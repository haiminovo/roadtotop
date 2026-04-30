import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import {
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
  starterTaskTemplates,
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
  bound_gold: number;
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
  pending_bound_gold: number;
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

type TaskRow = {
  task_id: string;
  code: string;
  title: string;
  description: string;
  status: "active" | "completed";
  progress: number;
  target: number;
  reward_gold: number;
  reward_exp: number;
};

type RewardPreview = {
  seconds: number;
  gold: number;
  boundGold: number;
  aetherCrystal: number;
  exp: number;
};

type DashboardData = {
  user: UserRow;
  role: RoleRow;
  afk: AfkRow;
  backpack: BackpackRow[];
  tasks: TaskRow[];
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
    boundGold: number;
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
  tasks: Array<{
    taskId: string;
    code: string;
    title: string;
    description: string;
    status: "active" | "completed";
    progress: number;
    target: number;
    rewardGold: number;
    rewardExp: number;
  }>;
  afk: {
    status: "idle" | "active";
    mapKey: MapKey | null;
    startedAt: number | null;
    lastSettledAt: number | null;
    accruedSeconds: number;
    maxOfflineSeconds: number;
    mapOptions: typeof mapConfigs;
    currentMap: null | {
      key: MapKey;
      label: string;
      summary: string;
      goldPerMinute: number;
      boundGoldPerMinute: number;
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

function makeId(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

function toMillis(value: Date | null) {
  return value ? new Date(value).getTime() : null;
}

function normalizeNumber(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function computeGrowth(previousSeconds: number, nextSeconds: number, perMinute: number) {
  const previousTotal = Math.floor((Math.max(0, previousSeconds) * perMinute) / 60);
  const nextTotal = Math.floor((Math.max(0, nextSeconds) * perMinute) / 60);
  return Math.max(0, nextTotal - previousTotal);
}

function buildHourlyReward(mapKey: MapKey | null): RewardPreview {
  const map = mapKey ? getMapConfig(mapKey) : null;

  if (!map) {
    return {
      seconds: 3600,
      gold: 0,
      boundGold: 0,
      aetherCrystal: 0,
      exp: 0,
    };
  }

  return {
    seconds: 3600,
    gold: map.goldPerMinute * 60,
    boundGold: map.boundGoldPerMinute * 60,
    aetherCrystal: Math.floor(map.aetherPerMinute * 60),
    exp: map.expPerMinute * 60,
  };
}

function settleAfkState(afk: AfkRow, now = Date.now()) {
  if (afk.status !== "active" || !afk.map_key || !afk.last_settled_at) {
    return afk;
  }

  const map = getMapConfig(afk.map_key);

  if (!map) {
    return afk;
  }

  const elapsedSeconds = Math.max(
    0,
    Math.floor((now - new Date(afk.last_settled_at).getTime()) / 1000),
  );

  if (elapsedSeconds <= 0) {
    return afk;
  }

  const remainingSeconds = Math.max(0, MAX_OFFLINE_SECONDS - afk.accrued_seconds);
  const grantedSeconds = Math.min(elapsedSeconds, remainingSeconds);
  const nextAccruedSeconds = afk.accrued_seconds + grantedSeconds;

  afk.pending_gold += computeGrowth(afk.accrued_seconds, nextAccruedSeconds, map.goldPerMinute);
  afk.pending_bound_gold += computeGrowth(
    afk.accrued_seconds,
    nextAccruedSeconds,
    map.boundGoldPerMinute,
  );
  afk.pending_aether_crystal += computeGrowth(
    afk.accrued_seconds,
    nextAccruedSeconds,
    map.aetherPerMinute,
  );
  afk.pending_exp += computeGrowth(afk.accrued_seconds, nextAccruedSeconds, map.expPerMinute);
  afk.accrued_seconds = nextAccruedSeconds;
  afk.last_settled_at = new Date(now);
  return afk;
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
        pending_bound_gold = $7,
        pending_aether_crystal = $8,
        pending_exp = $9,
        accrued_seconds = $10,
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
      normalizeNumber(afk.pending_bound_gold),
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
    pendingBoundGold: afk.pending_bound_gold,
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
        bound_gold,
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

  const [afkResult, backpackResult, taskResult] = await Promise.all([
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
          pending_bound_gold,
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
    query<TaskRow>(
      `
        SELECT
          task_id,
          code,
          title,
          description,
          status,
          progress,
          target,
          reward_gold,
          reward_exp
        FROM task
        WHERE role_id = $1
        ORDER BY created_at ASC
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
    tasks: taskResult.rows,
    user,
  };
}

function buildSnapshot(data: DashboardData): Day0SessionSnapshot {
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
      boundGold: data.role.bound_gold,
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
    tasks: data.tasks.map((task) => ({
      taskId: task.task_id,
      code: task.code,
      title: task.title,
      description: task.description,
      status: task.status,
      progress: task.progress,
      target: task.target,
      rewardGold: task.reward_gold,
      rewardExp: task.reward_exp,
    })),
    afk: {
      status: data.afk.status,
      mapKey: data.afk.map_key,
      startedAt: toMillis(data.afk.started_at),
      lastSettledAt: toMillis(data.afk.last_settled_at),
      accruedSeconds: data.afk.accrued_seconds,
      maxOfflineSeconds: MAX_OFFLINE_SECONDS,
      mapOptions: mapConfigs,
      currentMap: currentMap
        ? {
            key: currentMap.key,
            label: currentMap.label,
            summary: currentMap.summary,
            goldPerMinute: currentMap.goldPerMinute,
            boundGoldPerMinute: currentMap.boundGoldPerMinute,
            aetherPerMinute: currentMap.aetherPerMinute,
            expPerMinute: currentMap.expPerMinute,
          }
        : null,
      pendingReward: {
        seconds: data.afk.accrued_seconds,
        gold: data.afk.pending_gold,
        boundGold: data.afk.pending_bound_gold,
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
      `UPDATE "user" SET last_login_at = NOW(), last_seen_at = NOW() WHERE user_id = $1`,
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
          bound_gold,
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
          $1, $2, $3, $4, $5, 1, 0, 180, 60, 12, $6, $7, $8, $9, $10, NOW(), NOW()
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
          pending_bound_gold,
          pending_aether_crystal,
          pending_exp,
          accrued_seconds,
          created_at,
          updated_at
        )
        VALUES ($1, $2, 'idle', NULL, NULL, $3, 0, 0, 0, 0, 0, NOW(), NOW())
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

    for (const taskTemplate of starterTaskTemplates) {
      const isCreateRoleTask = taskTemplate.code === "create-role";

      await client.query(
        `
          INSERT INTO task (
            task_id,
            role_id,
            code,
            title,
            description,
            status,
            progress,
            target,
            reward_gold,
            reward_exp,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        `,
        [
          makeId("task"),
          roleId,
          taskTemplate.code,
          taskTemplate.title,
          taskTemplate.description,
          isCreateRoleTask ? "completed" : "active",
          isCreateRoleTask ? taskTemplate.target : 0,
          taskTemplate.target,
          taskTemplate.rewardGold,
          taskTemplate.rewardExp,
        ],
      );
    }
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
        accruedSeconds: 0,
        maxOfflineSeconds: MAX_OFFLINE_SECONDS,
        mapOptions: mapConfigs,
        currentMap: null,
        pendingReward: {
          seconds: 0,
          gold: 0,
          boundGold: 0,
          aetherCrystal: 0,
          exp: 0,
        },
        estimatedHourlyReward: {
          seconds: 3600,
          gold: 0,
          boundGold: 0,
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
      tasks: [],
    };
  }

  return getFullSessionSnapshot(loginResult.guestToken);
}

export async function getFullSessionSnapshot(guestToken: string) {
  const data = await requireDashboardData(guestToken);
  const now = Date.now();
  settleAfkState(data.afk, now);

  await withTransaction(async (client) => {
    await client.query(`UPDATE "user" SET last_seen_at = NOW() WHERE user_id = $1`, [data.user.user_id]);
    await persistAfk(client, data.afk);
  });

  await syncAfkRedis(data.afk);
  data.role.level = getLevelFromExp(data.role.exp);
  return buildSnapshot(data);
}

async function markFirstAfkTaskCompleted(client: PoolClient, roleId: string) {
  await client.query(
    `
      UPDATE task
      SET
        status = 'completed',
        progress = target,
        updated_at = NOW()
      WHERE role_id = $1 AND code = 'first-afk'
    `,
    [roleId],
  );
}

export async function startAfk(guestToken: string, mapKey: MapKey) {
  const map = getMapConfig(mapKey);

  if (!map) {
    throw new Error("地图不存在。");
  }

  const data = await requireDashboardData(guestToken);
  const now = Date.now();
  settleAfkState(data.afk, now);

  if (data.afk.status === "active") {
    throw new Error("当前已经处于挂机中，请先停止。");
  }

  data.afk.status = "active";
  data.afk.map_key = mapKey;
  data.afk.started_at = new Date(now);
  data.afk.last_settled_at = new Date(now);

  await withTransaction(async (client) => {
    await persistAfk(client, data.afk);
    await markFirstAfkTaskCompleted(client, data.role.role_id);
  });

  await syncAfkRedis(data.afk);
  return getFullSessionSnapshot(guestToken);
}

export async function stopAfk(guestToken: string) {
  const data = await requireDashboardData(guestToken);
  const now = Date.now();
  settleAfkState(data.afk, now);

  if (data.afk.status === "idle") {
    return buildSnapshot(data);
  }

  data.afk.status = "idle";
  data.afk.last_settled_at = new Date(now);

  await withTransaction(async (client) => {
    await persistAfk(client, data.afk);
  });

  await syncAfkRedis(data.afk);
  return getFullSessionSnapshot(guestToken);
}

export async function claimAfkReward(guestToken: string) {
  const data = await requireDashboardData(guestToken);
  const now = Date.now();
  settleAfkState(data.afk, now);

  if (
    data.afk.pending_gold <= 0 &&
    data.afk.pending_bound_gold <= 0 &&
    data.afk.pending_aether_crystal <= 0 &&
    data.afk.pending_exp <= 0
  ) {
    return buildSnapshot(data);
  }

  data.role.gold += data.afk.pending_gold;
  data.role.bound_gold += data.afk.pending_bound_gold;
  data.role.aether_crystal += data.afk.pending_aether_crystal;
  data.role.exp += data.afk.pending_exp;
  data.role.level = getLevelFromExp(data.role.exp);
  data.afk.pending_gold = 0;
  data.afk.pending_bound_gold = 0;
  data.afk.pending_aether_crystal = 0;
  data.afk.pending_exp = 0;
  data.afk.accrued_seconds = 0;
  data.afk.last_settled_at = new Date(now);

  await withTransaction(async (client) => {
    await client.query(
      `
        UPDATE "role"
        SET
          level = $2,
          exp = $3,
          gold = $4,
          bound_gold = $5,
          aether_crystal = $6,
          updated_at = NOW()
        WHERE role_id = $1
      `,
      [
        data.role.role_id,
        data.role.level,
        data.role.exp,
        normalizeNumber(data.role.gold),
        normalizeNumber(data.role.bound_gold),
        normalizeNumber(data.role.aether_crystal),
      ],
    );
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
