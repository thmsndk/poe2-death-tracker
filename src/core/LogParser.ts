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
  private readonly POLL_INTERVAL_MS = 1000; // Poll every second
  private lastProcessTime: number = 0;
  private readonly THROTTLE_MS = 1000; // Throttle to 1 second

  constructor(filePath: string) {
    super();
    this.filePath = filePath;
  }

  async start() {
    try {
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

      this.emit("startupDone");

      // Get initial file size and start watching
      const stats = await fs.stat(this.filePath);
      this.lastPosition = stats.size;

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

      console.log(`🔍 Watching for events in: ${this.filePath}`);
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
      const fileHandle = await fs.open(this.filePath, "r");
      const { size } = await fs.stat(this.filePath);

      if (size < this.lastPosition) {
        // File was truncated/reset
        this.lastPosition = 0;
      }

      if (size > this.lastPosition) {
        const buffer = Buffer.alloc(size - this.lastPosition);
        await fileHandle.read(buffer, 0, buffer.length, this.lastPosition);
        this.lastPosition = size;

        const newLines = buffer.toString().split("\n");
        for (const line of newLines) {
          if (line.trim()) {
            const event = this.parseLine(line);
            if (event) {
              this.emit("event", { ...event, isStartupEvent: false });
            }
          }
        }
      }

      await fileHandle.close();
    } catch (error) {
      console.error("❌ Error processing new lines:", error);
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
        console.log("🔄 Match:", match);
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
