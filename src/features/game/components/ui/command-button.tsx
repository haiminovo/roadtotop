'use client';

import React from 'react';

interface CommandButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'neutral' | 'danger' | 'success';
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
}

const variantClasses = {
  primary: 'bg-accent-blue text-white hover:brightness-110',
  neutral: 'bg-bg-tertiary text-text-primary border border-border-primary hover:bg-bg-hover',
  danger: 'bg-accent-red text-white hover:brightness-110',
  success: 'bg-accent-green text-white hover:brightness-110',
};

export function CommandButton({ children, onClick, variant = 'neutral', size = 'md', disabled, className = '' }: CommandButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center rounded-md font-medium transition-all
        ${size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'}
        ${variantClasses[variant]}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
    >
      {children}
    </button>
  );
}
