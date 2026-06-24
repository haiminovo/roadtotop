'use client';

// ============================================================
// 无尽模式面板 - 完全独立的横向卷轴战斗
// ============================================================

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { SideScrollerEngine } from '../engine/side-scroller-engine';

interface EndlessModePanelProps {
  heroName: string;
  classKey: string;
}

export function EndlessModePanel({ heroName, classKey }: EndlessModePanelProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<SideScrollerEngine | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [stats, setStats] = useState({ wave: 1, kills: 0, gold: 0, exp: 0 });

  // 初始化引擎
  const initEngine = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const width = rect.width || 800;
    const height = rect.height || 500;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.scale(dpr, dpr);

    const engine = new SideScrollerEngine(ctx, width, height);
    engine.init(heroName, classKey);

    engine.onWaveComplete = (wave: number, kills: number) => {
      setStats(s => ({ ...s, wave, kills }));
    };

    engine.onGameOver = (kills: number) => {
      setStats(s => ({ ...s, kills }));
    };

    engine.onReward = (gold: number, exp: number) => {
      setStats(s => ({ ...s, gold: s.gold + gold, exp: s.exp + exp }));
    };

    engineRef.current = engine;
    engine.start();
  }, [heroName, classKey]);

  const cleanupEngine = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.dispose();
      engineRef.current = null;
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => initEngine(), 50);
    return () => {
      clearTimeout(timer);
      cleanupEngine();
    };
  }, [initEngine, cleanupEngine]);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;

    const observer = new ResizeObserver(entries => {
      if (!engineRef.current) return;

      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);

        engineRef.current.resize(width, height);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const togglePause = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.togglePause();
    setIsPaused(p => !p);
  }, []);

  const restart = useCallback(() => {
    cleanupEngine();
    setStats({ wave: 1, kills: 0, gold: 0, exp: 0 });
    setIsPaused(false);
    setTimeout(() => initEngine(), 50);
  }, [cleanupEngine, initEngine]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-[#30363d]">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#8b949e]">等级</span>
            <span className="text-sm font-bold text-[#ffd700]">{stats.wave}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#8b949e]">击杀</span>
            <span className="text-sm font-bold text-[#e74c3c]">{stats.kills}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#8b949e]">金币</span>
            <span className="text-sm font-bold text-[#f39c12]">{stats.gold}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#8b949e]">经验</span>
            <span className="text-sm font-bold text-[#3498db]">{stats.exp}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={togglePause}
            className="px-3 py-1 text-xs rounded bg-[#21262d] text-[#c9d1d9] hover:bg-[#30363d] transition-colors"
          >
            {isPaused ? '▶ 继续' : '⏸ 暂停'}
          </button>
          <button
            onClick={restart}
            className="px-3 py-1 text-xs rounded bg-[#e74c3c] text-white hover:bg-[#c0392b] transition-colors"
          >
            🔄 重新开始
          </button>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 relative bg-[#0a0a0f] overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0" style={{ display: 'block' }} />
        {isPaused && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="text-center">
              <div className="text-4xl font-bold text-white mb-2">暂停</div>
              <div className="text-sm text-gray-300">点击「继续」按钮恢复游戏</div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
