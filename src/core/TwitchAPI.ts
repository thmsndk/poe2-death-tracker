import axios from "axios";
import { TwitchAuth, TwitchAuthResult, TwitchCredentials } from "./TwitchAuth";

export class TwitchAPI {
  private config: {
    enabled: boolean;
    credentials?: TwitchCredentials;
    auth?: TwitchAuthResult;
  };
  private lastTokenRefresh?: number;
  private userId?: string;

  constructor(config: {
    enabled: boolean;
    credentials?: TwitchCredentials;
    auth?: TwitchAuthResult;
  }) {
    this.config = config;
  }

  private async getUserId(): Promise<string> {
    if (this.userId) return this.userId;
    if (!this.config.credentials || !this.config.auth) {
      throw new Error("Twitch credentials or auth not configured");
    }

    try {
      const response = await axios.get("https://api.twitch.tv/helix/users", {
        headers: {
          "Client-ID": this.config.credentials.clientId,
          Authorization: `Bearer ${this.config.auth.accessToken}`,
        },
      });

      if (!response.data.data?.[0]?.id) {
        throw new Error("Failed to get user ID from response");
      }

      this.userId = response.data.data[0].id;
      if (!this.userId) {
        throw new Error("Failed to get user ID from response");
      }

      return this.userId;
    } catch (error) {
      console.error("❌ Failed to get user ID:", error);
      throw error;
    }
  }

  private async ensureValidToken(): Promise<boolean> {
    if (!this.config.enabled || !this.config.auth) {
      return false;
    }

    const auth = this.config.auth;
    const credentials = this.config.credentials;

    // Check if token is about to expire (within 5 minutes)
    const expirationTime = auth.obtainedAt + auth.expiresIn * 1000;
    const timeUntilExpiration = expirationTime - Date.now();

    if (timeUntilExpiration < 5 * 60 * 1000) {
      // Less than 5 minutes
      if (auth.refreshToken && credentials?.clientSecret) {
        try {
          console.log("🔄 Refreshing Twitch token...");
          const newAuth = await TwitchAuth.refreshToken(
            credentials,
            auth.refreshToken
          );
          this.config.auth = newAuth;
          this.lastTokenRefresh = Date.now();
          return true;
        } catch (error) {
          console.error("❌ Token refresh failed:", error);
          this.config.enabled = false;
          return false;
        }
      } else {
        console.log("⚠️ Twitch token is expiring soon and cannot be refreshed");
        this.config.enabled = false;
        return false;
      }
    }

    // Validate token permissions if we haven't recently
    if (
      !this.lastTokenRefresh ||
      Date.now() - this.lastTokenRefresh > 60 * 60 * 1000
    ) {
      const isValid = await TwitchAuth.validateToken(auth.accessToken);
      if (!isValid) {
        this.config.enabled = false;
        return false;
      }
      this.lastTokenRefresh = Date.now();
    }

    return true;
  }

  async createStreamMarker(description: string): Promise<void> {
    if (!this.config.enabled || !this.config.auth) {
      return;
    }

    try {
      const userId = await this.getUserId();

      await axios.post(
        "https://api.twitch.tv/helix/streams/markers",
        {
          user_id: userId,
          description,
        },
        {
          headers: {
            "Client-ID": this.config.credentials!.clientId,
            Authorization: `Bearer ${this.config.auth!.accessToken}`,
          },
        }
      );
      console.log("✅ Stream marker created:", description);
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          console.log("⚠️ Cannot create marker: Stream is not live");
        } else {
          console.error(
            "❌ Failed to create stream marker:",
            error.response?.data || error.message
          );
        }
      } else {
        console.error("❌ Failed to create stream marker:", error);
      }
    }
  }
}
