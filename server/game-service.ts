// ============================================================
// 核心游戏逻辑 - 挂机、战斗、离线收益、背包、市场、PVP
// ============================================================

import { query, withTransaction } from './db.js';
import { getGameConfig } from './dynamic-game-config.js';
import type { DynamicGameConfig, ItemCatalogEntry, SystemBalance } from '../src/lib/server/admin-config';
import type {
  RaceConfig, ClassConfig, MapConfig, SkillTemplate,
  EnemyTemplate, EventRule, EventAction,
} from '../src/lib/game-config';
import {
  getMaxHealth, getLevelFromExp, getExpRequiredForLevel,
  getSkillSlots, getSkillUsesPerBattle,
  getBodySlotCapacities, AFK_TASK_SECONDS, MAX_OFFLINE_SECONDS,
} from '../src/lib/game-config';

// --- 类型 ---
interface RoleRow {
  role_id: number; user_id: number; name: string; race_key: string; class_key: string;
  level: number; exp: number; gold: number; aether_crystal: number;
  strength: number; intelligence: number; agility: number; vitality: number;
  current_health: number; avatar_seed: string; skill_state: unknown;
  pvp_rating: number; pvp_wins: number; pvp_losses: number;
}

interface AfkRow {
  afk_id: number; role_id: number; status: string; activity_key: string; map_key: string;
  pending_gold: number; pending_aether: number; pending_exp: number;
  accrued_seconds: number; last_settled_at: string;
  recent_encounters: unknown; battle_state: unknown;
}

interface BackpackRow {
  backpack_id: number; role_id: number; item_id: number; quantity: number;
  equipped: boolean; equipped_slot_groups: unknown;
  current_durability: number; max_durability: number; repair_count: number;
}

interface EnemyInstance {
  key: string; name: string; health: number; maxHealth: number;
  stats: { strength: number; intelligence: number; agility: number; vitality: number };
  actionSpeed: number;
  actionPoints: number; effects: StatusEffect[];
  alive: boolean;
}

interface BattleState {
  enemies: EnemyInstance[];
  totalEnemies: number;
  defeatedCount: number;
  playerHealth: number; playerMaxHealth: number;
  playerActionPoints: number;
  playerEffects: StatusEffect[];
  logs: BattleLog[];
  playerSkillStates: Record<string, { used: number; cooldownLeft: number }>;
  result: 'ongoing' | 'win' | 'lose';
  // 兼容旧字段
  enemyKey: string; enemyName: string; enemyHealth: number; enemyMaxHealth: number;
  enemyStats: { strength: number; intelligence: number; agility: number; vitality: number };
  enemyActionPoints: number; enemyEffects: StatusEffect[];
}

interface StatusEffect { type: string; value?: number; duration: number; source: 'player' | 'enemy'; }
interface BattleLog {
  timestamp: number;
  message: string;
  type: 'damage' | 'heal' | 'effect' | 'info';
  attackerIndex?: number;
  targetIndex?: number;
  actionKind?: 'basic' | 'skill' | 'dot';
  effectKind?: 'slash' | 'projectile' | 'lightning' | 'status_burst';
  effectStyle?: 'arrow' | 'stab' | 'bolt';
  effectColor?: string;
  statusType?: string;
}

type QueryRunner = typeof query;

