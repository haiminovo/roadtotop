'use client';

import { useChatSocket } from "@/features/chat/hooks/use-chat-socket";

const statusLabel = {
  connected: "Connected",
  connecting: "Connecting",
  disconnected: "Disconnected",
} as const;

export default function Chat() {
  const { input, messages, sendMessage, setInput, status } = useChatSocket();

  return (
    <section className="border-t border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Realtime Chat</h3>
          <p className="text-xs text-slate-500">Talk to other connected clients through WebSocket.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {statusLabel[status]}
        </span>
      </div>

      <div className="mb-4 h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
        {messages.length === 0 ? (
          <p className="text-sm text-slate-400">No messages yet. Start the conversation below.</p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={[
                "rounded-lg px-3 py-2 text-sm",
                message.role === "self"
                  ? "ml-auto max-w-[80%] bg-blue-600 text-white"
                  : message.role === "server"
                    ? "max-w-[80%] bg-white text-slate-700"
                    : "bg-transparent px-0 py-1 text-xs text-slate-400",
              ].join(" ")}
            >
              {message.role === "server" ? `Server: ${message.content}` : message.content}
            </div>
          ))
        )}
      </div>

      <div className="flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              sendMessage();
            }
          }}
          className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
          placeholder="Type a message"
        />
        <button
          onClick={sendMessage}
          className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-700"
          type="button"
        >
          Send
        </button>
      </div>
    </section>
  );
}
