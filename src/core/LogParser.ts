import * as fs from "fs/promises";
import { FSWatcher, watch } from "fs";
import { EventEmitter } from "events";

interface BaseEvent {
  timestamp: string;
  type: EventType;
}

export interface DeathEvent extends BaseEvent {
  type: "death";
  character: {
    name: string;
  };
  data: Record<string, never>; // empty object since death has no additional data
}

export interface LevelUpEvent extends BaseEvent {
  type: "level_up";
  character: {
    name: string;
    class: string;
    level: number;
  };
}

export interface IdentifyEvent extends BaseEvent {
  type: "identify";
  data: {
    itemCount: number;
  };
}

export interface AreaEvent extends BaseEvent {
  type: "area";
  area: {
    level: number;
    name: string;
    seed: number;
  };
}

export interface PassiveAllocatedEvent extends BaseEvent {
  type: "passive_allocated";
  data: {
    skillId: string;
    skillName: string;
  };
}

export interface AfkStatusEvent extends BaseEvent {
  type: "afk_status";
  data: {
    status: boolean;
    autoReply: string | null;
  };
}

export type GameEvent =
  | DeathEvent
  | LevelUpEvent
  | IdentifyEvent
  | AreaEvent
  | PassiveAllocatedEvent
  | AfkStatusEvent;

export type EventType =
  | "death"
  | "level_up"
  | "identify"
  | "area"
  | "passive_allocated"
  | "afk_status";

interface LogParserEvents {
  event: (event: GameEvent & { isStartupEvent: boolean }) => void;
  startupDone: () => void;
}

export declare interface LogParser {
  on<E extends keyof LogParserEvents>(
    event: E,
    listener: LogParserEvents[E]
  ): this;
  emit<E extends keyof LogParserEvents>(
    event: E,
    ...args: Parameters<LogParserEvents[E]>
  ): boolean;
}

/**
 * LogParser watches a Path of Exile Client.txt log file and parses it into structured game events.
 * It handles file watching, incremental parsing, and emits events when new game events are detected.
 *
 * Events include:
 * - Character deaths
 * - Level ups
 * - Area changes
 * - Item identification
 * - Passive skill allocation
 * - AFK status changes
 *
 * @emits event - Emitted when a new game event is parsed
 */
export class LogParser extends EventEmitter {
  private filePath: string;
  private lastPosition: number = 0;
  private watcher: FSWatcher | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL_MS = 5000; // Poll every 5 seconds
  private lastProcessTime: number = 0;
  private readonly THROTTLE_MS = 1000; // Throttle to 1 second

  constructor(filePath: string) {
    super();
    this.filePath = filePath;
  }

  async start() {
    try {
      // Get initial file stats first
      const stats = await fs.stat(this.filePath);

      // TODO: The initial file read might be so large that we can't read it all at some point.
      // Initial parse of existing content
      const content = await fs.readFile(this.filePath, "utf-8");
      const lines = content.split("\n");

      for (const line of lines) {
        if (line.trim()) {
          const event = this.parseLine(line);
          if (event) {
            this.emit("event", { ...event, isStartupEvent: true });
          }
        }
      }

      // Set the last position AFTER we've read all the content
      this.lastPosition = stats.size;

      this.emit("startupDone");

      // Start watching file
      this.watcher = watch(this.filePath, (eventType) => {
        if (eventType === "change") {
          this.processNewLines();
        }
      });

      // Start polling stat to trigger watcher
      this.pollInterval = setInterval(async () => {
        await fs.stat(this.filePath);
      }, this.POLL_INTERVAL_MS);

      console.log(
        `🔍 Watching for events in: ${this.filePath} (starting from byte ${this.lastPosition})`
      );
    } catch (error) {
      console.error("❌ Error starting log parser:", error);
    }
  }

