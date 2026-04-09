'use client';

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/features/chat/types";

const WS_URL = "ws://127.0.0.1:8080";

function createMessage(role: ChatMessage["role"], content: string): ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
  };
}

export function useChatSocket() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">(
    "connecting",
  );
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const socket = new WebSocket(WS_URL);
    socketRef.current = socket;

    socket.onopen = () => {
      setStatus("connected");
      setMessages((current) => [...current, createMessage("system", "Connected to server")]);
    };

    socket.onmessage = (event) => {
      setMessages((current) => [...current, createMessage("server", event.data)]);
    };

    socket.onerror = () => {
      setMessages((current) => [...current, createMessage("system", "WebSocket error")]);
    };

    socket.onclose = () => {
      setStatus("disconnected");
      setMessages((current) => [...current, createMessage("system", "WebSocket disconnected")]);
    };

    return () => {
      socket.close();
    };
  }, []);

  const sendMessage = () => {
    const trimmedInput = input.trim();

    if (!trimmedInput) {
      return;
    }

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(trimmedInput);
      setMessages((current) => [...current, createMessage("self", trimmedInput)]);
      setInput("");
    }
  };

  return {
    input,
    messages,
    sendMessage,
    setInput,
    status,
  };
}
