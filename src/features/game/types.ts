// ============================================================
// 游戏域类型定义 - 客户端使用的类型表面
// ============================================================

import type {
  RaceKey, ClassKey, BodySlotType, ItemRarity, GameItemType,
  ActivityKey, AfkStatus, EncounterTier, RaceConfig, ClassConfig,
  MapConfig, StatBlock,
} from '@/lib/game-config';

export type { ActivityKey, BodySlotType, RaceKey, ClassKey };

// --- 会话快照（服务端 -> 客户端） ---
export interface SessionSnapshot {
  account: {
    guestToken: string;
    mode: 'guest' | 'registered';
    username: string | null;
    userId: number;
  };
  config: {
    activities: { key: string; name: string; description: string }[];
    classes: ClassConfig[];
    levels: { level: number; requiredExp: number }[];
    maps: MapConfig[];
    races: RaceConfig[];
    skills: SkillInfo[];
  };
  role: RoleSnapshot;
  backpack: BackpackEntry[];
  afk: AfkSnapshot;
  market: MarketSnapshot;
  pvp: PvpSnapshot;
}

export interface RoleSnapshot {
  roleId: number;
  name: string;
  raceKey: RaceKey;
  classKey: ClassKey;
  level: number;
  exp: number;
  currentExp: number;
  requiredExp: number;
  gold: number;
  aetherCrystal: number;
  stats: StatBlock;
  baseStats: StatBlock;
  levelBonusStats: StatBlock;
  equipmentStats: StatBlock;
  secondaryStats: { maxHealth: number; actionSpeed: number; skillSlots: number; skillUsesPerBattle: number };
  bodySlotCapacities: Record<BodySlotType, number>;
  bodySlots: Record<BodySlotType, BodySlotItem[]>;
  equippedSkills: string[];
  learnedSkills: string[];
  skillBooks: { key: string; name: string }[];
  currentHealth: number;
  avatarSeed: string;
  pvpRating: number;
  pvpWins: number;
  pvpLosses: number;
}

export interface BodySlotItem {
  backpackId: number;
  itemId: number;
  name: string;
  rarity: ItemRarity;
  iconKey?: string;
  statJson: Record<string, number>;
  currentDurability: number;
  maxDurability: number;
  repairCount: number;
}

// --- 背包条目 ---
export interface BackpackEntry {
  backpackId: number;
  itemId: number;
  name: string;
  rarity: ItemRarity;
  itemType: GameItemType;
  iconKey?: string;
  slot?: BodySlotType;
  slotUsage: number;
  quantity: number;
  equipped: boolean;
  equippedSlotGroups: number[][];
  currentDurability: number;
  maxDurability: number;
  repairCount: number;
  sellPrice: number;
  description: string;
  statJson: Record<string, number>;
  levelRequirement: number;
  skillKey?: string;
}

// --- 挂机快照 ---
export interface AfkSnapshot {
  status: AfkStatus;
  activityKey: ActivityKey;
  mapKey: string;
  pendingReward: { gold: number; aether: number; exp: number };
  estimatedHourlyReward: { gold: number; aether: number; exp: number };
  encounterRates: { common: number; rare: number; legendary: number };
  recentEncounters: RecentEncounter[];
  battle: BattleSnapshot | null;
  accruedSeconds: number;
}

export interface RecentEncounter {
  tier: EncounterTier;
  title: string;
  description: string;
  timestamp: number;
}

// --- 技能信息（轻量展示用） ---
export interface SkillInfo {
  key: string;
  name: string;
  category: 'attack' | 'spell' | 'guard';
  description: string;
  maxUses: number;
  cooldown: number;
  effects: { type: string; chance?: number; duration?: number }[];
}

