import * as fs from "fs/promises";
import * as path from "path";
import { GlobalStats, CharacterStats } from "../types";

/**
 * OutputManager handles writing game statistics to files for streaming overlays.
 * It formats and writes various statistics including:
 * - Current character information
 * - Leveling progress
 * - Death counts
 * - Session statistics
 *
 * Files are written to a configured output directory and are formatted
 * for easy consumption by OBS or other streaming software.
 */
export class OutputManager {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir + "/2";
  }

  async updateOutputs(
    stats: GlobalStats,
    activeCharacter: CharacterStats | null
  ) {
    await this.ensureOutputDir();

    // Global stats
    await this.writeFile(
      "total_deaths.txt",
      `💀 Total Deaths: ${stats.totalDeaths}`
    );

    if (activeCharacter) {
      await this.writeCharacterStats(activeCharacter);
      await this.writeLevelingStats(activeCharacter);
      await this.writeSessionStats(activeCharacter);
    }
  }

  private async writeCharacterStats(character: CharacterStats) {
    const basic = [
      `👤 ${character.class}`,
      `📊 Level ${character.maxLevel}`,
      `💀 Deaths: ${character.deaths}`,
    ].join(" | ");

    await this.writeFile("current_character.txt", basic);
  }

  private async writeLevelingStats(character: CharacterStats) {
    if (!character.levelingStats) return;

    const stats = character.levelingStats;
    const levelHistory = Object.entries(stats.timeToLevel)
      .slice(-5)
      .map(
        ([level, info]) =>
          `L${level}: ${this.formatDuration(info.secondsTaken)}`
      )
      .join(" ➡️ ");

    await this.writeFile("current_character_levels.txt", levelHistory);
  }

  private async writeSessionStats(character: CharacterStats) {
    const sessionStats = [
      `🎮 Session Stats`,
      `⏱️ Started: ${character.created}`,
      `📊 Current Level: ${character.levelingStats?.currentLevel}`,
      `💀 Deaths: ${character.deaths}`,
    ].join("\n");

    await this.writeFile("current_session.txt", sessionStats);
  }

  private async writeFile(filename: string, content: string) {
    await fs.writeFile(path.join(this.outputDir, filename), content, "utf-8");
  }

  private async ensureOutputDir() {
    await fs.mkdir(this.outputDir, { recursive: true });
  }

  private formatDuration(seconds: number | null): string {
    if (!seconds) return "N/A";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m${remainingSeconds}s`;
  }
}
