import { defineHandler, HTTPError } from "nitro/h3";
import { bot } from "~/server/lib/bot";

type Platform = keyof typeof bot.webhooks;

// Health check endpoint
export default defineHandler((event) => {
  const platform = event.context.params?.platform;

  const hasAdapter = bot.webhooks[platform as Platform] !== undefined;

  if (!hasAdapter) {
    throw new HTTPError(`${platform} adapter not configured`, { status: 404 });
  }

  return `${platform} webhook endpoint is active`;
});
