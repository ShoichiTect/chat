import { defineHandler, proxyRequest } from "nitro/h3";
import { getRedisClient } from "../utils/redis";

const PREVIEW_BRANCH_KEY = "chat-sdk:cache:preview-branch-url";

async function getPreviewBranchUrl(): Promise<string | null> {
  try {
    const client = await getRedisClient();
    if (!client) return null;

    const value = await client.get(PREVIEW_BRANCH_KEY);
    return value || null;
  } catch (error) {
    console.error("[middleware] Error fetching preview branch URL:", error);
    return null;
  }
}

export default defineHandler(async (event) => {
  // Only run in production
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  if (process.env.VERCEL_ENV !== "production") {
    return;
  }

  const pathname = event.path;

  // Only apply to webhook routes
  if (!pathname.startsWith("/api/webhooks/")) {
    return;
  }

  // Check if we have a preview branch configured
  const previewBranchUrl = await getPreviewBranchUrl();

  if (!previewBranchUrl) {
    // No preview branch configured, continue normally
    return;
  }

  // Construct target URL
  const targetUrl = new URL(pathname + (event.url?.search || ""), previewBranchUrl);

  console.warn(`[middleware] Proxying ${pathname} to ${targetUrl.hostname}`);

  // Proxy the request to the preview branch
  return proxyRequest(event, targetUrl.toString());
});
