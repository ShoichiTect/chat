import { defineHandler, HTTPError } from "nitro/h3";
import { bot } from "~/server/lib/bot";
import { createPersistentListener } from "~/server/lib/persistent-listener";

// Default listener duration: 10 minutes
const DEFAULT_DURATION_MS = 600 * 1000;

/**
 * Persistent listener for Discord Gateway.
 * Handles warm start optimization and cross-instance coordination.
 */
const discordGateway = createPersistentListener({
  name: "discord-gateway",
  redisUrl: process.env.REDIS_URL,
  defaultDurationMs: DEFAULT_DURATION_MS,
  maxDurationMs: DEFAULT_DURATION_MS,
});

/**
 * Start the Discord Gateway WebSocket listener.
 *
 * Features:
 * - Warm start optimization: reuses existing Gateway connection on same instance
 * - Cross-instance coordination via Redis pub/sub
 * - Graceful handoff between cron invocations
 *
 * This endpoint is invoked by a cron job every 9 minutes to maintain
 * continuous Gateway connectivity.
 *
 * Security: Requires CRON_SECRET validation.
 *
 * Usage: GET /api/discord/gateway
 * Optional query param: ?duration=600000 (milliseconds, max 600000)
 */
export default defineHandler(async (event): Promise<Response> => {
  // Validate CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[discord-gateway] CRON_SECRET not configured");
    throw new HTTPError("CRON_SECRET not configured", { status: 500 });
  }
  const authHeader = event.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    console.log("[discord-gateway] Unauthorized: invalid CRON_SECRET");
    throw new HTTPError("Unauthorized", { status: 401 });
  }

  // Ensure bot is initialized
  await bot.initialize();

  const discord = bot.getAdapter("discord");
  if (!discord) {
    console.log("[discord-gateway] Discord adapter not configured");
    throw new HTTPError("Discord adapter not configured", { status: 404 });
  }

  // Construct webhook URL for forwarding Gateway events
  const baseUrl =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    process.env.NITRO_APP_BASE_URL;
  let webhookUrl: string | undefined;
  if (baseUrl) {
    const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    const queryParam = bypassSecret
      ? `?x-vercel-protection-bypass=${bypassSecret}`
      : "";
    webhookUrl = `https://${baseUrl}/api/webhooks/discord${queryParam}`;
  }

  return discordGateway.start(event.req, {
    afterTask: (task) => {
      event.waitUntil?.(task);
    },
    run: async ({ abortSignal, durationMs, listenerId }) => {
      console.log(
        `[discord-gateway] Starting Gateway listener: ${listenerId}`,
        {
          webhookUrl: webhookUrl ? "configured" : "not configured",
          durationMs,
        },
      );

      const response = await discord.startGatewayListener(
        {
          waitUntil: (task: Promise<unknown>) => event.waitUntil(task),
        },
        durationMs,
        abortSignal,
        webhookUrl,
      );

      console.log(
        `[discord-gateway] Gateway listener ${listenerId} completed with status: ${response.status}`,
      );

      return response;
    },
  });
});
