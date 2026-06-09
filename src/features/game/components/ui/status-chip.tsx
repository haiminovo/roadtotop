'use client';

import React from 'react';

interface StatusChipProps {
  status: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  className?: string;
}

const variantClasses = {
  default: 'bg-bg-tertiary text-text-secondary',
  success: 'bg-accent-green/20 text-accent-green',
  warning: 'bg-accent-orange/20 text-accent-orange',
  danger: 'bg-accent-red/20 text-accent-red',
};

export function StatusChip({ status, variant = 'default', className = '' }: StatusChipProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]} ${className}`}>
      {status}
    </span>
  );
}
