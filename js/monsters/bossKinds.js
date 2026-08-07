/**
 * Boss 种类：
 * - 逢 5 / 逢 10：特殊 Boss（主题不同；10 比 5 更强）
 * - 其余关口：普通 Boss
 *   · 1～10：统一「关口守护者」
 *   · 11～20：用第 5 层特殊 Boss 外形，数值随层抬高
 *   · 21～30：用第 15 层特殊 Boss 外形
 *   · 类推：第 d 旬普通 Boss = 第 (10*(d-1)-5) 层特殊 Boss
 */

/** 普通关口（非 5/10）用的基础 Boss */
export const ORDINARY_BOSS_KIND = "boss";

/**
 * 特殊 Boss 序列：对应第 5、10、15、20… 层
 * （下标 0 = 5 层，1 = 10 层，…）
 */
export const SPECIAL_BOSS_CYCLE = [
  "boss_mist", // 5
  "boss_claw", // 10
  "boss_tide", // 15
  "boss_ruin", // 20
  "boss_saw", // 25
  "boss_dual", // 30
  "boss_reef", // 35
  "boss_sand", // 40
  "boss_harbor", // 45
  "boss_sun", // 50
];

/** @deprecated 兼容旧引用；请用 SPECIAL_BOSS_CYCLE / bossKindForFloor */
export const BOSS_CYCLE = SPECIAL_BOSS_CYCLE;

export function isSpecialBossFloor(floor) {
  const f = Math.max(1, Math.floor(floor || 1));
  return f % 5 === 0;
}

/** 逢 10 的特殊 Boss（比逢 5 更强） */
export function isDecadeBossFloor(floor) {
  const f = Math.max(1, Math.floor(floor || 1));
  return f % 10 === 0;
}

export function decadeOfFloor(floor) {
  return Math.ceil(Math.max(1, Math.floor(floor || 1)) / 10);
}

/** 特殊层（5/10/15…）对应的主题 kind */
export function specialBossKindForFloor(floor) {
  const f = Math.max(5, Math.floor(floor || 5));
  const milestone = Math.floor(f / 5) * 5;
  const idx = Math.floor(milestone / 5) - 1;
  const n = SPECIAL_BOSS_CYCLE.length;
  return SPECIAL_BOSS_CYCLE[((idx % n) + n) % n];
}

/** 普通关口 Boss 的主题 kind（数值仍按本层 scale） */
export function ordinaryBossKindForFloor(floor) {
  const d = decadeOfFloor(floor);
  if (d <= 1) return ORDINARY_BOSS_KIND;
  // 11～20 → 5；21～30 → 15；31～40 → 25…
  const templateFloor = 10 * (d - 1) - 5;
  return specialBossKindForFloor(templateFloor);
}

/** 该层固定 Boss kind */
export function bossKindForFloor(floor) {
  const f = Math.max(1, Math.floor(floor || 1));
  if (isSpecialBossFloor(f)) return specialBossKindForFloor(f);
  return ordinaryBossKindForFloor(f);
}

/** 面板属性：特殊 Boss 额外抬高；逢 10 明显高于逢 5 */
export function bossMilestoneMult(floor) {
  const f = Math.max(1, Math.floor(floor || 1));
  if (f % 10 === 0) return 1.22;
  if (f % 5 === 0) return 1.1;
  return 1;
}

/** 技能伤害：普通 1；逢 5 ×1.18；逢 10 ×1.38 */
export function bossSkillPowerMult(floor) {
  const f = Math.max(1, Math.floor(floor || 1));
  if (f % 10 === 0) return 1.38;
  if (f % 5 === 0) return 1.18;
  return 1;
}

/** 控制效果强度：逢 10 明显强于逢 5 */
export function bossControlEffectMult(floor) {
  const f = Math.max(1, Math.floor(floor || 1));
  if (f % 10 === 0) return 1.35;
  if (f % 5 === 0) return 1.12;
  return 1;
}

export function isBossKind(kind) {
  if (!kind) return false;
  return kind === "boss" || String(kind).startsWith("boss_");
}
