import * as fs from "fs/promises";
import * as path from "path";
import { GameDataService } from "../services/gameDataService";
import {
  CharacterInstance,
  DeathStats,
  GameState,
  GlobalStats,
} from "./StateManager";

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
  private gameDataService: GameDataService;

  constructor(outputDir: string, gameDataService: GameDataService) {
    this.outputDir = outputDir + "/2";
    this.gameDataService = gameDataService;
  }

  async updateOutputs(state: GameState) {
    await this.ensureOutputDir();
    await this.writeGlobalStats(state.stats);
    await this.writeRecentDeaths(state.stats.deaths.recent);

    // if (activeCharacter) {
    //   await this.writeCharacterStats(activeCharacter);
    //   await this.writeLevelingStats(activeCharacter);
    //   await this.writeSessionStats(activeCharacter);
    // }
  }

  private async writeGlobalStats(stats: GlobalStats) {
    await this.writeFile(
      "total_deaths.txt",
      `💀 Total Deaths: ${stats.deaths.total}`
    );
  }

  private async writeRecentDeaths(deaths: DeathStats["recent"]) {
    if (!deaths?.length) return;

    const formattedDeaths = deaths.slice(-5).map((e) => {
      const classStr = e.class ? `${e.class}` : "Unknown";
      const level = e.level ? `${e.level}` : "??";

      let areaStr = "";
      if (e.area) {
        const areaMatch = this.gameDataService.findExactWorldArea(e.area.name);
        areaStr = areaMatch.length > 0 ? areaMatch[0].item.Name : e.area.name;
      }

      return `${e.timestamp} | ${level} ${e.name} (${classStr}) | ${areaStr}`;
    });

    if (formattedDeaths.length) {
      // Write descending (most recent first)
      await this.writeFile(
        "last_five_deaths_desc.txt",
        [...formattedDeaths].reverse().join("\n")
      );

      // Write ascending (oldest first)
      await this.writeFile(
        "last_five_deaths_asc.txt",
        formattedDeaths.join("\n")
      );
    }
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