  async stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  private async processNewLines() {
    try {
      const currentTime = Date.now();
      const stats = await fs.stat(this.filePath);
      const size = stats.size;
      let newBytes = size - this.lastPosition;

      console.log(
        `📊 File check - Current: ${size} bytes, Previous: ${this.lastPosition} bytes, Delta: ${newBytes} bytes`
      );

      // If we processed recently, skip
      if (currentTime - this.lastProcessTime < this.THROTTLE_MS) {
        console.log(`⏱️ Skipping process - too soon after last check`);
        return;
      }

      // Handle file truncation first
      if (size < this.lastPosition) {
        console.log(
          `⚠️ File size decreased from ${this.lastPosition} to ${size} - file may have been truncated`
        );
        this.lastPosition = 0;
        newBytes = size; // Reset newBytes to read the entire file
      }

      if (newBytes === 0) {
        console.log(
          `ℹ️ File changed but size remained the same (size: ${size})`
        );
        return;
      }

      const fileHandle = await fs.open(this.filePath, "r");

      try {
        const { buffer, bytesRead } = await fileHandle.read({
          buffer: Buffer.alloc(newBytes),
          position: this.lastPosition,
        });

        console.log(`📖 Read ${bytesRead} bytes from file`);

        const newContent = buffer.toString();
        const newLines = newContent.split("\n").filter((line) => line.trim());
        console.log(`📋 Processing ${newLines.length} new lines`);

        for (const line of newLines) {
          const event = this.parseLine(line);
          if (event) {
            this.emit("event", { ...event, isStartupEvent: false });
          }
        }

        this.lastPosition = size;
        this.lastProcessTime = currentTime;
      } finally {
        await fileHandle.close();
      }
    } catch (error) {
      console.error("❌ Error processing new lines:", error);
      console.error(error);
    }
  }

  private parseLine(line: string): GameEvent | null {
    const patterns: {
      regex: RegExp;
      function: (match: RegExpMatchArray) => GameEvent | null;
    }[] = [
      {
        // death event
        regex:
          /(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}).*\[INFO Client.*\] : (.*) has been slain\./,
        function: this.parseDeathEvent,
      },
      {
        // level up event
        regex:
          /(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}).*\[INFO Client.*\] : (.*) \((.*)\) is now level (\d+)/,
        function: this.parseLevelUpEvent,
      },
      // {
      //   // item identification event
      //   regex:
      //     /(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}).*\[INFO Client \d+\] : (\d+) Items? identified/,
      //   function: this.parseIdentifyEvent,
      // },
      {
        // area generation event
        regex:
          /(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}).*\[DEBUG Client \d+\] Generating level (\d+) area "([^"]+)" with seed (\d+)/,
        function: this.parseAreaEvent,
      },
      // {
      //   // passive skill allocation
      //   regex:
      //     /(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}).*\[INFO Client.*\] Successfully allocated passive skill id: ([^,]+), name: (.+)/,
      //   function: this.parsePassiveSkillEvent,
      // },
      // {
      //   // AFK status changes
      //   regex:
      //     /(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}).*\[INFO Client.*\] : AFK mode is now (ON|OFF)/,
      //   function: this.parseAfkStatusEvent,
      // },
      //   {
      //     // boss dialogue event
      //     regex: /(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}).*\[INFO Client \d+\] The Executioner:/,
      //     function: this.parseBossDialogueEvent,
      //   },
      //   {
      //     // npc trade dialogue event
      //     regex: /(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}).*\[INFO Client \d+\] Una:/,
      //     function: this.parseTradeDialogueEvent,
      //   },
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern.regex);
      if (match) {
        // console.log("🔄 Match:", match);
        return pattern.function(match);
      }
    }

    return null;
  }

  private parseLevelUpEvent(match: RegExpMatchArray): LevelUpEvent | null {
    return {
      timestamp: match[1],
      type: "level_up",
      character: {
        name: match[2],
        class: match[3],
        level: parseInt(match[4], 10),
      },
    };
  }

  private parseDeathEvent(match: RegExpMatchArray): DeathEvent | null {
    return {
      timestamp: match[1],
      type: "death",
      character: {
        name: match[2],
      },
      data: {},
    };
  }

  private parseAreaEvent(match: RegExpMatchArray): AreaEvent | null {
    return {
      timestamp: match[1],
      type: "area",
      area: {
        level: parseInt(match[2], 10),
        name: match[3],
        seed: parseInt(match[4], 10),
      },
    };
  }

  private parseIdentifyEvent(match: RegExpMatchArray): IdentifyEvent | null {
    return {
      timestamp: match[1],
      type: "identify",
      data: {
        itemCount: parseInt(match[2], 10),
      },
    };
  }

  private parsePassiveSkillEvent(
    match: RegExpMatchArray
  ): PassiveAllocatedEvent | null {
    return {
      timestamp: match[1],
      type: "passive_allocated",
      data: {
        skillId: match[2],
        skillName: match[3],
      },
    };
  }

  private parseAfkStatusEvent(match: RegExpMatchArray): AfkStatusEvent | null {
    return {
      timestamp: match[1],
      type: "afk_status",
      data: {
        status: match[2] === "ON",
        autoReply: match[2] === "ON" ? "This player is AFK." : null,
      },
    };
  }
}
