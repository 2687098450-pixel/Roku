/**
 * 怪物技能（小怪强度弱于 Boss；后期种类技能倍率更高）
 *
 * 玩家可见文案只写范围 / 控制 / 持续类型，不写伤害公式。
 * 范围：单体 | 前排 | 全体 | 目标十字 | 目标一行 | 目标一列
 * 持续伤害两种：
 * - onAct：目标行动时跳一次（常用）
 * - pulse：每走 10 行动点跳一次（少用，单跳有倍率上限）
 */

import {
  bossSkillPowerMult,
  isSpecialBossFloor,
  isDecadeBossFloor,
} from "./bossKinds.js?v=159";

/** 脉动 DoT：每走多少行动点跳一次 */
export const PULSE_DOT_INTERVAL = 10;
/** 脉动单跳相对施法者攻击力的硬顶（防超模） */
export const PULSE_DOT_TICK_CAP_MULT = 0.12;
/** 脉动 DoT 最长行动条（约 ≤4 跳） */
export const PULSE_DOT_MAX_GAUGE = 40;

export const MONSTER_SKILLS = {
  // —— 史莱姆 ——
  gnaw: {
    id: "gnaw",
    name: "啃咬",
    style: "melee",
    mult: 1,
    flat: 0,
    weight: 1,
  },
  // —— 吸血蝠 ——
  fang: {
    id: "fang",
    name: "利齿",
    style: "melee",
    mult: 1.05,
    flat: 0,
    weight: 0.55,
  },
  sonic: {
    id: "sonic",
    name: "尖啸",
    style: "ranged",
    mult: 0.55,
    flat: 0,
    hitAll: true,
    weight: 0.45,
  },
  // —— 哥布林 ——
  stab: {
    id: "stab",
    name: "刺击",
    style: "melee",
    mult: 1.1,
    flat: 1,
    weight: 0.55,
  },
  throw_rock: {
    id: "throw_rock",
    name: "投石",
    style: "ranged",
    mult: 0.85,
    flat: 0,
    weight: 0.45,
  },
  // —— 毒菇 ——
  spore: {
    id: "spore",
    name: "孢子",
    style: "ranged",
    mult: 0.7,
    flat: 0,
    weight: 0.5,
    // 行动时持续伤害（常用型）
    dot: { type: "onAct", mult: 0.18, flat: 0, gauge: 50 },
  },
  puff: {
    id: "puff",
    name: "毒雾",
    style: "ranged",
    mult: 0.5,
    flat: 0,
    hitFront: true,
    weight: 0.5,
  },
  // —— 石傀儡 ——
  smash: {
    id: "smash",
    name: "砸击",
    style: "melee",
    mult: 1.25,
    flat: 2,
    weight: 0.65,
  },
  quake: {
    id: "quake",
    name: "震地",
    style: "melee",
    mult: 0.55,
    flat: 0,
    hitCross: true,
    weight: 0.35,
  },
  // —— 幽光萤 ——
  bolt: {
    id: "bolt",
    name: "光矢",
    style: "ranged",
    mult: 1.05,
    flat: 1,
    weight: 0.6,
  },
  flare: {
    id: "flare",
    name: "闪爆",
    style: "ranged",
    mult: 0.45,
    flat: 0,
    hitAll: true,
    weight: 0.4,
  },
  // —— 枯骨兵 ——
  bone_slash: {
    id: "bone_slash",
    name: "骨斩",
    style: "melee",
    mult: 1.15,
    flat: 2,
    weight: 0.6,
  },
  bone_toss: {
    id: "bone_toss",
    name: "抛骨",
    style: "ranged",
    mult: 0.9,
    flat: 1,
    weight: 0.4,
  },
  // —— 毒囊蛛 ——
  venom_bite: {
    id: "venom_bite",
    name: "毒咬",
    style: "melee",
    mult: 0.95,
    flat: 1,
    weight: 0.55,
    // 行动时持续伤害
    dot: { type: "onAct", mult: 0.22, flat: 1, gauge: 50 },
  },
  web_spray: {
    id: "web_spray",
    name: "蛛网",
    style: "ranged",
    mult: 0.4,
    flat: 0,
    hitFront: true,
    weight: 0.45,
    // 脉动持续：少用；单跳受 PULSE_DOT_TICK_CAP_MULT 限制
    dot: { type: "pulse", mult: 0.1, flat: 0, gauge: 40, interval: PULSE_DOT_INTERVAL },
  },
  // —— 暗影狼 ——
  rend: {
    id: "rend",
    name: "撕扯",
    style: "melee",
    mult: 1.25,
    flat: 3,
    weight: 0.6,
  },
  howl: {
    id: "howl",
    name: "嚎叫",
    style: "ranged",
    mult: 0.5,
    flat: 0,
    hitAll: true,
    weight: 0.4,
  },
  // —— 血羽妖 ——
  talon: {
    id: "talon",
    name: "利爪",
    style: "melee",
    mult: 1.2,
    flat: 3,
    weight: 0.55,
  },
  wind_slash: {
    id: "wind_slash",
    name: "风刃",
    style: "ranged",
    mult: 0.7,
    flat: 1,
    hitRow: true,
    weight: 0.45,
  },
  // —— 堕落骑士 ——
  cleave: {
    id: "cleave",
    name: "劈砍",
    style: "melee",
    mult: 1.35,
    flat: 4,
    weight: 0.6,
  },
  shield_bash: {
    id: "shield_bash",
    name: "盾击",
    style: "melee",
    mult: 0.7,
    flat: 2,
    hitFront: true,
    weight: 0.4,
  },
  // —— 咒术师 ——
  hex_bolt: {
    id: "hex_bolt",
    name: "咒矢",
    style: "ranged",
    mult: 1.25,
    flat: 4,
    weight: 0.55,
  },
  dark_nova: {
    id: "dark_nova",
    name: "暗爆",
    style: "ranged",
    mult: 0.55,
    flat: 1,
    hitAll: true,
    weight: 0.45,
  },
  // —— 食人魔 ——
  club_smash: {
    id: "club_smash",
    name: "巨锤",
    style: "melee",
    mult: 1.45,
    flat: 6,
    weight: 0.65,
  },
  stomp: {
    id: "stomp",
    name: "践踏",
    style: "melee",
    mult: 0.65,
    flat: 2,
    hitCross: true,
    weight: 0.35,
  },
  // —— 影魔 ——
  shadow_pierce: {
    id: "shadow_pierce",
    name: "影刺",
    style: "melee",
    mult: 1.35,
    flat: 5,
    weight: 0.55,
  },
  fade_strike: {
    id: "fade_strike",
    name: "虚闪",
    style: "ranged",
    mult: 1.05,
    flat: 3,
    weight: 0.45,
  },
  // —— 霜噬灵 ——
  ice_lance: {
    id: "ice_lance",
    name: "冰枪",
    style: "ranged",
    mult: 0.8,
    flat: 2,
    hitCol: true,
    weight: 0.55,
  },
  blizzard: {
    id: "blizzard",
    name: "暴雪",
    style: "ranged",
    mult: 0.6,
    flat: 2,
    hitAll: true,
    weight: 0.45,
  },
  // —— 深渊魔 ——
  hellfire: {
    id: "hellfire",
    name: "狱火",
    style: "ranged",
    mult: 1.35,
    flat: 6,
    weight: 0.5,
  },
  demon_claw: {
    id: "demon_claw",
    name: "魔爪",
    style: "melee",
    mult: 1.4,
    flat: 6,
    weight: 0.5,
  },
  // —— 幼龙 ——
  dragon_breath: {
    id: "dragon_breath",
    name: "龙息",
    style: "ranged",
    mult: 0.75,
    flat: 4,
    hitFront: true,
    weight: 0.45,
  },
  tail_swipe: {
    id: "tail_swipe",
    name: "甩尾",
    style: "melee",
    mult: 1.5,
    flat: 8,
    weight: 0.55,
  },
  // —— Boss（更强；高层追加）——
  crush: {
    id: "crush",
    name: "重砸",
    style: "melee",
    mult: 1.35,
    flat: 4,
    weight: 0.4,
    apply: { stun: true },
  },
  quake_roar: {
    id: "quake_roar",
    name: "地裂咆哮",
    style: "melee",
    mult: 0.85,
    flat: 2,
    hitFront: true,
    weight: 0.35,
    apply: { slow: 0.3 },
  },
  soul_drain: {
    id: "soul_drain",
    name: "吸魂",
    style: "ranged",
    mult: 1.1,
    flat: 2,
    weight: 0.25,
    apply: { healCut: 0.35 },
  },
  boss_cleave: {
    id: "boss_cleave",
    name: "裂空斩",
    style: "melee",
    mult: 1.5,
    flat: 8,
    weight: 0.3,
  },
  boss_meteor: {
    id: "boss_meteor",
    name: "陨星",
    style: "ranged",
    mult: 0.7,
    flat: 4,
    hitAll: true,
    weight: 0.28,
  },
  boss_void: {
    id: "boss_void",
    name: "虚空撕扯",
    style: "ranged",
    mult: 1.4,
    flat: 10,
    weight: 0.26,
  },
  boss_apocalypse: {
    id: "boss_apocalypse",
    name: "终焉审判",
    style: "melee",
    mult: 1.65,
    flat: 14,
    hitFront: true,
    weight: 0.22,
  },

  // —— 控制类（随层解锁挂到小怪 / Boss）——
  slow_strike: {
    id: "slow_strike",
    name: "绊击",
    style: "melee",
    mult: 0.9,
    flat: 0,
    weight: 0.4,
    apply: { slow: 0.25 },
  },
  healcut_spit: {
    id: "healcut_spit",
    name: "蚀疗",
    style: "ranged",
    mult: 0.75,
    flat: 1,
    weight: 0.35,
    apply: { healCut: 0.4 },
  },
  mute_hex: {
    id: "mute_hex",
    name: "禁咒",
    style: "ranged",
    mult: 0.65,
    flat: 0,
    weight: 0.3,
    apply: { silence: true },
  },
  bash_stun: {
    id: "bash_stun",
    name: "晕击",
    style: "melee",
    mult: 0.85,
    flat: 2,
    weight: 0.28,
    apply: { stun: true },
  },
  boss_slow: {
    id: "boss_slow",
    name: "重压迟滞",
    style: "melee",
    mult: 1.05,
    flat: 4,
    hitFront: true,
    weight: 0.28,
    apply: { slow: 0.35 },
  },
  boss_mass_slow: {
    id: "boss_mass_slow",
    name: "愚人重压",
    style: "ranged",
    mult: 0.75,
    flat: 3,
    hitAll: true,
    weight: 0.5,
    apply: { slow: 0.4 },
  },
  boss_silence: {
    id: "boss_silence",
    name: "封印之吼",
    style: "ranged",
    mult: 0.8,
    flat: 3,
    hitAll: true,
    weight: 0.24,
    apply: { silence: true },
  },
  boss_healcut: {
    id: "boss_healcut",
    name: "血咒",
    style: "ranged",
    mult: 1.0,
    flat: 5,
    weight: 0.26,
    apply: { healCut: 0.5 },
  },
};

