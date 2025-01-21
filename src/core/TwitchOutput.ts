import { GameEvent } from "./LogParser";
import { TwitchAPI } from "./TwitchAPI";
import { TwitchAuthResult } from "./TwitchAuth";
import { TwitchCredentials } from "./TwitchAuth";

export class TwitchOutput {
  private twitchAPI: TwitchAPI;
  private markerDelay: number = 3000; // 3 second delay for stream latency

  constructor(twitchConfig: {
    enabled: boolean;
    credentials?: TwitchCredentials;
    auth?: TwitchAuthResult;
  }) {
    this.twitchAPI = new TwitchAPI(twitchConfig);
  }

  handleGameEvent(event: GameEvent & { isStartupEvent: boolean }): void {
    // Skip marker creation for startup events
    if (event.isStartupEvent) {
      return;
    }

    const message = this.getMarkerMessage(event);
    if (message) {
      setTimeout(async () => {
        await this.twitchAPI.createStreamMarker(message);
      }, this.markerDelay);
    }
  }

  private getMarkerMessage(event: GameEvent): string | null {
    switch (event.type) {
      case "death":
        return `💀 ${event.character.name} died!`;
      case "level_up":
        return `🎉 ${event.character.name} (${event.data.class}) reached level ${event.data.level}!`;
      default:
        return null;
    }
  }
}
