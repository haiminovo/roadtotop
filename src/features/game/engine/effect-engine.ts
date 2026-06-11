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

// 职业 -> 默认攻击特效
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

  // 从 BattleLog 解析并生成特效
  enqueueFromLog(
    log: { type: string; message: string; timestamp: number },
    classKey: ClassKey,
    getPosition: (index: number) => { x: number; y: number } | null,
    playerIndex = -1,
    enemyIndices: number[] = [],
  ) {
    const msg = log.message;
    const isPlayerAttack = msg.startsWith('你') || msg.includes('挥剑') || msg.includes('斩击') ||
      msg.includes('劈砍') || msg.includes('刺击') || msg.includes('旋风') || msg.includes('致命') ||
      msg.includes('蓄力') || msg.includes('连续') || msg.includes('精准') || msg.includes('火球') ||
      msg.includes('闪电') || msg.includes('毒刃') || msg.includes('背刺') || msg.includes('治愈') ||
      msg.includes('包扎') || msg.includes('战吼') || msg.includes('盾击');

    const isEnemyAttack = !isPlayerAttack && (msg.includes('使出') || msg.includes('对你造成'));
    const isHeal = msg.includes('恢复') || msg.includes('治愈') || msg.includes('包扎');
    const isCrit = msg.includes('暴击');
    const isEffect = msg.includes('效果') || msg.includes('施加');

    // 提取伤害数字
    const dmgMatch = msg.match(/(\d+)\s*点伤害/);
    const healMatch = msg.match(/(\d+)\s*点/);
    const amount = dmgMatch ? parseInt(dmgMatch[1]) : healMatch ? parseInt(healMatch[1]) : 0;

    // 提取攻击者和目标名字
    const playerAttackMatch = msg.match(/对\s*(\S+)\s*造成/); // "你对 史莱姆 造成"
    const enemyAttackMatch = msg.match(/^(\S+)\s*使出/);       // "灰狼 使出 利爪连击"
    const playerHitMatch = msg.match(/对你造成/);              // "对你造成"

    // 根据名字匹配具体的敌人 index
    function findEnemyIndex(name: string): number {
      for (const idx of enemyIndices) {
        const el = document.querySelector(`[data-entity-index="${idx}"]`);
        if (el) {
          const nameEl = el.querySelector('[data-entity-name]');
          if (nameEl && nameEl.textContent === name) return idx;
        }
      }
      return -1;
    }

    let targetPos: { x: number; y: number } | null = null;
    let sourcePos: { x: number; y: number } | null = null;

    if (isPlayerAttack || msg.startsWith('你')) {
      // 玩家发起攻击 -> 起点是玩家，终点是被攻击的敌人
      sourcePos = getPosition(playerIndex);
      if (playerAttackMatch) {
        const targetName = playerAttackMatch[1];
        const idx = findEnemyIndex(targetName);
        if (idx >= 0) targetPos = getPosition(idx);
      }
      if (!targetPos) {
        // fallback: 找第一个存活敌人
        for (const idx of enemyIndices) {
          const pos = getPosition(idx);
          if (pos) { targetPos = pos; break; }
        }
      }
    } else if (isEnemyAttack || playerHitMatch) {
      // 敌人发起攻击 -> 起点是该敌人，终点是玩家
      targetPos = getPosition(playerIndex);
      if (enemyAttackMatch) {
        const attackerName = enemyAttackMatch[1];
        const idx = findEnemyIndex(attackerName);
        if (idx >= 0) sourcePos = getPosition(idx);
      }
      if (!sourcePos) {
        // fallback: 找第一个存活敌人
        for (const idx of enemyIndices) {
          const pos = getPosition(idx);
          if (pos) { sourcePos = pos; break; }
        }
      }
    }

    if (!sourcePos) sourcePos = getPosition(playerIndex) || { x: this.width * 0.2, y: this.height * 0.5 };
    if (!targetPos) targetPos = getPosition(enemyIndices[0]) || { x: this.width * 0.8, y: this.height * 0.5 };

    // 生成攻击特效
    if (log.type === 'damage' || isPlayerAttack || isEnemyAttack) {
      if (isPlayerAttack) {
        const style = CLASS_ATTACK_STYLE[classKey] || CLASS_ATTACK_STYLE.warrior;
        if (style.type === 'slash') {
          this.effects.push(createSlash(sourcePos.x, sourcePos.y, targetPos.x, targetPos.y, style.color));
        } else if (style.type === 'projectile') {
          const pStyle = (style.style || 'arrow') as 'arrow' | 'fireball' | 'lightning' | 'heal_bolt' | 'stab';
          this.effects.push(createProjectile(sourcePos.x, sourcePos.y, targetPos.x, targetPos.y, pStyle));
        }
      } else {
        // 敌人攻击 - 通用红色刀光
        this.effects.push(createSlash(sourcePos.x, sourcePos.y, targetPos.x, targetPos.y, '#f85149'));
      }

      // 伤害数字
      if (amount > 0) {
        setTimeout(() => {
          this.damageNumbers.push(createDamageNumber(
            targetPos!.x, targetPos!.y - 20,
            isCrit ? `暴击! -${amount}` : `-${amount}`,
            isCrit ? '#ffa500' : '#f85149',
            isCrit,
          ));
        }, 300);
      }
    }

    // 治疗
    if (isHeal && amount > 0) {
      const pos = getPosition(playerIndex) || { x: this.width * 0.3, y: this.height * 0.5 };
      this.effects.push(createHealAura(pos.x, pos.y));
      this.effects.push(createProjectile(pos.x, pos.y + 40, pos.x, pos.y, 'heal_bolt'));
      setTimeout(() => {
        this.damageNumbers.push(createDamageNumber(pos.x, pos.y - 20, `+${amount}`, '#3fb950'));
      }, 200);
    }

    // 闪电链
    if (msg.includes('闪电')) {
      const sp = getPosition(playerIndex) || { x: this.width * 0.3, y: this.height * 0.5 };
      for (const idx of enemyIndices) {
        const tp = getPosition(idx);
        if (tp) this.effects.push(createLightning(sp.x, sp.y, tp.x, tp.y));
      }
    }

    // 护盾/防御
    if (msg.includes('防御') || msg.includes('护盾') || msg.includes('格挡')) {
      const pos = getPosition(playerIndex) || { x: this.width * 0.3, y: this.height * 0.5 };
      this.effects.push(createShieldFlash(pos.x, pos.y));
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

    // 更新粒子
    this.particles.update(1);

    // 更新特效
    this.effects = this.effects.filter(effect => {
      switch (effect.type) {
        case 'slash': return updateSlash(effect, this.particles);
        case 'projectile': return updateProjectile(effect, this.particles, () => {});
        case 'lightning': return updateLightning(effect);
        case 'shield_flash': return updateShieldFlash(effect);
        case 'heal_aura': return updateHealAura(effect, this.particles);
      }
    });

    // 更新伤害数字
    this.damageNumbers = this.damageNumbers.filter(dn => updateDamageNumber(dn));

    // 绘制粒子
    this.particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
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
