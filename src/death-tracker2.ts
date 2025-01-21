import { GameEvent, LogParser } from "./core/LogParser";
import { EventManager } from "./core/EventManager";
import { GlobalStats, StateManager } from "./core/StateManager";
// import { OutputManager } from "./core/OutputManager";
// import { TwitchAPI } from "./core/TwitchAPI";
import { TwitchAuthResult, TwitchCredentials } from "./core/TwitchAuth";
import { TwitchOutput } from "./core/TwitchOutput";
import { inspect } from "util";

interface Config {
  logPath: string;
  outputDir: string;
  twitch?: {
    enabled: boolean;
    credentials?: TwitchCredentials;
    auth?: TwitchAuthResult;
  };
}

export class DeathTracker2 {
  private logParser: LogParser;
  private eventManager: EventManager;
  private stateManager: StateManager;
  // private outputManager: OutputManager;
  private twitchOutput?: TwitchOutput;

  constructor(config: Config) {
    console.log("🚀 Initializing Death Tracker 2.0...");

    // Initialize components
    this.logParser = new LogParser(config.logPath);
    this.eventManager = new EventManager();
    this.stateManager = new StateManager(config.outputDir);
    this.stateManager.buildStateFromCache();
    // this.outputManager = new OutputManager(config.outputDir);

    // Initialize Twitch if enabled
    if (config.twitch?.enabled) {
      // this.twitchOutput = new TwitchOutput(config.twitch);
      console.log(
        "🎮 Twitch integration enabled - Stream markers will be created for deaths and level ups"
      );
    }

    // Setup event chain
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    // LogParser emits raw events
    this.logParser.on(
      "event",
      (rawEvent: GameEvent & { isStartupEvent: boolean }) => {
        console.log("🔄 Event:", rawEvent);

        // StateManager updates game state
        this.stateManager.handleEvent(rawEvent);

        // Twitch: Make stream markers
        if (this.twitchOutput) {
          this.twitchOutput.handleGameEvent(rawEvent);
        }
      }
    );

    this.logParser.on("startupDone", () => {
      console.log("🚀 Startup done");
      console.log(
        "Current State:",
        inspect(this.stateManager.getState(), {
          depth: null, // Show all nesting levels
          colors: true, // Enable colors
          maxArrayLength: null, // Show full arrays
          compact: false, // Pretty formatting
        })
      );
    });

    // 4. StateManager emits state updates
    this.stateManager.on("state-updated", async (newState: GlobalStats) => {
      console.log("📊 State updated");

      // 5. OutputManager generates files
      // const activeChar = this.stateManager.getActiveCharacter();
      // await this.outputManager.updateOutputs(newState, activeChar);
      // console.log("📄 Outputs updated");
    });
  }

  async start() {
    try {
      console.log("🚀 Starting Death Tracker...");
      await this.logParser.start();
    } catch (error) {
      console.error("❌ Error starting Death Tracker:", error);
    }
  }

  async stop() {
    await this.logParser.stop();
    console.log("👋 Death Tracker stopped");
  }
}
