'use client';

import React, { useState, useRef, useEffect } from 'react';
import { SectionCard } from '@/features/game/components/ui/section-card';
import { CommandButton } from '@/features/game/components/ui/command-button';

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
  { key: 'world', name: '世界', color: 'var(--accent-blue)' },
  { key: 'trade', name: '交易', color: 'var(--accent-orange)' },
  { key: 'tavern', name: '酒馆', color: 'var(--accent-green)' },
];

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
    <SectionCard title="聊天" className="flex flex-col h-full">
      {/* 频道选择 */}
      <div className="flex gap-1 mb-2">
        {CHANNELS.map(ch => (
          <button
            key={ch.key}
            onClick={() => onChannelChange(ch.key)}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              currentChannel === ch.key
                ? 'text-white font-medium'
                : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover'
            }`}
            style={currentChannel === ch.key ? { background: ch.color } : undefined}
          >
            {ch.name}
          </button>
        ))}
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto min-h-0 max-h-60 space-y-1 mb-2">
        {filteredMessages.length === 0 ? (
          <p className="text-text-muted text-xs text-center py-4">暂无消息</p>
        ) : (
          filteredMessages.map((msg, i) => (
            <div key={msg.chatId || i} className="text-xs">
              <span className="text-accent-blue font-medium">{msg.senderName}</span>
              <span className="text-text-muted">: </span>
              <span className="text-text-primary">{msg.content}</span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入框 */}
      <div className="flex gap-1">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="输入消息..."
          maxLength={160}
          className="flex-1 px-2 py-1 text-xs bg-bg-tertiary border border-border-primary rounded text-text-primary placeholder:text-text-muted outline-none focus:border-accent-blue"
        />
        <CommandButton size="sm" variant="primary" onClick={handleSend}>
          发送
        </CommandButton>
      </div>
    </SectionCard>
  );
}
