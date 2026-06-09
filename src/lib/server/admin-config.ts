// ============================================================
// 后台配置管理 - 动态游戏配置加载/保存/验证
// ============================================================

import { query, withTransaction } from './db';
import type {
  RaceConfig, ClassConfig, MapConfig, SkillTemplate,
  EnemyTemplate, EventRule, ItemRarity, GameItemType, BodySlotType,
} from '../game-config';

// --- 动态配置接口 ---
export interface DynamicGameConfig {
  raceConfigs: RaceConfig[];
  classConfigs: ClassConfig[];
  mapConfigs: MapConfig[];
  activityConfigs: { key: string; name: string; description: string }[];
  skillTemplates: SkillTemplate[];
  enemyTemplates: EnemyTemplate[];
  eventRules: EventRule[];
  itemCatalog: ItemCatalogEntry[];
  systemBalance: SystemBalance;
}

export interface ItemCatalogEntry {
  itemId: number;
  name: string;
  rarity: ItemRarity;
  itemType: GameItemType;
  skillKey?: string;
  iconKey?: string;
  slot?: BodySlotType;
  slotUsage: number;
  sellPrice: number;
  description: string;
  statJson: Record<string, number>;
  levelRequirement: number;
}

export interface SystemBalance {
  maxOfflineSeconds: number;
  afkTaskSeconds: number;
  levelCap: number;
  expPerLevel: number;
  expGrowthPerLevel: number;
  baseHealth: number;
  healthPerVitality: number;
  healthPerLevel: number;
  baseSkillSlots: number;
  skillSlotsPer5Int: number;
  baseSkillUsesPerBattle: number;
  skillUsesPer5Int: number;
  maxActionPoints: number;
  baseActionSpeed: number;
  actionSpeedPer5Agi: number;
  marketFeePercent: number;
  pvpRatingKFactor: number;
  pvpGoldReward: number;
  chatMaxLen: number;
  chatCooldownSeconds: number;
  chatHistoryLimit: number;
}

// --- 默认值 ---
const DEFAULT_SYSTEM_BALANCE: SystemBalance = {
  maxOfflineSeconds: 86400,
  afkTaskSeconds: 10,
  levelCap: 50,
  expPerLevel: 100,
  expGrowthPerLevel: 10,
  baseHealth: 50,
  healthPerVitality: 12,
  healthPerLevel: 2,
  baseSkillSlots: 4,
  skillSlotsPer5Int: 1,
  baseSkillUsesPerBattle: 3,
  skillUsesPer5Int: 1,
  maxActionPoints: 100,
  baseActionSpeed: 10,
  actionSpeedPer5Agi: 1,
  marketFeePercent: 10,
  pvpRatingKFactor: 32,
  pvpGoldReward: 50,
  chatMaxLen: 160,
  chatCooldownSeconds: 3,
  chatHistoryLimit: 80,
};

// --- 解析函数 ---
function parseJsonConfig<T>(key: string, rows: { config_key: string; value: unknown }[], fallback: T): T {
  const row = rows.find(r => r.config_key === key);
  if (!row) return fallback;
  try {
    return (typeof row.value === 'string' ? JSON.parse(row.value) : row.value) as T;
  } catch {
    return fallback;
  }
}

// --- 加载配置 ---
export async function getDynamicGameConfig(): Promise<DynamicGameConfig> {
  const { rows } = await query('SELECT config_key, value FROM game_config');

  const raceConfigs = parseJsonConfig<RaceConfig[]>('races', rows, []);
  const classConfigs = parseJsonConfig<ClassConfig[]>('classes', rows, []);
  const mapConfigs = parseJsonConfig<MapConfig[]>('maps', rows, []);
  const activityConfigs = parseJsonConfig<{ key: string; name: string; description: string }[]>('activities', rows, []);
  const skillTemplates = parseJsonConfig<SkillTemplate[]>('skills', rows, []);
  const enemyTemplates = parseJsonConfig<EnemyTemplate[]>('enemies', rows, []);
  const eventRules = parseJsonConfig<EventRule[]>('event_rules', rows, []);
  const systemBalance = parseJsonConfig<SystemBalance>('system_balance', rows, DEFAULT_SYSTEM_BALANCE);

  // 从 item 表加载物品目录
  const itemResult = await query('SELECT * FROM item ORDER BY item_id');
  const itemCatalog: ItemCatalogEntry[] = itemResult.rows.map(row => ({
    itemId: row.item_id,
    name: row.name,
    rarity: row.rarity as ItemRarity,
    itemType: row.item_type as GameItemType,
    skillKey: row.skill_key || undefined,
    iconKey: row.icon_key || undefined,
    slot: row.slot as BodySlotType | undefined,
    slotUsage: row.slot_usage,
    sellPrice: row.sell_price,
    description: row.description,
    statJson: typeof row.stat_json === 'string' ? JSON.parse(row.stat_json) : row.stat_json,
    levelRequirement: row.level_requirement,
  }));

  return {
    raceConfigs,
    classConfigs,
    mapConfigs,
    activityConfigs,
    skillTemplates,
    enemyTemplates,
    eventRules,
    itemCatalog,
    systemBalance,
  };
}