/** 小怪按层解锁的控制技能（程度越深层数越高） */
export function trashControlSkillIdsForFloor(floor) {
  const f = Math.max(1, floor || 1);
  const ids = [];
  if (f >= 6) ids.push("slow_strike");
  if (f >= 10) ids.push("healcut_spit");
  if (f >= 14) ids.push("mute_hex");
  if (f >= 18) ids.push("bash_stun");
  return ids;
}

export const TYPE_SKILL_IDS = {
  slime: ["gnaw"],
  bat: ["fang", "sonic"],
  goblin: ["stab", "throw_rock"],
  mushroom: ["spore", "puff"],
  golem: ["smash", "quake"],
  wisp: ["bolt", "flare"],
  skeleton: ["bone_slash", "bone_toss"],
  spider: ["venom_bite", "web_spray"],
  wolf: ["rend", "howl"],
  harpy: ["talon", "wind_slash"],
  knight: ["cleave", "shield_bash"],
  mage: ["hex_bolt", "dark_nova"],
  ogre: ["club_smash", "stomp"],
  shadow: ["shadow_pierce", "fade_strike"],
  frost: ["ice_lance", "blizzard"],
  demon: ["hellfire", "demon_claw"],
  dragon: ["dragon_breath", "tail_swipe"],
  boss: ["crush", "quake_roar", "soul_drain"],
  boss_sun: ["crush", "quake_roar", "soul_drain"],
  boss_sand: ["crush", "quake_roar", "shield_bash"],
  boss_tide: ["crush", "quake_roar", "soul_drain", "boss_slow"],
  boss_harbor: ["crush", "cleave", "shield_bash"],
  boss_mist: ["crush", "quake_roar", "spore", "boss_healcut"],
  boss_reef: ["crush", "soul_drain", "hex_bolt"],
  boss_dual: ["crush", "quake", "shield_bash"],
  boss_ruin: ["crush", "bone_slash", "soul_drain"],
  boss_saw: ["crush", "rend", "boss_cleave"],
  boss_claw: ["crush", "quake_roar", "soul_drain", "boss_meteor"],
  boss_fool: ["crush", "boss_mass_slow", "quake_roar", "soul_drain"],
};

