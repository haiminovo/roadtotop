'use client';

import React, { useEffect, useState } from 'react';

interface Item {
  itemId: number;
  name: string;
  rarity: string;
  itemType: string;
  slot?: string;
  sellPrice: number;
  levelRequirement: number;
  description: string;
  statJson: Record<string, number>;
}

const RARITIES = ['white', 'green', 'blue', 'purple', 'orange'];
const ITEM_TYPES = ['equipment', 'skill_book', 'material'];
const SLOTS = ['head', 'hand', 'torso', 'legs', 'feet', 'neck', 'accessory'];

export default function ItemsAdmin() {
  const [items, setItems] = useState<Item[]>([]);
  const [editing, setEditing] = useState<Item | null>(null);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => { loadItems(); }, []);

  async function loadItems() {
    const res = await fetch('/api/admin/config?action=items');
    const data = await res.json();
    setItems(data.items || []);
  }

  async function saveItem(item: Partial<Item>) {
    await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_item', item }),
    });
    loadItems();
    setEditing(null);
    setShowNew(false);
  }

  async function deleteItem(itemId: number) {
    if (!confirm('确定删除？')) return;
    await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_item', itemId }),
    });
    loadItems();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">物品管理</h2>
        <button
          onClick={() => setShowNew(true)}
          className="px-3 py-1.5 bg-accent-blue text-white rounded text-sm"
        >
          新增物品
        </button>
      </div>

      {/* 物品列表 */}
      <div className="bg-bg-secondary border border-border-primary rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-primary text-text-muted">
              <th className="px-3 py-2 text-left">ID</th>
              <th className="px-3 py-2 text-left">名称</th>
              <th className="px-3 py-2 text-left">稀有度</th>
              <th className="px-3 py-2 text-left">类型</th>
              <th className="px-3 py-2 text-left">槽位</th>
              <th className="px-3 py-2 text-left">售价</th>
              <th className="px-3 py-2 text-left">等级要求</th>
              <th className="px-3 py-2 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.itemId} className="border-b border-border-secondary hover:bg-bg-hover">
                <td className="px-3 py-2 text-text-muted">{item.itemId}</td>
                <td className="px-3 py-2 font-medium">{item.name}</td>
                <td className="px-3 py-2">
                  <span className={`text-rarity-${item.rarity}`}>{item.rarity}</span>
                </td>
                <td className="px-3 py-2 text-text-secondary">{item.itemType}</td>
                <td className="px-3 py-2 text-text-secondary">{item.slot || '-'}</td>
                <td className="px-3 py-2 text-accent-orange">{item.sellPrice}</td>
                <td className="px-3 py-2 text-text-secondary">{item.levelRequirement}</td>
                <td className="px-3 py-2">
                  <button onClick={() => setEditing(item)} className="text-accent-blue text-xs mr-2">编辑</button>
                  <button onClick={() => deleteItem(item.itemId)} className="text-accent-red text-xs">删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 编辑弹窗 */}
      {(editing || showNew) && (
        <ItemEditor
          item={editing}
          onSave={saveItem}
          onClose={() => { setEditing(null); setShowNew(false); }}
        />
      )}
    </div>
  );
}

function ItemEditor({ item, onSave, onClose }: { item: Item | null; onSave: (item: Partial<Item>) => void; onClose: () => void }) {
  const [form, setForm] = useState({
    itemId: item?.itemId || 0,
    name: item?.name || '',
    rarity: item?.rarity || 'white',
    itemType: item?.itemType || 'equipment',
    slot: item?.slot || '',
    sellPrice: item?.sellPrice || 0,
    levelRequirement: item?.levelRequirement || 1,
    description: item?.description || '',
    statJsonStr: JSON.stringify(item?.statJson || {}, null, 2),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-secondary border border-border-primary rounded-lg p-4 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
        <h3 className="text-lg font-bold mb-4">{item ? '编辑物品' : '新增物品'}</h3>
        <div className="space-y-3">
          <Field label="名称" value={form.name} onChange={v => setForm({ ...form, name: v })} />
          <SelectField label="稀有度" value={form.rarity} options={RARITIES} onChange={v => setForm({ ...form, rarity: v })} />
          <SelectField label="类型" value={form.itemType} options={ITEM_TYPES} onChange={v => setForm({ ...form, itemType: v })} />
          {form.itemType === 'equipment' && (
            <SelectField label="槽位" value={form.slot} options={['', ...SLOTS]} onChange={v => setForm({ ...form, slot: v })} />
          )}
          <Field label="售价" type="number" value={String(form.sellPrice)} onChange={v => setForm({ ...form, sellPrice: Number(v) })} />
          <Field label="等级要求" type="number" value={String(form.levelRequirement)} onChange={v => setForm({ ...form, levelRequirement: Number(v) })} />
          <Field label="描述" value={form.description} onChange={v => setForm({ ...form, description: v })} />
          <div>
            <label className="text-xs text-text-muted block mb-1">属性 JSON</label>
            <textarea
              value={form.statJsonStr}
              onChange={e => setForm({ ...form, statJsonStr: e.target.value })}
              className="w-full px-2 py-1 text-xs bg-bg-tertiary border border-border-primary rounded font-mono h-20"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-1.5 bg-bg-tertiary text-text-secondary rounded text-sm">取消</button>
          <button
            onClick={() => {
              try {
                const statJson = JSON.parse(form.statJsonStr);
                onSave({ ...form, statJson });
              } catch { alert('JSON 格式错误'); }
            }}
            className="flex-1 py-1.5 bg-accent-blue text-white rounded text-sm"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs text-text-muted block mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-2 py-1 text-sm bg-bg-tertiary border border-border-primary rounded text-text-primary"
      />
    </div>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-text-muted block mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-2 py-1 text-sm bg-bg-tertiary border border-border-primary rounded text-text-primary"
      >
        {options.map(o => <option key={o} value={o}>{o || '无'}</option>)}
      </select>
    </div>
  );
}
