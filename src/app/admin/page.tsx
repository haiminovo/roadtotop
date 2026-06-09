'use client';

import React, { useEffect, useState } from 'react';

interface DashboardStats {
  totalUsers: number;
  totalRoles: number;
  totalItems: number;
  activeAfk: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    fetch('/api/admin/config?action=stats')
      .then(r => r.json())
      .then(setStats)
      .catch(console.error);
  }, []);

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">仪表盘</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="总用户" value={stats?.totalUsers ?? '-'} color="var(--accent-blue)" />
        <StatCard label="总角色" value={stats?.totalRoles ?? '-'} color="var(--accent-green)" />
        <StatCard label="物品数" value={stats?.totalItems ?? '-'} color="var(--accent-orange)" />
        <StatCard label="挂机中" value={stats?.activeAfk ?? '-'} color="var(--accent-purple)" />
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-bg-secondary border border-border-primary rounded-lg p-4">
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      <div className="text-sm text-text-muted mt-1">{label}</div>
    </div>
  );
}
