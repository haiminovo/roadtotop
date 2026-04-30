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
  deleteAccountRole: () => Promise<void>;
  error: string | null;
  claimOfflineReward: () => Promise<void>;
  dropBackpackItem: (backpackId: string) => Promise<void>;
  equipBackpackItem: (backpackId: string) => Promise<void>;
  dismissError: () => void;
  guestLogin: () => Promise<void>;
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
