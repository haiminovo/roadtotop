'use client';

import { useChatSocket } from "@/features/chat/hooks/use-chat-socket";

const statusLabel = {
  booting: "世界初始化中",
  error: "状态同步异常",
  ready: "主界面就绪",
  saving: "正在提交操作",
} as const;

export default function Chat() {
  const { input, messages, sendMessage, setInput, status } = useChatSocket();

  return (
    <section className="border-t border-cyan-400/10 bg-slate-950 p-5 text-white">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">酒馆大厅</h3>
          <p className="text-xs text-slate-400">通过 WebSocket 模拟世界聊天、酒馆招募、交易喊话和委托播报。</p>
        </div>
        <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-100">
          {statusLabel[status]}
        </span>
      </div>

      <div className="mb-4 h-56 space-y-2 overflow-y-auto rounded-2xl border border-white/8 bg-slate-900/70 p-3">
        {messages.length === 0 ? (
          <p className="text-sm text-slate-500">大厅还很安静。发一句招募、收购或委托情报试试看。</p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={[
                "rounded-lg px-3 py-2 text-sm",
                message.role === "self"
                  ? "ml-auto max-w-[80%] bg-cyan-400 text-slate-950"
                  : message.role === "server"
                    ? "max-w-[80%] bg-white/8 text-slate-100"
                    : "bg-transparent px-0 py-1 text-xs text-slate-500",
              ].join(" ")}
            >
              {message.role === "server" ? `频道: ${message.content}` : message.content}
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
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
          placeholder="输入招募、交易、酒馆情报..."
        />
        <button
          onClick={sendMessage}
          className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-cyan-300"
          type="button"
        >
          发送
        </button>
      </div>
    </section>
  );
}
