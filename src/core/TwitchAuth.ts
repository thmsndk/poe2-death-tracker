import express, { Response } from "express";
import { randomBytes } from "crypto";
import { Server } from "http";
import opener from "opener";
import axios from "axios";

export interface TwitchAuthResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  obtainedAt: number;
}

export interface TwitchCredentials {
  clientId: string;
  clientSecret?: string;
}

export enum AuthFlow {
  Implicit = "implicit",
  AuthCode = "authorization_code",
}

export class TwitchAuth {
  static showSetupInstructions() {
    console.log(`
🎮 Twitch Developer Application Setup Instructions:

1. Go to https://dev.twitch.tv/console
2. Log in with your Twitch account
3. Click "Register Your Application"
4. Fill in the following details:
   - Name: Choose a name (e.g., "My POE2 Death Tracker")
   - OAuth Redirect URLs: http://localhost:3000/callback
   - Category: Game Integration
5. Click "Create"
6. Click "Manage" on your newly created application
7. Copy your Client ID
8. Click "New Secret" to generate a Client Secret (recommended)

Note: If you provide both Client ID and Secret, tokens will auto-refresh.
If you provide only Client ID, tokens will expire after 1 hour.

Required permissions: channel:manage:broadcast
`);
  }

  static async validateToken(accessToken: string): Promise<boolean> {
    try {
      const response = await axios.get("https://id.twitch.tv/oauth2/validate", {
        headers: {
          Authorization: `OAuth ${accessToken}`,
        },
      });

      const scopes = response.data.scopes as string[];
      if (!scopes.includes("channel:manage:broadcast")) {
        console.log(
          "⚠️ Token is missing required permissions. Please reauthorize."
        );
        return false;
      }

      return true;
    } catch (error) {
      console.log("⚠️ Token validation failed");
      return false;
    }
  }

  static async startAuthFlow(
    credentials: TwitchCredentials,
    flow: AuthFlow = credentials.clientSecret
      ? AuthFlow.AuthCode
      : AuthFlow.Implicit
  ): Promise<TwitchAuthResult> {
    if (!credentials.clientId) {
      throw new Error("Client ID is required");
    }

    return new Promise((resolve, reject) => {
      const state = randomBytes(16).toString("hex");
      const server = express();
      let httpServer: Server;

      if (flow === AuthFlow.Implicit) {
        // Serve a simple HTML page that will extract token from hash
        server.get("/callback", (req, res: Response) => {
          res.send(`
            <html>
              <body>
                <script>
                  const hash = window.location.hash.substring(1);
                  const params = new URLSearchParams(hash);
                  fetch('/token?' + hash)
                    .then(() => {
                      document.body.innerHTML = '✅ Authentication successful! You can close this window.';
                    })
                    .catch(() => {
                      document.body.innerHTML = '❌ Authentication failed. You can close this window.';
                    });
                </script>
                Completing authentication...
              </body>
            </html>
          `);
        });

        // Token handling endpoint for implicit flow
        server.get("/token", (req, res: Response) => {
          const { access_token, state: returnedState, error } = req.query;

          if (error) {
            res.sendStatus(400);
            reject(new Error(`Authentication failed: ${error}`));
            httpServer.close();
            return;
          }

          if (typeof returnedState !== "string" || state !== returnedState) {
            res.sendStatus(400);
            reject(new Error("Invalid state parameter"));
            httpServer.close();
            return;
          }

          if (typeof access_token !== "string") {
            res.sendStatus(400);
            reject(new Error("Invalid token"));
            httpServer.close();
            return;
          }

          const result: TwitchAuthResult = {
            accessToken: access_token,
            expiresIn: 3600, // 1 hour
            obtainedAt: Date.now(),
          };

          res.sendStatus(200);
          resolve(result);
          httpServer.close();
        });
      } else {
        // Authorization Code flow
        server.get("/callback", async (req, res: Response) => {
          const { code, state: returnedState, error } = req.query;

          if (error) {
            res.send("❌ Authentication failed. You can close this window.");
            reject(new Error(`Authentication failed: ${error}`));
            httpServer.close();
            return;
          }

          if (typeof returnedState !== "string" || state !== returnedState) {
            res.send("❌ Invalid state parameter. You can close this window.");
            reject(new Error("Invalid state parameter"));
            httpServer.close();
            return;
          }

          if (typeof code !== "string") {
            res.send("❌ Invalid code. You can close this window.");
            reject(new Error("Invalid code"));
            httpServer.close();
            return;
          }

          try {
            const tokenResponse = await axios.post(
              "https://id.twitch.tv/oauth2/token",
              {
                client_id: credentials.clientId,
                client_secret: credentials.clientSecret,
                code,
                grant_type: "authorization_code",
                redirect_uri: "http://localhost:3000/callback",
              }
            );

            const result: TwitchAuthResult = {
              accessToken: tokenResponse.data.access_token,
              refreshToken: tokenResponse.data.refresh_token,
              expiresIn: tokenResponse.data.expires_in,
              obtainedAt: Date.now(),
            };

            res.send(
              "✅ Authentication successful! You can close this window."
            );
            resolve(result);
            httpServer.close();
          } catch (error) {
            res.send(
              "❌ Error exchanging code for token. You can close this window."
            );
            reject(error);
            httpServer.close();
          }
        });
      }

      httpServer = server.listen(3000, () => {
        const REDIRECT_URI = "http://localhost:3000/callback";
        const SCOPES = ["channel:manage:broadcast"];

        const authUrl =
          `https://id.twitch.tv/oauth2/authorize?` +
          `client_id=${credentials.clientId}&` +
          `redirect_uri=${REDIRECT_URI}&` +
          `response_type=${flow === AuthFlow.Implicit ? "token" : "code"}&` +
          `scope=${SCOPES.join(" ")}&` +
          `state=${state}`;

        opener(authUrl);
        console.log("🔐 Opening browser for Twitch authentication...");
      });
    });
  }

  static async refreshToken(
    credentials: TwitchCredentials,
    refreshToken: string
  ): Promise<TwitchAuthResult> {
    if (!credentials.clientSecret) {
      throw new Error("Client secret is required for token refresh");
    }

    const response = await axios.post("https://id.twitch.tv/oauth2/token", {
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
      obtainedAt: Date.now(),
    };
  }
}