// --- 保存配置 ---
export async function saveAdminGameConfig(config: Partial<DynamicGameConfig>): Promise<void> {
  await withTransaction(async (txQuery) => {
    const entries: [string, string, unknown][] = [
      ['races', 'array', config.raceConfigs],
      ['classes', 'array', config.classConfigs],
      ['maps', 'array', config.mapConfigs],
      ['activities', 'array', config.activityConfigs],
      ['skills', 'array', config.skillTemplates],
      ['enemies', 'array', config.enemyTemplates],
      ['event_rules', 'array', config.eventRules],
      ['system_balance', 'object', config.systemBalance],
    ];

    for (const [key, type, value] of entries) {
      if (value !== undefined) {
        await txQuery(
          `INSERT INTO game_config (config_key, config_type, value, updated_at)
           VALUES ($1, $2, $3::jsonb, NOW())
           ON CONFLICT (config_key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
          [key, type, JSON.stringify(value)]
        );
      }
    }

    // 更新物品目录
    if (config.itemCatalog) {
      for (const item of config.itemCatalog) {
        if (item.itemId > 0) {
          // 更新已有物品
          await txQuery(
            `UPDATE item SET name=$1, rarity=$2, item_type=$3, skill_key=$4, icon_key=$5,
             slot=$6, slot_usage=$7, sell_price=$8, description=$9, stat_json=$10::jsonb,
             level_requirement=$11 WHERE item_id=$12`,
            [item.name, item.rarity, item.itemType, item.skillKey || null, item.iconKey || null,
             item.slot || null, item.slotUsage, item.sellPrice, item.description,
             JSON.stringify(item.statJson), item.levelRequirement, item.itemId]
          );
        } else {
          // 新增物品
          await txQuery(
            `INSERT INTO item (name, rarity, item_type, skill_key, icon_key, slot, slot_usage,
             sell_price, description, stat_json, level_requirement)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)`,
            [item.name, item.rarity, item.itemType, item.skillKey || null, item.iconKey || null,
             item.slot || null, item.slotUsage, item.sellPrice, item.description,
             JSON.stringify(item.statJson), item.levelRequirement]
          );
        }
      }
    }
  });
}

// --- 后台账号管理 ---
export async function listAdminAccounts() {
  const { rows } = await query(
    `SELECT u.user_id, u.username, u.account_type, u.is_admin, u.created_at,
            r.role_id, r.name as role_name, r.level, r.gold, r.aether_crystal
     FROM "user" u LEFT JOIN role r ON u.user_id = r.user_id
     ORDER BY u.user_id DESC LIMIT 200`
  );
  return rows;
}

export async function updateAdminAccount(userId: number, data: { isAdmin?: boolean }) {
  if (data.isAdmin !== undefined) {
    await query('UPDATE "user" SET is_admin=$1, updated_at=NOW() WHERE user_id=$2', [data.isAdmin, userId]);
  }
}

export async function deleteAdminAccount(userId: number) {
  await withTransaction(async (txQuery) => {
    await txQuery('DELETE FROM backpack WHERE role_id IN (SELECT role_id FROM role WHERE user_id=$1)', [userId]);
    await txQuery('DELETE FROM afk WHERE role_id IN (SELECT role_id FROM role WHERE user_id=$1)', [userId]);
    await txQuery('DELETE FROM role WHERE user_id=$1', [userId]);
    await txQuery('DELETE FROM "user" WHERE user_id=$1', [userId]);
  });
}
