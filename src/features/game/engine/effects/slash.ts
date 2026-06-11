// ============================================================
// 斩击特效 - 弧形刀光
// ============================================================

import type { SlashEffect, Particle } from '../types';
import type { ParticlePool } from '../particle-pool';

export function createSlash(sx: number, sy: number, tx: number, ty: number, color = '#ffffff'): SlashEffect {
  const angle = Math.atan2(ty - sy, tx - sx);
  return {
    type: 'slash', cx: sx, cy: sy, tx, ty,
    radius: 50, startAngle: angle - 0.8, endAngle: angle + 0.8,
    progress: 0, speed: 0.08, trail: [], color, done: false,
  };
}

export function updateSlash(s: SlashEffect, particles: ParticlePool): boolean {
  if (s.done) return false;
  s.progress = Math.min(1, s.progress + s.speed);
  const angle = s.startAngle + (s.endAngle - s.startAngle) * s.progress;
  const x = s.cx + Math.cos(angle) * s.radius;
  const y = s.cy + Math.sin(angle) * s.radius;
  s.trail.push({ x, y, alpha: 1 });
  for (const pt of s.trail) pt.alpha -= 0.07;
  s.trail = s.trail.filter(pt => pt.alpha > 0);
  // 刀光粒子
  if (Math.random() < 0.5) {
    const p = particles.acquire();
    if (p) {
      p.x = x + (Math.random() - 0.5) * 8;
      p.y = y + (Math.random() - 0.5) * 8;
      p.vx = (Math.random() - 0.5) * 2;
      p.vy = (Math.random() - 0.5) * 2;
      p.life = 10 + Math.random() * 8;
      p.maxLife = p.life;
      p.size = 2 + Math.random() * 3;
      p.color = s.color;
      p.gravity = 0; p.drag = 0.95; p.shrink = 0.93;
    }
  }
  if (s.progress >= 1 && s.trail.length === 0) s.done = true;
  return !s.done;
}

export function drawSlash(ctx: CanvasRenderingContext2D, s: SlashEffect) {
  if (s.trail.length < 2) return;
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 1; i < s.trail.length; i++) {
    const prev = s.trail[i - 1];
    const curr = s.trail[i];
    const t = i / s.trail.length;
    ctx.beginPath();
    ctx.strokeStyle = `rgba(255,255,255,${curr.alpha * 0.9})`;
    ctx.lineWidth = t * 10 + 2;
    ctx.shadowBlur = 12 * curr.alpha;
    ctx.shadowColor = s.color;
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(curr.x, curr.y);
    ctx.stroke();
  }
  ctx.restore();
}
