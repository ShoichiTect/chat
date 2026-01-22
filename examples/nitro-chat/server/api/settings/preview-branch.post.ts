import { defineHandler, readBody, HTTPError } from "nitro/h3";
import { requireRedisClient } from "../../utils/redis";

const PREVIEW_BRANCH_KEY = "chat-sdk:cache:preview-branch-url";

export default defineHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { url } = body;

    const client = await requireRedisClient();

    if (url) {
      // Validate URL
      try {
        new URL(url);
      } catch {
        throw new HTTPError("Invalid URL", { status: 400 });
      }
      await client.set(PREVIEW_BRANCH_KEY, url);
    } else {
      // Clear the preview branch URL
      await client.del(PREVIEW_BRANCH_KEY);
    }

    return { success: true, url: url || null };
  } catch (error) {
    console.error("[settings] Error setting preview branch URL:", error);
    throw error instanceof HTTPError
      ? error
      : new HTTPError("Failed to set preview branch URL", { status: 500 });
  }
});
