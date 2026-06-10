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

export function ChatPanel({ messages, currentChannel, onChannelChange, onSend }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showHistory) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, showHistory]);

  const handleSend = () => {
    const content = input.trim();
    if (!content) return;
    onSend(currentChannel, content);
    setInput('');
  };

  const filteredMessages = messages.filter(m => m.channelKey === currentChannel);

  return (
    <div className="bg-bg-secondary border-t border-border-primary">
      {/* 聊天历史（可展开） */}
      {showHistory && (
        <div className="max-h-48 overflow-y-auto px-3 py-2 space-y-0.5 border-b border-border-secondary">
          {filteredMessages.length === 0 ? (
            <p className="text-text-muted text-xs text-center py-2">暂无消息</p>
          ) : (
            filteredMessages.map((msg, i) => (
              <div key={msg.chatId || i} className="text-xs leading-5">
                <span className="text-accent-blue font-medium">{msg.senderName}</span>
                <span className="text-text-muted">: </span>
                <span className="text-text-primary">{msg.content}</span>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* 输入栏 */}
      <div className="flex items-center gap-1 px-2 py-1.5">
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
          className="px-2 py-1 text-xs bg-accent-blue text-white rounded hover:brightness-110"
        >
          发送
        </button>

        {/* 展开/收起历史 */}
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="px-1.5 py-1 text-xs text-text-muted hover:text-text-secondary"
          title={showHistory ? '收起聊天' : '展开聊天'}
        >
          {showHistory ? '▼' : '▲'}
        </button>
      </div>
    </div>
  );
}
