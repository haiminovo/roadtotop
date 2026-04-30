import { createClient } from "redis";
import { logger } from "@/lib/server/logger";

type AppRedisClient = ReturnType<typeof createClient>;

declare global {
  var __roadToTopRedisClient: AppRedisClient | null | undefined;
  var __roadToTopRedisErrorLogged: boolean | undefined;
}

const fallbackStore = new Map<string, string>();

async function getRedisClient() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    return null;
  }

  if (global.__roadToTopRedisClient !== undefined) {
    return global.__roadToTopRedisClient;
  }

  const client = createClient({ url: redisUrl });

  client.on("error", (error) => {
    if (!global.__roadToTopRedisErrorLogged) {
      logger.warn("Redis connection failed, falling back to memory store.", {
        message: error.message,
      });
      global.__roadToTopRedisErrorLogged = true;
    }
  });

  try {
    await client.connect();
    logger.info("Redis client connected.");
    global.__roadToTopRedisClient = client;
    return client;
  } catch (error) {
    logger.warn("Redis unavailable during startup, using memory fallback.", {
      message: error instanceof Error ? error.message : "unknown",
    });
    global.__roadToTopRedisClient = null;
    return null;
  }
}

export async function setRedisJson(key: string, value: unknown) {
  const client = await getRedisClient();
  const serialized = JSON.stringify(value);

  if (!client) {
    fallbackStore.set(key, serialized);
    return;
  }

  await client.set(key, serialized);
}

export async function getRedisJson<T>(key: string) {
  const client = await getRedisClient();
  const value = client ? await client.get(key) : fallbackStore.get(key);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export async function deleteRedisKey(key: string) {
  const client = await getRedisClient();

  if (!client) {
    fallbackStore.delete(key);
    return;
  }

  await client.del(key);
}
