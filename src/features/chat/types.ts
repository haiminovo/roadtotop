export type ChatChannelKey = "world" | "trade" | "tavern";

export type ChatRoleProfile = {
  roleId: string;
  name: string;
  raceKey: string;
  classKey: string;
  level: number;
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
  equippedItems: Array<{
    backpackId: string;
    itemId: string;
    name: string;
    rarity: string;
    slot: string;
    iconKey: string | null;
    equippedCount: number;
    equippedSlotGroups: string[][];
  }>;
};

export type ChatMessage = {
  channelKey: ChatChannelKey;
  createdAt: number;
  id: string;
  content: string;
  senderName: string;
  senderRole: ChatRoleProfile | null;
  senderRoleId: string | null;
  senderUserId: string;
};

export type ChatChannel = {
  key: ChatChannelKey;
  label: string;
};
