'use client';

import React, { useEffect, useState, useRef } from 'react';

interface EnemyTemplate {
  key: string;
  name: string;
  mapKey: string;
  baseHealth: number;
  statWeights: { strength: number; intelligence: number; agility: number; vitality: number };
  fixedSkillKeys: string[];
  skillCaps: { attack: number; spell: number; guard: number };
  goldDrop: number;
  expDrop: number;
  monsterKey?: string;
}

// 像素怪物图案 - 从 pixel-art.ts 同步
const PIXEL_MONSTERS: Record<string, (string | null)[]> = {
  slime: [
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, '#4ab86a', '#4ab86a', '#4ab86a', '#4ab86a', '#4ab86a', '#4ab86a', null, null, null, null, null,
    null, null, null, '#4ab86a', '#4ab86a', '#6ab88a', '#6ab88a', '#6ab88a', '#6ab88a', '#6ab88a', '#6ab88a', '#4ab86a', null, null, null, null,
    null, null, '#4ab86a', '#6ab88a', '#6ab88a', '#6ab88a', '#6ab88a', '#6ab88a', '#6ab88a', '#6ab88a', '#6ab88a', '#6ab88a', '#4ab86a', null, null, null,
    null, '#4ab86a', '#6ab88a', '#6ab88a', '#ffffff', '#6ab88a', '#6ab88a', '#6ab88a', '#6ab88a', '#ffffff', '#6ab88a', '#6ab88a', '#4ab86a', null, null, null,
    null, '#4ab86a', '#6ab88a', '#ffffff', '#222222', '#ffffff', '#6ab88a', '#6ab88a', '#ffffff', '#222222', '#ffffff', '#6ab88a', '#4ab86a', null, null, null,
    '#4ab86a', '#6ab88a', '#6ab88a', '#6ab88a', '#6ab88a', '#6ab88a', '#6ab88a', '#6ab88a', '#6ab88a', '#6ab88a', '#6ab88a', '#6ab88a', '#6ab88a', '#4ab86a', null, null,
    '#4ab86a', '#6ab88a', '#6ab88a', '#6ab88a', '#6ab88a', '#6ab88a', '#6ab88a', '#6ab88a', '#6ab88a', '#6ab88a', '#6ab88a', '#6ab88a', '#6ab88a', '#4ab86a', null, null,
    '#2a884a', '#4ab86a', '#6ab88a', '#6ab88a', '#6ab88a', '#6ab88a', '#6ab88a', '#6ab88a', '#6ab88a', '#6ab88a', '#6ab88a', '#6ab88a', '#4ab86a', '#2a884a', null, null,
    null, null, '#2a884a', '#4ab86a', '#4ab86a', '#4ab86a', '#4ab86a', '#4ab86a', '#4ab86a', '#4ab86a', '#4ab86a', '#2a884a', null, null, null, null,
    null, null, null, '#2a884a', '#2a884a', '#2a884a', '#4ab86a', '#4ab86a', '#2a884a', '#2a884a', '#2a884a', null, null, null, null, null,
    null, null, null, null, null, null, '#2a884a', '#2a884a', '#2a884a', null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
  ],
  goblin: [
    null, null, null, null, null, '#5b6a2a', '#5b6a2a', '#5b6a2a', '#5b6a2a', '#5b6a2a', '#5b6a2a', null, null, null, null, null,
    null, null, null, '#5b6a2a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#5b6a2a', null, null, null, null,
    null, null, '#5b6a2a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#5b6a2a', null, null, null,
    null, '#5b6a2a', '#8b9a4a', '#ff4444', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#ff4444', '#8b9a4a', '#5b6a2a', null, null, null,
    null, '#5b6a2a', '#8b9a4a', '#ff4444', '#222222', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#222222', '#ff4444', '#8b9a4a', '#5b6a2a', null, null, null,
    null, null, '#8b9a4a', '#8b9a4a', '#8b9a4a', '#abba6a', '#abba6a', '#abba6a', '#abba6a', '#8b9a4a', '#8b9a4a', '#8b9a4a', null, null, null, null,
    null, null, null, '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', null, null, null, null, null,
    null, null, null, '#5b6a2a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#5b6a2a', null, null, null, null, null,
    null, null, null, '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', null, null, null, null, null,
    null, null, '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', null, null, '#8b9a4a', '#8b9a4a', '#8b9a4a', '#8b9a4a', null, null, null, null,
    null, null, '#5b6a2a', '#8b9a4a', '#8b9a4a', null, null, null, null, '#8b9a4a', '#8b9a4a', '#5b6a2a', null, null, null, null,
    null, null, '#5b6a2a', '#5b6a2a', null, null, null, null, null, null, '#5b6a2a', '#5b6a2a', null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
  ],
  skeleton: [
    null, null, null, null, '#e8e0d0', '#e8e0d0', '#e8e0d0', '#e8e0d0', '#e8e0d0', '#e8e0d0', null, null, null, null, null, null,
    null, null, null, '#e8e0d0', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#e8e0d0', null, null, null, null,
    null, null, '#e8e0d0', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#e8e0d0', null, null, null, null,
    null, '#e8e0d0', '#ffffff', '#222222', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#222222', '#ffffff', '#e8e0d0', null, null, null,
    null, '#e8e0d0', '#ffffff', '#222222', '#222222', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#222222', '#222222', '#ffffff', '#e8e0d0', null, null, null,
    null, null, '#e8e0d0', '#ffffff', '#ffffff', '#ffffff', '#222222', '#222222', '#222222', '#ffffff', '#ffffff', '#e8e0d0', null, null, null, null,
    null, null, null, '#e8e0d0', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#e8e0d0', null, null, null, null, null,
    null, null, null, null, '#b8b0a0', '#e8e0d0', '#e8e0d0', '#e8e0d0', '#e8e0d0', '#b8b0a0', null, null, null, null, null, null,
    null, null, null, null, '#e8e0d0', '#e8e0d0', '#e8e0d0', '#e8e0d0', '#e8e0d0', '#e8e0d0', null, null, null, null, null, null,
    null, null, null, '#e8e0d0', '#ffffff', '#e8e0d0', '#e8e0d0', '#e8e0d0', '#e8e0d0', '#ffffff', '#e8e0d0', null, null, null, null, null,
    null, null, '#e8e0d0', '#ffffff', '#ffffff', '#e8e0d0', '#e8e0d0', '#e8e0d0', '#e8e0d0', '#ffffff', '#ffffff', '#e8e0d0', null, null, null, null,
    null, null, '#e8e0d0', '#ffffff', '#ffffff', '#e8e0d0', '#e8e0d0', '#e8e0d0', '#e8e0d0', '#ffffff', '#ffffff', '#e8e0d0', null, null, null, null,
    null, null, null, '#e8e0d0', '#e8e0d0', null, null, null, null, '#e8e0d0', '#e8e0d0', null, null, null, null, null,
    null, null, null, '#b8b0a0', '#b8b0a0', null, null, null, null, '#b8b0a0', '#b8b0a0', null, null, null, null, null,
    null, null, null, '#e8e0d0', '#e8e0d0', null, null, null, null, '#e8e0d0', '#e8e0d0', null, null, null, null, null,
    null, null, null, '#222222', '#222222', null, null, null, null, '#222222', '#222222', null, null, null, null, null,
  ],
  wolf: [
    null, null, null, '#5a5a6a', null, null, null, null, null, null, null, '#5a5a6a', null, null, null, null,
    null, null, '#5a5a6a', '#7a7a8a', '#7a7a8a', null, null, null, null, null, '#7a7a8a', '#7a7a8a', '#5a5a6a', null, null, null,
    null, '#5a5a6a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#5a5a6a', null, null, null,
    null, '#5a5a6a', '#7a7a8a', '#ffcc44', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#ffcc44', '#7a7a8a', '#5a5a6a', null, null, null,
    null, null, '#9a9aaa', '#ffcc44', '#222222', '#9a9aaa', '#9a9aaa', '#9a9aaa', '#9a9aaa', '#222222', '#ffcc44', '#9a9aaa', null, null, null, null,
    null, null, '#9a9aaa', '#9a9aaa', '#9a9aaa', '#9a9aaa', '#222222', '#222222', '#9a9aaa', '#9a9aaa', '#9a9aaa', '#9a9aaa', null, null, null, null,
    null, null, null, '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', null, null, null, null, null,
    null, null, null, '#5a5a6a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#5a5a6a', null, null, null, null, null,
    null, null, null, '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', null, null, null, null, null,
    null, null, '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', null, null, '#7a7a8a', '#7a7a8a', '#7a7a8a', '#7a7a8a', null, null, null, null,
    null, null, '#5a5a6a', '#7a7a8a', '#7a7a8a', null, null, null, null, '#7a7a8a', '#7a7a8a', '#5a5a6a', null, null, null, null,
    null, null, '#5a5a6a', '#5a5a6a', null, null, null, null, null, null, '#5a5a6a', '#5a5a6a', null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
  ],
  bear: [
    null, null, '#5b3a1a', '#5b3a1a', null, null, null, null, null, null, null, '#5b3a1a', '#5b3a1a', null, null, null,
    null, null, '#5b3a1a', '#8b5a3a', '#8b5a3a', '#8b5a3a', null, null, null, null, '#8b5a3a', '#8b5a3a', '#5b3a1a', null, null, null,
    null, null, '#5b3a1a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#5b3a1a', null, null, null,
    null, null, '#8b5a3a', '#444444', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#444444', '#8b5a3a', null, null, null, null,
    null, null, '#ab7a5a', '#444444', '#222222', '#ab7a5a', '#ab7a5a', '#ab7a5a', '#ab7a5a', '#222222', '#444444', '#ab7a5a', null, null, null, null,
    null, null, '#ab7a5a', '#ab7a5a', '#ab7a5a', '#ab7a5a', '#222222', '#222222', '#ab7a5a', '#ab7a5a', '#ab7a5a', '#ab7a5a', null, null, null, null,
    null, null, null, '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', null, null, null, null, null,
    null, null, null, '#5b3a1a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#5b3a1a', null, null, null, null, null,
    null, null, null, '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', null, null, null, null, null,
    null, null, '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', '#8b5a3a', null, null, null, null,
    null, null, '#5b3a1a', '#8b5a3a', '#8b5a3a', null, null, null, null, '#8b5a3a', '#8b5a3a', '#5b3a1a', null, null, null, null,
    null, null, '#5b3a1a', '#5b3a1a', null, null, null, null, null, null, '#5b3a1a', '#5b3a1a', null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
  ],
  fire_elemental: [
    null, null, null, null, null, null, '#ffab5a', '#ffab5a', '#ffab5a', '#ffab5a', null, null, null, null, null, null,
    null, null, null, null, '#ffab5a', '#ffab5a', '#ffab5a', '#ff6b3a', '#ffab5a', '#ffab5a', '#ffab5a', null, null, null, null, null,
    null, null, null, '#ffab5a', '#ffab5a', '#ffab5a', '#ffab5a', '#ff6b3a', '#ff6b3a', '#ffab5a', '#ffab5a', '#ffab5a', null, null, null, null,
    null, null, '#ffab5a', '#ff6b3a', '#ffffff', '#ffab5a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ffab5a', '#ffffff', '#ff6b3a', '#ffab5a', null, null, null,
    null, null, '#ff6b3a', '#ffffff', '#222222', '#ffffff', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ffffff', '#222222', '#ffffff', '#ff6b3a', null, null, null,
    null, '#ffab5a', '#ff6b3a', '#ffab5a', '#ffffff', '#ffab5a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ffab5a', '#ffffff', '#ffab5a', '#ff6b3a', '#ffab5a', null, null,
    null, '#ffab5a', '#ff6b3a', '#ff6b3a', '#ffab5a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ffab5a', '#ff6b3a', '#ff6b3a', '#ffab5a', null, null,
    null, '#ffab5a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ffab5a', null, null,
    '#cc3a1a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#cc3a1a', null, null,
    null, null, '#cc3a1a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#cc3a1a', null, null, null,
    null, null, null, '#cc3a1a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#cc3a1a', null, null, null, null,
    null, null, null, null, '#cc3a1a', '#cc3a1a', '#ff6b3a', '#ff6b3a', '#ff6b3a', '#cc3a1a', '#cc3a1a', null, null, null, null, null,
    null, null, null, null, null, '#cc3a1a', '#cc3a1a', '#cc3a1a', '#cc3a1a', '#cc3a1a', null, null, null, null, null, null,
    null, null, null, null, null, null, '#cc3a1a', '#cc3a1a', '#cc3a1a', null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
  ],
  dragon_whelp: [
    null, null, '#6b2a88', null, null, null, null, null, null, null, null, null, '#6b2a88', null, null, null,
    null, '#6b2a88', '#9b5ab8', '#9b5ab8', null, null, null, null, null, null, null, '#9b5ab8', '#9b5ab8', '#6b2a88', null, null,
    null, null, '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', null, null, null,
    null, null, '#9b5ab8', '#ffcc44', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#ffcc44', '#9b5ab8', '#9b5ab8', null, null, null,
    null, null, '#bb7ad8', '#ffcc44', '#222222', '#bb7ad8', '#bb7ad8', '#bb7ad8', '#bb7ad8', '#222222', '#ffcc44', '#bb7ad8', '#bb7ad8', null, null, null,
    null, null, '#bb7ad8', '#bb7ad8', '#bb7ad8', '#bb7ad8', '#ffcc44', '#ffcc44', '#bb7ad8', '#bb7ad8', '#bb7ad8', '#bb7ad8', '#bb7ad8', null, null, null,
    null, null, null, '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', null, null, null, null, null,
    null, null, null, '#6b2a88', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#6b2a88', null, null, null, null, null,
    null, null, null, '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', null, null, null, null, null,
    null, null, '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', null, null, '#9b5ab8', '#9b5ab8', '#9b5ab8', '#9b5ab8', null, null, null, null,
    null, null, '#6b2a88', '#9b5ab8', '#9b5ab8', null, null, null, null, '#9b5ab8', '#9b5ab8', '#6b2a88', null, null, null, null,
    null, null, '#6b2a88', '#6b2a88', null, null, null, null, null, null, '#6b2a88', '#6b2a88', null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
  ],
  void_walker: [
    null, null, null, null, null, null, '#aa66ff', '#aa66ff', '#aa66ff', '#aa66ff', null, null, null, null, null, null,
    null, null, null, null, '#aa66ff', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#aa66ff', null, null, null, null, null,
    null, null, null, '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', null, null, null, null,
    null, null, '#5a5a8a', '#aa66ff', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#aa66ff', '#5a5a8a', '#5a5a8a', null, null, null,
    null, null, '#5a5a8a', '#aa66ff', '#ffffff', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#ffffff', '#aa66ff', '#5a5a8a', null, null, null, null,
    null, '#5a5a8a', '#5a5a8a', '#5a5a8a', '#ffffff', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#ffffff', '#5a5a8a', '#5a5a8a', '#5a5a8a', null, null, null,
    null, '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', null, null, null,
    null, '#3a3a5a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#3a3a5a', null, null,
    '#1a1a3a', '#3a3a5a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#3a3a5a', '#1a1a3a', null,
    null, '#3a3a5a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#3a3a5a', null, null,
    null, null, '#3a3a5a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#5a5a8a', '#3a3a5a', null, null, null, null,
    null, null, '#3a3a5a', '#3a3a5a', '#5a5a8a', '#5a5a8a', null, null, '#5a5a8a', '#5a5a8a', '#3a3a5a', '#3a3a5a', null, null, null, null,
    null, null, null, '#3a3a5a', '#3a3a5a', null, null, null, null, '#3a3a5a', '#3a3a5a', null, null, null, null, null,
    null, null, null, '#1a1a3a', '#1a1a3a', null, null, null, null, '#1a1a3a', '#1a1a3a', null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
  ],
};

