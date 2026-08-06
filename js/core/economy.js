/**
 * 经济倍率（获取侧；花费不改）
 * - 经验：按「1～50 层怪物全清一遍、上场 5 人约到 50 级」标定
 * - 金币（装备售卖等）：原先的 10%
 * - 怪物战斗掉落金币：原先的 15%（相对售卖倍率再 +50%）
 */

export const EXP_GAIN_MULT = 0.92;
export const GOLD_GAIN_MULT = 0.1;
/** 怪物击杀掉落专用；相对 GOLD_GAIN_MULT 提升 50% */
export const MONSTER_GOLD_GAIN_MULT = 0.15;

export function scaleExpGain(amount) {
  const n = Number(amount) || 0;
  if (n <= 0) return 0;
  // 正数至少给 1，避免早期 raw=1 时 ×倍率取整变 0
  return Math.max(1, Math.floor(n * EXP_GAIN_MULT));
}

export function scaleGoldGain(amount) {
  return Math.max(0, Math.floor((Number(amount) || 0) * GOLD_GAIN_MULT));
}

export function scaleMonsterGoldGain(amount) {
  return Math.max(0, Math.floor((Number(amount) || 0) * MONSTER_GOLD_GAIN_MULT));
}
