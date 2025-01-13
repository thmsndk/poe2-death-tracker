import * as fs from "fs/promises";
import { existsSync, readFileSync } from "fs";
import { watch } from "fs";
import * as path from "path";

interface TimeStats {
  byHour: Record<number, number>;
  byDay: Record<number, number>;
  byMonth: Record<number, number>;
  byYear: Record<number, number>;
}

interface LevelInfo {
  timestamp: string;
  secondsTaken: number | null;
}

interface LevelingStats {
  timeToLevel: Record<number, LevelInfo>; // level -> {timestamp, secondsTaken}
  averageTimePerLevel: number | null;
  fastestLevel: { level: number; seconds: number | null };
  slowestLevel: { level: number; seconds: number };
  currentLevel: number;
  lastLevelUp: string | null;
}

interface CharacterInfo {
  class?: string;
  maxLevel: number;
  deaths: number;
  levelingStats?: LevelingStats;
  deathStats?: TimeStats;
  created?: string; // First seen timestamp
  lastSeen?: string; // Last event timestamp
}

interface DeathEvent {
  timestamp: string;
  character: string;
  class?: string;
}

interface LevelEvent {
  timestamp: string;
  character: string;
  class: string;
  level: number;
}

interface CharacterStats {
  totalDeaths: number;
  characters: Record<string, CharacterInfo>;
  globalDeathStats: TimeStats;
}

export interface DeathTrackerConfig {
  logPath?: string;
  outputDir?: string;
}

export class DeathTracker {
  private deathEvents: DeathEvent[] = [];
  private levelEvents: LevelEvent[] = [];
  private stats: CharacterStats;
  private outputDir: string;
  private statsFile: string;
  private logPath: string;
  private lastPosition: number = 0;

  constructor(config?: DeathTrackerConfig) {
    console.log("🚀 Initializing Death Tracker...");
    this.outputDir = config?.outputDir ?? "death-stats";
    this.logPath =
      config?.logPath ??
      "D:\\SteamLibrary\\steamapps\\common\\Path of Exile 2\\logs\\Client.txt";
    this.statsFile = `${this.outputDir}/stats.json`;
    this.stats = this.loadStats();
    this.populateDeathEventsFromStats();
    this.updateStats();
  }

  private loadStats(): CharacterStats {
    if (existsSync(this.statsFile)) {
      console.log("📊 Loading existing stats file");
      const data = JSON.parse(readFileSync(this.statsFile, "utf-8"));
      return data;
    }

    console.log("📊 No existing stats file found, performing initial scan");
    return {
      totalDeaths: 0,
      characters: {},
      globalDeathStats: this.initializeTimeStats(),
    };
  }

  private initializeTimeStats(): TimeStats {
    return {
      byHour: {},
      byDay: {},
      byMonth: {},
      byYear: {},
    };
  }

  private updateTimeStats(timestamp: string, stats: TimeStats): void {
    const date = new Date(timestamp.replace(" ", "T"));
    stats.byHour[date.getHours()] = (stats.byHour[date.getHours()] || 0) + 1;
    stats.byDay[date.getDate()] = (stats.byDay[date.getDate()] || 0) + 1;
    stats.byMonth[date.getMonth() + 1] =
      (stats.byMonth[date.getMonth() + 1] || 0) + 1;
    stats.byYear[date.getFullYear()] =
      (stats.byYear[date.getFullYear()] || 0) + 1;
  }

