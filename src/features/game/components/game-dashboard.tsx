'use client';

import React, { useState } from 'react';
import { useGameSession } from '../context/game-session-provider';
import { TopStatusBar } from './top-status-bar';
import { RolePanel } from './role-panel';
import { BackpackPanel } from './backpack-panel';
import { AfkPanel } from './afk-panel';
import { MarketPanel } from './market-panel';
import { PvpPanel } from './pvp-panel';
import { OfflineRewardModal } from './offline-reward-modal';
import { ChatPanel } from '@/features/chat/components/chat-panel';

type TabKey = 'afk' | 'role' | 'backpack' | 'market' | 'pvp';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'afk', label: '活动' },
  { key: 'role', label: '角色' },
  { key: 'backpack', label: '背包' },
  { key: 'market', label: '市场' },
  { key: 'pvp', label: 'PVP' },
];

export function GameDashboard() {
  const {
    snapshot, connectionStatus, chatMessages, activityLogs,
    createRole, startAfk, stopAfk, claimOfflineReward,
    equipItem, unequipItem, dropItem, learnSkillBook,
    createMarketListing, cancelMarketListing, buyMarketListing,
    challengePvp, sendChat, clearChannel,
  } = useGameSession();

  const [activeTab, setActiveTab] = useState<TabKey>('afk');
  const [chatChannel, setChatChannel] = useState('world');
  const [offlineRewardDismissed, setOfflineRewardDismissed] = useState(false);
  const [roleName, setRoleName] = useState('');
  const [selectedRace, setSelectedRace] = useState('');
  const [selectedClass, setSelectedClass] = useState('');

  // 检查是否有离线奖励（在渲染前检查）
  const hasOfflineReward = snapshot?.afk && (
    snapshot.afk.pendingReward.gold > 0 ||
    snapshot.afk.pendingReward.aether > 0 ||
    snapshot.afk.pendingReward.exp > 0
  );

  // 连接状态
  if (connectionStatus === 'booting') {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-text-secondary">连接中...</div>
      </div>
    );
  }

  if (connectionStatus === 'error') {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-accent-red">连接失败，请刷新页面重试</div>
      </div>
    );
  }

  // 需要创建角色
  if (!snapshot?.role) {
    return (
      <div className="flex items-center justify-center h-screen p-4">
        <div className="bg-bg-secondary border border-border-primary rounded-lg p-6 max-w-md w-full">
          <h1 className="text-xl font-bold text-center mb-6">创建你的角色</h1>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-text-secondary block mb-1">角色名</label>
              <input
                type="text"
                value={roleName}
                onChange={e => setRoleName(e.target.value)}
                maxLength={16}
                className="w-full px-3 py-2 bg-bg-tertiary border border-border-primary rounded text-text-primary"
                placeholder="输入角色名..."
              />
            </div>

            <div>
              <label className="text-sm text-text-secondary block mb-1">种族</label>
              <div className="grid grid-cols-3 gap-2">
                {(snapshot?.config?.races || []).map(race => (
                  <button
                    key={race.key}
                    onClick={() => setSelectedRace(race.key)}
                    className={`p-2 rounded text-xs text-center transition-colors ${
                      selectedRace === race.key
                        ? 'bg-accent-blue text-white'
                        : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover'
                    }`}
                  >
                    <div className="font-medium">{race.name}</div>
                    <div className="text-text-muted mt-0.5">{race.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm text-text-secondary block mb-1">职业</label>
              <div className="grid grid-cols-3 gap-2">
                {(snapshot?.config?.classes || []).map(cls => (
                  <button
                    key={cls.key}
                    onClick={() => setSelectedClass(cls.key)}
                    className={`p-2 rounded text-xs text-center transition-colors ${
                      selectedClass === cls.key
                        ? 'bg-accent-blue text-white'
                        : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover'
                    }`}
                  >
                    <div className="font-medium">{cls.name}</div>
                    <div className="text-text-muted mt-0.5">{cls.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                if (roleName && selectedRace && selectedClass) {
                  createRole(roleName, selectedRace as never, selectedClass as never);
                }
              }}
              disabled={!roleName || !selectedRace || !selectedClass}
              className="w-full py-2 bg-accent-blue text-white rounded font-medium disabled:opacity-50"
            >
              创建角色
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* 桌面端侧边导航（全高） */}
      <nav className="hidden lg:flex flex-col w-16 bg-bg-secondary border-r border-border-primary">
        {/* 游戏标题 */}
        <div className="py-3 text-center border-b border-border-primary">
          <span className="text-xs font-bold text-accent-blue">RTT</span>
        </div>
        {/* 标签按钮 */}
        <div className="flex-1 flex flex-col py-2">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center text-xs transition-colors min-h-0 ${
                activeTab === tab.key
                  ? 'bg-bg-tertiary text-accent-blue border-l-2 border-accent-blue'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* 右侧主区域 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 顶部状态栏 */}
        <TopStatusBar snapshot={snapshot} />

        {/* 主内容区 */}
        <main className="flex-1 overflow-y-auto p-3">
          {/* 各面板 */}
          {activeTab === 'role' && (
            <RolePanel
              snapshot={snapshot}
              onUnequip={unequipItem}
            />
          )}
          {activeTab === 'backpack' && (
            <BackpackPanel
              snapshot={snapshot}
              onEquip={(id, slot) => equipItem(id, slot)}
              onUnequip={unequipItem}
              onDrop={dropItem}
              onLearnSkillBook={learnSkillBook}
            />
          )}
          {activeTab === 'afk' && (
            <AfkPanel
              snapshot={snapshot}
              onStart={(activity, map) => startAfk(activity, map)}
              onStop={stopAfk}
              onClaim={claimOfflineReward}
            />
          )}
          {activeTab === 'market' && (
            <MarketPanel
              snapshot={snapshot}
              onCreateListing={createMarketListing}
              onCancelListing={cancelMarketListing}
              onBuyListing={buyMarketListing}
            />
          )}
          {activeTab === 'pvp' && (
            <PvpPanel
              snapshot={snapshot}
              onChallenge={challengePvp}
            />
          )}
        </main>

        {/* 底部聊天栏（常驻） */}
        <ChatPanel
          messages={chatMessages}
          currentChannel={chatChannel}
          onChannelChange={setChatChannel}
          onSend={sendChat}
          onClear={clearChannel}
          activityLogs={activityLogs}
        />

        {/* 移动端底部标签栏 */}
        <nav className="lg:hidden flex bg-bg-secondary border-t border-border-primary">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 text-xs text-center transition-colors ${
                activeTab === tab.key ? 'text-accent-blue' : 'text-text-muted'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* 离线收益弹窗（登录时自动结算，只弹一次） */}
      {hasOfflineReward && !offlineRewardDismissed && (
        <OfflineRewardModal
          snapshot={snapshot}
          onClaim={() => { claimOfflineReward(); setOfflineRewardDismissed(true); }}
        />
      )}
    </div>
  );
}
