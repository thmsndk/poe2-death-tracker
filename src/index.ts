#!/usr/bin/env node

import { Command } from "commander";
import { DeathTracker } from "./death-tracker";

const program = new Command();

program
  .name("poe2-death-tracker")
  .description("Death and leveling tracker for Path of Exile 2")
  .option(
    "-p, --path <path>",
    "Path to Client.txt file",
    "D:\\SteamLibrary\\steamapps\\common\\Path of Exile 2\\logs\\Client.txt"
  )
  .option("-o, --output <dir>", "Output directory for stats", "death-stats")
  .parse();

const options = program.opts();

// Start the tracker
const tracker = new DeathTracker({
  logPath: options.path,
  outputDir: options.output,
});

tracker.start().catch(console.error);
