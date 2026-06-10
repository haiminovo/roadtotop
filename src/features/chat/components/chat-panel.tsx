'use client';

import React, { useState, useRef, useEffect } from 'react';

interface ChatMessage {
  chatId?: number;
  senderName: string;
  content: string;
  channelKey: string;
  createdAt?: string;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  currentChannel: string;
  onChannelChange: (channel: string) => void;
  onSend: (channelKey: string, content: string) => void;
}

const CHANNELS = [
  { key: 'world', name: '综合', color: 'var(--accent-blue)' },
  { key: 'trade', name: '交易', color: 'var(--accent-orange)' },
  { key: 'tavern', name: '酒馆', color: 'var(--accent-green)' },
];

function formatTime(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${year}-${month}-${day} ${h}:${m}`;
}

export function ChatPanel({ messages, currentChannel, onChannelChange, onSend }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const content = input.trim();
    if (!content) return;
    onSend(currentChannel, content);
    setInput('');
  };

  const filteredMessages = messages.filter(m => m.channelKey === currentChannel);

  return (
    <div className="bg-bg-secondary border-t border-border-primary">
      {/* 聊天历史（默认展开） */}
      <div className="h-32 overflow-y-auto px-3 py-1.5 space-y-0.5">
        {filteredMessages.length === 0 ? (
          <p className="text-text-muted text-xs text-center py-4">暂无消息，说点什么吧...</p>
        ) : (
          filteredMessages.map((msg, i) => (
            <div key={msg.chatId || i} className="text-xs leading-5">
              <span className="text-text-muted">[{formatTime(msg.createdAt)}]</span>
              <span className="text-accent-blue font-medium ml-1">{msg.senderName}</span>
              <span className="text-text-muted">: </span>
              <span className="text-text-primary">{msg.content}</span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入栏 */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-t border-border-secondary">
        {/* 频道切换 */}
        <div className="flex gap-0.5">
          {CHANNELS.map(ch => (
            <button
              key={ch.key}
              onClick={() => onChannelChange(ch.key)}
              className={`px-1.5 py-0.5 text-xs rounded transition-colors ${
                currentChannel === ch.key
                  ? 'text-white font-medium'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
              style={currentChannel === ch.key ? { background: ch.color } : undefined}
            >
              {ch.name}
            </button>
          ))}
        </div>

        {/* 输入框 */}
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="输入消息..."
          maxLength={160}
          className="flex-1 px-2 py-1 text-xs bg-bg-tertiary border border-border-primary rounded text-text-primary placeholder:text-text-muted outline-none focus:border-accent-blue"
        />

        {/* 发送按钮 */}
        <button
          onClick={handleSend}
          className="px-3 py-1 text-xs bg-accent-blue text-white rounded hover:brightness-110"
        >
          发送
        </button>
      </div>
    </div>
  );
}
