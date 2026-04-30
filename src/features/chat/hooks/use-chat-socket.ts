'use client';

import { useState } from "react";
import type { ChatMessage } from "@/features/chat/types";
import { useGameSession } from "@/features/game/context/game-session-provider";

export function useChatSocket() {
  const { status } = useGameSession();
  const [input, setInput] = useState("");
  const [messages] = useState<ChatMessage[]>([]);

  return {
    input,
    messages,
    sendMessage: () => {
      setInput("");
    },
    setInput,
    status,
  };
}
