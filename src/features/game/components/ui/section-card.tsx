'use client';

import React from 'react';

interface SectionCardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

export function SectionCard({ title, children, className = '', action }: SectionCardProps) {
  return (
    <div className={`bg-bg-secondary border border-border-primary rounded-lg ${className}`}>
      {title && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-border-primary">
          <h3 className="text-sm font-medium text-text-primary">{title}</h3>
          {action}
        </div>
      )}
      <div className="p-3">{children}</div>
    </div>
  );
}
