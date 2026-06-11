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

  // 初始化引擎
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const container = containerRef.current;
    if (container) {
      canvas.width = container.clientWidth * dpr;
      canvas.height = container.clientHeight * dpr;
      canvas.style.width = container.clientWidth + 'px';
      canvas.style.height = container.clientHeight + 'px';
      ctx.scale(dpr, dpr);
    }

    engineRef.current = new EffectEngine(ctx, container?.clientWidth || 400, container?.clientHeight || 200);

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        engineRef.current?.resize(width, height);
      }
    });
    if (container) observer.observe(container);

    return () => {
      observer.disconnect();
      engineRef.current?.destroy();
    };
  }, [containerRef]);

  // 处理战斗日志 -> 特效
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !battle?.logs?.length) return;

    const newLogs = battle.logs.slice(lastLogCountRef.current);
    lastLogCountRef.current = battle.logs.length;

    // 获取实体位置（从 DOM data 属性）
    const getPosition = (index: number): { x: number; y: number } | null => {
      const container = containerRef.current;
      if (!container) return null;
      const el = container.querySelector(`[data-entity-index="${index}"]`);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      return {
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top + rect.height / 2,
      };
    };

    const enemyIndices = battle.enemies.map((_, i) => i);

    for (const log of newLogs) {
      engine.enqueueFromLog(log, classKey, getPosition, -1, enemyIndices);
    }
  }, [battle, classKey, containerRef]);

  // 战斗结束时重置日志计数
  useEffect(() => {
    if (!battle || battle.result !== 'ongoing') {
      lastLogCountRef.current = 0;
    }
  }, [battle?.result]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 10 }}
    />
  );
}
