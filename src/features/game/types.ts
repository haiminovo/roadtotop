import type {
  ClassConfig,
  MapConfig,
  PanelKey,
  RaceConfig,
  ClassKey,
  MapKey,
  RaceKey,
} from "@/lib/game-config";

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
  name: string;
  rarity: string;
  slot: string;
  description: string;
  sellPrice: number;
  stats: Record<string, number>;
};

export type TaskEntry = {
  taskId: string;
  code: string;
  title: string;
  description: string;
  status: "active" | "completed";
  progress: number;
  target: number;
  rewardGold: number;
  rewardExp: number;
};

export type SessionSnapshot = {
  serverTime: number;
  account: {
    guestToken: string;
    hasRole: boolean;
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
  backpack: BackpackEntry[];
  tasks: TaskEntry[];
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
  };
};

export type CreateRoleDraft = {
  classKey: ClassKey;
  name: string;
  raceKey: RaceKey;
};

export type GameSessionContextValue = {
  activePanel: PanelKey;
  createRole: (draft: CreateRoleDraft) => Promise<void>;
  error: string | null;
  claimOfflineReward: () => Promise<void>;
  dismissError: () => void;
  guestLogin: () => Promise<void>;
  selectedMapKey: MapKey;
  selectMap: (mapKey: MapKey) => void;
  setActivePanel: (panel: PanelKey) => void;
  snapshot: SessionSnapshot | null;
  startAfk: () => Promise<void>;
  status: ConnectionStatus;
  stopAfk: () => Promise<void>;
};
