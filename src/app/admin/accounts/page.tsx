'use client';

import React, { useEffect, useState } from 'react';

interface Account {
  user_id: number;
  username: string;
  account_type: string;
  is_admin: boolean;
  role_id: number;
  role_name: string;
  level: number;
  gold: number;
  aether_crystal: number;
}

export default function AccountsAdmin() {
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => { loadAccounts(); }, []);

  async function loadAccounts() {
    const res = await fetch('/api/admin/config?action=accounts');
    const data = await res.json();
    setAccounts(data.accounts || []);
  }

  async function toggleAdmin(userId: number, isAdmin: boolean) {
    await fetch('/api/admin/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_admin', userId, isAdmin: !isAdmin }),
    });
    loadAccounts();
  }

  async function deleteAccount(userId: number) {
    if (!confirm('确定删除该账号？此操作不可撤销。')) return;
    await fetch('/api/admin/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', userId }),
    });
    loadAccounts();
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">账号管理</h2>
      <div className="bg-bg-secondary border border-border-primary rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-primary text-text-muted">
              <th className="px-3 py-2 text-left">ID</th>
              <th className="px-3 py-2 text-left">用户名</th>
              <th className="px-3 py-2 text-left">类型</th>
              <th className="px-3 py-2 text-left">角色</th>
              <th className="px-3 py-2 text-left">等级</th>
              <th className="px-3 py-2 text-left">金币</th>
              <th className="px-3 py-2 text-left">水晶</th>
              <th className="px-3 py-2 text-left">管理员</th>
              <th className="px-3 py-2 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map(acc => (
              <tr key={acc.user_id} className="border-b border-border-secondary hover:bg-bg-hover">
                <td className="px-3 py-2 text-text-muted">{acc.user_id}</td>
                <td className="px-3 py-2">{acc.username || '(游客)'}</td>
                <td className="px-3 py-2 text-text-secondary">{acc.account_type}</td>
                <td className="px-3 py-2">{acc.role_name || '-'}</td>
                <td className="px-3 py-2">{acc.level || '-'}</td>
                <td className="px-3 py-2 text-accent-orange">{acc.gold?.toLocaleString() ?? 0}</td>
                <td className="px-3 py-2 text-accent-purple">{acc.aether_crystal?.toLocaleString() ?? 0}</td>
                <td className="px-3 py-2">
                  <span className={acc.is_admin ? 'text-accent-green' : 'text-text-muted'}>
                    {acc.is_admin ? '是' : '否'}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => toggleAdmin(acc.user_id, acc.is_admin)} className="text-accent-blue text-xs mr-2">
                    {acc.is_admin ? '取消管理员' : '设为管理员'}
                  </button>
                  <button onClick={() => deleteAccount(acc.user_id)} className="text-accent-red text-xs">删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
