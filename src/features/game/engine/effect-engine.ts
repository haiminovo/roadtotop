// ============================================================
// 特效引擎 - 管理所有战斗特效的更新和绘制
// ============================================================

import type { Effect, DamageNumber, ProjectileEffect } from './types';
import type { ClassKey } from '@/lib/game-config';
import { ParticlePool } from './particle-pool';
import { createSlash, updateSlash, drawSlash } from './effects/slash';
import { createProjectile, updateProjectile, drawProjectile } from './effects/projectile';
import { createLightning, updateLightning, drawLightning } from './effects/lightning';
import { updateShieldFlash, drawShieldFlash } from './effects/shield-flash';
import { updateHealAura, drawHealAura } from './effects/heal-aura';
import { createStatusBurst, updateStatusBurst, drawStatusBurst } from './effects/status-burst';
import { createDamageNumber, updateDamageNumber, drawDamageNumber } from './effects/damage-number';

type AttackStyle =
  | { type: 'slash'; color: string }
  | { type: 'projectile'; style: ProjectileEffect['style'] };

type VisualLog = {
  type: string;
  message: string;
  timestamp: number;
  attackerIndex?: number;
  targetIndex?: number;
  actionKind?: 'basic' | 'skill' | 'dot';
  effectKind?: 'slash' | 'projectile' | 'lightning' | 'status_burst';
  effectStyle?: ProjectileEffect['style'];
  effectColor?: string;
  statusType?: string;
};

const CLASS_ATTACK_STYLE: Record<string, AttackStyle> = {
  warrior: { type: 'projectile', style: 'stab' },
  mage: { type: 'projectile', style: 'stab' },
  ranger: { type: 'projectile', style: 'arrow' },
  rogue: { type: 'projectile', style: 'stab' },
  priest: { type: 'projectile', style: 'bolt' },
  farmer: { type: 'projectile', style: 'stab' },
};

