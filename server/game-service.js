const { query, withTransaction } = require("./db");

const MAX_OFFLINE_SECONDS = 8 * 60 * 60;
const AFK_TASK_SECONDS = 10;
const LEVEL_CAP = 30;
const EXP_PER_LEVEL = 100;
const OFFLINE_MODAL_THRESHOLD_MS = 45 * 1000;

const raceConfigs = [
  {
    key: "human",
    label: "人类",
    summary: "四维均衡，最适合 Day0 的万能开荒模版。",
    stats: { strength: 5, agility: 5, intelligence: 5, vitality: 5 },
  },
  {
    key: "elf",
    label: "精灵",
    summary: "速度和法感更高，挂机效率偏灵巧与法术。",
    stats: { strength: 3, agility: 7, intelligence: 7, vitality: 3 },
  },
  {
    key: "dwarf",
    label: "矮人",
    summary: "更硬更稳，适合站桩和长期刷图。",
    stats: { strength: 7, agility: 3, intelligence: 3, vitality: 7 },
  },
];

const classConfigs = [
  {
    key: "warrior",
    label: "战士",
    summary: "近战起步快，初始金币与白装最实用。",
    starterItemId: "rusty-blade",
    stats: { strength: 4, agility: 2, intelligence: 0, vitality: 3 },
  },
  {
    key: "mage",
    label: "法师",
    summary: "智力成长高，预计收益里的经验占比更高。",
    starterItemId: "oak-staff",
    stats: { strength: 0, agility: 2, intelligence: 5, vitality: 2 },
  },
  {
    key: "farmer",
    label: "农民",
    summary: "务实稳定，适合 Day0 的挂机与资源周转。",
    starterItemId: "field-hoe",
    stats: { strength: 2, agility: 2, intelligence: 1, vitality: 4 },
  },
];

const mapConfigs = [
  {
    key: "palmia-wilds",
    label: "帕罗米亚野外",
    summary: "收益平衡，适合刚创角时开第一张图。",
    goldPerMinute: 20,
    aetherPerMinute: 0.25,
    expPerMinute: 10,
  },
];

const levelTable = Array.from({ length: LEVEL_CAP }, (_, index) => ({
  level: index + 1,
  totalExpRequired: index * EXP_PER_LEVEL,
}));

function toMillis(value) {
  return value ? new Date(value).getTime() : null;
}

function normalizeNumber(value) {
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? Math.max(0, Math.floor(numericValue)) : 0;
}

function getLevelFromExp(exp) {
  return Math.min(LEVEL_CAP, Math.floor(Math.max(0, exp) / EXP_PER_LEVEL) + 1);
}

function getCurrentLevelProgress(exp) {
  const currentLevel = getLevelFromExp(exp);
  const currentBase = (currentLevel - 1) * EXP_PER_LEVEL;
  const nextRequirement = currentLevel >= LEVEL_CAP ? currentBase : currentLevel * EXP_PER_LEVEL;

  return {
    currentLevel,
    currentLevelExp: Math.max(0, exp - currentBase),
    nextLevelExp: currentLevel >= LEVEL_CAP ? 0 : nextRequirement - currentBase,
  };
}

function getMapConfig(mapKey) {
  return mapConfigs.find((item) => item.key === mapKey) || null;
}

