import { existsSync } from "fs";
import path from "path";

interface GameInstallation {
  logPath: string | null;
  installPath: string | null;
  installType: "steam" | "standalone" | null;
}

export class POE2InstallationFinder {
  private steamPaths = [
    // Steam default paths
    "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Path of Exile 2",
    "C:\\Program Files\\Steam\\steamapps\\common\\Path of Exile 2",
    "D:\\SteamLibrary\\steamapps\\common\\Path of Exile 2",
    // Linux Steam paths
    "~/.steam/steam/steamapps/common/Path of Exile 2",
    "~/.local/share/Steam/steamapps/common/Path of Exile 2",
  ];

  private standalonePaths = [
    // Windows default GGG paths
    "C:\\Program Files (x86)\\Grinding Gear Games\\Path of Exile 2",
    "C:\\Program Files\\Grinding Gear Games\\Path of Exile 2",
    // Linux GGG paths (if they support it)
    "~/.local/share/Path of Exile 2",
  ];

  private additionalSteamLibraries: string[] = [];

  constructor() {
    this.loadAdditionalSteamLibraries();
  }

  private loadAdditionalSteamLibraries(): void {
    // Try to read Steam's libraryfolders.vdf to find additional Steam libraries
    const steamConfigPaths = [
      "C:\\Program Files (x86)\\Steam\\steamapps\\libraryfolders.vdf",
      "C:\\Program Files\\Steam\\steamapps\\libraryfolders.vdf",
      "~/.steam/steam/steamapps/libraryfolders.vdf",
    ];

    // TODO: Parse libraryfolders.vdf to find additional Steam libraries
    // This would require implementing a simple VDF parser
    // For now, we'll just check common paths
  }

  public findInstallation(): GameInstallation {
    // Check Steam paths first
    for (const basePath of [
      ...this.steamPaths,
      ...this.additionalSteamLibraries,
    ]) {
      const gamePath = this.expandPath(basePath);
      const logPath = path.join(gamePath, "logs", "Client.txt");

      if (existsSync(logPath)) {
        return {
          logPath,
          installPath: gamePath,
          installType: "steam",
        };
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
        };
      }
    }

    return {
      logPath: null,
      installPath: null,
      installType: null,
    };
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
