// ============================================================
// 飞弹特效 - 火球、箭矢、治疗弹
// ============================================================

import type { ProjectileEffect } from '../types';
import type { ParticlePool } from '../particle-pool';

function easeOutQuad(t: number) { return t * (2 - t); }

export function createProjectile(sx: number, sy: number, tx: number, ty: number, style: ProjectileEffect['style']): ProjectileEffect {
  return { type: 'projectile', sx, sy, tx, ty, progress: 0, speed: 0.03, style, hitFired: false, done: false };
}

export function updateProjectile(proj: ProjectileEffect, particles: ParticlePool, onHit: () => void): boolean {
  if (proj.done) return false;
  proj.progress = Math.min(1, proj.progress + proj.speed);
  const t = easeOutQuad(proj.progress);
  const x = proj.sx + (proj.tx - proj.sx) * t;
  const y = proj.sy + (proj.ty - proj.sy) * t;

  // 拖尾粒子
  if (proj.style === 'fireball') {
    for (let i = 0; i < 3; i++) {
      const p = particles.acquire();
      if (p) {
        p.x = x + (Math.random() - 0.5) * 8;
        p.y = y + (Math.random() - 0.5) * 8;
        p.vx = (Math.random() - 0.5) * 1.5;
        p.vy = (Math.random() - 0.5) * 1.5 - 0.5;
        p.life = 12 + Math.random() * 8; p.maxLife = p.life;
        p.size = 3 + Math.random() * 4;
        p.color = Math.random() < 0.5 ? '#ff6600' : '#ffaa00';
        p.gravity = -0.03; p.drag = 0.96; p.shrink = 0.94;
      }
    }
  } else if (proj.style === 'heal_bolt') {
    for (let i = 0; i < 2; i++) {
      const p = particles.acquire();
      if (p) {
        p.x = x + (Math.random() - 0.5) * 6;
        p.y = y + (Math.random() - 0.5) * 6;
        p.vx = (Math.random() - 0.5) * 1;
        p.vy = (Math.random() - 0.5) * 1;
        p.life = 10 + Math.random() * 6; p.maxLife = p.life;
        p.size = 2 + Math.random() * 3;
        p.color = Math.random() < 0.5 ? '#3fb950' : '#56d364';
        p.gravity = 0; p.drag = 0.97; p.shrink = 0.95;
      }
    }
  }

  if (proj.progress >= 1 && !proj.hitFired) {
    proj.hitFired = true;
    onHit();
    // 命中爆裂粒子
    for (let i = 0; i < 8; i++) {
      const p = particles.acquire();
      if (p) {
        p.x = proj.tx; p.y = proj.ty;
        p.vx = (Math.random() - 0.5) * 4;
        p.vy = (Math.random() - 0.5) * 4;
        p.life = 15 + Math.random() * 10; p.maxLife = p.life;
        p.size = 3 + Math.random() * 4;
        p.color = proj.style === 'fireball' ? '#ff6600' : proj.style === 'heal_bolt' ? '#3fb950' : '#cccccc';
        p.gravity = 0.05; p.drag = 0.95; p.shrink = 0.93;
      }
    }
    setTimeout(() => { proj.done = true; }, 200);
  }
  return !proj.done;
}

export function drawProjectile(ctx: CanvasRenderingContext2D, proj: ProjectileEffect) {
  if (proj.done) return;
  const t = easeOutQuad(proj.progress);
  const x = proj.sx + (proj.tx - proj.sx) * t;
  const y = proj.sy + (proj.ty - proj.sy) * t;
  const angle = Math.atan2(proj.ty - proj.sy, proj.tx - proj.sx);

  ctx.save();
  if (proj.style === 'fireball') {
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ff6600';
    ctx.fillStyle = '#ffaa00';
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (proj.style === 'arrow') {
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
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#3fb950';
    ctx.fillStyle = '#56d364';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (proj.style === 'stab') {
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
  ctx.restore();
}
