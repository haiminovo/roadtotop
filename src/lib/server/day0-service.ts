import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import {
  AFK_TASK_SECONDS,
  classConfigs,
  EXP_PER_LEVEL,
  getClassConfig,
  getCurrentLevelProgress,
  getLevelFromExp,
  getMapConfig,
  getRaceConfig,
  levelTable,
  mapConfigs,
  MAX_OFFLINE_SECONDS,
  raceConfigs,
  type ClassKey,
  type MapKey,
  type RaceKey,
} from "@/lib/game-config";
import { query, withTransaction } from "@/lib/server/db";
import { deleteRedisKey, setRedisJson } from "@/lib/server/redis";

type UserRow = {
  user_id: string;
  guest_token: string;
  last_login_at: Date;
  last_seen_at: Date;
};

type RoleRow = {
  role_id: string;
  user_id: string;
  name: string;
  race_key: RaceKey;
  class_key: ClassKey;
  level: number;
  exp: number;
  gold: number;
  aether_crystal: number;
  strength: number;
  agility: number;
  intelligence: number;
  vitality: number;
  avatar_seed: string;
};

type AfkRow = {
  afk_id: string;
  role_id: string;
  status: "idle" | "active";
  map_key: MapKey | null;
  started_at: Date | null;
  last_settled_at: Date | null;
  pending_gold: number;
  pending_aether_crystal: number;
  pending_exp: number;
  accrued_seconds: number;
};

type BackpackRow = {
  backpack_id: string;
  item_id: string;
  quantity: number;
  equipped: boolean;
  name: string;
  rarity: string;
  slot: string;
  description: string;
  sell_price: number;
  stat_json: Record<string, number>;
};

type RewardPreview = {
  seconds: number;
  gold: number;
  aetherCrystal: number;
  exp: number;
};

type RewardDelta = {
  aetherCrystal: number;
  exp: number;
  executions: number;
  gold: number;
  seconds: number;
};

type DashboardData = {
  user: UserRow;
  role: RoleRow;
  afk: AfkRow;
  backpack: BackpackRow[];
};

export type Day0SessionSnapshot = {
  serverTime: number;
  account: {
    guestToken: string;
    hasRole: boolean;
    userId: string;
  };
  config: {
    classes: typeof classConfigs;
    levels: typeof levelTable;
    maps: typeof mapConfigs;
    races: typeof raceConfigs;
  };
  role: null | {
    roleId: string;
    name: string;
    raceKey: RaceKey;
    classKey: ClassKey;
    level: number;
    exp: number;
    currentLevelExp: number;
    nextLevelExp: number;
    gold: number;
    aetherCrystal: number;
    avatarSeed: string;
    stats: {
      strength: number;
      agility: number;
      intelligence: number;
      vitality: number;
    };
  };
  backpack: Array<{
    backpackId: string;
    itemId: string;
    quantity: number;
    equipped: boolean;
    name: string;
    rarity: string;
    slot: string;
    description: string;
    sellPrice: number;
    stats: Record<string, number>;
  }>;
  afk: {
    status: "idle" | "active";
    mapKey: MapKey | null;
    startedAt: number | null;
    lastSettledAt: number | null;
    shouldShowOfflineRewardModal: boolean;
    accruedSeconds: number;
    taskDurationSeconds: number;
    maxOfflineSeconds: number;
    mapOptions: typeof mapConfigs;
    currentMap: null | {
      key: MapKey;
      label: string;
      summary: string;
      goldPerMinute: number;
      aetherPerMinute: number;
      expPerMinute: number;
    };
    pendingReward: RewardPreview;
    estimatedHourlyReward: RewardPreview;
  };
};

export type GuestLoginResult = {
  guestToken: string;
  hasRole: boolean;
  serverTime: number;
  userId: string;
};

const OFFLINE_MODAL_THRESHOLD_MS = 45 * 1000;

