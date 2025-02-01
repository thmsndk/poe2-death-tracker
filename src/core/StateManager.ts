import { EventEmitter } from "events";
import { AreaEvent, DeathEvent, GameEvent, LevelUpEvent } from "./LogParser";
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

export interface DeathStats {
  total: number;
  recent: Array<{
    timestamp: string;
    name: string;
    class: string;
    level: number;
    area: AreaEvent["area"] | undefined;
  }>;
}

export interface CharacterInstance {
  // id: string;
  name: string;
  class: string;
  league: LeagueStatus;
  maxLevel: number;
  deaths: DeathStats;
  created: string;
  lastSeen: string;
  area: AreaEvent["area"] | undefined;
  // levelingStats: LevelingStats;
  // timeStats: TimeStats;
}

export interface GlobalStats {
  deaths: DeathStats;
  // deathStats: TimeStats;
}

export type GameState = {
  stats: GlobalStats;
  characters: Record<string, CharacterInstance[]>;
};

interface StateManagerEvents {
  "state-updated": (state: GameState) => void;
}

export declare interface StateManager extends EventEmitter {
  on<E extends keyof StateManagerEvents>(
    event: E,
    listener: StateManagerEvents[E]
  ): this;
  emit<E extends keyof StateManagerEvents>(
    event: E,
    ...args: Parameters<StateManagerEvents[E]>
  ): boolean;
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
  private character: CharacterInstance | null = null;
  private characterCache: Record<string, CharacterInstance[]> = {};
  private currentArea: AreaEvent | null = null;

  constructor(outputDir: string) {
    super();
    this.stats = {
      deaths: {
        total: 0,
        recent: [],
      },
    };
    this.characterCache = {};
  }

  buildStateFromCache() {
    // TODO: load all events from cache and calculate the global stats (total deaths)
    // TODO: We need to load the currently active character from cache, based on the latest parsed event
  }

  handleEvent(event: GameEvent & { isStartupEvent: boolean }): void {
    // TODO: What do we do about startup events? it kinda depends if we have cached that specific event already, because then buildStateFromCache would have handled it
    // // Update active character/session
    // this.updateActiveState(event);
    // // Update stats based on event type
    switch (event.type) {
      case "death":
        this.handleDeath(event);
        break;
      case "level_up":
        this.handleLevelUp(event);
        break;
      case "area":
        this.handleAreaChange(event);
        break;
      // case "identify":
      //   this.handleIdentify(event);
      //   break;
    }

    if (!event.isStartupEvent) {
      // Emit state changes
      this.emit("state-updated", this.getState());
    }
  }

  private handleDeath(event: DeathEvent): void {
    // Character specific death
    const character = this.getOrCreateCharacter(
      event.character.name,
      event.timestamp
    );

    character.area = this.currentArea?.area || undefined;

    const enrichedDeath = {
      timestamp: event.timestamp,
      name: character.name,
      class: character.class,
      level: character.maxLevel,
      area: character.area || undefined,
    };

    // Global death counter
    this.stats.deaths.total++;

    this.stats.deaths.recent.push(enrichedDeath);

    // Update character
    character.deaths.total++;
    character.deaths.recent.push(enrichedDeath);

    character.lastSeen = event.timestamp;

    if (character.league.current === "hardcore") {
      character.league.hardcoreUntil = event.timestamp;
      character.league.current = "standard";
    }
  }

  private handleLevelUp(event: LevelUpEvent): void {
    const character = this.getOrCreateCharacter(
      event.character.name,
      event.timestamp,
      event.character.class,
      event.character.level
    );

    // Update character
    character.maxLevel = event.character.level;
    character.lastSeen = event.timestamp;

    // class can change e.g. Sorceress -> Stormweaver
    character.class = event.character.class;
  }

  private handleAreaChange(event: AreaEvent): void {
    this.currentArea = event;
  }

  getState(): GameState {
    return { stats: this.stats, characters: this.characterCache };
  }

  private getOrCreateCharacter(
    name: string,
    timestamp: string,
    characterClass?: string,
    level?: number
  ): CharacterInstance {
    if (this.character && this.character.name === name) {
      if (level === undefined && this.character.maxLevel > 1) {
        // death event or something else, we return the current character
        return this.character;
      }

      if (
        level &&
        level > this.character.maxLevel &&
        this.character.class !== "Unknown"
      ) {
        // level up event, we return the current character
        return this.character;
      }
    }

    if (this.character && this.character.name !== name) {
      // TODO: fetch from file cache
    }

    // Create new instance
    console.log("Creating new character instance", name, characterClass, level);

    this.character = {
      name: name,
      class: characterClass || "Unknown",
      league: {
        current: "hardcore",
      },
      maxLevel: level || 1,
      deaths: {
        total: 0,
        recent: [],
      },
      created: timestamp,
      lastSeen: timestamp,
      area: this.currentArea ? this.currentArea.area : undefined,
    };

    if (!this.characterCache[name]) {
      this.characterCache[name] = [this.character];
    } else {
      this.characterCache[name].push(this.character);
    }

    return this.character;
  }
}