const MONSTER_OPTIONS = Object.keys(PIXEL_MONSTERS);
const MONSTER_LABELS: Record<string, string> = {
  slime: '史莱姆',
  goblin: '哥布林',
  skeleton: '骷髅',
  wolf: '狼',
  bear: '熊',
  fire_elemental: '火元素',
  dragon_whelp: '幼龙',
  void_walker: '虚空行者',
};

const MAP_KEYS = ['plains', 'forest', 'cave', 'volcano', 'ruins', 'void'];
const MAP_LABELS: Record<string, string> = { plains: '翡翠平原', forest: '迷雾森林', cave: '水晶洞穴', volcano: '烈焰火山', ruins: '远古遗迹', void: '虚空裂隙' };

// 像素头像组件
function PixelAvatar({ monsterKey, enemyKey, size = 40 }: { monsterKey?: string; enemyKey?: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 根据敌人 key 推断 monsterKey
  const inferMonsterKey = (key: string): string => {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('slime')) return 'slime';
    if (lowerKey.includes('goblin')) return 'goblin';
    if (lowerKey.includes('skeleton') || lowerKey.includes('skull')) return 'skeleton';
    if (lowerKey.includes('wolf')) return 'wolf';
    if (lowerKey.includes('bear')) return 'bear';
    if (lowerKey.includes('fire') || lowerKey.includes('elemental')) return 'fire_elemental';
    if (lowerKey.includes('dragon')) return 'dragon_whelp';
    if (lowerKey.includes('void') || lowerKey.includes('shadow')) return 'void_walker';
    return 'slime';
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 优先使用提供的 monsterKey，如果没有则根据 enemyKey 推断
    let effectiveMonsterKey = monsterKey;
    if (!effectiveMonsterKey && enemyKey) {
      effectiveMonsterKey = inferMonsterKey(enemyKey);
    }
    const pixels = effectiveMonsterKey && PIXEL_MONSTERS[effectiveMonsterKey] ? PIXEL_MONSTERS[effectiveMonsterKey] : PIXEL_MONSTERS.slime;
    const pixelWidth = size / 16;
    const pixelHeight = size / 16;

    for (let i = 0; i < pixels.length; i++) {
      const color = pixels[i];
      if (color) {
        const px = (i % 16) * pixelWidth;
        const py = Math.floor(i / 16) * pixelHeight;
        ctx.fillStyle = color;
        ctx.fillRect(Math.floor(px), Math.floor(py), Math.ceil(pixelWidth), Math.ceil(pixelHeight));
      }
    }
  }, [monsterKey, enemyKey, size]);

  return <canvas ref={canvasRef} width={size} height={size} />;
}

