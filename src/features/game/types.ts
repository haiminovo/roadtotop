import type {
  AfkEncounterReward,
  BodySlotCapacities,
  BodySlotType,
  ClassConfig,
  MapConfig,
  EncounterTier,
  PanelKey,
  RaceConfig,
  ClassKey,
  MapKey,
  RaceKey,
} from "@/lib/game-config";
import type { ChatChannelKey, ChatMessage } from "@/features/chat/types";

export type ConnectionStatus = "booting" | "ready" | "saving" | "error";

export type RewardPreview = {
  seconds: number;
  gold: number;
  aetherCrystal: number;
  exp: number;
};

export type BattleLogEntry = {
  id: string;
  text: string;
  timestamp: number;
  type: string;
};

export type BattleSnapshot = {
  battleId: string;
  active: boolean;
  status: "active" | "finished";
  turnCount: number;
  winner: "player" | "enemy" | null;
  outcome: null | {
    loser: string | null;
    summary: string;
    winner: string | null;
  };
  player: {
    actionBar: number;
    currentHealth: number;
    maxHealth: number;
    defenseTurns: number;
    name: string;
    skillUsesRemaining: {
      guard: number;
      spell: number;
    };
    stats: {
      strength: number;
      agility: number;
      intelligence: number;
      vitality: number;
    };
  };
  enemy: {
    key: string;
    level: number;
    name: string;
    summary: string;
    actionBar: number;
    currentHealth: number;
    maxHealth: number;
    defenseTurns: number;
    skillUsesRemaining: {
      guard: number;
      spell: number;
    };
    stats: {
      strength: number;
      agility: number;
      intelligence: number;
      vitality: number;
    };
  };
  logs: BattleLogEntry[];
};

export type BackpackEntry = {
  backpackId: string;
  itemId: string;
  quantity: number;
  equipped: boolean;
  equippedCount: number;
  equippedSlotGroups: string[][];
  name: string;
  rarity: string;
  slot: BodySlotType;
  slotUsage: number;
  description: string;
  sellPrice: number;
  stats: Record<string, number>;
};

export type MarketCategoryKey = "equipment";
export type MarketListingStatus = "active" | "sold" | "cancelled";

export type MarketListingSummary = {
  listingId: string;
  itemId: string;
  categoryKey: MarketCategoryKey;
  name: string;
  rarity: "white" | "green" | "blue" | "purple" | "orange";
  slot: BodySlotType;
  slotUsage: number;
  description: string;
  sellPrice: number;
  stats: Record<string, number>;
  price: number;
  sellerName: string;
  availableCount: number;
  createdAt: number;
  isOwnListing: boolean;
};

export type MarketOwnListing = {
  listingId: string;
  itemId: string;
  categoryKey: MarketCategoryKey;
  name: string;
  rarity: "white" | "green" | "blue" | "purple" | "orange";
  slot: BodySlotType;
  slotUsage: number;
  description: string;
  sellPrice: number;
  stats: Record<string, number>;
  price: number;
  status: MarketListingStatus;
  createdAt: number;
  soldAt: number | null;
  cancelledAt: number | null;
  buyerRoleId: string | null;
  sellerReceiveAmount: number;
  feeAmount: number;
  quantity: number;
  sellerNoticeSeen: boolean;
};

export type SessionSnapshot = {
  serverTime: number;
  account: {
    guestToken: string;
    hasRole: boolean;
    mode: "guest" | "account";
    username: string | null;
    userId: string;
  };
  config: {
    classes: ClassConfig[];
    levels: Array<{ level: number; totalExpRequired: number }>;
    maps: MapConfig[];
    races: RaceConfig[];
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
    currentHealth: number;
    maxHealth: number;
    gold: number;
    aetherCrystal: number;
    avatarSeed: string;
    stats: {
      strength: number;
      agility: number;
      intelligence: number;
      vitality: number;
    };
    bodySlotCapacities: BodySlotCapacities;
    bodySlots: Array<{
      key: string;
      label: string;
      slotType: BodySlotType;
      item: null | {
        backpackId: string;
        itemId: string;
        name: string;
        rarity: string;
      };
    }>;
  };
  backpack: BackpackEntry[];
  afk: {
    status: "idle" | "active";
    mapKey: MapKey | null;
    startedAt: number | null;
    lastSettledAt: number | null;
    shouldShowOfflineRewardModal: boolean;
    accruedSeconds: number;
    taskDurationSeconds: number;
    maxOfflineSeconds: number;
    mapOptions: MapConfig[];
    currentMap: MapConfig | null;
    pendingReward: RewardPreview;
    battle: BattleSnapshot | null;
    estimatedHourlyReward: RewardPreview;
    encounterRates: Record<EncounterTier, number>;
    recentEncounters: Array<{
      id: string;
      key: string;
      tier: EncounterTier;
      title: string;
      description: string;
      reward: AfkEncounterReward;
      triggeredAt: number;
    }>;
  };
  market: {
    feeRatePercent: number;
    categoryOptions: Array<{ key: MarketCategoryKey; label: string }>;
    rarityOptions: Array<"white" | "green" | "blue" | "purple" | "orange">;
    slotOptions: BodySlotType[];
    listings: MarketListingSummary[];
    myListings: MarketOwnListing[];
  };
};

export type CreateRoleDraft = {
  classKey: ClassKey;
  name: string;
  raceKey: RaceKey;
};

export type AccountLoginDraft = {
  password: string;
  username: string;
};

export type AccountRegistrationDraft = {
  confirmPassword: string;
  password: string;
  username: string;
};

export type GameSessionContextValue = {
  activePanel: PanelKey;
  accountLogin: (draft: AccountLoginDraft) => Promise<void>;
  chatMessages: ChatMessage[];
  createRole: (draft: CreateRoleDraft) => Promise<void>;
  createMarketListing: (backpackId: string, price: number, quantity: number) => Promise<void>;
  cancelMarketListing: (listingId: string) => Promise<void>;
  dismissMarketSoldNotification: (listingId: string) => Promise<void>;
  deleteAccountRole: () => Promise<void>;
  error: string | null;
  buyMarketListing: (listingId: string) => Promise<void>;
  claimOfflineReward: () => Promise<void>;
  dropBackpackItem: (backpackId: string) => Promise<void>;
  equipBackpackItem: (backpackId: string) => Promise<void>;
  dismissError: () => void;
  guestLogin: () => Promise<void>;
  isRealtimeReady: boolean;
  registerAccount: (draft: AccountRegistrationDraft) => Promise<void>;
  sendChatMessage: (channelKey: ChatChannelKey, content: string) => Promise<void>;
  selectedMapKey: MapKey;
  selectMap: (mapKey: MapKey) => void;
  setActivePanel: (panel: PanelKey) => void;
  snapshot: SessionSnapshot | null;
  startAfk: () => Promise<void>;
  status: ConnectionStatus;
  stopAfk: () => Promise<void>;
  unequipBackpackItem: (backpackId: string) => Promise<void>;
};
