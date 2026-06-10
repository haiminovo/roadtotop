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

const MIN_HEIGHT = 32;
const MAX_HEIGHT = 500;
const DEFAULT_HEIGHT = 200;

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
  const [chatHeight, setChatHeight] = useState(DEFAULT_HEIGHT);
  const [collapsed, setCollapsed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  useEffect(() => {
    if (!collapsed) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, collapsed]);

  const handleSend = () => {
    const content = input.trim();
    if (!content) return;
    onSend(currentChannel, content);
    setInput('');
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    startHeightRef.current = collapsed ? MIN_HEIGHT : chatHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, [chatHeight, collapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const delta = startYRef.current - e.clientY;
      const newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startHeightRef.current + delta));
      setChatHeight(newHeight);
      setCollapsed(newHeight <= MIN_HEIGHT + 10);
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

  const toggleCollapse = () => {
    if (collapsed) {
      setCollapsed(false);
      setChatHeight(DEFAULT_HEIGHT);
    } else {
      setCollapsed(true);
    }
  };

  const filteredMessages = messages.filter(m => m.channelKey === currentChannel);
  const currentHeight = collapsed ? MIN_HEIGHT : chatHeight;

  return (
    <div ref={containerRef} className="bg-bg-secondary border-t border-border-primary flex flex-col relative" style={{ height: currentHeight }}>
      {/* 拖动手柄 */}
      <div
        className="absolute top-0 left-0 right-0 h-1 cursor-row-resize z-10 hover:bg-accent-blue/20"
        onMouseDown={handleMouseDown}
      />

      {/* 频道切换栏 */}
      <div className="flex items-center gap-1 px-3 shrink-0" style={{ height: 28, marginTop: 4 }}>
        {CHANNELS.map(ch => (
          <button
            key={ch.key}
            onClick={() => {
              onChannelChange(ch.key);
              if (collapsed) setCollapsed(false);
            }}
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
        <div className="ml-auto flex items-center gap-2">
          {!collapsed && (
            <span className="text-text-muted text-xs">{filteredMessages.length} 条</span>
          )}
          <button
            onClick={toggleCollapse}
            className="text-text-muted hover:text-text-secondary text-xs px-1 leading-none"
            title={collapsed ? '展开聊天' : '收起聊天'}
          >
            {collapsed ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* 聊天历史 + 输入栏（收起时隐藏） */}
      {!collapsed && (
        <>
          <div className="flex-1 overflow-y-auto px-3 py-1 space-y-0.5 min-h-0">
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

          <div className="flex items-center gap-2 px-3 py-1.5 border-t border-border-secondary shrink-0">
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
        </>
      )}
    </div>
  );
}
