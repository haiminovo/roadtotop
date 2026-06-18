'use client';

// ============================================================
// 精灵动画系统 - 简化版
// ============================================================

export interface CombatEntity {
  id: string;
  type: 'hero' | 'monster';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  state: string;
  hitFlash: number;
  attackProgress: number;
  classKey?: string;
  monsterKey?: string;
  hp: number;
  maxHp: number;
  stateTime: number;
}

const CLASS_COLORS: Record<string, { main: string; light: string; dark: string }> = {
  warrior: { main: '#e74c3c', light: '#ff6b5b', dark: '#c0392b' },
  mage: { main: '#9b59b6', light: '#be8ed6', dark: '#7d3c98' },
  ranger: { main: '#27ae60', light: '#58d68d', dark: '#1e8449' },
  rogue: { main: '#f39c12', light: '#f7dc6f', dark: '#d68910' },
  priest: { main: '#3498db', light: '#85c1e9', dark: '#2980b9' },
  farmer: { main: '#1abc9c', light: '#76d7c4', dark: '#16a085' },
};

const CLASS_ICONS: Record<string, string> = {
  warrior: '⚔️',
  mage: '🔮',
  ranger: '🏹',
  rogue: '🗡️',
  priest: '✨',
  farmer: '🌾',
};

const MONSTER_CONFIGS: Record<string, { color: string; icon: string }> = {
  slime: { color: '#27ae60', icon: '🟢' },
  goblin: { color: '#e67e22', icon: '👺' },
  skeleton: { color: '#ecf0f1', icon: '💀' },
  wolf: { color: '#7f8c8d', icon: '🐺' },
  bear: { color: '#8b4513', icon: '🐻' },
  fire_elemental: { color: '#e74c3c', icon: '🔥' },
  dragon_whelp: { color: '#9b59b6', icon: '🐉' },
  void_walker: { color: '#2c3e50', icon: '👻' },
};

export class SpriteRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  drawEntity(entity: CombatEntity, dt: number): void {
    const ctx = this.ctx;

    ctx.save();

    let alpha = 1;
    let yOffset = 0;
    let scale = 1;

    if (entity.state === 'dying' || entity.state === 'dead') {
      const fadeTime = entity.stateTime;
      alpha = Math.max(0, 1 - fadeTime / 0.8);
      yOffset = fadeTime * 30;
      scale = 1 - fadeTime * 0.3;
    } else if (entity.hitFlash > 0) {
      alpha *= 0.5 + Math.sin(Date.now() * 0.05) * 0.5;
    }

    if (entity.attackProgress > 0) {
      scale *= 1 + Math.sin(entity.attackProgress * Math.PI) * 0.2;
    }

    ctx.globalAlpha = alpha;

    const centerX = entity.x + entity.width / 2;
    const centerY = entity.y + entity.height / 2 + yOffset;
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);
    ctx.translate(-centerX, -centerY);

    if (entity.type === 'hero') {
      this.drawHero(entity);
    } else {
      this.drawMonster(entity);
    }

    if (entity.attackProgress > 0 && entity.attackProgress < 1 && entity.state !== 'dying' && entity.state !== 'dead') {
      this.drawAttackIndicator(entity);
    }

    ctx.restore();

    if (entity.state !== 'dying' && entity.state !== 'dead') {
      this.drawHealthBar(entity);
    }
  }

  private drawHero(entity: CombatEntity): void {
    const ctx = this.ctx;
    const { x, y, width, height, classKey } = entity;

    const colors = CLASS_COLORS[classKey || 'warrior'] || CLASS_COLORS.warrior;

    this.roundRect(x + 5, y + 10, width - 10, height - 15, 8);
    ctx.fillStyle = colors.main;
    ctx.fill();

    ctx.fillStyle = colors.light;
    ctx.globalAlpha = 0.3;
    this.roundRect(x + 8, y + 13, (width - 16) / 2, (height - 18) / 2, 6);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = colors.dark;
    ctx.lineWidth = 2;
    this.roundRect(x + 5, y + 10, width - 10, height - 15, 8);
    ctx.stroke();

    const icon = CLASS_ICONS[classKey || 'warrior'] || '⚔️';
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, x + width / 2, y + height / 2);
  }

  private drawMonster(entity: CombatEntity): void {
    const ctx = this.ctx;
    const { x, y, width, height, monsterKey } = entity;

    const config = MONSTER_CONFIGS[monsterKey || 'slime'] || MONSTER_CONFIGS.slime;

    ctx.beginPath();
    ctx.ellipse(x + width / 2, y + height / 2 + 5, width / 2 - 5, height / 2 - 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = config.color;
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(x + width / 3, y + height / 3, width / 5, height / 6, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(x + width / 2, y + height / 2 + 5, width / 2 - 5, height / 2 - 10, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(config.icon, x + width / 2, y + height / 2 + 5);
  }

  private drawAttackIndicator(entity: CombatEntity): void {
    const ctx = this.ctx;
    const t = entity.attackProgress;
    const direction = entity.type === 'hero' ? -1 : 1;

    ctx.save();
    ctx.globalAlpha = 1 - t;

    const startX = entity.x + entity.width / 2;
    const startY = entity.y + entity.height / 2;
    const length = 60 * t;

    const gradient = ctx.createLinearGradient(startX, startY, startX + direction * length, startY);
    gradient.addColorStop(0, entity.type === 'hero' ? '#fff' : '#ff6b6b');
    gradient.addColorStop(1, 'transparent');

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 8 + (1 - t) * 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(startX + direction * length, startY);
    ctx.stroke();

    ctx.restore();
  }

  private drawHealthBar(entity: CombatEntity): void {
    const ctx = this.ctx;
    const { x, y, width, hp, maxHp } = entity;

    const barWidth = width + 10;
    const barHeight = 6;
    const barX = x + (width - barWidth) / 2;
    const barY = y - 15;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    const hpPercent = Math.max(0, hp / maxHp);
    let hpColor = '#2ecc71';
    if (hpPercent <= 0.3) hpColor = '#e74c3c';
    else if (hpPercent <= 0.6) hpColor = '#f39c12';

    ctx.fillStyle = hpColor;
    ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);

    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    ctx.fillStyle = '#fff';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(entity.name, x + width / 2, barY - 4);
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
