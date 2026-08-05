/**
 * 层固定 Boss：1～10 循环十种主题 Boss；逢 5 / 逢 10 额外放大。
 * 旧「关口守护者」(boss) 仅作回退。
 */

export const BOSS_CYCLE = [
  "boss_sun",
  "boss_sand",
  "boss_tide",
  "boss_harbor",
  "boss_mist",
  "boss_reef",
  "boss_dual",
  "boss_ruin",
  "boss_saw",
  "boss_claw",
];

/** 该层固定 Boss kind */
export function bossKindForFloor(floor) {
  const f = Math.max(1, Math.floor(floor || 1));
  return BOSS_CYCLE[(f - 1) % BOSS_CYCLE.length];
}

/** 逢 5 / 逢 10 在层 scale 之外再抬一点 */
export function bossMilestoneMult(floor) {
  const f = Math.max(1, Math.floor(floor || 1));
  if (f % 10 === 0) return 1.14;
  if (f % 5 === 0) return 1.07;
  return 1;
}

export function isBossKind(kind) {
  if (!kind) return false;
  return kind === "boss" || String(kind).startsWith("boss_");
}
