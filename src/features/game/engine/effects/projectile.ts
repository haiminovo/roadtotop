// ============================================================
// 飞弹特效 - 箭矢、刺击、能量短矛
// ============================================================

import type { ProjectileEffect } from '../types';
import type { ParticlePool } from '../particle-pool';

function easeOutQuad(t: number) { return t * (2 - t); }

function getArcHeight(proj: ProjectileEffect) {
  const dx = proj.tx - proj.sx;
  const dy = proj.ty - proj.sy;
  const distance = Math.hypot(dx, dy);
  return Math.min(72, Math.max(28, distance * 0.22));
}

function getProjectilePoint(proj: ProjectileEffect, progress: number) {
  const t = easeOutQuad(progress);
  const arc = Math.sin(Math.PI * progress) * getArcHeight(proj);
  return {
    x: proj.sx + (proj.tx - proj.sx) * t,
    y: proj.sy + (proj.ty - proj.sy) * t - arc,
  };
}

function getProjectileAngle(proj: ProjectileEffect) {
  const nextProgress = Math.min(1, proj.progress + 0.02);
  const from = getProjectilePoint(proj, proj.progress);
  const to = getProjectilePoint(proj, nextProgress);
  return Math.atan2(to.y - from.y, to.x - from.x);
}

export function createProjectile(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  style: ProjectileEffect['style'],
  color?: string,
): ProjectileEffect {
  return { type: 'projectile', sx, sy, tx, ty, progress: 0, speed: 0.026, style, color, hitFired: false, done: false };
}

export function updateProjectile(proj: ProjectileEffect, particles: ParticlePool, onHit: () => void): boolean {
  if (proj.done) return false;
  proj.progress = Math.min(1, proj.progress + proj.speed);
  void particles;

  if (proj.progress >= 1 && !proj.hitFired) {
    proj.hitFired = true;
    onHit();
    proj.done = true;
  }
  return !proj.done;
}

function drawStabProjectile(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, color = '#bc8cff') {
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowBlur = 8;
  ctx.shadowColor = color;
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.lineTo(10, 0);
  ctx.stroke();
}

function drawBoltProjectile(ctx: CanvasRenderingContext2D, proj: ProjectileEffect, x: number, y: number, angle: number) {
  const color = proj.color || '#56d364';
  const trail = getProjectilePoint(proj, Math.max(0, proj.progress - 0.08));

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'butt';
  ctx.shadowBlur = 10;
  ctx.shadowColor = color;
  ctx.beginPath();
  ctx.moveTo(trail.x, trail.y);
  ctx.lineTo(x, y);
  ctx.stroke();

  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(9, 0);
  ctx.lineTo(0, -4);
  ctx.lineTo(-8, 0);
  ctx.lineTo(0, 4);
  ctx.closePath();
  ctx.fill();
}

export function drawProjectile(ctx: CanvasRenderingContext2D, proj: ProjectileEffect) {
  if (proj.done) return;
  const { x, y } = getProjectilePoint(proj, proj.progress);
  const angle = getProjectileAngle(proj);

  ctx.save();
  if (proj.style === 'arrow') {
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = '#cccccc';
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-4, -3);
    ctx.lineTo(-4, 3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#8b6914';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(-12, 0);
    ctx.stroke();
  } else if (proj.style === 'bolt') {
    drawBoltProjectile(ctx, proj, x, y, angle);
  } else if (proj.style === 'stab') {
    drawStabProjectile(ctx, x, y, angle, proj.color);
  }
  ctx.restore();
}