/** Boss 技能组：普通关口一套弱技能；特殊层用主题技，逢 10 再加强 */
export function bossSkillIdsForFloor(floor, kind = null) {
  const f = Math.max(1, floor || 1);
  const k = kind || "boss";

  if (!isSpecialBossFloor(f)) {
    const ids = ["crush", "quake_roar", "soul_drain"];
    if (f >= 12) ids.push("boss_slow");
    if (f >= 22) ids.push("boss_healcut");
    return ids;
  }

  const themed = [...(TYPE_SKILL_IDS[k] || ["crush", "quake_roar", "soul_drain"])];
  const add = (id) => {
    if (!themed.includes(id)) themed.push(id);
  };

  if (isDecadeBossFloor(f)) {
    // 10 / 20 / 30…：群体控制 + 高伤技
    add("boss_silence");
    add("bash_stun");
    add("boss_cleave");
    add("boss_meteor");
    add("boss_healcut");
    if (f >= 30) add("boss_void");
    if (f >= 40) add("boss_apocalypse");
  } else {
    // 5 / 15 / 25…：中等威胁
    add("boss_slow");
    add("boss_healcut");
    if (f >= 15) add("boss_cleave");
    if (f >= 25) add("boss_meteor");
  }
  return themed;
}

/** @deprecated 用 bossSkillIdsForFloor(floor, kind) */
export function bossSkillIdsForKind(kind, floor) {
  return bossSkillIdsForFloor(floor, kind);
}

