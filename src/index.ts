#!/usr/bin/env node

import { Command } from "commander";
import { DeathTracker } from "./death-tracker";
import { DeathTracker2 } from "./death-tracker2";
import { POE2InstallationFinder } from "./poe2-installation-finder";
import inquirer from "inquirer";
import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import {
  TwitchAuth,
  TwitchAuthResult,
  TwitchCredentials,
  AuthFlow,
} from "./core/TwitchAuth";

interface Config {
  logPath: string;
  outputDir: string;
  twitch?: {
    enabled: boolean;
    credentials?: TwitchCredentials;
    auth?: TwitchAuthResult;
  };
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
  .option("--test-twitch", "Test Twitch authentication flow")
  .option("--v2", "Use DeathTracker2 implementation")
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
    await installationFinder.findInstallation();

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

  const twitchConfig = await setupTwitchConfig();

  const config: Config = {
    logPath: answers.logPath,
    outputDir: answers.outputDir,
    twitch: twitchConfig,
  };

  return config;
}

async function setupTwitchConfig(): Promise<Config["twitch"]> {
  const enableTwitch = await inquirer.prompt([
    {
      type: "confirm",
      name: "enabled",
      message:
        "Would you like to enable Twitch integration for stream markers?",
      default: true,
    },
  ]);

  if (!enableTwitch.enabled) {
    return { enabled: false };
  }

  // Show setup instructions
  TwitchAuth.showSetupInstructions();

  const credentialsPrompt = await inquirer.prompt([
    {
      type: "input",
      name: "clientId",
      message: "Enter your Twitch Client ID:",
      validate: (input) => input.length > 0 || "Client ID is required",
    },
    {
      type: "password",
      name: "clientSecret",
      message:
        "Enter your Twitch Client Secret (optional, enables token refresh):",
      mask: "*",
    },
  ]);

  const credentials: TwitchCredentials = {
    clientId: credentialsPrompt.clientId,
    ...(credentialsPrompt.clientSecret && {
      clientSecret: credentialsPrompt.clientSecret,
    }),
  };

  try {
    console.log("🎮 Starting Twitch authentication...");
    console.log("📝 A browser window will open for you to authorize the app");

    const auth = await TwitchAuth.startAuthFlow(
      credentials,
      credentials.clientSecret ? AuthFlow.AuthCode : AuthFlow.Implicit
    );

    console.log("✅ Twitch authentication successful!");
    if (auth.refreshToken) {
      console.log("🔄 Token refresh is enabled!");
    } else {
      console.log(
        "⚠️ Token will expire in 1 hour. Provide a Client Secret to enable auto-refresh."
      );
    }

    return {
      enabled: true,
      credentials,
      auth,
    };
  } catch (error) {
    console.error("❌ Twitch authentication failed:", error);
    return { enabled: false };
  }
}

async function main() {
  const options = program.opts();
  console.log("🔍 Debug: Using tracker version:", options.v2 ? "v2" : "v1");

  if (options.testTwitch) {
    try {
      console.log("🎮 Testing Twitch authentication...");

      // Show setup instructions
      TwitchAuth.showSetupInstructions();

      const credentialsPrompt = await inquirer.prompt([
        {
          type: "input",
          name: "clientId",
          message: "Enter your Twitch Client ID:",
          validate: (input) => input.length > 0 || "Client ID is required",
        },
        {
          type: "password",
          name: "clientSecret",
          message:
            "Enter your Twitch Client Secret (optional, enables token refresh):",
          mask: "*",
        },
      ]);

      const credentials: TwitchCredentials = {
        clientId: credentialsPrompt.clientId,
        ...(credentialsPrompt.clientSecret && {
          clientSecret: credentialsPrompt.clientSecret,
        }),
      };

      console.log("📝 A browser window will open for you to authorize the app");
      const auth = await TwitchAuth.startAuthFlow(
        credentials,
        credentials.clientSecret ? AuthFlow.AuthCode : AuthFlow.Implicit
      );

      console.log("\n✅ Authentication successful!");
      console.log("\nToken info:");
      console.log(
        `🕒 Obtained at: ${new Date(auth.obtainedAt).toLocaleString()}`
      );
      console.log(`⏳ Expires in: ${auth.expiresIn} seconds`);
      console.log(`🔄 Refresh enabled: ${auth.refreshToken ? "Yes" : "No"}`);

      if (auth.refreshToken && credentials.clientSecret) {
        console.log("\n🔄 Testing token refresh...");
        const refreshed = await TwitchAuth.refreshToken(
          credentials,
          auth.refreshToken
        );
        console.log("✅ Token refresh successful!");
        console.log(
          `🕒 New token obtained at: ${new Date(
            refreshed.obtainedAt
          ).toLocaleString()}`
        );
      }
    } catch (error) {
      console.error("❌ Authentication failed:", error);
    }
    return;
  }

  // Command line arguments take precedence
  if (options.path && options.output) {
    const TrackerClass = options.v2 ? DeathTracker2 : DeathTracker;
    const tracker = new TrackerClass({
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

  const TrackerClass = options.v2 ? DeathTracker2 : DeathTracker;
  console.log(
    "🚀 Starting tracker:",
    options.v2 ? "DeathTracker2" : "DeathTracker"
  );
  const tracker = new TrackerClass(config);
  await tracker.start();
}

main().catch(console.error);
