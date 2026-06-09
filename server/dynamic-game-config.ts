// ============================================================
// 运行时游戏配置加载（WS 服务器端）
// ============================================================

import { query } from './db.js';
import type { DynamicGameConfig, SystemBalance, ItemCatalogEntry } from '../src/lib/server/admin-config';

let cachedConfig: DynamicGameConfig | null = null;
let lastLoadTime = 0;
const CACHE_TTL_MS = 30_000; // 30秒缓存

export async function getGameConfig(forceReload = false): Promise<DynamicGameConfig> {
  const now = Date.now();
  if (!forceReload && cachedConfig && now - lastLoadTime < CACHE_TTL_MS) {
    return cachedConfig;
  }
  cachedConfig = await loadConfigFromDb();
  lastLoadTime = now;
  return cachedConfig;
}

export function invalidateConfigCache(): void {
  cachedConfig = null;
  lastLoadTime = 0;
}

async function loadConfigFromDb(): Promise<DynamicGameConfig> {
  const { rows } = await query('SELECT config_key, value FROM game_config');

  const parse = <T>(key: string, fallback: T): T => {
    const row = rows.find(r => r.config_key === key);
    if (!row) return fallback;
    try {
      return (typeof row.value === 'string' ? JSON.parse(row.value) : row.value) as T;
    } catch {
      return fallback;
    }
  };

  const itemResult = await query('SELECT * FROM item ORDER BY item_id');
  const itemCatalog: ItemCatalogEntry[] = itemResult.rows.map(row => ({
    itemId: row.item_id,
    name: row.name,
    rarity: row.rarity,
    itemType: row.item_type,
    skillKey: row.skill_key || undefined,
    iconKey: row.icon_key || undefined,
    slot: row.slot || undefined,
    slotUsage: row.slot_usage,
    sellPrice: row.sell_price,
    description: row.description,
    statJson: typeof row.stat_json === 'string' ? JSON.parse(row.stat_json) : row.stat_json,
    levelRequirement: row.level_requirement,
  }));

  return {
    raceConfigs: parse('races', []),
    classConfigs: parse('classes', []),
    mapConfigs: parse('maps', []),
    activityConfigs: parse('activities', []),
    skillTemplates: parse('skills', []),
    enemyTemplates: parse('enemies', []),
    eventRules: parse('event_rules', []),
    itemCatalog,
    systemBalance: parse<SystemBalance>('system_balance', {
      maxOfflineSeconds: 86400, afkTaskSeconds: 10, levelCap: 50,
      expPerLevel: 100, expGrowthPerLevel: 10, baseHealth: 50,
      healthPerVitality: 12, healthPerLevel: 2, baseSkillSlots: 4,
      skillSlotsPer5Int: 1, baseSkillUsesPerBattle: 3, skillUsesPer5Int: 1,
      maxActionPoints: 100, baseActionSpeed: 10, actionSpeedPer5Agi: 1,
      marketFeePercent: 10, pvpRatingKFactor: 32, pvpGoldReward: 50,
      chatMaxLen: 160, chatCooldownSeconds: 3, chatHistoryLimit: 80,
    }),
  };
}