export class EffectEngine {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private effects: Effect[] = [];
  private damageNumbers: DamageNumber[] = [];
  private particles = new ParticlePool(300);
  private rafId = 0;
  private running = false;
  private disposed = false;
  private loopToken = 0;
  private damageTimers: ReturnType<typeof setTimeout>[] = [];

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.clear();
  }

  clear() {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    this.ctx.restore();
  }

  reset() {
    cancelAnimationFrame(this.rafId);
    for (const timer of this.damageTimers) clearTimeout(timer);
    this.damageTimers = [];
    this.running = false;
    this.loopToken++;
    this.effects = [];
    this.damageNumbers = [];
    this.particles.clear();
    this.clear();
  }

  enqueueFromLog(
    log: VisualLog,
    classKey: ClassKey,
    getPos: (index: number, towardIndex?: number) => { x: number; y: number } | null,
    getEntityName: (index: number) => string | null,
    playerIdx: number,
    enemyIdxs: number[],
  ) {
    if (this.disposed) return;
    const msg = log.message;

    // 判断攻击方向
    const playerAttacking = msg.startsWith('你对') || msg.match(/^(挥剑|斩击|劈砍|刺击|旋风|致命|蓄力|连续|精准|火球|闪电|毒刃|背刺|治愈|包扎|战吼|盾击)/);
    const enemyAttacking = msg.includes('对你造成') || (msg.includes('使出') && !playerAttacking);

    // 提取目标名字
    const playerTargetMatch = msg.match(/对\s*(\S+)\s*造成/);
    const enemyNameMatch = msg.match(/^(\S+)\s*使出/);

    // 提取伤害数字
    const dmgMatch = msg.match(/(\d+)\s*点伤害/);
    const amount = dmgMatch ? parseInt(dmgMatch[1]) : 0;
    const isCrit = msg.includes('暴击');

    // 通过名字找敌人 index
    function findIdxByName(name: string): number {
      for (const idx of enemyIdxs) {
        if (getEntityName(idx) === name) return idx;
      }
      return -1;
    }

    let sx: number, sy: number, tx: number, ty: number;

    if (log.actionKind === 'dot' || log.effectKind === 'status_burst') {
      const targetIdx = typeof log.targetIndex === 'number' ? log.targetIndex : playerIdx;
      const tp = getPos(targetIdx);
      tx = tp?.x ?? this.width * 0.5;
      ty = tp?.y ?? this.height * 0.5;
      this.effects.push(createStatusBurst(tx, ty, log.effectColor || '#bc8cff'));
      if (amount > 0) {
        this.damageNumbers.push(createDamageNumber(
          tx, ty - 20,
          `-${amount}`,
          log.effectColor || '#bc8cff',
          false,
        ));
      }
      this.startLoop();
      return;
    }

    if (playerAttacking) {
      // 玩家 -> 敌人
      let targetIdx = typeof log.targetIndex === 'number' ? log.targetIndex : -1;
      if (targetIdx < 0 && playerTargetMatch) targetIdx = findIdxByName(playerTargetMatch[1]);
      if (targetIdx < 0) targetIdx = enemyIdxs[0] ?? 0;
      const sp = getPos(playerIdx, targetIdx);
      sx = sp?.x ?? this.width * 0.2;
      sy = sp?.y ?? this.height * 0.5;
      const tp = getPos(targetIdx, playerIdx);
      tx = tp?.x ?? this.width * 0.8;
      ty = tp?.y ?? this.height * 0.5;
    } else if (enemyAttacking) {
      // 敌人 -> 玩家
      let srcIdx = typeof log.attackerIndex === 'number' ? log.attackerIndex : -1;
      if (srcIdx < 0 && enemyNameMatch) srcIdx = findIdxByName(enemyNameMatch[1]);
      if (srcIdx < 0) srcIdx = enemyIdxs[0] ?? 0;
      const tp = getPos(playerIdx, srcIdx);
      tx = tp?.x ?? this.width * 0.2;
      ty = tp?.y ?? this.height * 0.5;
      const sp = getPos(srcIdx, playerIdx);
      sx = sp?.x ?? this.width * 0.8;
      sy = sp?.y ?? this.height * 0.5;
    } else {
      return; // 非攻击日志不生成特效
    }

    // 生成攻击特效
    if (playerAttacking) {
      const style = CLASS_ATTACK_STYLE[classKey] || CLASS_ATTACK_STYLE.warrior;
      this.enqueueAttackEffect(sx, sy, tx, ty, log, style);
    } else {
      this.enqueueAttackEffect(sx, sy, tx, ty, log, { type: 'projectile', style: 'stab' });
    }

    // 伤害数字
    if (amount > 0) {
      const timer = setTimeout(() => {
        this.damageTimers = this.damageTimers.filter(t => t !== timer);
        if (this.disposed) return;
        this.damageNumbers.push(createDamageNumber(
          tx, ty - 20,
          isCrit ? `暴击! -${amount}` : `-${amount}`,
          isCrit ? '#ffa500' : '#f85149',
          isCrit,
        ));
        this.startLoop();
      }, 250);
      this.damageTimers.push(timer);
    }

    this.startLoop();
  }

  private enqueueAttackEffect(sx: number, sy: number, tx: number, ty: number, log: VisualLog, fallback: AttackStyle) {
    if (log.effectKind === 'lightning') {
      this.effects.push(createLightning(sx, sy, tx, ty, log.effectColor));
      return;
    }

    if (log.effectKind === 'slash') {
      this.effects.push(createSlash(sx, sy, tx, ty, log.effectColor || (fallback.type === 'slash' ? fallback.color : '#bc8cff')));
      return;
    }

    if (log.effectKind === 'projectile') {
      this.effects.push(createProjectile(sx, sy, tx, ty, log.effectStyle || (fallback.type === 'projectile' ? fallback.style : 'stab'), log.effectColor));
      return;
    }

    if (fallback.type === 'slash') {
      this.effects.push(createSlash(sx, sy, tx, ty, fallback.color));
    } else {
      this.effects.push(createProjectile(sx, sy, tx, ty, fallback.style, log.effectColor));
    }
  }

  private startLoop() {
    if (this.disposed || this.running) return;
    this.running = true;
    const token = ++this.loopToken;
    const loop = () => {
      if (this.disposed || token !== this.loopToken) return;
      this.tick();
      if (this.effects.length > 0 || this.damageNumbers.length > 0 || this.particles.activeCount > 0) {
        this.rafId = requestAnimationFrame(loop);
      } else {
        this.running = false;
        this.clear();
      }
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private tick() {
    if (this.disposed) return;
    const ctx = this.ctx;
    this.clear();

    this.particles.update(1);

    this.effects = this.effects.filter(effect => {
      switch (effect.type) {
        case 'slash': return updateSlash(effect, this.particles);
        case 'projectile': return updateProjectile(effect, this.particles, () => {});
        case 'lightning': return updateLightning(effect);
        case 'shield_flash': return updateShieldFlash(effect);
        case 'heal_aura': return updateHealAura(effect, this.particles);
        case 'status_burst': return updateStatusBurst(effect);
      }
    });

    this.damageNumbers = this.damageNumbers.filter(dn => updateDamageNumber(dn));

    // 绘制粒子
    this.particles.forEach(p => {
      const size = Math.max(0.5, p.size);
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - size);
      ctx.lineTo(p.x + size, p.y);
      ctx.lineTo(p.x, p.y + size);
      ctx.lineTo(p.x - size, p.y);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });

    // 绘制特效
    for (const effect of this.effects) {
      switch (effect.type) {
        case 'slash': drawSlash(ctx, effect); break;
        case 'projectile': drawProjectile(ctx, effect); break;
        case 'lightning': drawLightning(ctx, effect); break;
        case 'shield_flash': drawShieldFlash(ctx, effect); break;
        case 'heal_aura': drawHealAura(ctx, effect); break;
        case 'status_burst': drawStatusBurst(ctx, effect); break;
      }
    }

    // 绘制伤害数字
    for (const dn of this.damageNumbers) {
      drawDamageNumber(ctx, dn);
    }
  }

  destroy() {
    this.disposed = true;
    this.reset();
  }
}
