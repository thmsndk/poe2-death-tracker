import { EventEmitter } from "events";
import { GameEvent } from "./LogParser";
// export interface TimeStats {
//   byHour: Record<number, number>;
//   byDay: Record<number, number>;
//   byMonth: Record<number, number>;
//   byYear: Record<number, number>;
// }

export interface LevelInfo {
  timestamp: string;
  secondsTaken: number | null;
}

export interface LevelingStats {
  timeToLevel: Record<number, LevelInfo>;
  averageTimePerLevel: number | null;
  fastestLevel: { level: number; seconds: number | null };
  slowestLevel: { level: number; seconds: number };
  currentLevel: number;
  lastLevelUp: string | null;
}

export interface LeagueStatus {
  current: "hardcore" | "standard";
  hardcoreUntil?: string;
}

export interface CharacterInstance {
  id: string;
  name: string;
  class: string;
  league: LeagueStatus;
  maxLevel: number;
  deaths: number;
  created: string;
  lastSeen: string;
  levelingStats: LevelingStats;
  // timeStats: TimeStats;
}

export interface GlobalStats {
  characters: Record<string, CharacterInstance[]>;
  deaths: {
    total: number;
  };
  // deathStats: TimeStats;
}

/**
 * StateManager maintains the global application state and character statistics.
 * It processes enriched game events to update:
 * - Character progression
 * - Death statistics
 * - Leveling times
 * - Session information
 * - League status
 *
 * It also tracks the currently active character and session,
 * providing access to current game state for the UI and outputs.
 *
 * @emits state-updated - Emitted when the global state has been modified
 */
export class StateManager extends EventEmitter {
  private stats: GlobalStats;
  private activeCharacter: string | null = null;
  private activeSession: string | null = null;

  constructor(outputDir: string) {
    super();
    this.stats = {
      characters: {},
      deaths: {
        total: 0,
      },
    };
  }

  buildStateFromCache() {
    // TODO: load all events from cache and calculate the global stats (total deaths)
    // TODO: We need to load the currently active character from cache, based on the latest parsed event
  }

  handleEvent(event: GameEvent & { isStartupEvent: boolean }): void {
    // TODO: What do we do about startup events? it kinda depends if we have cached that specific event already, because then buildStateFromCache would have handled it
    // TODO: If we are suddenly lower level, this means it's a new character instance
    // // Update active character/session
    // this.updateActiveState(event);
    // // Update stats based on event type
    switch (event.type) {
      case "death":
        this.handleDeath(event);
        break;
      // case "level_up":
      //   this.handleLevelUp(event);
      //   break;
      // case "area":
      //   this.handleAreaChange(event);
      //   break;
      // case "identify":
      //   this.handleIdentify(event);
      //   break;
    }
    // Emit state changes
    // this.emit("state-updated", this.getState());
  }

  private handleDeath(event: GameEvent): void {
    // Global death counter
    this.stats.deaths.total++;

    // Character specific death

    // const char = this.getOrCreateCharacter(event.character);
    // char.deaths++;
    // char.lastSeen = event.timestamp;
    // this.stats.totalDeaths++;
    // this.updateTimeStats(event.timestamp, char.deathStats!);
  }

  // private handleLevelUp(event: GameEvent): void {
  //   const char = this.getOrCreateCharacter(event.character);
  //   char.maxLevel = Math.max(char.maxLevel, event.data.level);
  //   char.class = event.data.class;
  //   char.lastSeen = event.timestamp;
  //   this.updateLevelingStats(char, event);
  // }

  getState(): GlobalStats {
    return this.stats;
  }

  // getActiveCharacter(): CharacterStats | null {
  //   // return this.activeCharacter
  //   //   ? this.stats.characters[this.activeCharacter]
  //   //   : null;
  //   return null
  // }

  // ... additional state management methods
}
