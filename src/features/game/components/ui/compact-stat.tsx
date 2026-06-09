'use client';

import React from 'react';

interface CompactStatProps {
  label: string;
  value: number;
  max?: number;
  color?: string;
  showBar?: boolean;
  className?: string;
}

export function CompactStat({ label, value, max, color, showBar = false, className = '' }: CompactStatProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-xs text-text-muted w-8">{label}</span>
      {showBar && max ? (
        <div className="flex-1 flex items-center gap-2">
          <div className="flex-1 progress-bar">
            <div
              className="progress-bar-fill"
              style={{ width: `${(value / max) * 100}%`, background: color || 'var(--accent-blue)' }}
            />
          </div>
          <span className="text-xs text-text-secondary tabular-nums">{value}/{max}</span>
        </div>
      ) : (
        <span className="text-sm font-medium tabular-nums" style={{ color: color || 'var(--text-primary)' }}>
          {value}
        </span>
      )}
    </div>
  );
}
