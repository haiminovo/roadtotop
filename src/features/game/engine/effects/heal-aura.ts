// ============================================================
// 治疗光环特效
// ============================================================

import type { HealAuraEffect } from '../types';
import type { ParticlePool } from '../particle-pool';

export function createHealAura(x: number, y: number): HealAuraEffect {
  return { type: 'heal_aura', x, y, age: 0, maxAge: 30, done: false };
}

export function updateHealAura(h: HealAuraEffect, particles: ParticlePool): boolean {
  if (h.done) return false;
  h.age++;
  // 上升粒子
  if (h.age % 2 === 0) {
    const p = particles.acquire();
    if (p) {
      p.x = h.x + (Math.random() - 0.5) * 30;
      p.y = h.y + Math.random() * 10;
      p.vx = (Math.random() - 0.5) * 0.5;
      p.vy = -1 - Math.random() * 1.5;
      p.life = 20 + Math.random() * 10; p.maxLife = p.life;
      p.size = 3 + Math.random() * 3;
      p.color = Math.random() < 0.5 ? '#3fb950' : '#56d364';
      p.gravity = -0.01; p.drag = 0.98; p.shrink = 0.96;
    }
  }
  if (h.age >= h.maxAge) h.done = true;
  return !h.done;
}

export function drawHealAura(ctx: CanvasRenderingContext2D, h: HealAuraEffect) {
  if (h.done) return;
  const progress = h.age / h.maxAge;
  const alpha = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
  ctx.save();
  ctx.globalAlpha = alpha * 0.3;
  ctx.fillStyle = '#3fb950';
  ctx.shadowBlur = 20;
  ctx.shadowColor = '#3fb950';
  ctx.beginPath();
  ctx.arc(h.x, h.y, 25, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
