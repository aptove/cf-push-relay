/**
 * Push Relay – Cloudflare Worker Entry Point
 *
 * Architecture:
 *   fetch handler  → Push Worker (HTTP routes: /register, /push, /health)
 *   scheduled handler → Token Worker (Cron: refresh APNs JWT + FCM OAuth2 token)
 *
 * Two-worker design in a single Worker script:
 *   - The Push Worker handles incoming HTTP requests. It reads
 *     pre-generated auth tokens from KV for near-zero CPU time per push.
 *   - The Token Worker runs on a Cron schedule (every 45 min) to
 *     generate fresh APNs JWTs and FCM access tokens, storing them in KV.
 *
 * Device Token Addressing:
 *   APNs:  device token → URL path   (POST /3/device/<token>)
 *   FCM:   device token → body field  ({ "message": { "token": "<token>" } })
 *
 *   The auth credentials (JWT/OAuth2) identify the *publisher*, not the device.
 *   Apple/Google look up the target device internally using the device token,
 *   then route the push to the correct phone via their persistent connection.
 */

import type { Env } from "./types";
import { handleRequest } from "./router";
import { refreshApnsJwt } from "./apns";
import { refreshFcmToken } from "./fcm";

export default {
  /**
   * Push Worker – HTTP request handler.
   * Routes: POST /register, DELETE /register, POST /push, GET /health
   */
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    return handleRequest(request, env);
  },

  /**
   * Token Worker – Cron trigger handler.
   * Runs every 45 minutes to pre-generate auth tokens:
   *   - APNs: ES256 JWT (team_id + key_id + iat), cached 50 min
   *   - FCM:  RS256 JWT → OAuth2 access token exchange, cached 55 min
   *
   * If either refresh fails, the other still runs.
   * Push Worker falls back to on-demand generation if KV is empty.
   */
  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    const tasks: Promise<void>[] = [];

    // Only refresh APNs if configured
    if (env.APNS_PRIVATE_KEY && env.APNS_KEY_ID && env.APNS_TEAM_ID) {
      tasks.push(
        refreshApnsJwt(env).catch((e) =>
          console.error("APNs JWT refresh failed:", e),
        ),
      );
    }

    // Only refresh FCM if configured
    if (env.FCM_PRIVATE_KEY && env.FCM_CLIENT_EMAIL) {
      tasks.push(
        refreshFcmToken(env).catch((e) =>
          console.error("FCM token refresh failed:", e),
        ),
      );
    }

    ctx.waitUntil(Promise.all(tasks));
  },
};
