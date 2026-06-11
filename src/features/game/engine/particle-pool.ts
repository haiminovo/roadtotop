// ============================================================
// 粒子对象池 - 避免 GC 压力
// ============================================================

import type { Particle } from './types';

export class ParticlePool {
  private pool: Particle[];
  activeCount = 0;

  constructor(size: number) {
    this.pool = Array.from({ length: size }, () => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0,
      life: 0, maxLife: 0, size: 0, color: '#fff',
      alpha: 1, gravity: 0, drag: 1, shrink: 1,
    }));
  }

  acquire(): Particle | null {
    for (const p of this.pool) {
      if (!p.active) { p.active = true; this.activeCount++; return p; }
    }
    return null;
  }

  release(p: Particle) { p.active = false; this.activeCount--; }

  forEach(fn: (p: Particle) => void) {
    for (const p of this.pool) { if (p.active) fn(p); }
  }

  update(dt: number) {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
      p.size *= p.shrink;
      if (p.life <= 0 || p.alpha <= 0.01) {
        this.release(p);
      }
    }
  }
}
