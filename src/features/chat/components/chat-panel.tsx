'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

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
  const [chatHeight, setChatHeight] = useState(200);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const content = input.trim();
    if (!content) return;
    onSend(currentChannel, content);
    setInput('');
  };

  // 拖动调整高度
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = chatHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, [chatHeight]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const delta = startYRef.current - e.clientY;
      const newHeight = Math.max(80, Math.min(500, startHeightRef.current + delta));
      setChatHeight(newHeight);
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const filteredMessages = messages.filter(m => m.channelKey === currentChannel);

  return (
    <div ref={containerRef} className="bg-bg-secondary border-t border-border-primary flex flex-col" style={{ height: chatHeight }}>
      {/* 拖动手柄 */}
      <div
        className="h-1.5 cursor-row-resize flex items-center justify-center hover:bg-bg-hover group"
        onMouseDown={handleMouseDown}
      >
        <div className="w-8 h-0.5 rounded bg-border-primary group-hover:bg-text-muted transition-colors" />
      </div>

      {/* 频道切换 */}
      <div className="flex items-center gap-1 px-3 py-1 border-b border-border-secondary">
        {CHANNELS.map(ch => (
          <button
            key={ch.key}
            onClick={() => onChannelChange(ch.key)}
            className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
              currentChannel === ch.key
                ? 'text-white font-medium'
                : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover'
            }`}
            style={currentChannel === ch.key ? { background: ch.color } : undefined}
          >
            {ch.name}
          </button>
        ))}
        <span className="text-text-muted text-xs ml-auto">{filteredMessages.length} 条消息</span>
      </div>

      {/* 聊天历史 */}
      <div className="flex-1 overflow-y-auto px-3 py-1.5 space-y-0.5 min-h-0">
        {filteredMessages.length === 0 ? (
          <p className="text-text-muted text-xs text-center py-4">暂无消息，说点什么吧...</p>
        ) : (
          filteredMessages.map((msg, i) => (
            <div key={msg.chatId || i} className="text-xs leading-5 hover:bg-bg-hover px-1 rounded">
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
      <div className="flex items-center gap-2 px-3 py-1.5 border-t border-border-secondary">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder={`在 ${CHANNELS.find(c => c.key === currentChannel)?.name || ''} 频道发言...`}
          maxLength={160}
          className="flex-1 px-2 py-1 text-xs bg-bg-tertiary border border-border-primary rounded text-text-primary placeholder:text-text-muted outline-none focus:border-accent-blue"
        />
        <button
          onClick={handleSend}
          className="px-3 py-1 text-xs bg-accent-blue text-white rounded hover:brightness-110 active:brightness-90"
        >
          发送
        </button>
      </div>
    </div>
  );
}
