import { EventEmitter } from "events";
import {
  GameEvent,
  DeathEvent,
  LevelUpEvent,
  IdentifyEvent,
  AreaEvent,
  PassiveAllocatedEvent,
  AfkStatusEvent,
} from "./LogParser";

/**
 * EventManager enriches raw game events with contextual information.
 * It maintains the current character state (name, class, level, area)
 * and ensures all events have complete character information.
 *
 * This acts as a middleware between LogParser and StateManager,
 * enriching events with data that might not be available in the original log entry.
 *
 * @emits enriched-event - Emitted when an event has been processed and enriched
 */
export class EventManager extends EventEmitter {
  private currentCharacter: {
    name: string | null;
    class: string | null;
    level: number | null;
    area: string | null;
  } = {
    name: null,
    class: null,
    level: null,
    area: null,
  };

  private lastEventTime: number | null = null;

  processEvent(
    event: GameEvent & { isStartupEvent: boolean }
  ): GameEvent & { isStartupEvent: boolean } {
    // Update current character info
    if (event.character.name) {
      this.currentCharacter.name = event.character.name;
    }
    if (event.type === "level_up") {
      this.currentCharacter.class = event.data.class;
      this.currentCharacter.level = event.data.level;
    }
    if (event.type === "area") {
      this.currentCharacter.area = event.data.name;
    }

    return this.enrichEvent(event);
  }

  private enrichEvent<T extends GameEvent>(event: T): T {
    return {
      ...event,
      character: {
        name: event.character.name || this.currentCharacter.name || "",
        class:
          event.character.class || this.currentCharacter.class || undefined,
        level:
          event.character.level || this.currentCharacter.level || undefined,
        area: event.character.area || this.currentCharacter.area || undefined,
      },
    };
  }
}
