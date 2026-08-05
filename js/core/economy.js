/**
 * 经济倍率（获取侧；花费不改）
 * - 经验：原先的 50%
 * - 金币（战斗掉落、装备售卖等）：原先的 10%
 */

export const EXP_GAIN_MULT = 0.5;
export const GOLD_GAIN_MULT = 0.1;

export function scaleExpGain(amount) {
  return Math.max(0, Math.floor((Number(amount) || 0) * EXP_GAIN_MULT));
}

export function scaleGoldGain(amount) {
  return Math.max(0, Math.floor((Number(amount) || 0) * GOLD_GAIN_MULT));
}
