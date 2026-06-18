'use client';

// ============================================================
// 横向卷轴战斗引擎 - 无限战斗版
// ============================================================

import { SpriteRenderer } from './sprite-animation';

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export type EntityState = 'idle' | 'walking' | 'attacking' | 'hit' | 'dying' | 'dead';

export interface CombatEntity {
  id: string;
  type: 'hero' | 'monster';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  attackRange: number;
  attackSpeed: number;
  moveSpeed: number;
  critChance: number;
  critMultiplier: number;
  state: EntityState;
  lastAttackTime: number;
  targetId: string | null;
  animationFrame: number;
  animationTime: number;
  stateTime: number;
  hitFlash: number;
  attackProgress: number;
  classKey?: string;
  monsterKey?: string;
  sortOrder: number;
}

export interface DamageNumber {
  x: number;
  y: number;
  value: number;
  isCrit: boolean;
  age: number;
  maxAge: number;
  alpha: number;
  vy: number;
}

export interface AttackEffect {
  id: string;
  type: 'slash';
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  progress: number;
  speed: number;
  color: string;
  done: boolean;
}

export interface SideScrollerState {
  heroes: CombatEntity[];
  monsters: CombatEntity[];
  wave: number;
  totalKills: number;
  isPaused: boolean;
  gameOver: boolean;
  effects: AttackEffect[];
  damageNumbers: DamageNumber[];
}

export interface SideScrollerConfig {
  sceneWidth: number;
  sceneHeight: number;
  groundY: number;
  heroSpawnX: number;
  monsterSpawnX: number;
}

const monsterTypes: Record<string, { color: string; icon: string }> = {
  slime: { color: '#27ae60', icon: '🟢' },
  goblin: { color: '#e67e22', icon: '👺' },
  skeleton: { color: '#ecf0f1', icon: '💀' },
  wolf: { color: '#7f8c8d', icon: '🐺' },
  bear: { color: '#8b4513', icon: '🐻' },
  fire_elemental: { color: '#e74c3c', icon: '🔥' },
  dragon_whelp: { color: '#9b59b6', icon: '🐉' },
  void_walker: { color: '#2c3e50', icon: '👻' },
};

const monsterNames: Record<string, string[]> = {
  slime: ['史莱姆', '小绿史莱姆', '泡沫史莱姆'],
  goblin: ['哥布林', '小哥布林', '哥布林战士'],
  skeleton: ['骷髅兵', '骷髅弓手', '骷髅战士'],
  wolf: ['野狼', '灰狼', '狂狼'],
  bear: ['黑熊', '棕熊', '狂熊'],
  fire_elemental: ['火元素', '火焰精灵', '烈焰使者'],
  dragon_whelp: ['幼龙', '小火龙', '飞龙幼崽'],
  void_walker: ['虚空行者', '暗影怪', '深渊魔物'],
};

const availableMonsterKeys = Object.keys(monsterTypes);

function createDefaultConfig(canvasWidth: number, canvasHeight: number): SideScrollerConfig {
  return {
    sceneWidth: canvasWidth,
    sceneHeight: canvasHeight,
    groundY: canvasHeight - 100,
    heroSpawnX: canvasWidth - 150,
    monsterSpawnX: 150,
  };
}

function createHero(
  id: string,
  name: string,
  classKey: string,
  x: number,
  y: number
): CombatEntity {
  return {
    id,
    type: 'hero',
    name,
    classKey,
    x,
    y,
    width: 60,
    height: 80,
    hp: 150,
    maxHp: 150,
    attack: 25,
    defense: 8,
    attackRange: 80,
    attackSpeed: 1.0,
    moveSpeed: 120,
    critChance: 0.15,
    critMultiplier: 1.8,
    state: 'idle',
    lastAttackTime: 0,
    targetId: null,
    animationFrame: 0,
    animationTime: 0,
    stateTime: 0,
    hitFlash: 0,
    attackProgress: 0,
    sortOrder: 0,
  };
}

