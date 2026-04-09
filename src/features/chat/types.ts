export type ChatMessageRole = "system" | "self" | "server";

export type ChatMessage = {
  id: string;
  role: ChatMessageRole;
  content: string;
};
