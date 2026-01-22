import { defineHandler, HTTPError } from "nitro/h3";
import { bot } from "~/server/lib/bot";
import { recorder } from "~/server/lib/recorder";

type Platform = keyof typeof bot.webhooks;

export default defineHandler(async (event) => {
  const platform = event.context.params?.platform as string;

  // Check if we have a webhook handler for this platform
  const webhookHandler = bot.webhooks[platform as Platform];
  if (!webhookHandler) {
    throw new HTTPError(`Unknown platform: ${platform}`, { status: 404 });
  }

  // Record webhook if enabled (no-op if disabled)
  if (recorder.isEnabled) {
    await recorder.recordWebhook(platform, event.req);
  }

  // Handle the webhook with waitUntil for background processing
  // Nitro's event.waitUntil ensures work completes after the response is sent
  return webhookHandler(event.req, {
    waitUntil: (task) => event.waitUntil(task),
  });
});
