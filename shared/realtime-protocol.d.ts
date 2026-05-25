export type ClientMessageType =
  | "game:session:start"
  | "game:afk:start"
  | "game:afk:stop"
  | "game:afk:claim"
  | "game:backpack:drop"
  | "game:backpack:equip"
  | "game:backpack:unequip"
  | "game:backpack:learn-skill-book"
  | "game:skill:configure-loadout"
  | "game:market:create"
  | "game:market:cancel"
  | "game:market:buy"
  | "game:market:sold:dismiss"
  | "game:pvp:challenge"
  | "game:chat:send";

export type ServerMessageType =
  | "game:error"
  | "game:session:ready"
  | "game:state:update"
  | "game:chat:history"
  | "game:chat:message";

export type ClientMessagePayloads = {
  "game:session:start": { guestToken: string };
  "game:afk:start": { activityKey: string; mapKey: string };
  "game:afk:stop": Record<string, never>;
  "game:afk:claim": Record<string, never>;
  "game:backpack:drop": { backpackId: string };
  "game:backpack:equip": { backpackId: string };
  "game:backpack:unequip": { backpackId: string };
  "game:backpack:learn-skill-book": { backpackId: string };
  "game:skill:configure-loadout": { action: "equip" | "unequip"; skillKey: string };
  "game:market:create": { backpackId: string; price: number; quantity: number };
  "game:market:cancel": { listingId: string };
  "game:market:buy": { listingId: string };
  "game:market:sold:dismiss": { listingId: string };
  "game:pvp:challenge": { targetRoleId: string };
  "game:chat:send": { channelKey: string; content: string };
};

export type ClientMessage<TType extends ClientMessageType = ClientMessageType> = {
  type: TType;
  payload: ClientMessagePayloads[TType];
};

export type ServerMessage = {
  type: ServerMessageType | string;
  payload: Record<string, unknown>;
};

export const CLIENT_MESSAGE_TYPES: Readonly<{
  AFK_CLAIM: "game:afk:claim";
  AFK_START: "game:afk:start";
  AFK_STOP: "game:afk:stop";
  BACKPACK_DROP: "game:backpack:drop";
  BACKPACK_EQUIP: "game:backpack:equip";
  BACKPACK_LEARN_SKILL_BOOK: "game:backpack:learn-skill-book";
  BACKPACK_UNEQUIP: "game:backpack:unequip";
  CHAT_SEND: "game:chat:send";
  MARKET_BUY: "game:market:buy";
  MARKET_CANCEL: "game:market:cancel";
  MARKET_CREATE: "game:market:create";
  MARKET_SOLD_DISMISS: "game:market:sold:dismiss";
  PVP_CHALLENGE: "game:pvp:challenge";
  SESSION_START: "game:session:start";
  SKILL_CONFIGURE_LOADOUT: "game:skill:configure-loadout";
}>;

export const SERVER_MESSAGE_TYPES: Readonly<{
  CHAT_HISTORY: "game:chat:history";
  CHAT_MESSAGE: "game:chat:message";
  ERROR: "game:error";
  SESSION_READY: "game:session:ready";
  STATE_UPDATE: "game:state:update";
}>;

export function createClientMessage<TType extends ClientMessageType>(
  type: TType,
  payload: ClientMessagePayloads[TType],
): ClientMessage<TType>;

export function parseServerMessage(value: unknown): ServerMessage | null;

export function validateClientMessage(value: unknown):
  | { ok: true; message: ClientMessage }
  | { ok: false; error: string };