export function pickMonsterSkill(monster) {
  let ids = monster.skillIds || TYPE_SKILL_IDS[monster.kind] || ["gnaw"];
  // 禁魔：只能用单体基础技（无控制、无群体、无持续）
  if (monster.statuses?.silence && (monster.statuses.silence.remain || 0) > (monster.statuses.silence.bar || 0)) {
    ids = ids.filter((id) => {
      const sk = MONSTER_SKILLS[id];
      if (!sk) return false;
      if (monsterSkillIsAoe(sk) || sk.dot) return false;
      if (sk.apply && Object.keys(sk.apply).length) return false;
      return true;
    });
    if (!ids.length) ids = ["gnaw"];
    return MONSTER_SKILLS[ids[0]] || MONSTER_SKILLS.gnaw;
  }

  const turn = Math.max(0, Math.floor(monster.actCount || 0));
  monster.actCount = turn + 1;
  monster.controlCd = Math.max(0, Math.floor(monster.controlCd || 0));

  const controlIds = ids.filter((id) => {
    const sk = MONSTER_SKILLS[id];
    return sk?.apply && Object.keys(sk.apply).length > 0;
  });
  const basicIds = ids.filter((id) => !controlIds.includes(id));

  const floor = monster.combatFloor || monster.floor || 1;
  const wantControl =
    controlIds.length > 0 &&
    monster.controlCd <= 0 &&
    Math.random() < 0.8 &&
    (turn < 2 || Math.random() < 0.45);

  const pickWeighted = (list) => {
    const pool = list.map((id) => MONSTER_SKILLS[id]).filter(Boolean);
    if (!pool.length) return null;
    const total = pool.reduce((s, sk) => s + (sk.weight || 1), 0);
    let r = Math.random() * total;
    for (const sk of pool) {
      r -= sk.weight || 1;
      if (r <= 0) return sk;
    }
    return pool[pool.length - 1];
  };

  if (wantControl) {
    const sk = pickWeighted(controlIds);
    if (sk) {
      monster.controlCd = controlSkillCooldown(sk, floor);
      return sk;
    }
  }

  if (monster.controlCd > 0) monster.controlCd -= 1;
  const basic = pickWeighted(basicIds.length ? basicIds : ids);
  return basic || MONSTER_SKILLS.gnaw;
}

