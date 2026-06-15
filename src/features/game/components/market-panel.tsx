'use client';

import React, { useState } from 'react';
import type { SessionSnapshot } from '../types';
import { SectionCard } from './ui/section-card';
import { CommandButton } from './ui/command-button';
import { RARITY_COLORS, RARITY_NAMES, formatNumber } from '@/lib/game-config';
import { getIcon } from '@/lib/ui/icons';

interface MarketPanelProps {
  snapshot: SessionSnapshot;
  onCreateListing: (backpackId: number, price: number) => void;
  onCancelListing: (listingId: number) => void;
  onBuyListing: (listingId: number) => void;
}

function formatDurability(value: number | string | null | undefined) {
  if (value == null) return '-';
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function MarketPanel({ snapshot, onCreateListing, onCancelListing, onBuyListing }: MarketPanelProps) {
  const [tab, setTab] = useState<'browse' | 'my'>('browse');
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const [price, setPrice] = useState('');

  const sellableItems = snapshot.backpack.filter(b =>
    !b.equipped &&
    b.itemType !== 'skill_book' &&
    (b.itemType !== 'equipment' || b.currentDurability >= b.maxDurability)
  );
  const damagedEquipmentCount = snapshot.backpack.filter(b =>
    !b.equipped &&
    b.itemType === 'equipment' &&
    b.currentDurability < b.maxDurability
  ).length;

  return (
    <div className="space-y-3">
      {/* 标签切换 */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('browse')}
          className={`px-3 py-1 text-sm rounded ${tab === 'browse' ? 'bg-accent-blue text-white' : 'bg-bg-tertiary text-text-secondary'}`}
        >
          市场
        </button>
        <button
          onClick={() => setTab('my')}
          className={`px-3 py-1 text-sm rounded ${tab === 'my' ? 'bg-accent-blue text-white' : 'bg-bg-tertiary text-text-secondary'}`}
        >
          我的 ({snapshot.market.myListings.length})
        </button>
      </div>

      {tab === 'browse' ? (
        <SectionCard title="交易市场">
          <div className="text-xs text-text-muted mb-2">手续费: {snapshot.market.feeRatePercent}%</div>
          {snapshot.market.listings.length === 0 ? (
            <p className="text-text-muted text-sm text-center py-4">暂无商品</p>
          ) : (
            <div className="space-y-1.5">
              {snapshot.market.listings.map(listing => {
                const Icon = getIcon(listing.iconKey) as React.ComponentType<{ size?: number }>;
                return (
                  <div key={listing.listingId} className="flex items-center gap-2 p-2 rounded bg-bg-tertiary border border-border-secondary">
                    <Icon size={20} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium" style={{ color: RARITY_COLORS[listing.itemRarity] }}>
                        {listing.itemName}
                      </span>
                      <span className="text-xs text-text-muted ml-1">[{RARITY_NAMES[listing.itemRarity]}]</span>
                      <div className="text-xs text-text-muted">卖家: {listing.sellerName}</div>
                      {listing.itemType === 'equipment' && listing.maxDurability && (
                        <div className="text-xs text-text-muted">
                          耐久: {formatDurability(listing.currentDurability)}/{formatDurability(listing.maxDurability)}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-accent-orange">{formatNumber(listing.price)} 金</div>
                      {listing.sellerRoleId !== snapshot.role.roleId && (
                        <CommandButton size="sm" variant="primary" onClick={() => onBuyListing(listing.listingId)}>
                          购买
                        </CommandButton>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      ) : (
        <SectionCard title="我的上架">
          {snapshot.market.myListings.length === 0 ? (
            <p className="text-text-muted text-sm text-center py-4">暂无上架物品</p>
          ) : (
            <div className="space-y-1.5">
              {snapshot.market.myListings.map(listing => (
                <div key={listing.listingId} className="flex items-center gap-2 p-2 rounded bg-bg-tertiary">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">{listing.itemName}</div>
                    {listing.itemType === 'equipment' && listing.maxDurability && (
                      <div className="text-xs text-text-muted">
                        耐久: {formatDurability(listing.currentDurability)}/{formatDurability(listing.maxDurability)}
                      </div>
                    )}
                  </div>
                  <span className="text-sm text-accent-orange">{formatNumber(listing.price)} 金</span>
                  <CommandButton size="sm" variant="danger" onClick={() => onCancelListing(listing.listingId)}>
                    下架
                  </CommandButton>
                </div>
              ))}
            </div>
          )}

          {/* 上架物品 */}
          {sellableItems.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border-primary">
              <div className="text-xs text-text-muted mb-2">上架物品</div>
              {damagedEquipmentCount > 0 && (
                <div className="text-xs text-accent-orange mb-2">
                  {damagedEquipmentCount} 件装备未满耐久，修理后才能出售
                </div>
              )}
              <div className="space-y-1">
                {sellableItems.map(item => (
                  <div key={item.backpackId} className="flex items-center gap-2">
                    <span className="text-xs flex-1" style={{ color: RARITY_COLORS[item.rarity] }}>
                      {item.name}
                      {item.quantity > 1 ? ` x${item.quantity}` : ''}
                    </span>
                    <input
                      type="number"
                      placeholder="价格"
                      className="w-20 px-2 py-0.5 text-xs bg-bg-tertiary border border-border-primary rounded"
                      value={selectedItem === item.backpackId ? price : ''}
                      onChange={(e) => { setSelectedItem(item.backpackId); setPrice(e.target.value); }}
                    />
                    <CommandButton
                      size="sm"
                      variant="success"
                      onClick={() => {
                        if (selectedItem === item.backpackId && price) {
                          onCreateListing(item.backpackId, parseInt(price));
                          setPrice('');
                          setSelectedItem(null);
                        }
                      }}
                    >
                      上架
                    </CommandButton>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}
