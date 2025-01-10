import { existsSync } from "fs";
import { readFileSync } from "fs";
import path from "path";
import * as VDF from "vdf-parser";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface GameInstallation {
  logPath: string | null;
  installPath: string | null;
  installType: "steam" | "standalone" | null;
  locationDescription: string | null;
}

interface SteamLibraryFolders {
  libraryfolders: {
    [key: string]: {
      path: string;
      [key: string]: unknown;
    };
  };
}

export class POE2InstallationFinder {
  private steamPaths = [
    // Default Steam paths
    "C:\\Program Files (x86)\\Steam",
    "C:\\Program Files\\Steam",
    // Linux Steam paths
    "~/.steam/steam",
    "~/.local/share/Steam",
  ];

  private standalonePaths = [
    "C:\\Program Files (x86)\\Grinding Gear Games\\Path of Exile 2",
    "C:\\Program Files\\Grinding Gear Games\\Path of Exile 2",
  ];

  async findInstallation() {
    // Try Windows Registry first for Steam path
    const steamPath = await this.findSteamPathFromRegistry();
    if (steamPath) {
      this.steamPaths.unshift(steamPath); // Add registry path as highest priority
    }

    // Check all Steam installations
    for (const basePath of this.steamPaths) {
      const steamPath = this.expandPath(basePath);
      const libraryFolders = await this.getSteamLibraryFolders(steamPath);

      for (const libraryPath of libraryFolders) {
        const gamePath = path.join(
          libraryPath,
          "steamapps",
          "common",
          "Path of Exile 2"
        );
        const logPath = path.join(gamePath, "logs", "Client.txt");

        if (existsSync(logPath)) {
          return {
            logPath,
            installPath: gamePath,
            installType: "steam",
            locationDescription: this.getLocationDescription(logPath),
          };
        }
      }
    }

    // Check standalone paths
    for (const basePath of this.standalonePaths) {
      const gamePath = this.expandPath(basePath);
      const logPath = path.join(gamePath, "logs", "Client.txt");

      if (existsSync(logPath)) {
        return {
          logPath,
          installPath: gamePath,
          installType: "standalone",
          locationDescription: this.getLocationDescription(logPath),
        };
      }
    }

    return {
      logPath: null,
      installPath: null,
      installType: null,
      locationDescription: null,
    };
  }

  private async findSteamPathFromRegistry(): Promise<string | null> {
    if (process.platform !== "win32") return null;

    try {
      const { stdout } = await execAsync(
        'reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Valve\\Steam" /v "InstallPath"'
      );

      const match = stdout.match(/InstallPath\s+REG_SZ\s+([^\r\n]+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  private async getSteamLibraryFolders(steamPath: string): Promise<string[]> {
    const libraryFoldersPath = path.join(
      steamPath,
      "steamapps",
      "libraryfolders.vdf"
    );

    if (!existsSync(libraryFoldersPath)) {
      return [steamPath];
    }

    try {
      const vdfContent = readFileSync(libraryFoldersPath, "utf-8");
      const parsed = VDF.parse(vdfContent) as SteamLibraryFolders;
      const libraries: string[] = [steamPath];

      if (parsed.libraryfolders) {
        Object.values(parsed.libraryfolders).forEach((library) => {
          if (library?.path) {
            libraries.push(library.path);
          }
        });
      }

      return libraries;
    } catch (error) {
      console.log("⚠️ Error parsing Steam library folders");
      return [steamPath];
    }
  }

  private getLocationDescription(p: string): string {
    // Convert Windows drive letters to more readable format
    if (process.platform === "win32") {
      const drive = p.substring(0, 2);
      const rest = p.substring(2);
      const driveDescription =
        drive === "C:"
          ? "System Drive (C:)"
          : drive === "D:"
          ? "Secondary Drive (D:)"
          : `Drive ${drive}`;
      return `${driveDescription}${rest}`;
    }

    // For Linux/Mac, make home directory more readable
    if (p.startsWith(process.env.HOME || "")) {
      return p.replace(process.env.HOME || "", "~/");
    }

    return p;
  }

  private expandPath(p: string): string {
    if (p.startsWith("~")) {
      return path.join(
        process.env.HOME || process.env.USERPROFILE || "",
        p.slice(1)
      );
    }
    return p;
  }
}