export default function EnemiesAdmin() {
  const [enemies, setEnemies] = useState<EnemyTemplate[]>([]);
  const [editing, setEditing] = useState<EnemyTemplate | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [filterMap, setFilterMap] = useState('');

  useEffect(() => { loadEnemies(); }, []);

  async function loadEnemies() {
    const res = await fetch('/api/admin/config?action=enemies');
    const data = await res.json();
    const loadedEnemies = data.enemies || [];

    // 检查是否有敌人缺失 monsterKey，如果有，自动补充并保存
    const enemiesToFix = loadedEnemies.filter((e: EnemyTemplate) => !e.monsterKey);
    if (enemiesToFix.length > 0) {
      console.log(`发现 ${enemiesToFix.length} 个敌人缺少 monsterKey，正在修复...`);
      const fixedEnemies = loadedEnemies.map((e: EnemyTemplate) => ({
        ...e,
        monsterKey: e.monsterKey || inferMonsterKeyForSave(e.key)
      }));

      // 保存修复后的数据
      await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_enemies', enemies: fixedEnemies }),
      });

      setEnemies(fixedEnemies);
    } else {
      setEnemies(loadedEnemies);
    }
  }

  // 自动推断 monsterKey
  const inferMonsterKeyForSave = (enemyKey: string): string => {
    const key = enemyKey.toLowerCase();
    if (key.includes('slime')) return 'slime';
    if (key.includes('goblin')) return 'goblin';
    if (key.includes('skeleton') || key.includes('skull')) return 'skeleton';
    if (key.includes('wolf')) return 'wolf';
    if (key.includes('bear')) return 'bear';
    if (key.includes('fire') || key.includes('elemental')) return 'fire_elemental';
    if (key.includes('dragon')) return 'dragon_whelp';
    if (key.includes('void') || key.includes('shadow')) return 'void_walker';
    return 'slime';
  };

  async function saveEnemy(enemy: EnemyTemplate) {
    // 确保 enemy 有 monsterKey
    const enemyToSave = {
      ...enemy,
      monsterKey: enemy.monsterKey || inferMonsterKeyForSave(enemy.key)
    };

    const isNew = !enemies.find(e => e.key === enemy.key);
    const updated = isNew
      ? [...enemies, enemyToSave]
      : enemies.map(e => e.key === enemy.key ? enemyToSave : e);

    await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_enemies', enemies: updated }),
    });
    loadEnemies();
    setEditing(null);
    setShowNew(false);
  }

  async function deleteEnemy(key: string) {
    if (!confirm('确定删除？')) return;
    const updated = enemies.filter(e => e.key !== key);
    await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save_enemies', enemies: updated }),
    });
    loadEnemies();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">怪物管理</h2>
        <button
          onClick={() => setShowNew(true)}
          className="px-3 py-1.5 bg-accent-blue text-white rounded text-sm"
        >
          新增怪物
        </button>
      </div>

      {/* 筛选 */}
      <div className="flex gap-2 mb-3 flex-wrap">
        <button onClick={() => setFilterMap('')}
          className={`px-2 py-0.5 text-xs rounded ${!filterMap ? 'bg-accent-blue text-white' : 'bg-bg-tertiary text-text-secondary'}`}>
          全部 ({enemies.length})
        </button>
        {MAP_KEYS.map(m => (
          <button key={m} onClick={() => setFilterMap(m)}
            className={`px-2 py-0.5 text-xs rounded ${filterMap === m ? 'bg-accent-blue text-white' : 'bg-bg-tertiary text-text-secondary'}`}>
            {MAP_LABELS[m]} ({enemies.filter(e => e.mapKey === m).length})
          </button>
        ))}
      </div>

      <div className="bg-bg-secondary border border-border-primary rounded-lg overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="border-b border-border-primary text-text-muted">
              <th className="px-3 py-2 text-left">图像</th>
              <th className="px-3 py-2 text-left">Key</th>
              <th className="px-3 py-2 text-left">名称</th>
              <th className="px-3 py-2 text-left">地图</th>
              <th className="px-3 py-2 text-left">血量</th>
              <th className="px-3 py-2 text-left">力量</th>
              <th className="px-3 py-2 text-left">智力</th>
              <th className="px-3 py-2 text-left">敏捷</th>
              <th className="px-3 py-2 text-left">体力</th>
              <th className="px-3 py-2 text-left">金币</th>
              <th className="px-3 py-2 text-left">经验</th>
              <th className="px-3 py-2 text-left">操作</th>
            </tr>
          </thead>
          <tbody>
            {enemies.filter(e => !filterMap || e.mapKey === filterMap).map(enemy => (
              <tr key={enemy.key} className="border-b border-border-secondary hover:bg-bg-hover">
                <td className="px-3 py-2">
                  <div className="w-10 h-10 rounded flex items-center justify-center bg-bg-tertiary">
                    <PixelAvatar monsterKey={enemy.monsterKey} enemyKey={enemy.key} size={36} />
                  </div>
                </td>
                <td className="px-3 py-2 text-text-muted font-mono text-xs">{enemy.key}</td>
                <td className="px-3 py-2 font-medium">{enemy.name}</td>
                <td className="px-3 py-2 text-text-secondary">{MAP_LABELS[enemy.mapKey] || enemy.mapKey}</td>
                <td className="px-3 py-2">{enemy.baseHealth}</td>
                <td className="px-3 py-2 text-accent-red">{enemy.statWeights.strength}</td>
                <td className="px-3 py-2 text-accent-blue">{enemy.statWeights.intelligence}</td>
                <td className="px-3 py-2 text-accent-green">{enemy.statWeights.agility}</td>
                <td className="px-3 py-2 text-accent-orange">{enemy.statWeights.vitality}</td>
                <td className="px-3 py-2 text-accent-orange">{enemy.goldDrop}</td>
                <td className="px-3 py-2 text-accent-blue">{enemy.expDrop}</td>
                <td className="px-3 py-2">
                  <button onClick={() => setEditing(enemy)} className="text-accent-blue text-xs mr-2">编辑</button>
                  <button onClick={() => deleteEnemy(enemy.key)} className="text-accent-red text-xs">删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(editing || showNew) && (
        <EnemyEditor
          enemy={editing}
          onSave={saveEnemy}
          onClose={() => { setEditing(null); setShowNew(false); }}
        />
      )}
    </div>
  );
}