function createMonster(
  id: string,
  name: string,
  monsterKey: string,
  x: number,
  y: number,
  wave: number
): CombatEntity {
  const hpMult = 1 + (wave - 1) * 0.15;
  const atkMult = 1 + (wave - 1) * 0.1;

  return {
    id,
    type: 'monster',
    name,
    monsterKey,
    x,
    y,
    width: 50,
    height: 70,
    hp: Math.floor((50 + wave * 10) * hpMult),
    maxHp: Math.floor((50 + wave * 10) * hpMult),
    attack: Math.floor((12 + wave * 2) * atkMult),
    defense: 3 + wave,
    attackRange: 70,
    attackSpeed: 1.2,
    moveSpeed: 90,
    critChance: 0.05,
    critMultiplier: 1.5,
    state: 'idle',
    lastAttackTime: 0,
    targetId: null,
    animationFrame: 0,
    animationTime: 0,
    stateTime: 0,
    hitFlash: 0,
    attackProgress: 0,
    sortOrder: 0,
  };
}

export class SideScrollerEngine {
  state: SideScrollerState;
  config: SideScrollerConfig;
  private renderer: SpriteRenderer;
  private ctx: CanvasRenderingContext2D;
  private lastTime: number = 0;
  private animationFrameId: number = 0;
  private running: boolean = false;
  private disposed: boolean = false;