// --- 战斗快照 ---
export interface EnemySnapshot {
  key: string;
  name: string;
  health: number;
  maxHealth: number;
  stats: { strength: number; intelligence: number; agility: number; vitality: number };
  actionSpeed?: number;
  actionPoints: number;
  effects: StatusEffect[];
  alive: boolean;
  skills: SkillInfo[];
  skillStates?: Record<string, { used: number; cooldownLeft: number }>;
}

export interface BattleSnapshot {
  enemies: EnemySnapshot[];
  totalEnemies: number;
  defeatedCount: number;
  playerHealth: number;
  playerMaxHealth: number;
  playerActionPoints: number;
  playerEffects: StatusEffect[];
  logs: BattleLog[];
  playerSkillStates: Record<string, { used: number; cooldownLeft: number }>;
  playerSkills: SkillInfo[];
  result: 'ongoing' | 'win' | 'lose';
}

export interface StatusEffect {
  type: string;
  value?: number;
  duration: number;
  source: 'player' | 'enemy';
}

export interface BattleLog {
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

// --- 市场快照 ---
export interface MarketSnapshot {
  feeRatePercent: number;
  listings: MarketListing[];
  myListings: MarketListing[];
}

export interface MarketListing {
  listingId: number;
  sellerRoleId: number;
  sellerName: string;
  itemId: number;
  itemName: string;
  itemRarity: ItemRarity;
  itemType: GameItemType;
  iconKey?: string;
  categoryKey: string;
  quantity: number;
  price: number;
  currentDurability?: number | null;
  maxDurability?: number | null;
  status: string;
  createdAt: string;
}

// --- PVP 快照 ---
export interface PvpSnapshot {
  rating: number;
  wins: number;
  losses: number;
  leaderboard: PvpLeaderboardEntry[];
  recentBattles: PvpBattleRecord[];
}

export interface PvpLeaderboardEntry {
  rank: number;
  roleId: number;
  name: string;
  level: number;
  rating: number;
  wins: number;
  losses: number;
}

export interface PvpBattleRecord {
  battleId: number;
  opponentName: string;
  opponentLevel: number;
  result: 'win' | 'lose';
  ratingChange: number;
  createdAt: string;
}

// --- 聊天消息 ---
export interface ChatMessageData {
  chatId?: number;
  senderName: string;
  content: string;
  channelKey: string;
  createdAt?: string;
}

// --- 游戏会话上下文 ---
export interface BattleLogEntry {
  timestamp: number;
  message: string;
  type: string;
}

export interface PvpChallengeResult {
  challengerWins: boolean;
  ratingChange: number;
  challengerNewRating: number;
  defenderNewRating: number;
  defenderName: string;
  goldReward: number;
}

export interface GameSessionContextValue {
  snapshot: SessionSnapshot | null;
  connectionStatus: ConnectionStatus;
  chatMessages: ChatMessageData[];
  activityLogs: BattleLogEntry[];
  pvpResult: PvpChallengeResult | null;
  gameError: string | null;
  // 操作函数
  createRole: (name: string, raceKey: RaceKey, classKey: ClassKey) => void;
  startAfk: (activityKey: ActivityKey, mapKey: string) => void;
  stopAfk: () => void;
  claimOfflineReward: () => void;
  equipItem: (backpackId: number, slot: BodySlotType, replaceBackpackId?: number) => void;
  unequipItem: (backpackId: number) => void;
  dropItem: (backpackId: number) => void;
  repairEquipment: (backpackId: number) => void;
  learnSkillBook: (backpackId: number) => void;
  configureSkillLoadout: (skillKeys: string[]) => void;
  createMarketListing: (backpackId: number, price: number) => void;
  cancelMarketListing: (listingId: number) => void;
  buyMarketListing: (listingId: number) => void;
  challengePvp: (targetRoleId: number) => void;
  sendChat: (channelKey: string, content: string) => void;
  clearChannel: (channelKey: string) => void;
  dismissPvpResult: () => void;
  sellItem: (backpackId: number) => void;
}

export type ConnectionStatus = 'booting' | 'ready' | 'saving' | 'error';