function buildHourlyReward(mapKey) {
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

function buildRewardForSeconds(mapKey, seconds) {
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

function buildRewardDeltaForExecutions(mapKey, previousExecutions, nextExecutions) {
  const previousReward = buildRewardForSeconds(mapKey, previousExecutions * AFK_TASK_SECONDS);
  const nextReward = buildRewardForSeconds(mapKey, nextExecutions * AFK_TASK_SECONDS);

  return {
    aetherCrystal: Math.max(0, nextReward.aetherCrystal - previousReward.aetherCrystal),
    exp: Math.max(0, nextReward.exp - previousReward.exp),
    executions: Math.max(0, nextExecutions - previousExecutions),
    gold: Math.max(0, nextReward.gold - previousReward.gold),
  };
}

function applyRewardToRole(role, reward) {
  if (reward.gold <= 0 && reward.aetherCrystal <= 0 && reward.exp <= 0) {
    return false;
  }

  role.gold += reward.gold;
  role.aether_crystal += reward.aetherCrystal;
  role.exp += reward.exp;
  role.level = getLevelFromExp(role.exp);
  return true;
}

function settleAfkState(afk, options = {}) {
  const now = options.now || Date.now();
  const emptyReward = { aetherCrystal: 0, exp: 0, executions: 0, gold: 0 };

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

  const grantedSeconds = options.capSeconds === undefined
    ? elapsedSeconds
    : Math.min(elapsedSeconds, Math.max(0, options.capSeconds));
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

function consumePendingReward(afk, reward) {
  afk.pending_gold = Math.max(0, afk.pending_gold - reward.gold);
  afk.pending_aether_crystal = Math.max(0, afk.pending_aether_crystal - reward.aetherCrystal);
  afk.pending_exp = Math.max(0, afk.pending_exp - reward.exp);
}

function discardCurrentTaskProgress(afk) {
  afk.accrued_seconds = 0;
}

async function persistRole(client, role) {
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

async function persistAfk(client, afk) {
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

async function findUserByGuestToken(guestToken) {
  const result = await query(
    `SELECT user_id, guest_token, last_login_at, last_seen_at FROM "user" WHERE guest_token = $1`,
    [guestToken],
  );

  return result.rows[0] || null;
}

async function findRoleByUserId(userId) {
  const result = await query(
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

  return result.rows[0] || null;
}

async function requireDashboardData(guestToken) {
  const user = await findUserByGuestToken(guestToken);

  if (!user) {
    throw new Error("游客会话不存在，请重新登录。");
  }

  const role = await findRoleByUserId(user.user_id);

  if (!role) {
    throw new Error("角色不存在，请先创建角色。");
  }

  const [afkResult, backpackResult, taskResult] = await Promise.all([
    query(
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
    query(
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
    query(
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

function buildSnapshot(data, options = {}) {
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
      stats: item.stat_json || {},
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
      shouldShowOfflineRewardModal: options.shouldShowOfflineRewardModal || false,
      accruedSeconds: data.afk.accrued_seconds,
      taskDurationSeconds: AFK_TASK_SECONDS,
      maxOfflineSeconds: MAX_OFFLINE_SECONDS,
      mapOptions: mapConfigs,
      currentMap,
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

function buildBootstrapSnapshot(user) {
  return {
    account: {
      guestToken: user.guest_token,
      hasRole: false,
      userId: user.user_id,
    },
    afk: {
      status: "idle",
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
    tasks: [],
  };
}

async function getSessionSnapshot(guestToken) {
  const user = await findUserByGuestToken(guestToken);

  if (!user) {
    throw new Error("游客会话不存在，请重新登录。");
  }

  const role = await findRoleByUserId(user.user_id);

  if (!role) {
    return buildBootstrapSnapshot(user);
  }

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

  data.role.level = getLevelFromExp(data.role.exp);
  return buildSnapshot(data, { shouldShowOfflineRewardModal });
}

async function markFirstAfkTaskCompleted(client, roleId) {
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

async function startAfkForGuest(guestToken, mapKey) {
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
    await markFirstAfkTaskCompleted(client, data.role.role_id);
  });

  return getSessionSnapshot(guestToken);
}

async function stopAfkForGuest(guestToken) {
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

  return getSessionSnapshot(guestToken);
}

async function claimAfkRewardForGuest(guestToken) {
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

  return getSessionSnapshot(guestToken);
}

module.exports = {
  AFK_TASK_SECONDS,
  getSessionSnapshot,
  startAfkForGuest,
  stopAfkForGuest,
  claimAfkRewardForGuest,
};
