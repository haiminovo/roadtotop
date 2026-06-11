'use client';

import React, { useRef, useEffect } from 'react';
import type { BattleSnapshot } from '../types';
import type { ClassKey } from '@/lib/game-config';
import { EffectEngine } from '../engine/effect-engine';

interface BattleCanvasProps {
  battle: BattleSnapshot;
  classKey: ClassKey;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function BattleCanvas({ battle, classKey, containerRef }: BattleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<EffectEngine | null>(null);
  const lastLogCountRef = useRef(0);
  const lastBattleKeyRef = useRef('');

  // 初始化引擎
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = container.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);

    engineRef.current = new EffectEngine(ctx, w, h);

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const d = window.devicePixelRatio || 1;
        canvas.width = width * d;
        canvas.height = height * d;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(d, d);
        engineRef.current?.resize(width, height);
      }
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      engineRef.current?.destroy();
    };
  }, [containerRef]);

  // 处理战斗日志 -> 特效
  useEffect(() => {
    const engine = engineRef.current;
    const container = containerRef.current;
    if (!engine || !battle?.logs?.length || !container) return;

    // 检测是否是新战斗
    const battleKey = `${battle.totalEnemies}_${battle.result}`;
    if (battleKey !== lastBattleKeyRef.current) {
      lastLogCountRef.current = 0;
      lastBattleKeyRef.current = battleKey;
    }

    const newLogs = battle.logs.slice(lastLogCountRef.current);
    lastLogCountRef.current = battle.logs.length;
    if (newLogs.length === 0) return;

    // 获取实体卡片中心位置（相对于容器）
    const getPos = (index: number): { x: number; y: number } | null => {
      const el = container.querySelector(`[data-entity-index="${index}"]`);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const cRect = container.getBoundingClientRect();
      return {
        x: rect.left - cRect.left + rect.width / 2,
        y: rect.top - cRect.top + rect.height / 2,
      };
    };

    const enemyIdxs = battle.enemies.map((_, i) => i);

    for (const log of newLogs) {
      engine.enqueueFromLog(log, classKey, getPos, -1, enemyIdxs);
    }
  }, [battle, classKey, containerRef]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 10 }}
    />
  );
}
