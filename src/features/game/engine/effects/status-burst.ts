// ============================================================
// 状态伤害/附着亮起特效
// ============================================================

import type { StatusBurstEffect } from '../types';

export function createStatusBurst(x: number, y: number, color = '#bc8cff'): StatusBurstEffect {
  return {
    type: 'status_burst',
    x, y,
    radius: 8,
    maxRadius: 34,
    age: 0,
    maxAge: 24,
    color,
    done: false,
  };
}

export function updateStatusBurst(s: StatusBurstEffect): boolean {
  if (s.done) return false;
  s.age++;
  s.radius = 8 + (s.maxRadius - 8) * (s.age / s.maxAge);
  if (s.age >= s.maxAge) s.done = true;
  return !s.done;
}

export function drawStatusBurst(ctx: CanvasRenderingContext2D, s: StatusBurstEffect) {
  if (s.done) return;
  const alpha = 1 - s.age / s.maxAge;
  const inner = Math.max(4, s.radius * 0.28);
  const outer = s.radius;
  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = 2;
  ctx.shadowBlur = 14;
  ctx.shadowColor = s.color;

  ctx.beginPath();
  ctx.moveTo(s.x, s.y - outer);
  ctx.lineTo(s.x + outer, s.y);
  ctx.lineTo(s.x, s.y + outer);
  ctx.lineTo(s.x - outer, s.y);
  ctx.closePath();
  ctx.stroke();

  ctx.globalAlpha = Math.max(0, alpha * 0.22);
  ctx.beginPath();
  ctx.moveTo(s.x, s.y - inner);
  ctx.lineTo(s.x + inner, s.y);
  ctx.lineTo(s.x, s.y + inner);
  ctx.lineTo(s.x - inner, s.y);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = Math.max(0, alpha * 0.8);
  ctx.beginPath();
  ctx.moveTo(s.x - outer * 0.8, s.y);
  ctx.lineTo(s.x - inner * 1.3, s.y);
  ctx.moveTo(s.x + inner * 1.3, s.y);
  ctx.lineTo(s.x + outer * 0.8, s.y);
  ctx.moveTo(s.x, s.y - outer * 0.8);
  ctx.lineTo(s.x, s.y - inner * 1.3);
  ctx.moveTo(s.x, s.y + inner * 1.3);
  ctx.lineTo(s.x, s.y + outer * 0.8);
  ctx.stroke();

  ctx.restore();
}
