// ============================================================
// 特效引擎 - 管理所有战斗特效的更新和绘制
// ============================================================

import type { Effect, DamageNumber } from './types';
import type { ClassKey } from '@/lib/game-config';
import { ParticlePool } from './particle-pool';
import { createSlash, updateSlash, drawSlash } from './effects/slash';
import { createProjectile, updateProjectile, drawProjectile } from './effects/projectile';
import { createLightning, updateLightning, drawLightning } from './effects/lightning';
import { createShieldFlash, updateShieldFlash, drawShieldFlash } from './effects/shield-flash';
import { createHealAura, updateHealAura, drawHealAura } from './effects/heal-aura';
import { createDamageNumber, updateDamageNumber, drawDamageNumber } from './effects/damage-number';

const CLASS_ATTACK_STYLE: Record<string, { type: string; style?: string; color?: string }> = {
  warrior: { type: 'slash', color: '#ffffff' },
  mage: { type: 'projectile', style: 'fireball' },
  ranger: { type: 'projectile', style: 'arrow' },
  rogue: { type: 'projectile', style: 'stab' },
  priest: { type: 'projectile', style: 'heal_bolt' },
  farmer: { type: 'slash', color: '#8b6914' },
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

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  enqueueFromLog(
    log: { type: string; message: string; timestamp: number },
    classKey: ClassKey,
    getPos: (index: number) => { x: number; y: number } | null,
    playerIdx: number,
    enemyIdxs: number[],
  ) {
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
        const el = document.querySelector(`[data-entity-index="${idx}"] [data-entity-name]`);
        if (el?.textContent === name) return idx;
      }
      return -1;
    }

    let sx: number, sy: number, tx: number, ty: number;

    if (playerAttacking) {
      // 玩家 -> 敌人
      const sp = getPos(playerIdx);
      sx = sp?.x ?? this.width * 0.2;
      sy = sp?.y ?? this.height * 0.5;
      let targetIdx = -1;
      if (playerTargetMatch) targetIdx = findIdxByName(playerTargetMatch[1]);
      if (targetIdx < 0) targetIdx = enemyIdxs[0] ?? 0;
      const tp = getPos(targetIdx);
      tx = tp?.x ?? this.width * 0.8;
      ty = tp?.y ?? this.height * 0.5;
    } else if (enemyAttacking) {
      // 敌人 -> 玩家
      const tp = getPos(playerIdx);
      tx = tp?.x ?? this.width * 0.2;
      ty = tp?.y ?? this.height * 0.5;
      let srcIdx = -1;
      if (enemyNameMatch) srcIdx = findIdxByName(enemyNameMatch[1]);
      if (srcIdx < 0) srcIdx = enemyIdxs[0] ?? 0;
      const sp = getPos(srcIdx);
      sx = sp?.x ?? this.width * 0.8;
      sy = sp?.y ?? this.height * 0.5;
    } else {
      return; // 非攻击日志不生成特效
    }

    // 生成攻击特效
    if (playerAttacking) {
      const style = CLASS_ATTACK_STYLE[classKey] || CLASS_ATTACK_STYLE.warrior;
      if (style.type === 'slash') {
        this.effects.push(createSlash(sx, sy, tx, ty, style.color));
      } else {
        this.effects.push(createProjectile(sx, sy, tx, ty, (style.style || 'arrow') as any));
      }
    } else {
      this.effects.push(createSlash(sx, sy, tx, ty, '#f85149'));
    }

    // 伤害数字
    if (amount > 0) {
      setTimeout(() => {
        this.damageNumbers.push(createDamageNumber(
          tx, ty - 20,
          isCrit ? `暴击! -${amount}` : `-${amount}`,
          isCrit ? '#ffa500' : '#f85149',
          isCrit,
        ));
      }, 250);
    }

    this.startLoop();
  }

  private startLoop() {
    if (this.running) return;
    this.running = true;
    const loop = () => {
      this.tick();
      if (this.effects.length > 0 || this.damageNumbers.length > 0 || this.particles.activeCount > 0) {
        this.rafId = requestAnimationFrame(loop);
      } else {
        this.running = false;
        this.ctx.clearRect(0, 0, this.width, this.height);
      }
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private tick() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    this.particles.update(1);

    this.effects = this.effects.filter(effect => {
      switch (effect.type) {
        case 'slash': return updateSlash(effect, this.particles);
        case 'projectile': return updateProjectile(effect, this.particles, () => {});
        case 'lightning': return updateLightning(effect);
        case 'shield_flash': return updateShieldFlash(effect);
        case 'heal_aura': return updateHealAura(effect, this.particles);
      }
    });

    this.damageNumbers = this.damageNumbers.filter(dn => updateDamageNumber(dn));

    // 绘制粒子
    this.particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2);
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
      }
    }

    // 绘制伤害数字
    for (const dn of this.damageNumbers) {
      drawDamageNumber(ctx, dn);
    }
  }

  destroy() {
    cancelAnimationFrame(this.rafId);
    this.running = false;
    this.effects = [];
    this.damageNumbers = [];
  }
}