  private updateLevelingStats(character: string, newLevel: LevelEvent): void {
    const charInfo = this.stats.characters[character];
    if (!charInfo.levelingStats) {
      charInfo.levelingStats = {
        timeToLevel: {
          1: {
            timestamp: charInfo.created ?? newLevel.timestamp,
            secondsTaken: 0,
          },
        },
        averageTimePerLevel: null,
        fastestLevel: { level: 1, seconds: 0 },
        slowestLevel: { level: 1, seconds: 0 },
        currentLevel: newLevel.level,
        lastLevelUp: newLevel.timestamp,
      };
    }

    // For level 2 and above, calculate time from previous level
    if (newLevel.level > 1) {
      const prevLevel = newLevel.level - 1;
      const prevLevelInfo = charInfo.levelingStats.timeToLevel[prevLevel];

      if (prevLevelInfo) {
        // Convert YYYY/MM/DD HH:mm:ss to YYYY-MM-DDTHH:mm:ss
        const prevTimeStr = prevLevelInfo.timestamp.replace(
          /(\d{4})\/(\d{2})\/(\d{2}) /,
          "$1-$2-$3T"
        );
        const newTimeStr = newLevel.timestamp.replace(
          /(\d{4})\/(\d{2})\/(\d{2}) /,
          "$1-$2-$3T"
        );

        const prevTime = new Date(prevTimeStr);
        const newTime = new Date(newTimeStr);

        const secondsTaken = Math.floor(
          (newTime.getTime() - prevTime.getTime()) / 1000
        );

        console.log(
          `Debug: Level ${newLevel.level} took ${secondsTaken} seconds`
        ); // Debug log

        charInfo.levelingStats.timeToLevel[newLevel.level] = {
          timestamp: newLevel.timestamp,
          secondsTaken,
        };

        // Update fastest level (ignore level 1)
        if (
          charInfo.levelingStats.fastestLevel.level === 1 ||
          secondsTaken <
            (charInfo.levelingStats.fastestLevel.seconds ?? Infinity)
        ) {
          charInfo.levelingStats.fastestLevel = {
            level: newLevel.level,
            seconds: secondsTaken,
          };
        }

        // Update slowest level (ignore level 1)
        if (
          charInfo.levelingStats.slowestLevel.level === 1 ||
          secondsTaken > charInfo.levelingStats.slowestLevel.seconds
        ) {
          charInfo.levelingStats.slowestLevel = {
            level: newLevel.level,
            seconds: secondsTaken,
          };
        }

        // Update average (only counting levels 2 and above)
        const validTimes = Object.entries(charInfo.levelingStats.timeToLevel)
          .filter(
            ([level, info]) => parseInt(level) > 1 && info.secondsTaken !== null
          )
          .map(([_, info]) => info.secondsTaken as number);

        charInfo.levelingStats.averageTimePerLevel =
          validTimes.length > 0
            ? validTimes.reduce((sum, time) => sum + time, 0) /
              validTimes.length
            : null;
      }
    }

    charInfo.levelingStats.currentLevel = newLevel.level;
    charInfo.levelingStats.lastLevelUp = newLevel.timestamp;
  }

