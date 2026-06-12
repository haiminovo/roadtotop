// ============================================================
// 飞弹特效 - 火球、箭矢、治疗弹
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

export function createProjectile(sx: number, sy: number, tx: number, ty: number, style: ProjectileEffect['style']): ProjectileEffect {
  return { type: 'projectile', sx, sy, tx, ty, progress: 0, speed: 0.026, style, hitFired: false, done: false };
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

function drawGlowTrail(ctx: CanvasRenderingContext2D, proj: ProjectileEffect, color: string) {
  const trailLength = 5;
  for (let i = trailLength; i >= 1; i--) {
    const progress = Math.max(0, proj.progress - i * 0.025);
    const { x, y } = getProjectilePoint(proj, progress);
    const alpha = (1 - i / (trailLength + 1)) * 0.45;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1.5, 5 - i * 0.7), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawStabProjectile(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number) {
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.strokeStyle = '#bc8cff';
  ctx.lineWidth = 2;
  ctx.shadowBlur = 8;
  ctx.shadowColor = '#bc8cff';
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.lineTo(10, 0);
  ctx.stroke();
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
  } else if (proj.style === 'heal_bolt') {
    drawGlowTrail(ctx, proj, '#56d364');
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#3fb950';
    ctx.fillStyle = '#56d364';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (proj.style === 'stab') {
    drawStabProjectile(ctx, x, y, angle);
  }
  ctx.restore();
}
