/**
 * 力 / 智 / 敏 → 战斗属性换算
 *
 * 力：生命、防御、普攻底盘
 * 智：技能强度、治疗、蓝量、少量生命
 * 敏：速度、暴击、少量普攻
 *
 * 装备主属性叠在 convert 之前；附属词条（暴击/命中/闪避）仍叠在换算之后
 */

export const PRIMARY_KEYS = ["str", "int", "agi"];

export const PRIMARY_LABEL = {
  str: "力",
  int: "智",
  agi: "敏",
};

/** 换算系数（调这一张表就能牵全体平衡） */
export const PRIMARY_CONVERT = {
  hpBase: 18,
  strHp: 3.6,
  intHp: 1.4,
  strAtk: 0.35,
  agiAtk: 0.4,
  strDef: 0.5,
  intDef: 0.06,
  spdBase: 11,
  agiSpd: 0.42,
  agiCrit: 0.0022,
  intSkill: 0.88,
  strSkill: 0.18,
  mpBase: 50,
  intMp: 2.4,
};

export function blankPrimary(n = 0) {
  return { str: n, int: n, agi: n };
}

export function readPrimary(obj) {
  if (!obj || typeof obj !== "object") return blankPrimary(0);
  return {
    str: Math.max(0, Math.floor(Number(obj.str) || 0)),
    int: Math.max(0, Math.floor(Number(obj.int) || 0)),
    agi: Math.max(0, Math.floor(Number(obj.agi) || 0)),
  };
}

export function addPrimary(a, b) {
  const x = readPrimary(a);
  const y = readPrimary(b);
  return {
    str: x.str + y.str,
    int: x.int + y.int,
    agi: x.agi + y.agi,
  };
}

/** 三维 → 战斗属性（未加装备） */
export function convertPrimary(str, int, agi) {
  const c = PRIMARY_CONVERT;
  const S = Math.max(0, Number(str) || 0);
  const I = Math.max(0, Number(int) || 0);
  const A = Math.max(0, Number(agi) || 0);
  return {
    maxHp: Math.max(1, Math.floor(c.hpBase + S * c.strHp + I * c.intHp)),
    atk: Math.max(1, Math.floor(S * c.strAtk + A * c.agiAtk)),
    def: Math.max(0, Math.floor(S * c.strDef + I * c.intDef)),
    spd: Math.max(1, Math.floor(c.spdBase + A * c.agiSpd)),
    skillAtk: Math.max(1, Math.floor(I * c.intSkill + S * c.strSkill)),
    maxMp: Math.max(40, Math.floor(c.mpBase + I * c.intMp)),
    critRate: A * c.agiCrit,
  };
}

export function formatPrimaryLine(p) {
  const x = readPrimary(p);
  const parts = [];
  if (x.str) parts.push(`力+${x.str}`);
  if (x.int) parts.push(`智+${x.int}`);
  if (x.agi) parts.push(`敏+${x.agi}`);
  return parts.join(" ") || "—";
}