  onWaveComplete?: (wave: number, kills: number) => void;
  onGameOver?: (kills: number) => void;
  onReward?: (gold: number, exp: number) => void;

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.config = createDefaultConfig(width, height);
    this.renderer = new SpriteRenderer(ctx);
    this.state = this.createInitialState();
  }

  private createInitialState(): SideScrollerState {
    return {
      heroes: [],
      monsters: [],
      wave: 1,
      totalKills: 0,
      isPaused: false,
      gameOver: false,
      effects: [],
      damageNumbers: [],
    };
  }

  init(heroName: string, classKey: string): void {
    this.state = this.createInitialState();
    const hero = createHero(
      'hero_1',
      heroName,
      classKey,
      this.config.heroSpawnX,
      this.config.groundY - 80
    );
    this.state.heroes = [hero];
    this.spawnWave(1);
  }

  resize(width: number, height: number): void {
    this.config = createDefaultConfig(width, height);
  }

  start(): void {
    if (this.running || this.disposed) return;
    this.running = true;
    this.lastTime = performance.now();
    this.gameLoop();
  }

  stop(): void {
    this.running = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = 0;
    }
  }

  togglePause(): void {
    this.state.isPaused = !this.state.isPaused;
  }

  private gameLoop = (): void => {
    if (!this.running || this.disposed) return;

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    if (!this.state.isPaused) {
      this.update(dt);
    }

    this.render();
    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  };

  private update(dt: number): void {
    this.updateEntities(dt);
    this.updateEffects(dt);
    this.updateDamageNumbers(dt);
    this.checkAndRespawnMonsters();
  }

  private updateEntities(dt: number): void {
    const now = performance.now() / 1000;

    for (const hero of this.state.heroes) {
      hero.stateTime += dt;

      if (hero.state === 'dying' && hero.stateTime > 0.5) {
        hero.state = 'dead';
        hero.stateTime = 0;
      }

      if (hero.state === 'dead' && hero.stateTime > 1.5) {
        this.resurrectHero(hero);
        continue;
      }

      if (hero.state !== 'dead' && hero.state !== 'dying') {
        this.updateEntity(hero, this.state.monsters, dt, now);
      }
    }

    for (const monster of this.state.monsters) {
      monster.stateTime += dt;

      if (monster.state === 'dying' && monster.stateTime > 0.5) {
        monster.state = 'dead';
        monster.stateTime = 0;
      }

      if (monster.state !== 'dead' && monster.state !== 'dying') {
        this.updateEntity(monster, this.state.heroes, dt, now);
      }
    }

    this.state.monsters = this.state.monsters.filter(m => {
      if (m.state === 'dead' && m.stateTime > 0.5) return false;
      return true;
    });
  }

  private updateEntity(
    entity: CombatEntity,
    enemies: CombatEntity[],
    dt: number,
    now: number
  ): void {
    if (entity.type === 'monster') {
      entity.stateTime += dt;
    }

    if (entity.hitFlash > 0) {
      entity.hitFlash = Math.max(0, entity.hitFlash - dt);
    }

    if (entity.attackProgress > 0) {
      entity.attackProgress += dt * 5;
      if (entity.attackProgress >= 1) {
        entity.attackProgress = 0;
        if (entity.state === 'attacking') {
          entity.state = 'idle';
          entity.stateTime = 0;
        }
      }
    }

    if (entity.state === 'dead' || entity.state === 'dying') {
      return;
    }

    if (entity.state === 'hit' && entity.stateTime > 0.15) {
      entity.state = 'idle';
      entity.stateTime = 0;
    }

    const aliveEnemies = enemies.filter(e => e.state !== 'dead' && e.state !== 'dying');
    if (aliveEnemies.length === 0) {
      entity.targetId = null;
      return;
    }

    if (!entity.targetId || !enemies.find(e => e.id === entity.targetId && e.state !== 'dead')) {
      const entityCenter = entity.x + entity.width / 2;
      aliveEnemies.sort((a, b) => {
        const distA = Math.abs((a.x + a.width / 2) - entityCenter);
        const distB = Math.abs((b.x + b.width / 2) - entityCenter);
        return distA - distB;
      });
      entity.targetId = aliveEnemies[0].id;
    }

    const target = enemies.find(e => e.id === entity.targetId);
    if (!target) return;

    const entityCenter = entity.x + entity.width / 2;
    const targetCenter = target.x + target.width / 2;
    const distance = Math.abs(targetCenter - entityCenter);
    const effectiveRange = entity.attackRange + entity.width / 2 + target.width / 2;

    if (distance <= effectiveRange) {
      if (entity.state !== 'attacking' && entity.attackProgress === 0) {
        entity.state = 'idle';
      }

      if (entity.lastAttackTime === 0) {
        entity.lastAttackTime = now - entity.attackSpeed + Math.random() * 0.3;
      }

      if (now - entity.lastAttackTime >= entity.attackSpeed && entity.attackProgress === 0) {
        this.performAttack(entity, target);
        entity.lastAttackTime = now;
      }
    } else {
      entity.state = 'walking';
      const direction = entityCenter > targetCenter ? -1 : 1;
      entity.x += direction * entity.moveSpeed * dt;

      if (entity.type === 'hero') {
        entity.x = Math.min(this.config.sceneWidth - entity.width - 20, entity.x);
      } else {
        entity.x = Math.max(20, entity.x);
      }
    }
  }

  private performAttack(attacker: CombatEntity, target: CombatEntity): void {
    attacker.state = 'attacking';
    attacker.stateTime = 0;
    attacker.attackProgress = 0.01;

    const isCrit = Math.random() < attacker.critChance;
    let damage = attacker.attack - target.defense / 2;
    if (isCrit) {
      damage = Math.floor(damage * attacker.critMultiplier);
    }
    damage = Math.max(1, damage + Math.floor((Math.random() - 0.5) * 6));

    target.hp -= damage;
    target.state = 'hit';
    target.stateTime = 0;
    target.hitFlash = 0.2;

    this.addDamageNumber(target.x + target.width / 2, target.y, damage, isCrit);
    this.addAttackEffect(attacker, target);

    if (target.hp <= 0) {
      target.hp = 0;
      target.state = 'dying';
      target.stateTime = 0;

      if (target.type === 'monster') {
        this.state.totalKills++;
        if (this.state.totalKills % 5 === 0) {
          this.state.wave++;
        }
        const goldReward = 5 + this.state.wave * 2;
        const expReward = 10 + this.state.wave * 5;
        this.onReward?.(goldReward, expReward);
      }
    }
  }

  private addDamageNumber(x: number, y: number, value: number, isCrit: boolean): void {
    this.state.damageNumbers.push({
      x,
      y,
      value,
      isCrit,
      age: 0,
      maxAge: isCrit ? 1.2 : 0.8,
      alpha: 1,
      vy: isCrit ? -60 : -40,
    });
  }

  private addAttackEffect(attacker: CombatEntity, target: CombatEntity): void {
    const startX = attacker.x + attacker.width / 2;
    const startY = attacker.y + attacker.height / 2;
    const endX = target.x + target.width / 2;
    const endY = target.y + target.height / 2;

    this.state.effects.push({
      id: 'effect_' + Date.now() + '_' + Math.random(),
      type: 'slash',
      x: startX,
      y: startY,
      targetX: endX,
      targetY: endY,
      progress: 0,
      speed: 8,
      color: attacker.type === 'hero' ? '#fff' : '#ff6b6b',
      done: false,
    });
  }

  private updateEffects(dt: number): void {
    this.state.effects = this.state.effects.filter(effect => {
      effect.progress += dt * effect.speed;
      if (effect.progress >= 1) {
        effect.done = true;
      }
      return !effect.done;
    });
  }

  private updateDamageNumbers(dt: number): void {
    this.state.damageNumbers = this.state.damageNumbers.filter(dn => {
      dn.age += dt;
      dn.y += dn.vy * dt;
      dn.alpha = 1 - (dn.age / dn.maxAge);
      dn.vy *= 0.98;
      return dn.age < dn.maxAge;
    });
  }

  private checkAndRespawnMonsters(): void {
    const aliveMonsters = this.state.monsters.filter(m => m.state !== 'dead' && m.state !== 'dying');
    const aliveCount = aliveMonsters.length;

    if (aliveCount === 0) {
      this.state.wave++;
      this.spawnWave(this.state.wave);
    } else if (aliveCount < 2 && Math.random() < 0.02) {
      this.spawnSingleMonster();
    }
  }

  private resurrectHero(hero: CombatEntity): void {
    hero.hp = hero.maxHp;
    hero.state = 'idle';
    hero.stateTime = 0;
    hero.x = this.config.heroSpawnX;
    hero.y = this.config.groundY - 80;
    hero.lastAttackTime = 0;
    hero.targetId = null;
    hero.attackProgress = 0;
    hero.hitFlash = 0;
  }

  private spawnSingleMonster(): void {
    const monsterKey = availableMonsterKeys[Math.floor(Math.random() * availableMonsterKeys.length)];
    const names = monsterNames[monsterKey] || ['怪物'];
    const name = names[Math.floor(Math.random() * names.length)];

    const x = 30;
    const y = this.config.groundY - 70;

    const monster = createMonster(
      `monster_${Date.now()}_${Math.random()}`,
      name,
      monsterKey,
      x,
      y,
      this.state.wave
    );

    this.state.monsters.push(monster);
  }

  private spawnWave(wave: number): void {
    this.state.wave = wave;
    const count = Math.min(2 + Math.floor(wave / 2), 6);

    const monsters: CombatEntity[] = [];
    for (let i = 0; i < count; i++) {
      const monsterKey = availableMonsterKeys[Math.floor(Math.random() * availableMonsterKeys.length)];
      const names = monsterNames[monsterKey] || ['怪物'];
      const name = names[Math.floor(Math.random() * names.length)];

      const x = 30 + i * 60;
      const y = this.config.groundY - 70;

      monsters.push(createMonster(
        `monster_${wave}_${i}`,
        name,
        monsterKey,
        x,
        y,
        wave
      ));
    }

    this.state.monsters = monsters;
  }

  private render(): void {
    const ctx = this.ctx;
    const { sceneWidth, sceneHeight, groundY } = this.config;

    ctx.clearRect(0, 0, sceneWidth, sceneHeight);

    ctx.fillStyle = '#161b22';
    ctx.fillRect(0, 0, sceneWidth, sceneHeight);

    ctx.fillStyle = '#21262d';
    ctx.fillRect(0, groundY, sceneWidth, sceneHeight - groundY);

    const allEntities = [...this.state.heroes, ...this.state.monsters].sort((a, b) =>
      (a.y + a.height) - (b.y + b.height)
    );

    for (const entity of allEntities) {
      this.renderer.drawEntity(entity, 0.016);
    }

    this.drawAttackEffects();
    this.drawDamageNumbers();
  }

  private drawAttackEffects(): void {
    const ctx = this.ctx;
    for (const effect of this.state.effects) {
      const t = effect.progress;
      const x = effect.x + (effect.targetX - effect.x) * t;
      const y = effect.y + (effect.targetY - effect.y) * t;

      ctx.save();
      ctx.globalAlpha = 1 - t;

      const size = 30 + (1 - t) * 20;
      ctx.strokeStyle = effect.color;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(x, y, size, -0.5 + t, 0.5 + t);
      ctx.stroke();

      ctx.globalAlpha = (1 - t) * 0.3;
      ctx.lineWidth = 8;
      ctx.stroke();

      ctx.restore();
    }
  }

  private drawDamageNumbers(): void {
    const ctx = this.ctx;
    for (const dn of this.state.damageNumbers) {
      ctx.save();
      ctx.globalAlpha = dn.alpha;

      const fontSize = dn.isCrit ? 24 : 18;
      ctx.font = `bold ${fontSize} sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillText((dn.isCrit ? '暴击! ' : '') + dn.value, dn.x + 2, dn.y + 2);

      ctx.fillStyle = dn.isCrit ? '#ffd700' : '#ff6b6b';
      ctx.fillText((dn.isCrit ? '暴击! ' : '') + dn.value, dn.x, dn.y);

      ctx.restore();
    }
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
  }
}
