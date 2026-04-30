export type ChatChannelKey = "world" | "trade" | "tavern";

export type ChatMessage = {
  channelKey: ChatChannelKey;
  createdAt: number;
  id: string;
  content: string;
  senderName: string;
  senderUserId: string;
};

export type ChatChannel = {
  key: ChatChannelKey;
  label: string;
  summary: string;
};
