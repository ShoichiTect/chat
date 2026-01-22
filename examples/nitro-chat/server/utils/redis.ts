import { createClient } from "redis";
import { HTTPError } from "nitro/h3";

const REDIS_URL = process.env.REDIS_URL || "";

// Redis client singleton
let redisClient: ReturnType<typeof createClient> | null = null;
let redisConnectPromise: Promise<void> | null = null;

/**
 * Get a shared Redis client instance.
 * Returns null if REDIS_URL is not configured.
 */
export async function getRedisClient() {
  if (!REDIS_URL) return null;

  if (!redisClient) {
    redisClient = createClient({ url: REDIS_URL });
    redisClient.on("error", (err) => {
      console.error("[redis] Redis client error:", err);
    });
  }

  if (!redisClient.isOpen) {
    if (!redisConnectPromise) {
      redisConnectPromise = redisClient.connect().then(() => {});
    }
    await redisConnectPromise;
  }

  return redisClient;
}

/**
 * Get a shared Redis client instance, throwing if not configured.
 * Use this when Redis is required.
 */
export async function requireRedisClient() {
  const client = await getRedisClient();
  if (!client) {
    throw new HTTPError("REDIS_URL is not configured", { status: 503 });
  }
  return client;
}
