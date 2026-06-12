// ============================================================
// 斩击特效 - 弧形刀光
// ============================================================

import type { SlashEffect } from '../types';
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
  void particles;
  const angle = s.startAngle + (s.endAngle - s.startAngle) * s.progress;
  const x = s.cx + Math.cos(angle) * s.radius;
  const y = s.cy + Math.sin(angle) * s.radius;
  s.trail.push({ x, y, alpha: 1 });
  for (const pt of s.trail) pt.alpha -= 0.07;
  s.trail = s.trail.filter(pt => pt.alpha > 0);
  if (s.progress >= 1 && s.trail.length === 0) s.done = true;
  return !s.done;
}

export function drawSlash(ctx: CanvasRenderingContext2D, s: SlashEffect) {
  if (s.trail.length < 2) return;
  ctx.save();
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  for (let i = 1; i < s.trail.length; i++) {
    const prev = s.trail[i - 1];
    const curr = s.trail[i];
    const t = i / s.trail.length;
    ctx.beginPath();
    ctx.strokeStyle = `rgba(255,255,255,${curr.alpha * 0.9})`;
    ctx.lineWidth = t * 7 + 1;
    ctx.shadowBlur = 6 * curr.alpha;
    ctx.shadowColor = s.color;
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(curr.x, curr.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = s.color;
    ctx.globalAlpha = curr.alpha * 0.55;
    ctx.lineWidth = Math.max(1, t * 3);
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(curr.x, curr.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
