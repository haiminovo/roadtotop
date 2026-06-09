'use client';

import React from 'react';

interface DataPillProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: string;
  className?: string;
}

export function DataPill({ label, value, icon, color, className = '' }: DataPillProps) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-bg-tertiary text-xs ${className}`}>
      {icon && <span className="text-text-secondary">{icon}</span>}
      <span className="text-text-muted">{label}</span>
      <span className="font-medium" style={{ color: color || 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}