/** 控制技内置冷却：越强越长；层数升高略缩短 */
function controlSkillCooldown(sk, floor) {
  const apply = sk?.apply || {};
  let base = 2;
  if (apply.stun) base = 3;
  else if (apply.silence) base = 3;
  else if (apply.healCut != null) base = 2;
  else if (apply.slow != null) base = 2;
  const cut = Math.min(2, Math.floor((floor || 1) / 25));
  return Math.max(1, base - cut);
}

export function monsterSkillDamage(monster, skill) {
  const mult = skill.mult ?? 1;
  const flat = skill.flat ?? 0;
  let dmg = Math.max(1, Math.floor((monster.atk || 0) * mult) + flat);
  // 关口 Boss（逢 5 / 10）技能伤害额外抬高
  if (monster?.isBoss && !monster?.isHiddenBoss) {
    const f = monster.combatFloor || monster.floor || 1;
    const skillMult = bossSkillPowerMult(f);
    if (skillMult !== 1) dmg = Math.max(1, Math.floor(dmg * skillMult));
  }
  return dmg;
}

/** 是否群体 / 范围技 */
export function monsterSkillIsAoe(sk) {
  return !!(sk?.hitAll || sk?.hitFront || sk?.hitCross || sk?.hitRow || sk?.hitCol);
}

/** 范围文案（玩家可见） */
export function monsterSkillRangeLabel(sk, opts = {}) {
  if (!sk) return "单体";
  if (opts.flow) {
    if (sk.hitAll) return "半径2";
    if (sk.hitAllFront || sk.hitFront || sk.hitCross || sk.hitRow || sk.hitCol) {
      return "半径1";
    }
    if (sk.aoeRadius != null && sk.aoeRadius > 0) return `半径${sk.aoeRadius}`;
    return "单体";
  }
  if (sk.hitAll) return "全体";
  if (sk.hitFront) return "前排";
  if (sk.hitCross) return "目标十字";
  if (sk.hitRow) return "目标一行";
  if (sk.hitCol) return "目标一列";
  return "单体";
}

/** 持续伤害文案 */
export function monsterSkillDotLabel(sk) {
  if (!sk?.dot) return "";
  if (sk.dot.type === "pulse") return "脉动持续伤害";
  if (sk.dot.type === "onAct") return "行动时持续伤害";
  return "持续伤害";
}

/** 本层怪物列表等：名称 + 范围/控制/持续，不写伤害公式 */
export function monsterSkillBrief(sk) {
  if (!sk) return "";
  const tags = [monsterSkillRangeLabel(sk)];
  if (sk.apply?.stun) tags.push("眩晕");
  if (sk.apply?.slow != null) tags.push("减速");
  if (sk.apply?.silence) tags.push("禁魔");
  if (sk.apply?.healCut != null) tags.push("减疗");
  const dot = monsterSkillDotLabel(sk);
  if (dot) tags.push(dot);
  return `${sk.name}（${tags.join(" · ")}）`;
}

/** 脉动/行动持续：单跳伤害；脉动型有硬顶 */
export function monsterDotTickDamage(casterAtk, dot) {
  const atk = Math.max(0, Number(casterAtk) || 0);
  const mult = Number(dot?.mult) || 0;
  const flat = Number(dot?.flat) || 0;
  let dmg = Math.max(1, Math.floor(atk * mult) + flat);
  if (dot?.type === "pulse") {
    const cap = Math.max(1, Math.floor(atk * PULSE_DOT_TICK_CAP_MULT));
    dmg = Math.min(dmg, cap);
  }
  return dmg;
}

/** 应用持续时钳制脉动时长 */
export function clampMonsterDotGauge(dot) {
  let gauge = Math.max(1, Math.floor(dot?.gauge ?? 50));
  if (dot?.type === "pulse") gauge = Math.min(gauge, PULSE_DOT_MAX_GAUGE);
  return gauge;
}
