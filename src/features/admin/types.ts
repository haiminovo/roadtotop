export type AdminAccountRecord = {
  userId: string;
  guestToken: string;
  accountType: "guest" | "account";
  username: string | null;
  hasPassword: boolean;
  roleId: string | null;
  roleName: string | null;
  createdAt: number | null;
  lastLoginAt: number | null;
  lastSeenAt: number | null;
};

export type AdminRoleRecord = {
  roleId: string;
  userId: string;
  name: string;
  raceKey: string;
  classKey: string;
  level: number;
  exp: number;
  gold: number;
  aetherCrystal: number;
  currentHealth: number;
  strength: number;
  agility: number;
  intelligence: number;
  vitality: number;
  avatarSeed: string;
  username: string | null;
  accountType: string;
  updatedAt: number | null;
};

export type AdminAccountDraft = {
  accountType: "guest" | "account";
  guestToken: string;
  password: string;
  username: string;
};

export type AdminRoleDraft = {
  userId: string;
  name: string;
  raceKey: string;
  classKey: string;
  level: number;
  exp: number;
  gold: number;
  aetherCrystal: number;
  currentHealth: number;
  strength: number;
  agility: number;
  intelligence: number;
  vitality: number;
  avatarSeed: string;
};