// --- 工具函数 ---
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(): number {
  return Math.random();
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickRandomByWeight<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function randomMultiplier(min = 0.85, max = 1.15): number {
  return min + Math.random() * (max - min);
}

function varyInt(value: number, min = 0.85, max = 1.15): number {
  return Math.max(1, Math.floor(value * randomMultiplier(min, max)));
}

function calculateActionGainPerTick(agility: number, config: DynamicGameConfig): number {
  const base = config.systemBalance.baseActionSpeed || 10;
  const perFiveAgility = config.systemBalance.actionSpeedPer5Agi || 1;
  const agilitySteps = Math.floor(Math.max(0, agility) / 5);
  return Math.max(1, Math.floor(base + agilitySteps * perFiveAgility));
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// --- 创建角色 ---
export async function createRole(userId: number, name: string, raceKey: string, classKey: string) {
  const config = await getGameConfig();
  const race = config.raceConfigs.find(r => r.key === raceKey);
  const cls = config.classConfigs.find(c => c.key === classKey);
  if (!race || !cls) throw new Error('无效的种族或职业');

  const stats = {
    strength: cls.baseStats.strength + race.statBonus.strength,
    intelligence: cls.baseStats.intelligence + race.statBonus.intelligence,
    agility: cls.baseStats.agility + race.statBonus.agility,
    vitality: cls.baseStats.vitality + race.statBonus.vitality,
  };
  const maxHp = getMaxHealth(1, stats.vitality);
  const avatarSeed = `${raceKey}_${classKey}_${Date.now()}`;

  const result = await withTransaction(async (txQuery) => {
    const roleResult = await txQuery(
      `INSERT INTO role (user_id, name, race_key, class_key, strength, intelligence, agility, vitality, current_health, avatar_seed)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING role_id`,
      [userId, name, raceKey, classKey, stats.strength, stats.intelligence, stats.agility, stats.vitality, maxHp, avatarSeed]
    );
    const roleId = roleResult.rows[0].role_id;
    await txQuery(
      `INSERT INTO afk (role_id, status, activity_key, map_key) VALUES ($1, 'idle', 'combat', 'plains')`,
      [roleId]
    );
    return roleId;
  });
  return result;
}

// --- 获取完整会话快照 ---
export async function getSessionSnapshot(userId: number) {
  const config = await getGameConfig();
  const roleResult = await query('SELECT * FROM role WHERE user_id=$1', [userId]);
  if (roleResult.rows.length === 0) return null;
  const role = roleResult.rows[0] as RoleRow;

  const { level, currentExp, requiredExp } = getLevelFromExp(role.exp);
  const maxHp = getMaxHealth(level, role.vitality);
  const skillState = parseJson<{ equippedSkills: string[]; learnedSkills: string[] }>(role.skill_state, { equippedSkills: [], learnedSkills: [] });

  // 背包
  const backpackResult = await query(
    `SELECT b.*, i.name, i.rarity, i.item_type, i.skill_key, i.icon_key, i.slot, i.slot_usage,
            i.sell_price, i.description, i.stat_json, i.level_requirement
     FROM backpack b JOIN item i ON b.item_id = i.item_id WHERE b.role_id=$1 ORDER BY b.backpack_id`,
    [role.role_id]
  );

  // 挂机状态
  const afkResult = await query('SELECT * FROM afk WHERE role_id=$1', [role.role_id]);
  const afk = afkResult.rows[0] as AfkRow | undefined;

  // 市场
  const marketResult = await query(
    `SELECT ml.*, i.name as item_name, i.rarity as item_rarity, i.item_type, i.icon_key,
            r.name as seller_name
     FROM market_listing ml JOIN item i ON ml.item_id = i.item_id
     JOIN role r ON ml.seller_role_id = r.role_id
     WHERE ml.status='active' ORDER BY ml.created_at DESC LIMIT 50`
  );
  const myListings = await query(
    `SELECT ml.*, i.name as item_name, i.rarity as item_rarity, i.item_type, i.icon_key
     FROM market_listing ml JOIN item i ON ml.item_id = i.item_id
     WHERE ml.seller_role_id=$1 AND ml.status='active' ORDER BY ml.created_at DESC`,
    [role.role_id]
  );

  // PVP 排行榜
  const leaderboardResult = await query(
    `SELECT role_id, name, level, pvp_rating, pvp_wins, pvp_losses
     FROM role ORDER BY pvp_rating DESC LIMIT 20`
  );

  // PVP 战斗记录
  const pvpBattles = await query(
    `SELECT pb.*,
            CASE WHEN pb.challenger_id=$1 THEN r2.name ELSE r1.name END as opponent_name,
            CASE WHEN pb.challenger_id=$1 THEN r2.level ELSE r1.level END as opponent_level
     FROM pvp_battle pb
     JOIN role r1 ON pb.challenger_id = r1.role_id
     JOIN role r2 ON pb.defender_id = r2.role_id
     WHERE pb.challenger_id=$1 OR pb.defender_id=$1
     ORDER BY pb.created_at DESC LIMIT 20`,
    [role.role_id]
  );

  // 构建装备槽位
  const bodySlotCapacities = getBodySlotCapacities(role.race_key as never);
  const bodySlots: Record<string, unknown[]> = {};
  for (const slot of Object.keys(bodySlotCapacities)) {
    bodySlots[slot] = [];
  }
  for (const row of backpackResult.rows) {
    if (row.equipped && row.slot) {
      const equippedGroups = parseJson<number[][]>(row.equipped_slot_groups, []);
      bodySlots[row.slot] = bodySlots[row.slot] || [];
      bodySlots[row.slot].push({
        backpackId: row.backpack_id, itemId: row.item_id,
        name: row.name, rarity: row.rarity, iconKey: row.icon_key,
        statJson: parseJson(row.stat_json, {}),
        currentDurability: toNumber(row.current_durability),
        maxDurability: toNumber(row.max_durability, 100),
        repairCount: row.repair_count,
      });
    }
  }

  // 技能书
  const skillBooks = backpackResult.rows
    .filter(r => r.item_type === 'skill_book')
    .map(r => ({ key: r.skill_key, name: r.name }));

  // 挂机收益估算
  const mapConfig = config.mapConfigs.find(m => m.key === (afk?.map_key || 'plains'));
  const estimatedHourly = mapConfig ? {
    gold: Math.floor(mapConfig.goldPerTask * 3600 / AFK_TASK_SECONDS),
    aether: Math.floor(mapConfig.aetherPerTask * 3600 / AFK_TASK_SECONDS),
    exp: Math.floor(mapConfig.expPerTask * 3600 / AFK_TASK_SECONDS),
  } : { gold: 0, aether: 0, exp: 0 };

  // 构建背包条目
  const backpack = backpackResult.rows.map(row => ({
    backpackId: row.backpack_id, itemId: row.item_id,
    name: row.name, rarity: row.rarity, itemType: row.item_type,
    iconKey: row.icon_key, slot: row.slot, slotUsage: row.slot_usage,
    quantity: row.quantity, equipped: row.equipped,
    equippedSlotGroups: parseJson<number[][]>(row.equipped_slot_groups, []),
    currentDurability: toNumber(row.current_durability),
    maxDurability: toNumber(row.max_durability, 100),
    repairCount: row.repair_count,
    sellPrice: row.sell_price, description: row.description,
    statJson: parseJson<Record<string, number>>(row.stat_json, {}),
    levelRequirement: row.level_requirement, skillKey: row.skill_key,
  }));

  return {
    account: {
      guestToken: '', mode: 'guest' as const, username: null, userId,
    },
    config: {
      activities: config.activityConfigs,
      classes: config.classConfigs,
      levels: Array.from({ length: config.systemBalance.levelCap }, (_, i) => ({
        level: i + 1, requiredExp: getExpRequiredForLevel(i + 1),
      })),
      maps: config.mapConfigs,
      races: config.raceConfigs,
    },
    role: {
      roleId: role.role_id, name: role.name, raceKey: role.race_key, classKey: role.class_key,
      level, exp: role.exp, currentExp, requiredExp,
      gold: role.gold, aetherCrystal: role.aether_crystal,
      stats: { strength: role.strength, intelligence: role.intelligence, agility: role.agility, vitality: role.vitality },
      secondaryStats: {
        maxHealth: maxHp, actionSpeed: calculateActionGainPerTick(role.agility, config),
        skillSlots: getSkillSlots(role.intelligence), skillUsesPerBattle: getSkillUsesPerBattle(role.intelligence),
      },
      bodySlotCapacities, bodySlots,
      equippedSkills: skillState.equippedSkills, learnedSkills: skillState.learnedSkills,
      skillBooks, currentHealth: role.current_health, avatarSeed: role.avatar_seed,
      pvpRating: role.pvp_rating, pvpWins: role.pvp_wins, pvpLosses: role.pvp_losses,
    },
    backpack,
    afk: buildAfkSnapshot(afk, config, role),
    market: {
      feeRatePercent: config.systemBalance.marketFeePercent,
      listings: marketResult.rows.map(r => ({
        listingId: r.listing_id, sellerRoleId: r.seller_role_id, sellerName: r.seller_name,
        itemId: r.item_id, itemName: r.item_name, itemRarity: r.item_rarity,
        itemType: r.item_type, iconKey: r.icon_key, categoryKey: r.category_key, quantity: r.quantity,
        price: r.price, currentDurability: r.current_durability == null ? null : toNumber(r.current_durability),
        maxDurability: r.max_durability == null ? null : toNumber(r.max_durability, 100),
        status: r.status, createdAt: r.created_at,
      })),
      myListings: myListings.rows.map(r => ({
        listingId: r.listing_id, sellerRoleId: r.seller_role_id, sellerName: '',
        itemId: r.item_id, itemName: r.item_name, itemRarity: r.item_rarity,
        itemType: r.item_type, iconKey: r.icon_key, categoryKey: r.category_key, quantity: r.quantity,
        price: r.price, currentDurability: r.current_durability == null ? null : toNumber(r.current_durability),
        maxDurability: r.max_durability == null ? null : toNumber(r.max_durability, 100),
        status: r.status, createdAt: r.created_at,
      })),
    },
    pvp: {
      rating: role.pvp_rating, wins: role.pvp_wins, losses: role.pvp_losses,
      leaderboard: leaderboardResult.rows.map((r, i) => ({
        rank: i + 1, roleId: r.role_id, name: r.name, level: r.level,
        rating: r.pvp_rating, wins: r.pvp_wins, losses: r.pvp_losses,
      })),
      recentBattles: pvpBattles.rows.map(r => ({
        battleId: r.battle_id, opponentName: r.opponent_name, opponentLevel: r.opponent_level,
        result: r.winner_id === role.role_id ? 'win' as const : 'lose' as const,
        ratingChange: r.rating_change, createdAt: r.created_at,
      })),
    },
  };
}

function buildAfkSnapshot(afk: AfkRow | undefined, config: DynamicGameConfig, role: RoleRow) {
  if (!afk) return {
    status: 'idle' as const, activityKey: 'combat' as const, mapKey: 'plains',
    pendingReward: { gold: 0, aether: 0, exp: 0 },
    estimatedHourlyReward: { gold: 0, aether: 0, exp: 0 },
    encounterRates: { common: 0.3, rare: 0.1, legendary: 0.01 },
    recentEncounters: [], battle: null, accruedSeconds: 0,
  };

  const mapConfig = config.mapConfigs.find(m => m.key === afk.map_key);
  const battleState = parseJson<BattleState | null>(afk.battle_state, null);

  return {
    status: afk.status as 'idle' | 'afk' | 'battle',
    activityKey: afk.activity_key as 'combat' | 'gathering' | 'fishing',
    mapKey: afk.map_key,
    pendingReward: { gold: afk.pending_gold, aether: afk.pending_aether, exp: afk.pending_exp },
    estimatedHourlyReward: mapConfig ? {
      gold: Math.floor(mapConfig.goldPerTask * 3600 / AFK_TASK_SECONDS),
      aether: Math.floor(mapConfig.aetherPerTask * 3600 / AFK_TASK_SECONDS),
      exp: Math.floor(mapConfig.expPerTask * 3600 / AFK_TASK_SECONDS),
    } : { gold: 0, aether: 0, exp: 0 },
    encounterRates: { common: 0.3, rare: 0.1, legendary: 0.01 },
    recentEncounters: parseJson(afk.recent_encounters, []),
    battle: battleState ? buildBattleSnapshot(battleState, role, config) : null,
    accruedSeconds: afk.accrued_seconds,
  };
}

function buildBattleSnapshot(bs: BattleState, role: RoleRow, config: DynamicGameConfig) {
  // 解析玩家装备的技能（无装备技能时默认展示普攻）
  const skillState = parseJson<{ equippedSkills: string[] }>(role.skill_state, { equippedSkills: [] });
  const equippedKeys = skillState.equippedSkills.length > 0 ? skillState.equippedSkills : ['slash'];
  const playerSkills = equippedKeys
    .map((key: string) => config.skillTemplates.find(s => s.key === key))
    .filter((s): s is SkillTemplate => Boolean(s))
    .map((s: SkillTemplate) => ({ key: s.key, name: s.name, category: s.category, description: s.description, maxUses: s.maxUses, cooldown: s.cooldown, effects: s.effects.map(e => ({ type: e.type, chance: e.chance, duration: e.duration })) }));

  return {
    enemies: bs.enemies.map(e => {
      // 解析敌人技能
      const template = config.enemyTemplates.find(t => t.key === e.key);
      const skills = (template?.fixedSkillKeys || [])
        .map(key => config.skillTemplates.find(s => s.key === key))
        .filter((s): s is SkillTemplate => Boolean(s))
        .map(s => ({ key: s.key, name: s.name, category: s.category, description: s.description, maxUses: s.maxUses, cooldown: s.cooldown, effects: s.effects.map(eff => ({ type: eff.type, chance: eff.chance, duration: eff.duration })) }));
      return {
        key: e.key, name: e.name, health: e.health, maxHealth: e.maxHealth,
        stats: e.stats, actionSpeed: e.actionSpeed,
        actionPoints: Math.min(100, e.actionPoints),
        effects: e.effects, alive: e.alive, skills,
      };
    }),
    totalEnemies: bs.totalEnemies, defeatedCount: bs.defeatedCount,
    playerHealth: bs.playerHealth, playerMaxHealth: bs.playerMaxHealth,
    playerActionPoints: Math.min(100, bs.playerActionPoints),
    playerEffects: bs.playerEffects,
    logs: bs.logs.slice(-30), playerSkillStates: bs.playerSkillStates, result: bs.result,
    playerSkills,
  };
}

// --- 开始挂机 ---
export async function startAfk(userId: number, activityKey: string, mapKey: string) {
  const config = await getGameConfig();
  const map = config.mapConfigs.find(m => m.key === mapKey);
  if (!map) throw new Error('无效的地图');
  const role = await getRoleByUserId(userId);
  const { level } = getLevelFromExp(role.exp);
  if (level < map.levelRequired) throw new Error(`需要等级 ${map.levelRequired}`);

  // 同步等级到数据库
  if (level !== role.level) {
    await query('UPDATE role SET level=$1, updated_at=NOW() WHERE role_id=$2', [level, role.role_id]);
  }

  // 先结算离线收益
  await settleAfkState(userId);

  await query(
    `UPDATE afk SET status='afk', activity_key=$1, map_key=$2, updated_at=NOW() WHERE role_id=$3`,
    [activityKey, mapKey, role.role_id]
  );
}

// --- 停止挂机 ---
export async function stopAfk(userId: number) {
  await settleAfkState(userId);
  const role = await getRoleByUserId(userId);
  await query(`UPDATE afk SET status='idle', updated_at=NOW() WHERE role_id=$1`, [role.role_id]);
}

// --- 领取离线收益 ---
export async function claimOfflineReward(userId: number) {
  const rewards = await settleAfkState(userId);
  const role = await getRoleByUserId(userId);
  const newExp = role.exp + rewards.gold + rewards.exp;
  const { level: newLevel } = getLevelFromExp(role.exp + rewards.exp);
  await withTransaction(async (txQuery) => {
    await txQuery(
      `UPDATE role SET gold=gold+$1, aether_crystal=aether_crystal+$2, exp=exp+$3, level=$4, updated_at=NOW() WHERE role_id=$5`,
      [rewards.gold, rewards.aether, rewards.exp, newLevel, role.role_id]
    );
    await txQuery(
      `UPDATE afk SET pending_gold=0, pending_aether=0, pending_exp=0, updated_at=NOW() WHERE role_id=$1`,
      [role.role_id]
    );
  });
  return rewards;
}

// --- 离线收益结算（微模拟） ---
export async function settleAfkState(userId: number): Promise<{ gold: number; aether: number; exp: number }> {
  const config = await getGameConfig();
  const role = await getRoleByUserId(userId);
  const afkResult = await query('SELECT * FROM afk WHERE role_id=$1', [role.role_id]);
  if (afkResult.rows.length === 0) return { gold: 0, aether: 0, exp: 0 };
  const afk = afkResult.rows[0] as AfkRow;

  if (afk.status === 'idle') return { gold: 0, aether: 0, exp: 0 };

  const now = Date.now();
  const lastSettled = new Date(afk.last_settled_at).getTime();
  const elapsedSeconds = Math.floor((now - lastSettled) / 1000);
  const maxOffline = config.systemBalance.maxOfflineSeconds;
  const grantedSeconds = Math.min(elapsedSeconds, maxOffline);

  if (grantedSeconds <= 0) return { gold: 0, aether: 0, exp: 0 };

  let pendingGold = afk.pending_gold;
  let pendingAether = afk.pending_aether;
  let pendingExp = afk.pending_exp;
  let accrued = afk.accrued_seconds;
  const recentEncounters = parseJson<{ tier: string; title: string; description: string; timestamp: number }[]>(afk.recent_encounters, []);
  let battleState = parseJson<BattleState | null>(afk.battle_state, null);
  let finishedBattleForSnapshot: BattleState | null = null;
  const taskSeconds = config.systemBalance.afkTaskSeconds;
  const mapConfig = config.mapConfigs.find(m => m.key === afk.map_key);

  // 如果有已结束的战斗，先清除
  if (battleState && battleState.result !== 'ongoing') {
    battleState = null;
  }

  for (let t = 0; t < grantedSeconds; t++) {
    // 如果在战斗中
    if (battleState && battleState.result === 'ongoing') {
      battleState = simulateBattleTick(battleState, role, config);
      if (battleState.result === 'win') {
        const durabilityLoss = 0.1;
        const brokenItems = await damageEquippedEquipment(role.role_id, durabilityLoss);
        battleState.logs.push({ timestamp: Date.now(), message: `🛠 装备耐久 -${durabilityLoss}`, type: 'info' });
        for (const name of brokenItems) {
          battleState.logs.push({ timestamp: Date.now(), message: `⚠️ ${name} 耐久耗尽，已自动卸下放回背包`, type: 'info' });
        }
        let battleGold = 0;
        let battleExp = 0;
        let battleAether = 0;
        const itemNames: string[] = [];
        for (const e of battleState!.enemies) {
          const template = config.enemyTemplates.find(t => t.key === e.key);
          if (template) {
            battleGold += template.goldDrop;
            battleExp += template.expDrop;
          }
        }
        pendingGold += battleGold;
        pendingExp += battleExp;
        const killEvents = config.eventRules.filter(r =>
          r.trigger.type === 'enemy_kill' &&
          (!r.trigger.mapKey || r.trigger.mapKey === afk.map_key)
        );
        for (const rule of killEvents) {
          const rewards = evaluateEventActions(rule.actions, config, rule.encounter);
          battleGold += rewards.gold;
          battleAether += rewards.aether;
          battleExp += rewards.exp;
          pendingGold += rewards.gold;
          pendingAether += rewards.aether;
          pendingExp += rewards.exp;
          // 掉落物品加入背包
          for (const item of rewards.grantedItems) {
            await addDropItem(role.role_id, item.itemId);
            itemNames.push(item.name);
          }
          // 记录遭遇
          if (rewards.encounter) {
            recentEncounters.push({ ...rewards.encounter, timestamp: Date.now() });
          }
        }
        const rewardParts = [
          battleGold > 0 ? `金币 +${battleGold}` : '',
          battleAether > 0 ? `以太水晶 +${battleAether}` : '',
          battleExp > 0 ? `经验 +${battleExp}` : '',
        ].filter(Boolean);
        if (rewardParts.length > 0) {
          battleState.logs.push({ timestamp: Date.now(), message: `🎁 战利品：${rewardParts.join('，')}`, type: 'info' });
        }
        if (itemNames.length > 0) {
          battleState.logs.push({ timestamp: Date.now(), message: `📦 获得物品：${itemNames.join('、')}`, type: 'info' });
        }
        finishedBattleForSnapshot = battleState;
        battleState = null;
      } else if (battleState.result === 'lose') {
        const durabilityLoss = randomInt(1, 3);
        const brokenItems = await damageEquippedEquipment(role.role_id, durabilityLoss);
        battleState.logs.push({ timestamp: Date.now(), message: `🛠 战败导致装备耐久 -${durabilityLoss}`, type: 'info' });
        for (const name of brokenItems) {
          battleState.logs.push({ timestamp: Date.now(), message: `⚠️ ${name} 耐久耗尽，已自动卸下放回背包`, type: 'info' });
        }
        finishedBattleForSnapshot = battleState;
        battleState = null;
      }
      continue;
    }

    // 非战斗 - 累积时间
    accrued++;
    if (accrued >= taskSeconds) {
      accrued = 0;
      if (mapConfig) {
        pendingGold += mapConfig.goldPerTask;
        pendingAether += mapConfig.aetherPerTask;
        pendingExp += mapConfig.expPerTask;
      }

      const tickEvents = config.eventRules.filter(r =>
        r.trigger.type === 'afk_tick' &&
        (!r.trigger.mapKey || r.trigger.mapKey === afk.map_key) &&
        (!r.trigger.activityKey || r.trigger.activityKey === afk.activity_key)
      );
      for (const rule of tickEvents) {
        const rewards = evaluateEventActions(rule.actions, config, rule.encounter);
        pendingGold += rewards.gold;
        pendingAether += rewards.aether;
        pendingExp += rewards.exp;
        if (rewards.startBattle && !battleState && !finishedBattleForSnapshot) {
          const enemies = config.enemyTemplates.filter(e => e.mapKey === afk.map_key);
          if (enemies.length > 0) {
            const enemy = pickRandom(enemies);
            battleState = createBattleState(enemy, role, config);
          }
        }
        for (const item of rewards.grantedItems) {
          await addDropItem(role.role_id, item.itemId);
        }
        // 记录遭遇
        if (rewards.encounter) {
          recentEncounters.push({ ...rewards.encounter, timestamp: Date.now() });
        }
      }
    }
  }

  // 保留最近20条遭遇记录
  while (recentEncounters.length > 20) recentEncounters.shift();

  // 同步等级
  const { level: settledLevel } = getLevelFromExp(role.exp + pendingExp);

  // 更新数据库
  const persistedBattleState = finishedBattleForSnapshot || battleState;

  await query(
    `UPDATE afk SET pending_gold=$1, pending_aether=$2, pending_exp=$3,
     accrued_seconds=$4, last_settled_at=NOW(), recent_encounters=$5::jsonb,
     battle_state=$6::jsonb, status=$7, updated_at=NOW()
    WHERE role_id=$8`,
    [pendingGold, pendingAether, pendingExp, accrued,
     JSON.stringify(recentEncounters), JSON.stringify(persistedBattleState),
     persistedBattleState ? 'battle' : 'afk', role.role_id]
  );
  await query('UPDATE role SET level=$1, updated_at=NOW() WHERE role_id=$2', [settledLevel, role.role_id]);

  return { gold: pendingGold, aether: pendingAether, exp: pendingExp };
}

// --- 评估事件动作 ---
function evaluateEventActions(actions: EventAction[], config: DynamicGameConfig, encounterInfo?: { tier: string; title: string; description: string }) {
  let gold = 0, aether = 0, exp = 0;
  let startBattle = false;
  const grantedItems: { itemId: number; name: string }[] = [];

  for (const action of actions) {
    if (randomFloat() > action.chance) continue;

    switch (action.type) {
      case 'grant_gold':
        gold += randomInt(action.min || 0, action.max || 0);
        break;
      case 'grant_aether':
        aether += randomInt(action.min || 0, action.max || 0);
        break;
      case 'grant_exp':
        exp += randomInt(action.min || 0, action.max || 0);
        break;
      case 'grant_item': {
        if (action.itemId) {
          grantedItems.push({ itemId: action.itemId, name: action.itemName || '未知物品' });
        } else if (action.itemType || action.rarity) {
          // 按 itemType 和 rarity 从物品目录中随机选取
          const candidates = config.itemCatalog.filter(item =>
            (!action.itemType || item.itemType === action.itemType) &&
            (!action.rarity || item.rarity === action.rarity)
          );
          if (candidates.length > 0) {
            const picked = pickRandom(candidates);
            grantedItems.push({ itemId: picked.itemId, name: picked.name });
          }
        }
        break;
      }
      case 'start_battle':
        startBattle = true;
        break;
    }
  }

  // 只有在实际获得了奖励时才返回 encounter（避免出现无意义的空文案）
  const hasReward = gold > 0 || aether > 0 || exp > 0 || grantedItems.length > 0 || startBattle;
  const encounter = (hasReward && encounterInfo) ? encounterInfo : null;

  return { gold, aether, exp, startBattle, encounter, grantedItems };
}

// --- 添加物品到背包：装备永远新增独立实例，非装备按 item_id 堆叠 ---
async function addDropItem(roleId: number, itemId: number) {
  await addItemToBackpack(roleId, itemId);
}

async function addItemToBackpack(
  roleId: number,
  itemId: number,
  runner: QueryRunner = query,
  options: { quantity?: number; currentDurability?: number | null; maxDurability?: number | null; repairCount?: number | null } = {},
) {
  const itemResult = await runner('SELECT item_type FROM item WHERE item_id=$1', [itemId]);
  if (itemResult.rows.length === 0) throw new Error('物品不存在');

  const quantity = Math.max(1, Math.floor(options.quantity ?? 1));
  const itemType = itemResult.rows[0].item_type as string;

  if (itemType === 'equipment') {
    const maxDurability = Math.max(1, Number(options.maxDurability ?? 100));
    const currentDurability = Math.min(maxDurability, Math.max(0, Number(options.currentDurability ?? maxDurability)));
    const repairCount = Math.max(0, Math.floor(options.repairCount ?? 0));

    for (let i = 0; i < quantity; i++) {
      await runner(
        `INSERT INTO backpack (
          role_id, item_id, quantity, current_durability, max_durability, repair_count
        ) VALUES ($1,$2,1,$3,$4,$5)`,
        [roleId, itemId, currentDurability, maxDurability, repairCount],
      );
    }
    return;
  }

  const existing = await runner(
    `SELECT backpack_id FROM backpack WHERE role_id=$1 AND item_id=$2 ORDER BY backpack_id LIMIT 1`,
    [roleId, itemId],
  );
  if (existing.rows.length > 0) {
    await runner('UPDATE backpack SET quantity=quantity+$1 WHERE backpack_id=$2', [quantity, existing.rows[0].backpack_id]);
  } else {
    await runner('INSERT INTO backpack (role_id, item_id, quantity) VALUES ($1, $2, $3)', [roleId, itemId, quantity]);
  }
}

async function damageEquippedEquipment(roleId: number, durabilityLoss: number): Promise<string[]> {
  if (durabilityLoss <= 0) return [];
  await query(
    `UPDATE backpack b
     SET current_durability = GREATEST(0, current_durability - $1)
     FROM item i
     WHERE b.item_id = i.item_id
       AND b.role_id = $2
       AND b.equipped = true
       AND i.item_type = 'equipment'`,
    [durabilityLoss, roleId],
  );
  // 查找耐久归零的装备，自动卸下并保留在背包中等待修理
  const broken = await query(
    `SELECT b.backpack_id, i.name FROM backpack b
     JOIN item i ON b.item_id = i.item_id
     WHERE b.role_id = $1 AND b.equipped = true
       AND i.item_type = 'equipment' AND b.current_durability <= 0`,
    [roleId],
  );
  const brokenNames: string[] = [];
  for (const row of broken.rows) {
    await query(
      `UPDATE backpack SET equipped=false, equipped_slot_groups='[]'::jsonb WHERE backpack_id=$1`,
      [row.backpack_id],
    );
    brokenNames.push(row.name);
  }
  return brokenNames;
}

// --- 创建战斗状态（1-4个敌人同时对战） ---
function createBattleState(enemy: EnemyTemplate, role: RoleRow, config: DynamicGameConfig): BattleState {
  const roleLevel = getLevelFromExp(role.exp).level;
  const enemyLevel = roleLevel;
  const maxHp = getMaxHealth(roleLevel, role.vitality);
  const roll = Math.random();
  const enemyCount = roll < 0.6 ? 1 : roll < 0.8 ? 2 : roll < 0.95 ? 3 : 4;
  const scaleFactor = 0.3 + roleLevel * 0.01; // 敌人属性缩放因子

  const mapEnemies = config.enemyTemplates.filter(e => e.mapKey === enemy.mapKey);
  const enemies: EnemyInstance[] = [];
  for (let i = 0; i < enemyCount; i++) {
    const template = mapEnemies.length > 0 ? pickRandom(mapEnemies) : enemy;
    const baseStats = {
      strength: Math.floor(template.statWeights.strength * enemyLevel * scaleFactor),
      intelligence: Math.floor(template.statWeights.intelligence * enemyLevel * scaleFactor),
      agility: Math.floor(template.statWeights.agility * enemyLevel * scaleFactor),
      vitality: Math.floor(template.statWeights.vitality * enemyLevel * scaleFactor),
    };
    const stats = {
      strength: varyInt(baseStats.strength),
      intelligence: varyInt(baseStats.intelligence),
      agility: varyInt(baseStats.agility),
      vitality: varyInt(baseStats.vitality),
    };
    const hp = varyInt(Math.floor(template.baseHealth * (1 + enemyLevel * 0.15)));
    const actionSpeed = varyInt(calculateActionGainPerTick(stats.agility, config), 0.9, 1.15);
    enemies.push({
      key: template.key, name: template.name, health: hp, maxHealth: hp,
      stats,
      actionSpeed,
      actionPoints: 0, effects: [], alive: true,
    });
  }

  const state: BattleState = {
    enemies, totalEnemies: enemyCount, defeatedCount: 0,
    playerHealth: role.current_health || maxHp, playerMaxHealth: maxHp,
    playerActionPoints: 0, playerEffects: [],
    logs: [{ timestamp: Date.now(), message: `遭遇了 ${enemyCount} 个敌人！${enemies.map(e => e.name).join('、')} 同时出现！`, type: 'info' }],
    playerSkillStates: {}, result: 'ongoing',
    enemyKey: '', enemyName: '', enemyHealth: 0, enemyMaxHealth: 0,
    enemyStats: { strength: 0, intelligence: 0, agility: 0, vitality: 0 },
    enemyActionPoints: 0, enemyEffects: [],
  };
  return state;
}

function getAliveEnemies(state: BattleState): EnemyInstance[] {
  return state.enemies.filter(e => e.alive);
}

function getEnemyStatusText(state: BattleState): string {
  return state.enemies.map((e, i) => e.alive ? `${e.name}${Math.ceil(e.health / e.maxHealth * 100)}%` : `${e.name}💀`).join(' ');
}

// --- 战斗动作名称 ---
const PLAYER_ATTACK_NAMES = [
  '挥击', '劈砍', '刺击', '横扫', '重击', '连击', '精准打击', '蓄力打击',
];
const ENEMY_ATTACK_NAMES: Record<string, string[]> = {
  default: ['扑咬', '撕咬', '撞击', '挥击', '尾扫'],
  slime: ['酸液喷吐', '弹跳撞击', '粘液拍打'],
  wolf: ['獠牙撕咬', '利爪抓挠', '猛扑'],
  goblin: ['匕首刺击', '投掷石块', '偷袭'],
  bear: ['熊掌拍击', '撞击', '猛扑'],
  skeleton: ['骨剑挥砍', '骨爪抓挠', '盾撞'],
  fire_elemental: ['火苗喷吐', '焰爪拍击', '灼热触碰'],
  dragon_whelp: ['幼龙啃咬', '利爪撕裂', '尾锤扫击'],
  void_walker: ['虚空触碰', '暗影抓挠', '空间震击'],
};

const MAX_ACTIONS_PER_ACTOR_PER_TICK = 10;

function getEnemyBasicEffect(enemyKey: string): Pick<BattleLog, 'effectKind' | 'effectStyle' | 'effectColor'> {
  if (enemyKey.includes('slime')) return { effectKind: 'projectile', effectStyle: 'bolt', effectColor: '#56d364' };
  if (enemyKey.includes('goblin')) return { effectKind: 'projectile', effectStyle: 'arrow', effectColor: '#d29922' };
  if (enemyKey.includes('skeleton')) return { effectKind: 'projectile', effectStyle: 'stab', effectColor: '#e6edf3' };
  if (enemyKey.includes('wolf') || enemyKey.includes('bear')) return { effectKind: 'projectile', effectStyle: 'stab', effectColor: '#bc8cff' };
  if (enemyKey.includes('fire') || enemyKey.includes('dragon')) return { effectKind: 'lightning', effectColor: '#ff9f43' };
  if (enemyKey.includes('void')) return { effectKind: 'projectile', effectStyle: 'stab', effectColor: '#bc8cff' };
  return { effectKind: 'projectile', effectStyle: 'stab', effectColor: '#bc8cff' };
}

function getSkillEffectVisual(skill?: SkillTemplate): Pick<BattleLog, 'effectKind' | 'effectStyle' | 'effectColor'> {
  if (!skill) return { effectKind: 'projectile', effectStyle: 'stab', effectColor: '#bc8cff' };
  const effectTypes = skill.effects.map(e => e.type);
  if (skill.category === 'guard') return { effectKind: 'status_burst', effectColor: '#58a6ff' };
  if (skill.category === 'spell' || effectTypes.some(t => t.includes('灼烧') || t.includes('火'))) {
    return { effectKind: 'lightning', effectColor: '#ff9f43' };
  }
  if (effectTypes.some(t => t.includes('中毒') || t.includes('毒'))) {
    return { effectKind: 'projectile', effectStyle: 'bolt', effectColor: '#56d364' };
  }
  return { effectKind: 'projectile', effectStyle: 'stab', effectColor: '#bc8cff' };
}

function getPlayerBasicEffect(classKey: string): Pick<BattleLog, 'effectKind' | 'effectStyle' | 'effectColor'> {
  if (classKey === 'ranger') return { effectKind: 'projectile', effectStyle: 'arrow', effectColor: '#d29922' };
  if (classKey === 'mage') return { effectKind: 'lightning', effectColor: '#88ccff' };
  if (classKey === 'priest') return { effectKind: 'projectile', effectStyle: 'bolt', effectColor: '#56d364' };
  if (classKey === 'rogue') return { effectKind: 'projectile', effectStyle: 'stab', effectColor: '#bc8cff' };
  return { effectKind: 'projectile', effectStyle: 'stab', effectColor: '#ffffff' };
}

function getDotEffectColor(type: string): string {
  if (type.includes('灼烧') || type.includes('火')) return '#ff9f43';
  if (type.includes('中毒') || type.includes('毒')) return '#56d364';
  return '#bc8cff';
}

function getPlayerAttackName(isCrit: boolean): string {
  void isCrit;
  const name = PLAYER_ATTACK_NAMES[Math.floor(Math.random() * PLAYER_ATTACK_NAMES.length)];
  return name;
}

function getEnemyAttackName(enemyKey: string, isCrit: boolean): string {
  void isCrit;
  const names = ENEMY_ATTACK_NAMES[enemyKey] || ENEMY_ATTACK_NAMES.default;
  const name = names[Math.floor(Math.random() * names.length)];
  return name;
}

// --- 模拟战斗 tick（最快单位每 tick 获得一整条行动条，其它单位按速度比例推进） ---
function simulateBattleTick(state: BattleState, role: RoleRow, config: DynamicGameConfig): BattleState {
  const aliveEnemies = getAliveEnemies(state);
  if (aliveEnemies.length === 0) { state.result = 'win'; return state; }

  const actionThreshold = config.systemBalance.maxActionPoints || 100;
  const playerSpeed = calculateActionGainPerTick(role.agility, config);
  const enemySpeeds = new Map<EnemyInstance, number>();
  for (const enemy of aliveEnemies) {
    enemySpeeds.set(enemy, enemy.actionSpeed || calculateActionGainPerTick(enemy.stats.agility, config));
  }
  const fastestSpeed = Math.max(1, playerSpeed, ...enemySpeeds.values());

  // 记录本 tick 前的 ATB，用于判断谁是最快者
  const playerRatio = playerSpeed / fastestSpeed;
  state.playerActionPoints += actionThreshold * playerRatio;

  for (const enemy of aliveEnemies) {
    const enemySpeed = enemySpeeds.get(enemy) || calculateActionGainPerTick(enemy.stats.agility, config);
    enemy.actionPoints += actionThreshold * (enemySpeed / fastestSpeed);
  }

  // 玩家行动（随机攻击一个存活敌人）
  let playerActionsThisTick = 0;
  while (state.playerActionPoints >= actionThreshold && playerActionsThisTick < MAX_ACTIONS_PER_ACTOR_PER_TICK) {
    const currentAliveEnemies = getAliveEnemies(state);
    if (currentAliveEnemies.length === 0) break;
    state.playerActionPoints -= actionThreshold;
    playerActionsThisTick++;
    const target = pickRandom(currentAliveEnemies);

    const critChance = Math.min(0.3, role.agility * 0.005);
    const isCrit = Math.random() < critChance;
    const critMult = isCrit ? 1.8 : 1;
    const baseDmg = role.strength + Math.floor(role.agility * 0.3);
    const enemyDef = Math.floor(target.stats.vitality * 0.4);
    const variance = randomInt(-3, 5);
    const damage = Math.max(1, Math.floor((baseDmg - enemyDef + variance) * critMult));

    target.health = Math.max(0, target.health - damage);
    const attackName = getPlayerAttackName(isCrit);
    state.logs.push({
      timestamp: Date.now(),
      message: `普通攻击（${attackName}）！对 ${target.name} 造成 ${damage} 点伤害${isCrit ? '（暴击！）' : ''}`,
      type: isCrit ? 'effect' : 'damage',
      attackerIndex: -1,
      targetIndex: state.enemies.indexOf(target),
      actionKind: 'basic',
      ...getPlayerBasicEffect(role.class_key),
    });

    if (Math.random() < 0.15 && target.effects.length < 3) {
      const effectType = Math.random() < 0.5 ? '灼烧' : '破甲';
      target.effects.push({ type: effectType, value: 2, duration: 3, source: 'player' });
      state.logs.push({ timestamp: Date.now(), message: `${target.name} 被施加了 ${effectType} 效果！`, type: 'effect' });
    }

    if (target.health <= 0) {
      target.alive = false;
      state.defeatedCount++;
      state.logs.push({ timestamp: Date.now(), message: `⚔️ 击败了 ${target.name}！`, type: 'info' });

      if (state.defeatedCount >= state.totalEnemies) {
        state.result = 'win';
        state.logs.push({ timestamp: Date.now(), message: `🎉 全部击败！获得了胜利！`, type: 'info' });
        return state;
      }
    }
  }

  // 所有存活敌人各自行动
  for (const enemy of getAliveEnemies(state)) {
    let enemyActionsThisTick = 0;
    while (enemy.actionPoints >= actionThreshold && enemyActionsThisTick < MAX_ACTIONS_PER_ACTOR_PER_TICK) {
      enemy.actionPoints -= actionThreshold;
      enemyActionsThisTick++;

      const template = config.enemyTemplates.find(t => t.key === enemy.key);
      const availableSkills = (template?.fixedSkillKeys || [])
        .map(key => config.skillTemplates.find(skill => skill.key === key))
        .filter((skill): skill is SkillTemplate => Boolean(skill));
      const skill = availableSkills.length > 0 && Math.random() < 0.35 ? pickRandom(availableSkills) : undefined;
      const isSkill = Boolean(skill);
      const critChance = Math.min(0.2, enemy.stats.agility * 0.004);
      const isCrit = Math.random() < critChance;
      const critMult = isCrit ? 1.6 : 1;
      const skillPower = skill ? skill.baseDamage + skill.levelGrowth * getLevelFromExp(role.exp).level : 0;
      const baseDmg = enemy.stats.strength + Math.floor(enemy.stats.agility * 0.2) + skillPower;
      const playerDef = Math.floor(role.vitality * 0.4);
      const variance = randomInt(-3, 5);
      const damage = Math.max(1, Math.floor((baseDmg - playerDef + variance) * critMult));

      state.playerHealth = Math.max(0, state.playerHealth - damage);
      const attackName = skill ? skill.name : getEnemyAttackName(enemy.key, isCrit);
      state.logs.push({
        timestamp: Date.now(),
        message: skill
          ? `${enemy.name} 使出技能 ${attackName}！对你造成 ${damage} 点伤害${isCrit ? '（暴击！）' : ''}`
          : `${enemy.name} 普通攻击（${attackName}）！对你造成 ${damage} 点伤害${isCrit ? '（暴击！）' : ''}`,
        type: isCrit ? 'effect' : 'damage',
        attackerIndex: state.enemies.indexOf(enemy),
        targetIndex: -1,
        actionKind: isSkill ? 'skill' : 'basic',
        ...(isSkill ? getSkillEffectVisual(skill) : getEnemyBasicEffect(enemy.key)),
      });

      if (skill) {
        for (const effect of skill.effects) {
          if (Math.random() > (effect.chance ?? 1)) continue;
          if (state.playerEffects.length >= 3) break;
          if (effect.type === '中毒' || effect.type === '灼烧') {
            state.playerEffects.push({
              type: effect.type,
              value: effect.value ?? 2,
              duration: effect.duration ?? 2,
              source: 'enemy',
            });
            state.logs.push({
              timestamp: Date.now(),
              message: `你被施加了 ${effect.type} 效果！`,
              type: 'effect',
              targetIndex: -1,
              actionKind: 'dot',
              effectKind: 'status_burst',
              effectColor: getDotEffectColor(effect.type),
              statusType: effect.type,
            });
          }
        }
      }

      // 敌人随机触发效果
      if (!skill && Math.random() < 0.1 && state.playerEffects.length < 3) {
        state.playerEffects.push({ type: '中毒', value: 3, duration: 2, source: 'enemy' });
        state.logs.push({ timestamp: Date.now(), message: `你中毒了！每回合受到持续伤害`, type: 'effect' });
      }

      if (state.playerHealth <= 0) {
        state.result = 'lose';
        state.logs.push({ timestamp: Date.now(), message: `💀 你被 ${enemy.name} 击败了...`, type: 'info' });
        return state;
      }
    }
  }

  // 处理玩家持续效果
  state.playerEffects = state.playerEffects.filter(eff => {
    if (eff.type === '灼烧' || eff.type === '中毒') {
      const dotDmg = eff.value || 2;
      state.playerHealth = Math.max(0, state.playerHealth - dotDmg);
      state.logs.push({
        timestamp: Date.now(),
        message: `${eff.type}效果造成 ${dotDmg} 点伤害`,
        type: 'effect',
        targetIndex: -1,
        actionKind: 'dot',
        effectKind: 'status_burst',
        effectColor: getDotEffectColor(eff.type),
        statusType: eff.type,
      });
    }
    eff.duration--;
    return eff.duration > 0;
  });

  // 处理所有敌人持续效果
  for (const enemy of getAliveEnemies(state)) {
    enemy.effects = enemy.effects.filter(eff => {
      if (eff.type === '灼烧' || eff.type === '中毒') {
        const dotDmg = eff.value || 2;
        enemy.health = Math.max(0, enemy.health - dotDmg);
        state.logs.push({
          timestamp: Date.now(),
          message: `${enemy.name} 受到${eff.type}效果 ${dotDmg} 点伤害`,
          type: 'effect',
          targetIndex: state.enemies.indexOf(enemy),
          actionKind: 'dot',
          effectKind: 'status_burst',
          effectColor: getDotEffectColor(eff.type),
          statusType: eff.type,
        });
        if (enemy.health <= 0) {
          enemy.alive = false;
          state.defeatedCount++;
          state.logs.push({ timestamp: Date.now(), message: `⚔️ ${enemy.name} 被持续伤害击败！`, type: 'info' });
        }
      }
      eff.duration--;
      return eff.duration > 0;
    });
  }

  // 检查是否全部击败
  if (getAliveEnemies(state).length === 0) {
    state.result = 'win';
    state.logs.push({ timestamp: Date.now(), message: `🎉 全部击败！获得了胜利！`, type: 'info' });
  }

  // 最快者的 ATB 始终拉满（它每 tick 都会行动）
  // 如果玩家是最快者
  if (playerRatio >= 1) {
    state.playerActionPoints = actionThreshold;
  }
  // 如果某个敌人是最快者
  for (const enemy of getAliveEnemies(state)) {
    const enemySpeed = enemySpeeds.get(enemy) || calculateActionGainPerTick(enemy.stats.agility, config);
    if (enemySpeed / fastestSpeed >= 1) {
      enemy.actionPoints = actionThreshold;
    }
  }

  return state;
}

// --- 装备操作 ---
export async function equipItem(userId: number, backpackId: number, slot: string, replaceBackpackId?: number) {
  const role = await getRoleByUserId(userId);
  const bpResult = await query(
    `SELECT b.*, i.slot as item_slot, i.slot_usage FROM backpack b JOIN item i ON b.item_id=i.item_id
     WHERE b.backpack_id=$1 AND b.role_id=$2`, [backpackId, role.role_id]
  );
  if (bpResult.rows.length === 0) throw new Error('物品不存在');
  const bp = bpResult.rows[0];
  if (bp.equipped) throw new Error('物品已装备');
  if (bp.item_slot !== slot) throw new Error('物品不能装备到该槽位');
  if (toNumber(bp.current_durability, 100) <= 0) throw new Error('装备耐久耗尽，请先修理');

  // 检查槽位容量
  const capacities = getBodySlotCapacities(role.race_key as never);
  const equippedCount = await query(
    `SELECT COUNT(*) as cnt FROM backpack WHERE role_id=$1 AND equipped=true AND item_id IN (SELECT item_id FROM item WHERE slot=$2)`,
    [role.role_id, slot]
  );
  const capacity = capacities[slot as keyof typeof capacities];
  const isFull = equippedCount.rows[0].cnt >= capacity;
  if (isFull && !replaceBackpackId) {
    throw new Error('该槽位已满');
  }

  await withTransaction(async (txQuery) => {
    if (isFull && replaceBackpackId) {
      const replacementResult = await txQuery(
        `SELECT b.backpack_id, i.slot
         FROM backpack b JOIN item i ON b.item_id=i.item_id
         WHERE b.backpack_id=$1 AND b.role_id=$2 AND b.equipped=true`,
        [replaceBackpackId, role.role_id],
      );
      if (replacementResult.rows.length === 0) throw new Error('要替换的装备不存在');
      if (replacementResult.rows[0].slot !== slot) throw new Error('要替换的装备不在该槽位');
      await txQuery(
        `UPDATE backpack SET equipped=false, equipped_slot_groups='[]'::jsonb WHERE backpack_id=$1`,
        [replaceBackpackId],
      );
    }

    await txQuery('UPDATE backpack SET equipped=true WHERE backpack_id=$1 AND role_id=$2', [backpackId, role.role_id]);
  });
}

export async function unequipItem(userId: number, backpackId: number) {
  const role = await getRoleByUserId(userId);
  await query(
    'UPDATE backpack SET equipped=false, equipped_slot_groups=\'[]\'::jsonb WHERE backpack_id=$1 AND role_id=$2',
    [backpackId, role.role_id]
  );
}

export async function dropItem(userId: number, backpackId: number) {
  const role = await getRoleByUserId(userId);
  await query('DELETE FROM backpack WHERE backpack_id=$1 AND role_id=$2 AND equipped=false', [backpackId, role.role_id]);
}

export async function repairEquipment(userId: number, backpackId: number) {
  const role = await getRoleByUserId(userId);
  const bpResult = await query(
    `SELECT b.*, i.item_type, i.sell_price, i.name
     FROM backpack b JOIN item i ON b.item_id=i.item_id
     WHERE b.backpack_id=$1 AND b.role_id=$2`,
    [backpackId, role.role_id],
  );
  if (bpResult.rows.length === 0) throw new Error('物品不存在');
  const bp = bpResult.rows[0];
  if (bp.item_type !== 'equipment') throw new Error('只有装备可以修理');
  const currentDurability = toNumber(bp.current_durability);
  const maxDurability = toNumber(bp.max_durability, 100);
  if (currentDurability >= maxDurability) throw new Error('装备已经是满耐久');

  const lostDurability = maxDurability - currentDurability;
  const repairCost = Math.max(0, Math.ceil(toNumber(bp.sell_price) * lostDurability / maxDurability * 0.35));
  if (role.gold < repairCost) throw new Error(`金币不足，需要 ${repairCost} 金币`);

  await withTransaction(async (txQuery) => {
    if (repairCost > 0) {
      await txQuery('UPDATE role SET gold=gold-$1, updated_at=NOW() WHERE role_id=$2', [repairCost, role.role_id]);
    }
    await txQuery(
      `UPDATE backpack
       SET current_durability=max_durability, repair_count=repair_count+1
       WHERE backpack_id=$1 AND role_id=$2`,
      [backpackId, role.role_id],
    );
  });
}

// --- 学习技能书 ---
export async function learnSkillBook(userId: number, backpackId: number) {
  const role = await getRoleByUserId(userId);
  const bpResult = await query(
    `SELECT b.*, i.skill_key FROM backpack b JOIN item i ON b.item_id=i.item_id
     WHERE b.backpack_id=$1 AND b.role_id=$2 AND i.item_type='skill_book'`,
    [backpackId, role.role_id]
  );
  if (bpResult.rows.length === 0) throw new Error('物品不存在或不是技能书');

  const skillKey = bpResult.rows[0].skill_key;
  const skillState = parseJson<{ equippedSkills: string[]; learnedSkills: string[] }>(role.skill_state, { equippedSkills: [], learnedSkills: [] });
  if (skillState.learnedSkills.includes(skillKey)) throw new Error('已学会该技能');

  skillState.learnedSkills.push(skillKey);
  await withTransaction(async (txQuery) => {
    await txQuery('UPDATE role SET skill_state=$1::jsonb, updated_at=NOW() WHERE role_id=$2', [JSON.stringify(skillState), role.role_id]);
    await txQuery('DELETE FROM backpack WHERE backpack_id=$1', [backpackId]);
  });
}

// --- 配置技能栏 ---
export async function configureSkillLoadout(userId: number, skillKeys: string[]) {
  const role = await getRoleByUserId(userId);
  const skillState = parseJson<{ equippedSkills: string[]; learnedSkills: string[] }>(role.skill_state, { equippedSkills: [], learnedSkills: [] });
  const maxSlots = getSkillSlots(role.intelligence);
  const validKeys = skillKeys.filter(k => skillState.learnedSkills.includes(k)).slice(0, maxSlots);
  skillState.equippedSkills = validKeys;
  await query('UPDATE role SET skill_state=$1::jsonb, updated_at=NOW() WHERE role_id=$2', [JSON.stringify(skillState), role.role_id]);
}

// --- 交易市场 ---
export async function createMarketListing(userId: number, backpackId: number, price: number) {
  const role = await getRoleByUserId(userId);
  const safePrice = Math.floor(Number(price));
  if (!Number.isFinite(safePrice) || safePrice <= 0) throw new Error('价格无效');

  const bpResult = await query(
    `SELECT b.*, i.item_type, i.slot, i.name FROM backpack b JOIN item i ON b.item_id=i.item_id
     WHERE b.backpack_id=$1 AND b.role_id=$2 AND b.equipped=false`,
    [backpackId, role.role_id]
  );
  if (bpResult.rows.length === 0) throw new Error('物品不存在或已装备');
  const bp = bpResult.rows[0];
  const isEquipment = bp.item_type === 'equipment';
  const currentDurability = toNumber(bp.current_durability);
  const maxDurability = toNumber(bp.max_durability, 100);
  if (isEquipment && currentDurability < maxDurability) {
    throw new Error('只有满耐久装备可以出售');
  }

  await withTransaction(async (txQuery) => {
    if (isEquipment || bp.quantity <= 1) {
      await txQuery('DELETE FROM backpack WHERE backpack_id=$1', [backpackId]);
    } else {
      await txQuery('UPDATE backpack SET quantity=quantity-1 WHERE backpack_id=$1', [backpackId]);
    }
    await txQuery(
      `INSERT INTO market_listing (
        seller_role_id, item_id, category_key, quantity, price,
        current_durability, max_durability, repair_count
      ) VALUES ($1,$2,$3,1,$4,$5,$6,$7)`,
      [
        role.role_id, bp.item_id, bp.item_type, safePrice,
        isEquipment ? currentDurability : null,
        isEquipment ? maxDurability : null,
        isEquipment ? bp.repair_count : null,
      ]
    );
  });
}

export async function cancelMarketListing(userId: number, listingId: number) {
  const role = await getRoleByUserId(userId);
  const listingResult = await query(
    `SELECT ml.*, i.item_type FROM market_listing ml JOIN item i ON ml.item_id=i.item_id
     WHERE ml.listing_id=$1 AND ml.seller_role_id=$2 AND ml.status=$3`,
    [listingId, role.role_id, 'active']
  );
  if (listingResult.rows.length === 0) throw new Error('订单不存在');
  const listing = listingResult.rows[0];

  await withTransaction(async (txQuery) => {
    await txQuery('UPDATE market_listing SET status=$1, updated_at=NOW() WHERE listing_id=$2', ['cancelled', listingId]);
    await addItemToBackpack(role.role_id, listing.item_id, txQuery, {
      quantity: listing.quantity,
      currentDurability: listing.current_durability,
      maxDurability: listing.max_durability,
      repairCount: listing.repair_count,
    });
  });
}

export async function buyMarketListing(userId: number, listingId: number) {
  const role = await getRoleByUserId(userId);
  const listingResult = await query(
    `SELECT ml.*, i.name as item_name, i.item_type FROM market_listing ml JOIN item i ON ml.item_id=i.item_id
     WHERE ml.listing_id=$1 AND ml.status='active'`, [listingId]
  );
  if (listingResult.rows.length === 0) throw new Error('订单不存在');
  const listing = listingResult.rows[0];
  if (listing.seller_role_id === role.role_id) throw new Error('不能购买自己的物品');
  if (role.gold < listing.price) throw new Error('金币不足');

  const config = await getGameConfig();
  const { fee, sellerReceives } = { fee: Math.floor(listing.price * config.systemBalance.marketFeePercent / 100), sellerReceives: listing.price - Math.floor(listing.price * config.systemBalance.marketFeePercent / 100) };

  await withTransaction(async (txQuery) => {
    await txQuery('UPDATE role SET gold=gold-$1, updated_at=NOW() WHERE role_id=$2', [listing.price, role.role_id]);
    await txQuery('UPDATE role SET gold=gold+$1, updated_at=NOW() WHERE role_id=$2', [sellerReceives, listing.seller_role_id]);
    await txQuery(
      `UPDATE market_listing SET status='sold', buyer_role_id=$1, sold_price=$2, fee_amount=$3,
       seller_receive_amount=$4, updated_at=NOW() WHERE listing_id=$5`,
      [role.role_id, listing.price, fee, sellerReceives, listingId]
    );
    await addItemToBackpack(role.role_id, listing.item_id, txQuery, {
      quantity: listing.quantity,
      currentDurability: listing.current_durability,
      maxDurability: listing.max_durability,
      repairCount: listing.repair_count,
    });
  });
}

// --- PVP 系统 ---
export async function challengePvp(userId: number, targetRoleId: number) {
  const config = await getGameConfig();
  const challenger = await getRoleByUserId(userId);
  const defenderResult = await query('SELECT * FROM role WHERE role_id=$1', [targetRoleId]);
  if (defenderResult.rows.length === 0) throw new Error('目标玩家不存在');
  const defender = defenderResult.rows[0] as RoleRow;
  if (defender.role_id === challenger.role_id) throw new Error('不能挑战自己');

  // 模拟 PVP 战斗（简化版：基于属性比较 + 随机因素）
  const challengerPower = challenger.strength + challenger.agility + challenger.vitality + challenger.intelligence + randomInt(-10, 10);
  const defenderPower = defender.strength + defender.agility + defender.vitality + defender.intelligence + randomInt(-10, 10);

  const challengerWins = challengerPower >= defenderPower;
  const winnerId = challengerWins ? challenger.role_id : defender.role_id;

  // ELO 计算
  const expectedChallenger = 1 / (1 + Math.pow(10, (defender.pvp_rating - challenger.pvp_rating) / 400));
  const kFactor = config.systemBalance.pvpRatingKFactor;
  const ratingChange = Math.round(kFactor * (1 - expectedChallenger));

  const goldReward = config.systemBalance.pvpGoldReward;

  await withTransaction(async (txQuery) => {
    await txQuery(
      `INSERT INTO pvp_battle (challenger_id, defender_id, winner_id, rating_change) VALUES ($1,$2,$3,$4)`,
      [challenger.role_id, defender.role_id, winnerId, ratingChange]
    );

    if (challengerWins) {
      await txQuery(
        `UPDATE role SET pvp_rating=pvp_rating+$1, pvp_wins=pvp_wins+1, gold=gold+$2, updated_at=NOW() WHERE role_id=$3`,
        [ratingChange, goldReward, challenger.role_id]
      );
      await txQuery(
        `UPDATE role SET pvp_rating=GREATEST(0, pvp_rating-$1), pvp_losses=pvp_losses+1, updated_at=NOW() WHERE role_id=$2`,
        [ratingChange, defender.role_id]
      );
    } else {
      await txQuery(
        `UPDATE role SET pvp_rating=GREATEST(0, pvp_rating-$1), pvp_losses=pvp_losses+1, updated_at=NOW() WHERE role_id=$2`,
        [ratingChange, challenger.role_id]
      );
      await txQuery(
        `UPDATE role SET pvp_rating=pvp_rating+$1, pvp_wins=pvp_wins+1, gold=gold+$2, updated_at=NOW() WHERE role_id=$3`,
        [ratingChange, goldReward, defender.role_id]
      );
    }
  });

  return {
    winnerId, challengerWins, ratingChange,
    challengerNewRating: challengerWins ? challenger.pvp_rating + ratingChange : challenger.pvp_rating - ratingChange,
    defenderNewRating: challengerWins ? defender.pvp_rating - ratingChange : defender.pvp_rating + ratingChange,
  };
}

// --- 辅助函数 ---
async function getRoleByUserId(userId: number): Promise<RoleRow> {
  const result = await query('SELECT * FROM role WHERE user_id=$1', [userId]);
  if (result.rows.length === 0) throw new Error('角色不存在');
  return result.rows[0] as RoleRow;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (!value) return fallback;
  try {
    return (typeof value === 'string' ? JSON.parse(value) : value) as T;
  } catch {
    return fallback;
  }
}
