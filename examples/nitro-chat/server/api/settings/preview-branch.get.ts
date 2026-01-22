import { defineHandler, HTTPError } from "nitro/h3";
import { requireRedisClient } from "../../utils/redis";

const PREVIEW_BRANCH_KEY = "chat-sdk:cache:preview-branch-url";

export default defineHandler(async () => {
  try {
    const client = await requireRedisClient();
    const value = await client.get(PREVIEW_BRANCH_KEY);

    return { url: value || null };
  } catch (error) {
    console.error("[settings] Error getting preview branch URL:", error);
    throw error instanceof HTTPError
      ? error
      : new HTTPError("Failed to get preview branch URL", { status: 500 });
  }
});
