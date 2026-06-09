'use client';

import React from 'react';
import type { SessionSnapshot } from '../types';
import { CommandButton } from './ui/command-button';
import { formatNumber } from '@/lib/game-config';

interface OfflineRewardModalProps {
  snapshot: SessionSnapshot;
  onClaim: () => void;
  onClose: () => void;
}

export function OfflineRewardModal({ snapshot, onClaim, onClose }: OfflineRewardModalProps) {
  const { afk } = snapshot;
  const hasReward = afk.pendingReward.gold > 0 || afk.pendingReward.aether > 0 || afk.pendingReward.exp > 0;

  if (!hasReward) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-bg-secondary border border-border-primary rounded-lg p-6 max-w-sm w-full mx-4">
        <h2 className="text-lg font-bold text-center mb-4">离线收益</h2>

        <div className="text-center text-sm text-text-muted mb-4">
          离线期间获得了以下奖励
        </div>

        <div className="space-y-3 mb-6">
          {afk.pendingReward.gold > 0 && (
            <div className="flex items-center justify-between p-3 rounded bg-bg-tertiary">
              <span className="text-text-secondary">金币</span>
              <span className="text-lg font-bold text-accent-orange">+{formatNumber(afk.pendingReward.gold)}</span>
            </div>
          )}
          {afk.pendingReward.aether > 0 && (
            <div className="flex items-center justify-between p-3 rounded bg-bg-tertiary">
              <span className="text-text-secondary">以太水晶</span>
              <span className="text-lg font-bold text-accent-purple">+{formatNumber(afk.pendingReward.aether)}</span>
            </div>
          )}
          {afk.pendingReward.exp > 0 && (
            <div className="flex items-center justify-between p-3 rounded bg-bg-tertiary">
              <span className="text-text-secondary">经验值</span>
              <span className="text-lg font-bold text-accent-blue">+{formatNumber(afk.pendingReward.exp)}</span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <CommandButton variant="neutral" onClick={onClose} className="flex-1">
            稍后领取
          </CommandButton>
          <CommandButton variant="success" onClick={onClaim} className="flex-1">
            领取奖励
          </CommandButton>
        </div>
      </div>
    </div>
  );
}
