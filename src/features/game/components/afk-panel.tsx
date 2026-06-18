'use client';

// ============================================================
// 无尽模式面板 - 唯一玩法
// ============================================================

import React from 'react';
import { EndlessModePanel } from './endless-mode-panel';
import type { SessionSnapshot } from '../types';

interface AfkPanelProps {
  snapshot: SessionSnapshot;
}

export function AfkPanel({ snapshot }: AfkPanelProps): React.ReactElement {
  const { role } = snapshot;
  return <EndlessModePanel heroName={role.name} classKey={role.classKey} />;
}
