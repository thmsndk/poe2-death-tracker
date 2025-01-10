#!/usr/bin/env node

import { Command } from "commander";
import { DeathTracker } from "./death-tracker";
import { POE2InstallationFinder } from "./poe2-installation-finder";
import inquirer from "inquirer";
import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";

interface Config {
  logPath: string;
  outputDir: string;
}

const CONFIG_DIR = "config";
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

const program = new Command();

program
  .name("poe2-death-tracker")
  .description("Death and leveling tracker for Path of Exile 2")
  .option("-p, --path <path>", "Path to Client.txt file")
  .option("-o, --output <dir>", "Output directory for stats")
  .option("--reset-config", "Reset configuration and prompt for new paths")
  .parse();

async function loadConfig(): Promise<Config | null> {
  try {
    if (existsSync(CONFIG_FILE)) {
      const data = await fs.readFile(CONFIG_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.log("⚠️ Error reading config file");
  }
  return null;
}

async function saveConfig(config: Config): Promise<void> {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
    console.log("✅ Configuration saved");
  } catch (error) {
    console.log("⚠️ Error saving config file");
  }
}

async function setupConfig(): Promise<Config> {
  const installationFinder = new POE2InstallationFinder();
  const { logPath: detectedPath, installType } =
    installationFinder.findInstallation();

  if (detectedPath) {
    console.log(`🎮 Found ${installType} installation!`);
    console.log(`📂 Location: ${detectedPath}`);
  } else {
    console.log("⚠️ No installation detected automatically");
  }

  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "logPath",
      message: "Path to Path of Exile 2 Client.txt file:",
      default: detectedPath || "Please enter the path manually",
      validate: async (input: string) => {
        if (input === "Please enter the path manually") {
          return "Please enter a valid path";
        }
        try {
          await fs.access(input);
          return true;
        } catch {
          return "File not found. Please enter a valid path.";
        }
      },
    },
    {
      type: "input",
      name: "outputDir",
      message: "Directory for stats files:",
      default: () => path.resolve("death-stats"),
      async validate(input: string) {
        try {
          await fs.mkdir(path.resolve(input), { recursive: true });
          return true;
        } catch {
          return "Unable to create directory. Please check permissions.";
        }
      },
      filter(input: string) {
        return input.trim();
      },
    },
  ]);

  return answers;
}

async function main() {
  const options = program.opts();

  // Command line arguments take precedence
  if (options.path && options.output) {
    const tracker = new DeathTracker({
      logPath: options.path,
      outputDir: options.output,
    });
    await tracker.start();
    return;
  }

  // Load or create config
  let config = await loadConfig();

  // If no config exists or reset is requested, run setup
  if (!config || options.resetConfig) {
    config = await setupConfig();
    await saveConfig(config);
  }

  const outputDir = path.resolve(config.outputDir);
  console.log(`📊 Stats will be saved to: ${outputDir}`);
  console.log(
    `💡 Tip: Use this path in OBS Text Source's "Read from file" setting`
  );

  const tracker = new DeathTracker(config);
  await tracker.start();
}

main().catch(console.error);