function makeId(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

function toMillis(value: Date | null) {
  return value ? new Date(value).getTime() : null;
}

function normalizeNumber(value: number) {
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? Math.max(0, Math.floor(numericValue)) : 0;
}

function buildHourlyReward(mapKey: MapKey | null): RewardPreview {
  const map = mapKey ? getMapConfig(mapKey) : null;

  if (!map) {
    return {
      seconds: 3600,
      gold: 0,
      aetherCrystal: 0,
      exp: 0,
    };
  }

  return {
    seconds: 3600,
    gold: map.goldPerMinute * 60,
    aetherCrystal: Math.floor(map.aetherPerMinute * 60),
    exp: map.expPerMinute * 60,
  };
}

function buildRewardForSeconds(mapKey: MapKey | null, seconds: number): RewardPreview {
  const map = mapKey ? getMapConfig(mapKey) : null;

  if (!map) {
    return {
      seconds,
      gold: 0,
      aetherCrystal: 0,
      exp: 0,
    };
  }

  return {
    seconds,
    gold: Math.floor((seconds * map.goldPerMinute) / 60),
    aetherCrystal: Math.floor((seconds * map.aetherPerMinute) / 60),
    exp: Math.floor((seconds * map.expPerMinute) / 60),
  };
}

function buildRewardDeltaForExecutions(mapKey: MapKey | null, previousExecutions: number, nextExecutions: number): RewardDelta {
  const previousSeconds = previousExecutions * AFK_TASK_SECONDS;
  const nextSeconds = nextExecutions * AFK_TASK_SECONDS;
  const previousReward = buildRewardForSeconds(mapKey, previousSeconds);
  const nextReward = buildRewardForSeconds(mapKey, nextSeconds);

  return {
    aetherCrystal: Math.max(0, nextReward.aetherCrystal - previousReward.aetherCrystal),
    exp: Math.max(0, nextReward.exp - previousReward.exp),
    executions: Math.max(0, nextExecutions - previousExecutions),
    gold: Math.max(0, nextReward.gold - previousReward.gold),
    seconds: Math.max(0, nextSeconds - previousSeconds),
  };
}

function applyRewardToRole(role: RoleRow, reward: RewardDelta) {
  if (reward.gold <= 0 && reward.aetherCrystal <= 0 && reward.exp <= 0) {
    return false;
  }

  role.gold += reward.gold;
  role.aether_crystal += reward.aetherCrystal;
  role.exp += reward.exp;
  role.level = getLevelFromExp(role.exp);
  return true;
}

function settleAfkState(afk: AfkRow, options?: { capSeconds?: number; now?: number }): RewardDelta {
  const now = options?.now ?? Date.now();

  const emptyReward: RewardDelta = {
    aetherCrystal: 0,
    exp: 0,
    executions: 0,
    gold: 0,
    seconds: 0,
  };

  if (afk.status !== "active" || !afk.map_key || !afk.last_settled_at) {
    return emptyReward;
  }

  const elapsedSeconds = Math.max(
    0,
    Math.floor((now - new Date(afk.last_settled_at).getTime()) / 1000),
  );

  if (elapsedSeconds <= 0) {
    return emptyReward;
  }

  const grantedSeconds =
    options?.capSeconds === undefined ? elapsedSeconds : Math.min(elapsedSeconds, Math.max(0, options.capSeconds));
  const previousTotalSeconds = Math.max(0, afk.accrued_seconds);
  const nextTotalSeconds = previousTotalSeconds + grantedSeconds;
  const previousExecutions = Math.floor(previousTotalSeconds / AFK_TASK_SECONDS);
  const nextExecutions = Math.floor(nextTotalSeconds / AFK_TASK_SECONDS);
  const rewardDelta = buildRewardDeltaForExecutions(afk.map_key, previousExecutions, nextExecutions);

  afk.pending_gold += rewardDelta.gold;
  afk.pending_aether_crystal += rewardDelta.aetherCrystal;
  afk.pending_exp += rewardDelta.exp;
  afk.accrued_seconds = nextTotalSeconds % AFK_TASK_SECONDS;
  afk.last_settled_at = new Date(now);

  return rewardDelta;
}

function consumePendingReward(afk: AfkRow, reward: RewardDelta) {
  afk.pending_gold = Math.max(0, afk.pending_gold - reward.gold);
  afk.pending_aether_crystal = Math.max(0, afk.pending_aether_crystal - reward.aetherCrystal);
  afk.pending_exp = Math.max(0, afk.pending_exp - reward.exp);
}

function discardCurrentTaskProgress(afk: AfkRow) {
  afk.accrued_seconds = 0;
}

async function persistRole(client: PoolClient, role: RoleRow) {
  await client.query(
    `
      UPDATE "role"
      SET
        level = $2,
        exp = $3,
        gold = $4,
        aether_crystal = $5,
        updated_at = NOW()
      WHERE role_id = $1
    `,
    [
      role.role_id,
      role.level,
      normalizeNumber(role.exp),
      normalizeNumber(role.gold),
      normalizeNumber(role.aether_crystal),
    ],
  );
}

async function persistAfk(client: PoolClient, afk: AfkRow) {
  await client.query(
    `
      UPDATE afk
      SET
        status = $2,
        map_key = $3,
        started_at = $4,
        last_settled_at = $5,
        pending_gold = $6,
        pending_aether_crystal = $7,
        pending_exp = $8,
        accrued_seconds = $9,
        updated_at = NOW()
      WHERE afk_id = $1
    `,
    [
      afk.afk_id,
      afk.status,
      afk.map_key,
      afk.started_at,
      afk.last_settled_at,
      normalizeNumber(afk.pending_gold),
      normalizeNumber(afk.pending_aether_crystal),
      normalizeNumber(afk.pending_exp),
      normalizeNumber(afk.accrued_seconds),
    ],
  );
}

async function syncAfkRedis(afk: AfkRow) {
  const key = `afk:${afk.role_id}`;

  if (afk.status === "idle") {
    await deleteRedisKey(key);
    return;
  }

  await setRedisJson(key, {
    accruedSeconds: afk.accrued_seconds,
    lastSettledAt: toMillis(afk.last_settled_at),
    mapKey: afk.map_key,
    pendingAetherCrystal: afk.pending_aether_crystal,
    pendingExp: afk.pending_exp,
    pendingGold: afk.pending_gold,
    startedAt: toMillis(afk.started_at),
    status: afk.status,
  });
}

async function findUserByGuestToken(guestToken: string) {
  const result = await query<UserRow>(
    `SELECT user_id, guest_token, last_login_at, last_seen_at FROM "user" WHERE guest_token = $1`,
    [guestToken],
  );

  return result.rows[0] ?? null;
}

async function findRoleByUserId(userId: string) {
  const result = await query<RoleRow>(
    `
      SELECT
        role_id,
        user_id,
        name,
        race_key,
        class_key,
        level,
        exp,
        gold,
        aether_crystal,
        strength,
        agility,
        intelligence,
        vitality,
        avatar_seed
      FROM "role"
      WHERE user_id = $1
    `,
    [userId],
  );

  return result.rows[0] ?? null;
}

async function requireDashboardData(guestToken: string) {
  const user = await findUserByGuestToken(guestToken);

  if (!user) {
    throw new Error("游客会话不存在，请重新登录。");
  }

  const role = await findRoleByUserId(user.user_id);

  if (!role) {
    throw new Error("角色不存在，请先创建角色。");
  }

  const [afkResult, backpackResult] = await Promise.all([
    query<AfkRow>(
      `
        SELECT
          afk_id,
          role_id,
          status,
          map_key,
          started_at,
          last_settled_at,
          pending_gold,
          pending_aether_crystal,
          pending_exp,
          accrued_seconds
        FROM afk
        WHERE role_id = $1
      `,
      [role.role_id],
    ),
    query<BackpackRow>(
      `
        SELECT
          backpack.backpack_id,
          backpack.item_id,
          backpack.quantity,
          backpack.equipped,
          item.name,
          item.rarity,
          item.slot,
          item.description,
          item.sell_price,
          item.stat_json
        FROM backpack
        JOIN item ON item.item_id = backpack.item_id
        WHERE backpack.role_id = $1
        ORDER BY backpack.equipped DESC, item.rarity DESC, item.name ASC
      `,
      [role.role_id],
    ),
  ]);

  const afk = afkResult.rows[0];

  if (!afk) {
    throw new Error("挂机状态不存在，请重新创建角色。");
  }

  return {
    afk,
    backpack: backpackResult.rows,
    role,
    user,
  };
}

function buildSnapshot(data: DashboardData, options?: { shouldShowOfflineRewardModal?: boolean }): Day0SessionSnapshot {
  const progress = getCurrentLevelProgress(data.role.exp);
  const currentMap = data.afk.map_key ? getMapConfig(data.afk.map_key) : null;

  return {
    serverTime: Date.now(),
    account: {
      guestToken: data.user.guest_token,
      hasRole: true,
      userId: data.user.user_id,
    },
    config: {
      classes: classConfigs,
      levels: levelTable,
      maps: mapConfigs,
      races: raceConfigs,
    },
    role: {
      roleId: data.role.role_id,
      name: data.role.name,
      raceKey: data.role.race_key,
      classKey: data.role.class_key,
      level: data.role.level,
      exp: data.role.exp,
      currentLevelExp: progress.currentLevelExp,
      nextLevelExp: progress.nextLevelExp,
      gold: data.role.gold,
      aetherCrystal: data.role.aether_crystal,
      avatarSeed: data.role.avatar_seed,
      stats: {
        strength: data.role.strength,
        agility: data.role.agility,
        intelligence: data.role.intelligence,
        vitality: data.role.vitality,
      },
    },
    backpack: data.backpack.map((item) => ({
      backpackId: item.backpack_id,
      itemId: item.item_id,
      quantity: item.quantity,
      equipped: item.equipped,
      name: item.name,
      rarity: item.rarity,
      slot: item.slot,
      description: item.description,
      sellPrice: item.sell_price,
      stats: item.stat_json ?? {},
    })),
    afk: {
      status: data.afk.status,
      mapKey: data.afk.map_key,
      startedAt: toMillis(data.afk.started_at),
      lastSettledAt: toMillis(data.afk.last_settled_at),
      shouldShowOfflineRewardModal: options?.shouldShowOfflineRewardModal ?? false,
      accruedSeconds: data.afk.accrued_seconds,
      taskDurationSeconds: AFK_TASK_SECONDS,
      maxOfflineSeconds: MAX_OFFLINE_SECONDS,
      mapOptions: mapConfigs,
      currentMap: currentMap
        ? {
            key: currentMap.key,
            label: currentMap.label,
            summary: currentMap.summary,
            goldPerMinute: currentMap.goldPerMinute,
            aetherPerMinute: currentMap.aetherPerMinute,
            expPerMinute: currentMap.expPerMinute,
          }
        : null,
      pendingReward: {
        seconds: data.afk.accrued_seconds,
        gold: data.afk.pending_gold,
        aetherCrystal: data.afk.pending_aether_crystal,
        exp: data.afk.pending_exp,
      },
      estimatedHourlyReward: buildHourlyReward(data.afk.map_key),
    },
  };
}

export async function loginGuest(existingGuestToken?: string | null): Promise<GuestLoginResult> {
  const guestToken = existingGuestToken?.trim() || makeId("guest");
  const existing = existingGuestToken ? await findUserByGuestToken(existingGuestToken) : null;

  if (existing) {
    await query(
      `UPDATE "user" SET last_login_at = NOW() WHERE user_id = $1`,
      [existing.user_id],
    );

    return {
      guestToken: existing.guest_token,
      hasRole: Boolean(await findRoleByUserId(existing.user_id)),
      serverTime: Date.now(),
      userId: existing.user_id,
    };
  }

  const userId = makeId("user");

  await query(
    `
      INSERT INTO "user" (user_id, guest_token, account_type, last_login_at, last_seen_at)
      VALUES ($1, $2, 'guest', NOW(), NOW())
    `,
    [userId, guestToken],
  );

  return {
    guestToken,
    hasRole: false,
    serverTime: Date.now(),
    userId,
  };
}

export async function createRoleForGuest(input: {
  guestToken: string;
  name: string;
  raceKey: RaceKey;
  classKey: ClassKey;
}) {
  const race = getRaceConfig(input.raceKey);
  const roleClass = getClassConfig(input.classKey);
  const trimmedName = input.name.trim();

  if (!race || !roleClass) {
    throw new Error("种族或职业配置不存在。");
  }

  if (trimmedName.length < 2 || trimmedName.length > 12) {
    throw new Error("角色名需为 2 到 12 个字符。");
  }

  const user = await findUserByGuestToken(input.guestToken);

  if (!user) {
    throw new Error("游客会话失效，请重新登录。");
  }

  const existingRole = await findRoleByUserId(user.user_id);

  if (existingRole) {
    throw new Error("该游客账号已经创建过角色。");
  }

  const roleId = makeId("role");
  const afkId = makeId("afk");
  const now = new Date();
  const startingStats = {
    agility: race.stats.agility + roleClass.stats.agility,
    intelligence: race.stats.intelligence + roleClass.stats.intelligence,
    strength: race.stats.strength + roleClass.stats.strength,
    vitality: race.stats.vitality + roleClass.stats.vitality,
  };

  await withTransaction(async (client) => {
    await client.query(
      `
        INSERT INTO "role" (
          role_id,
          user_id,
          name,
          race_key,
          class_key,
          level,
          exp,
          gold,
          aether_crystal,
          strength,
          agility,
          intelligence,
          vitality,
          avatar_seed,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, 1, 0, 240, 12, $6, $7, $8, $9, $10, NOW(), NOW()
        )
      `,
      [
        roleId,
        user.user_id,
        trimmedName,
        race.key,
        roleClass.key,
        startingStats.strength,
        startingStats.agility,
        startingStats.intelligence,
        startingStats.vitality,
        trimmedName.slice(0, 1),
      ],
    );

    await client.query(
      `
        INSERT INTO afk (
          afk_id,
          role_id,
          status,
          map_key,
          started_at,
          last_settled_at,
          pending_gold,
          pending_aether_crystal,
          pending_exp,
          accrued_seconds,
          created_at,
          updated_at
        )
        VALUES ($1, $2, 'idle', NULL, NULL, $3, 0, 0, 0, 0, NOW(), NOW())
      `,
      [afkId, roleId, now],
    );

    await client.query(
      `
        INSERT INTO backpack (backpack_id, role_id, item_id, quantity, equipped, created_at, updated_at)
        VALUES
          ($1, $4, $2, 1, TRUE, NOW(), NOW()),
          ($3, $4, 'forest-cloak', 1, FALSE, NOW(), NOW()),
          ($5, $4, 'traveler-ring', 1, FALSE, NOW(), NOW())
      `,
      [
        makeId("bag"),
        roleClass.starterItemId,
        makeId("bag"),
        roleId,
        makeId("bag"),
      ],
    );

  });

  return getFullSessionSnapshot(input.guestToken);
}

export async function getGuestBootstrap(guestToken?: string | null) {
  const loginResult = await loginGuest(guestToken);

  if (!loginResult.hasRole) {
    return {
      account: {
        guestToken: loginResult.guestToken,
        hasRole: false,
        userId: loginResult.userId,
      },
      afk: {
        status: "idle" as const,
        mapKey: null,
        startedAt: null,
        lastSettledAt: null,
        shouldShowOfflineRewardModal: false,
        accruedSeconds: 0,
        taskDurationSeconds: AFK_TASK_SECONDS,
        maxOfflineSeconds: MAX_OFFLINE_SECONDS,
        mapOptions: mapConfigs,
        currentMap: null,
        pendingReward: {
          seconds: 0,
          gold: 0,
          aetherCrystal: 0,
          exp: 0,
        },
        estimatedHourlyReward: {
          seconds: 3600,
          gold: 0,
          aetherCrystal: 0,
          exp: 0,
        },
      },
      backpack: [],
      config: {
        classes: classConfigs,
        levels: levelTable,
        maps: mapConfigs,
        races: raceConfigs,
      },
      role: null,
      serverTime: Date.now(),
    };
  }

  return getFullSessionSnapshot(loginResult.guestToken);
}

export async function getFullSessionSnapshot(guestToken: string) {
  const data = await requireDashboardData(guestToken);
  const now = Date.now();
  const lastSeenAt = new Date(data.user.last_seen_at).getTime();
  const wasOffline = now - lastSeenAt > OFFLINE_MODAL_THRESHOLD_MS;
  const rewardDelta = settleAfkState(data.afk, {
    capSeconds: wasOffline ? MAX_OFFLINE_SECONDS : undefined,
    now,
  });

  const didAutoSettleOnlineReward = !wasOffline && applyRewardToRole(data.role, rewardDelta);

  if (didAutoSettleOnlineReward) {
    consumePendingReward(data.afk, rewardDelta);
  }

  const shouldShowOfflineRewardModal =
    wasOffline &&
    (data.afk.pending_gold > 0 || data.afk.pending_aether_crystal > 0 || data.afk.pending_exp > 0);

  await withTransaction(async (client) => {
    await client.query(`UPDATE "user" SET last_seen_at = NOW() WHERE user_id = $1`, [data.user.user_id]);
    if (didAutoSettleOnlineReward) {
      await persistRole(client, data.role);
    }
    await persistAfk(client, data.afk);
  });

  await syncAfkRedis(data.afk);
  data.role.level = getLevelFromExp(data.role.exp);
  return buildSnapshot(data, { shouldShowOfflineRewardModal });
}

export async function startAfk(guestToken: string, mapKey: MapKey) {
  const map = getMapConfig(mapKey);

  if (!map) {
    throw new Error("地图不存在。");
  }

  const data = await requireDashboardData(guestToken);
  const now = Date.now();
  settleAfkState(data.afk, { now });

  if (data.afk.status === "active") {
    throw new Error("当前已经处于挂机中，请先停止。");
  }

  data.afk.status = "active";
  data.afk.map_key = mapKey;
  data.afk.started_at = new Date(now);
  data.afk.last_settled_at = new Date(now);

  await withTransaction(async (client) => {
    await persistAfk(client, data.afk);
  });

  await syncAfkRedis(data.afk);
  return getFullSessionSnapshot(guestToken);
}

export async function stopAfk(guestToken: string) {
  const data = await requireDashboardData(guestToken);
  const now = Date.now();
  const rewardDelta = settleAfkState(data.afk, { now });

  if (data.afk.status === "idle") {
    return buildSnapshot(data);
  }

  if (applyRewardToRole(data.role, rewardDelta)) {
    consumePendingReward(data.afk, rewardDelta);
  }

  data.afk.status = "idle";
  data.afk.last_settled_at = new Date(now);
  discardCurrentTaskProgress(data.afk);

  await withTransaction(async (client) => {
    await persistRole(client, data.role);
    await persistAfk(client, data.afk);
  });

  await syncAfkRedis(data.afk);
  return getFullSessionSnapshot(guestToken);
}

export async function claimAfkReward(guestToken: string) {
  const data = await requireDashboardData(guestToken);
  const now = Date.now();
  const rewardDelta = settleAfkState(data.afk, {
    capSeconds: MAX_OFFLINE_SECONDS,
    now,
  });

  const lastSeenAt = new Date(data.user.last_seen_at).getTime();
  const wasOffline = now - lastSeenAt > OFFLINE_MODAL_THRESHOLD_MS;

  if (!wasOffline && applyRewardToRole(data.role, rewardDelta)) {
    consumePendingReward(data.afk, rewardDelta);
  }

  if (
    data.afk.pending_gold <= 0 &&
    data.afk.pending_aether_crystal <= 0 &&
    data.afk.pending_exp <= 0
  ) {
    return buildSnapshot(data);
  }

  data.role.gold += data.afk.pending_gold;
  data.role.aether_crystal += data.afk.pending_aether_crystal;
  data.role.exp += data.afk.pending_exp;
  data.role.level = getLevelFromExp(data.role.exp);
  data.afk.pending_gold = 0;
  data.afk.pending_aether_crystal = 0;
  data.afk.pending_exp = 0;
  data.afk.last_settled_at = new Date(now);

  await withTransaction(async (client) => {
    await persistRole(client, data.role);
    await persistAfk(client, data.afk);
  });

  await syncAfkRedis(data.afk);
  return getFullSessionSnapshot(guestToken);
}

export function getCreateRoleOptions() {
  return {
    classes: classConfigs,
    races: raceConfigs,
  };
}

export function isValidRaceKey(value: string): value is RaceKey {
  return raceConfigs.some((item) => item.key === value);
}

export function isValidClassKey(value: string): value is ClassKey {
  return classConfigs.some((item) => item.key === value);
}

export function isValidMapKey(value: string): value is MapKey {
  return mapConfigs.some((item) => item.key === value);
}

export function getLevelOverview() {
  return {
    expPerLevel: EXP_PER_LEVEL,
    levelCap: levelTable.length,
    levels: levelTable,
  };
}