  private parseLevelEvent(line: string): LevelEvent | null {
    const match = line.match(
      /(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}).*\[INFO Client.*\] : (.*) \((.*)\) is now level (\d+)/
    );
    if (!match) return null;
    return {
      timestamp: match[1],
      character: match[2],
      class: match[3],
      level: parseInt(match[4], 10),
    };
  }

  private parseDeathEvent(line: string): DeathEvent | null {
    const match = line.match(
      /(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}).*\[INFO Client.*\] : (.*) has been slain\./
    );
    if (!match) return null;
    const character = match[2];
    return {
      timestamp: match[1],
      character,
      class: this.stats.characters[character]?.class,
    };
  }

  private async updateStats(
    newDeath?: DeathEvent,
    newLevel?: LevelEvent
  ): Promise<void> {
    await this.ensureOutputDir();

    if (newLevel) {
      const character = newLevel.character;
      if (!this.stats.characters[character]) {
        this.stats.characters[character] = {
          class: newLevel.class,
          maxLevel: newLevel.level,
          deaths: 0,
          created: newLevel.timestamp,
        };
      }

      this.stats.characters[character].class = newLevel.class;
      this.stats.characters[character].maxLevel = Math.max(
        this.stats.characters[character].maxLevel,
        newLevel.level
      );
      this.stats.characters[character].lastSeen = newLevel.timestamp;

      this.updateLevelingStats(character, newLevel);
      console.log(
        `📈 Level up - ${character} (${newLevel.class}) reached level ${newLevel.level}`
      );

      // Generate current character stats for the most recent character that leveled
      await this.generateCurrentCharacterStats(character);
      await this.saveStats();
    }

    if (newDeath) {
      const character = newDeath.character;
      if (!this.stats.characters[character]) {
        this.stats.characters[character] = {
          maxLevel: 1,
          deaths: 0,
          created: newDeath.timestamp,
          deathStats: this.initializeTimeStats(),
        };
      }

      this.stats.totalDeaths++;
      this.stats.characters[character].deaths++;
      this.stats.characters[character].lastSeen = newDeath.timestamp;

      // Update time-based stats
      if (!this.stats.characters[character].deathStats) {
        this.stats.characters[character].deathStats =
          this.initializeTimeStats();
      }
      this.updateTimeStats(
        newDeath.timestamp,
        this.stats.characters[character].deathStats!
      );
      this.updateTimeStats(newDeath.timestamp, this.stats.globalDeathStats);

      console.log(
        `💀 Death detected - ${character} ${
          this.stats.characters[character].class
            ? `(${this.stats.characters[character].class}) `
            : ""
        }(Total: ${this.stats.characters[character].deaths})`
      );
      await this.saveStats();
    }

    try {
      if (this.stats.totalDeaths > 0) {
        await fs.writeFile(
          path.join(this.outputDir, "total_deaths.txt"),
          `Total Deaths: ${this.stats.totalDeaths.toString()}`
        );

        // Write character stats JSON for overlay
        await fs.writeFile(
          path.join(this.outputDir, "character_stats.json"),
          JSON.stringify(this.stats.characters, null, 2)
        );

        // Update death logs with class information
        if (this.deathEvents.length > 0) {
          const recentDeaths = this.deathEvents
            .map((e) => {
              const charInfo = this.stats.characters[e.character];
              const classStr = charInfo?.class ? ` (${charInfo.class})` : "";
              const level = charInfo?.levelingStats?.currentLevel ?? "??";
              const totalStr =
                (charInfo?.deaths || 0) > 1
                  ? ` (Total: ${charInfo?.deaths})`
                  : "";
              return `${e.timestamp} - ${e.character}${classStr} Level ${level} died${totalStr}`;
            })
            .join("\n");
          await fs.writeFile(
            path.join(this.outputDir, "recent_deaths.txt"),
            recentDeaths
          );

          const lastFiveDeaths = this.deathEvents
            .slice(-5)
            .map((e) => {
              const charInfo = this.stats.characters[e.character];
              const classStr = charInfo?.class ? ` (${charInfo.class})` : "";
              const level = charInfo?.levelingStats?.currentLevel ?? "??";
              const totalStr =
                (charInfo?.deaths || 0) > 1
                  ? ` (Total: ${charInfo?.deaths})`
                  : "";
              return `${e.timestamp} - ${e.character}${classStr} Level ${level} died${totalStr}`;
            })
            .filter((line) => !line.includes("undefined"))
            .join("\n");

          if (lastFiveDeaths) {
            await fs.writeFile(
              path.join(this.outputDir, "last_five_deaths.txt"),
              lastFiveDeaths
            );
          }
        }

        console.log("📝 Updated all stat files");
      }
    } catch (error) {
      console.error("❌ Error updating stat files:", error);
    }
  }

  // Update the file processing in startTailing and initialScan to include level events
  private async processNewLines(lines: string[]): Promise<void> {
    for (const line of lines) {
      if (!line.trim()) continue;

      const deathEvent = this.parseDeathEvent(line);
      const levelEvent = this.parseLevelEvent(line);

      if (levelEvent) {
        this.levelEvents.push(levelEvent);
        await this.updateStats(undefined, levelEvent);
      }

      if (deathEvent) {
        const isDuplicate = this.deathEvents.some(
          (e) =>
            e.timestamp === deathEvent.timestamp &&
            e.character === deathEvent.character
        );

        if (!isDuplicate) {
          this.deathEvents.push(deathEvent);
          await this.updateStats(deathEvent);
        }
      }
    }
  }

  public async start(): Promise<void> {
    await fs.mkdir(this.outputDir, { recursive: true });

    if (!existsSync(this.statsFile)) {
      // Only do initial scan if no stats file exists
      const fileContent = await fs.readFile(this.logPath, "utf-8");
      await this.processNewLines(fileContent.split("\n"));
      await this.saveStats();
    }

    // Start tailing for new events
    await this.startTailing();
  }

  private async startTailing(): Promise<void> {
    const stat = await fs.stat(this.logPath);
    this.lastPosition = stat.size;
    console.log(`🔍 Initial file size: ${this.lastPosition} bytes`);

    // Add a timestamp to track last processing time
    let lastProcessTime = Date.now();

    const processFileChanges = async (source: string) => {
      try {
        const currentTime = Date.now();
        const stat = await fs.stat(this.logPath);
        const newBytes = stat.size - this.lastPosition;

        console.log(
          `📊 [${source}] File check - Current: ${stat.size} bytes, Previous: ${this.lastPosition} bytes, Delta: ${newBytes} bytes`
        );

        // If we processed recently (within last second), skip
        if (currentTime - lastProcessTime < 1000) {
          console.log(
            `⏱️ [${source}] Skipping process - too soon after last check`
          );
          return;
        }

        if (newBytes < 0) {
          console.log(
            `⚠️ [${source}] File size decreased - file may have been truncated`
          );
          this.lastPosition = stat.size;
          return;
        }

        if (newBytes === 0) {
          console.log(`ℹ️ [${source}] File changed but size remained the same`);
          return;
        }

        const handle = await fs.open(this.logPath, "r");
        const { buffer, bytesRead } = await handle.read({
          buffer: Buffer.alloc(newBytes),
          position: this.lastPosition,
        });
        await handle.close();

        console.log(`📖 [${source}] Read ${bytesRead} bytes from file`);

        const newContent = buffer.toString();
        const newLines = newContent.split("\n").filter((line) => line.trim());
        console.log(`📋 [${source}] Processing ${newLines.length} new lines`);

        await this.processNewLines(newLines);
        this.lastPosition = stat.size;
        lastProcessTime = currentTime;
      } catch (error) {
        console.error(`❌ [${source}] Error processing changes:`, error);
        console.error(error);
      }
    };

    // File watcher
    watch(this.logPath, async (eventType, filename) => {
      console.log(
        `📝 [Watcher] File event '${eventType}' detected on ${filename}`
      );
      if (eventType === "change") {
        await processFileChanges("Watcher");
      } else {
        console.log(`⚠️ [Watcher] Unexpected file event: ${eventType}`);
      }
    });

    console.log(`\n💡 Watching for events in: ${this.logPath}`);
    console.log(`💡 Stats are being saved to: ${this.outputDir}\n`);

    // File poking interval (every 1 second)
    setInterval(async () => {
      // Just access the file to trigger the watcher
      try {
        await fs.stat(this.logPath);
      } catch (error) {
        console.error(`❌ [Poke] Error accessing file:`, error);
      }
    }, 1000);
  }

  private async ensureOutputDir(): Promise<void> {
    await fs.mkdir(this.outputDir, { recursive: true });
  }

  private async saveStats(): Promise<void> {
    await this.ensureOutputDir();
    await fs.writeFile(this.statsFile, JSON.stringify(this.stats, null, 2));
  }

  private async generateCurrentCharacterStats(
    character: string
  ): Promise<void> {
    const charInfo = this.stats.characters[character];
    const levelStats = charInfo.levelingStats;
    const sessionTime = this.getSessionTime(charInfo);
    const levelsPerHour = (
      ((levelStats?.currentLevel ?? 0) * 3600) /
      sessionTime
    ).toFixed(1);

    // Save full JSON stats
    await fs.writeFile(
      path.join(this.outputDir, "current_character.json"),
      JSON.stringify(
        {
          character,
          class: charInfo.class,
          currentLevel: levelStats?.currentLevel ?? 0,
          deaths: charInfo.deaths,
          created: charInfo.created,
          lastSeen: charInfo.lastSeen,
          levelingStats: charInfo.levelingStats,
        },
        null,
        2
      )
    );

    if (levelStats?.timeToLevel) {
      // Recent levels - horizontal format
      const recentLevelsHorizontal = Object.entries(levelStats.timeToLevel)
        .slice(-5)
        .map(
          ([level, info]) =>
            `L${level}: ${info.timestamp.split(" ")[1]} (${
              info.secondsTaken
                ? this.formatShortDuration(info.secondsTaken)
                : "N/A"
            })`
        )
        .join(" ➡️ ");
      await fs.writeFile(
        path.join(this.outputDir, "current_character_recent_levels.txt"),
        `🎯 Recent Levels: ${recentLevelsHorizontal}`
      );

      // All levels compact view
      const allLevels = Object.entries(levelStats.timeToLevel)
        .map(
          ([level, info]) =>
            `L${level}: ${this.formatShortDuration(info.secondsTaken ?? 0)}`
        )
        .join(" | ");
      await fs.writeFile(
        path.join(this.outputDir, "current_character_all_levels.txt"),
        `📈 Level History: ${allLevels}`
      );

      // Add new vertical all levels view
      const allLevelsVertical = Object.entries(levelStats.timeToLevel)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(
          ([level, info]) =>
            `🕒 ${
              info.timestamp.split(" ")[1]
            }  |  📊 Level ${level}  |  ⏱️ ${this.formatShortDuration(
              info.secondsTaken ?? 0
            )}`
        )
        .join("\n");
      await fs.writeFile(
        path.join(this.outputDir, "current_character_all_levels_vertical.txt"),
        `📈 Level History:\n\n${allLevelsVertical}`
      );

      // Records and averages
      const records = [
        `⚡ Fastest: L${
          levelStats.fastestLevel.level
        } (${this.formatShortDuration(levelStats.fastestLevel.seconds ?? 0)})`,
        `🐌 Slowest: L${
          levelStats.slowestLevel.level
        } (${this.formatShortDuration(levelStats.slowestLevel.seconds ?? 0)})`,
        `⌚ Average: ${this.formatShortDuration(
          levelStats.averageTimePerLevel ?? 0
        )}`,
        `🏃 Pace: ${levelsPerHour} lvl/hr`,
      ].join(" | ");
      await fs.writeFile(
        path.join(this.outputDir, "current_character_records.txt"),
        records
      );

      // Session stats
      const sessionStats = [
        `🕒 Session Length: ${this.formatShortDuration(sessionTime)}`,
        `📊 Levels Gained: ${levelStats.currentLevel}`,
        `💀 Deaths: ${charInfo.deaths}`,
        `🎮 Started: ${charInfo.created?.split(" ")[1]}`,
      ].join(" | ");
      await fs.writeFile(
        path.join(this.outputDir, "current_character_session.txt"),
        sessionStats
      );

      // Basic formats 1-4
      const basicFormat1 = `${character} (${charInfo.class}) | Level ${
        levelStats.currentLevel
      } | Deaths: ${charInfo.deaths} | Last Level: ${this.formatShortDuration(
        levelStats.timeToLevel[levelStats.currentLevel]?.secondsTaken ?? 0
      )} | Avg: ${this.formatShortDuration(
        levelStats.averageTimePerLevel ?? 0
      )}`;

      // For Format 2, we need to exclude level 1 from fastest time consideration
      const validTimes = Object.entries(levelStats.timeToLevel)
        .filter(
          ([level, info]) =>
            parseInt(level) > 1 && // Exclude level 1
            info.secondsTaken !== null && // Ensure secondsTaken exists
            info.secondsTaken !== undefined && // Extra safety check
            info.secondsTaken > 0 // Only include positive times
        )
        .map(([_, info]) => info.secondsTaken as number);

      const fastestTime =
        validTimes.length > 0 ? Math.min(...validTimes) : null;
      const slowestTime =
        validTimes.length > 0 ? Math.max(...validTimes) : null;

      const basicFormat2 = [
        `${character} (${charInfo.class}) | Level ${levelStats.currentLevel} | Deaths: ${charInfo.deaths}`,
        `⚡ Fast: ${this.formatShortDuration(
          fastestTime
        )} | 🐌 Slow: ${this.formatShortDuration(
          slowestTime
        )} | ⌚ Avg: ${this.formatShortDuration(
          levelStats.averageTimePerLevel ?? 0
        )}`,
      ].join("\n");

      const basicFormat3 = `${character} (L${levelStats.currentLevel} ${
        charInfo.class
      }) | Recent: ${Object.entries(levelStats.timeToLevel)
        .slice(-3)
        .map(
          ([level, info]) =>
            `L${level}: ${this.formatShortDuration(info.secondsTaken ?? 0)}`
        )
        .join(" → ")} | Avg: ${this.formatShortDuration(
        levelStats.averageTimePerLevel ?? 0
      )}`;

      const basicFormat4 = [
        `👤 ${character} (${charInfo.class}) | 📊 Level ${
          levelStats.currentLevel
        } | ⏱️ Session: ${this.formatShortDuration(sessionTime)}`,
        `⚡ ${levelsPerHour} lvl/hr | 🏃 Best: ${this.formatShortDuration(
          fastestTime
        )} | ⌚ Avg: ${this.formatShortDuration(
          levelStats.averageTimePerLevel ?? 0
        )} | 💀 Deaths: ${charInfo.deaths}`,
      ].join("\n");

      // Last 5 levels - vertical format with improved alignment
      const recentLevelsVertical = Object.entries(levelStats.timeToLevel)
        .slice(-5)
        .reverse()
        .map(
          ([level, info]) =>
            `🕒 ${
              info.timestamp.split(" ")[1]
            }  |  📊 Level ${level}  |  ⏱️ ${this.formatShortDuration(
              info.secondsTaken ?? 0
            )}`
        )
        .join("\n");

      // Save all formats
      await fs.writeFile(
        path.join(this.outputDir, "current_character_basic1.txt"),
        basicFormat1
      );
      await fs.writeFile(
        path.join(this.outputDir, "current_character_basic2.txt"),
        basicFormat2
      );
      await fs.writeFile(
        path.join(this.outputDir, "current_character_basic3.txt"),
        basicFormat3
      );
      await fs.writeFile(
        path.join(this.outputDir, "current_character_basic4.txt"),
        basicFormat4
      );
      await fs.writeFile(
        path.join(
          this.outputDir,
          "current_character_recent_levels_vertical.txt"
        ),
        `🎯 Recent Level Progress:\n\n${recentLevelsVertical}`
      );
    }
  }

  private getSessionTime(charInfo: CharacterInfo): number {
    if (!charInfo.created) return 0;
    const start = new Date(charInfo.created);
    const end = charInfo.lastSeen ? new Date(charInfo.lastSeen) : new Date();
    return Math.floor((end.getTime() - start.getTime()) / 1000);
  }

  private formatShortDuration(seconds: number | null): string {
    if (seconds === null || seconds === undefined) return "N/A";
    if (seconds === 0) return "0s"; // Changed to explicitly show 0s instead of N/A
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }

  private populateDeathEventsFromStats(): void {
    // Reconstruct death events from character stats
    for (const [character, info] of Object.entries(this.stats.characters)) {
      if (info.lastSeen && info.deaths > 0) {
        // Add at least the last known death
        this.deathEvents.push({
          timestamp: info.lastSeen,
          character,
          class: info.class,
        });
      }
    }
    // Sort events by timestamp to maintain chronological order
    this.deathEvents.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }
}