function EnemyEditor({ enemy, onSave, onClose }: { enemy: EnemyTemplate | null; onSave: (e: EnemyTemplate) => void; onClose: () => void }) {
  // 自动推断默认 monsterKey
  const inferMonsterKey = (enemyKey: string): string => {
    const key = enemyKey.toLowerCase();
    if (key.includes('slime')) return 'slime';
    if (key.includes('goblin')) return 'goblin';
    if (key.includes('skeleton') || key.includes('skull')) return 'skeleton';
    if (key.includes('wolf')) return 'wolf';
    if (key.includes('bear')) return 'bear';
    if (key.includes('fire') || key.includes('flame') || key.includes('elemental')) return 'fire_elemental';
    if (key.includes('dragon') || key.includes('dragon')) return 'dragon_whelp';
    if (key.includes('void') || key.includes('shadow')) return 'void_walker';
    return 'slime';
  };

  const [form, setForm] = useState({
    key: enemy?.key || '',
    name: enemy?.name || '',
    mapKey: enemy?.mapKey || 'plains',
    baseHealth: enemy?.baseHealth || 50,
    strength: enemy?.statWeights.strength || 1,
    intelligence: enemy?.statWeights.intelligence || 1,
    agility: enemy?.statWeights.agility || 1,
    vitality: enemy?.statWeights.vitality || 1,
    goldDrop: enemy?.goldDrop || 5,
    expDrop: enemy?.expDrop || 5,
    fixedSkillKeysStr: (enemy?.fixedSkillKeys || ['slash']).join(','),
    attackCap: enemy?.skillCaps.attack || 2,
    spellCap: enemy?.skillCaps.spell || 0,
    guardCap: enemy?.skillCaps.guard || 0,
    monsterKey: enemy?.monsterKey || '',
  });

  const effectiveMonsterKey = form.monsterKey || inferMonsterKey(form.key);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-secondary border border-border-primary rounded-lg p-4 max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto">
        <h3 className="text-lg font-bold mb-4">{enemy ? '编辑怪物' : '新增怪物'}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <Field label="Key" value={form.key} onChange={v => {
              const newMonsterKey = form.monsterKey || inferMonsterKey(v);
              setForm({ ...form, key: v, monsterKey: form.monsterKey || newMonsterKey });
            }} disabled={!!enemy} />
            <Field label="名称" value={form.name} onChange={v => setForm({ ...form, name: v })} />
            <SelectField label="地图" value={form.mapKey} options={MAP_KEYS} labels={MAP_LABELS} onChange={v => setForm({ ...form, mapKey: v })} />
            <SelectField
              label="怪物图像"
              value={form.monsterKey || ''}
              options={MONSTER_OPTIONS}
              labels={MONSTER_LABELS}
              includeEmpty={true}
              onChange={v => setForm({ ...form, monsterKey: v || undefined })}
            />
            <Field label="基础血量" type="number" value={String(form.baseHealth)} onChange={v => setForm({ ...form, baseHealth: Number(v) })} />

            <div className="grid grid-cols-2 gap-2">
              <Field label="力量权重" type="number" value={String(form.strength)} onChange={v => setForm({ ...form, strength: Number(v) })} />
              <Field label="智力权重" type="number" value={String(form.intelligence)} onChange={v => setForm({ ...form, intelligence: Number(v) })} />
              <Field label="敏捷权重" type="number" value={String(form.agility)} onChange={v => setForm({ ...form, agility: Number(v) })} />
              <Field label="体力权重" type="number" value={String(form.vitality)} onChange={v => setForm({ ...form, vitality: Number(v) })} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Field label="金币掉落" type="number" value={String(form.goldDrop)} onChange={v => setForm({ ...form, goldDrop: Number(v) })} />
              <Field label="经验掉落" type="number" value={String(form.expDrop)} onChange={v => setForm({ ...form, expDrop: Number(v) })} />
            </div>

            <Field label="技能 (逗号分隔)" value={form.fixedSkillKeysStr} onChange={v => setForm({ ...form, fixedSkillKeysStr: v })} />

            <div className="grid grid-cols-3 gap-2">
              <Field label="攻击上限" type="number" value={String(form.attackCap)} onChange={v => setForm({ ...form, attackCap: Number(v) })} />
              <Field label="法术上限" type="number" value={String(form.spellCap)} onChange={v => setForm({ ...form, spellCap: Number(v) })} />
              <Field label="防御上限" type="number" value={String(form.guardCap)} onChange={v => setForm({ ...form, guardCap: Number(v) })} />
            </div>
          </div>

          <div className="flex flex-col items-center justify-start pt-2">
            <div className="text-xs text-text-muted mb-2">图像预览</div>
            <div className="w-24 h-24 rounded-lg bg-bg-tertiary flex items-center justify-center border border-border-primary">
              <PixelAvatar monsterKey={effectiveMonsterKey} size={80} />
            </div>
            <div className="text-sm text-text-primary mt-2 font-medium">
              {MONSTER_LABELS[effectiveMonsterKey] || '史莱姆'}
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {MONSTER_OPTIONS.map(mKey => (
                <button
                  key={mKey}
                  onClick={() => setForm({ ...form, monsterKey: mKey })}
                  className={`w-10 h-10 rounded flex items-center justify-center border-2 transition-all ${
                    effectiveMonsterKey === mKey
                      ? 'border-accent-blue bg-accent-blue/10'
                      : 'border-border-primary hover:border-border-secondary bg-bg-tertiary'
                  }`}
                  title={MONSTER_LABELS[mKey]}
                >
                  <PixelAvatar monsterKey={mKey} size={32} />
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-1.5 bg-bg-tertiary text-text-secondary rounded text-sm">取消</button>
          <button
            onClick={() => {
              onSave({
                key: form.key,
                name: form.name,
                mapKey: form.mapKey,
                baseHealth: form.baseHealth,
                statWeights: { strength: form.strength, intelligence: form.intelligence, agility: form.agility, vitality: form.vitality },
                fixedSkillKeys: form.fixedSkillKeysStr.split(',').map(s => s.trim()).filter(Boolean),
                skillCaps: { attack: form.attackCap, spell: form.spellCap, guard: form.guardCap },
                goldDrop: form.goldDrop,
                expDrop: form.expDrop,
                monsterKey: form.monsterKey || inferMonsterKey(form.key),
              });
            }}
            className="flex-1 py-1.5 bg-accent-blue text-white rounded text-sm"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', disabled = false }: { label: string; value: string; onChange: (v: string) => void; type?: string; disabled?: boolean }) {
  return (
    <div>
      <label className="text-xs text-text-muted block mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-2 py-1 text-sm bg-bg-tertiary border border-border-primary rounded text-text-primary disabled:opacity-50"
      />
    </div>
  );
}

function SelectField({ label, value, options, labels, includeEmpty = false, onChange }: { label: string; value: string; options: string[]; labels?: Record<string, string>; includeEmpty?: boolean; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-text-muted block mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-2 py-1 text-sm bg-bg-tertiary border border-border-primary rounded text-text-primary"
      >
        {includeEmpty && <option value="">自动推断</option>}
        {options.map(o => <option key={o} value={o}>{labels?.[o] || o || '(空)'}</option>)}
      </select>
    </div>
  );
}
