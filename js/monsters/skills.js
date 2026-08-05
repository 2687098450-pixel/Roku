/**
 * 怪物技能（小怪强度弱于 Boss；后期种类技能倍率更高）
 */

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
    mult: 0.9,
    flat: 0,
    weight: 0.5,
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
    mult: 0.6,
    flat: 0,
    hitFront: true,
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
    mult: 1.2,
    flat: 2,
    weight: 0.55,
  },
  web_spray: {
    id: "web_spray",
    name: "蛛网",
    style: "ranged",
    mult: 0.55,
    flat: 0,
    hitFront: true,
    weight: 0.45,
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
    mult: 0.95,
    flat: 2,
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
    mult: 0.7,
    flat: 2,
    hitFront: true,
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
    mult: 1.3,
    flat: 5,
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
  },
  quake_roar: {
    id: "quake_roar",
    name: "地裂咆哮",
    style: "melee",
    mult: 0.85,
    flat: 2,
    hitFront: true,
    weight: 0.35,
  },
  soul_drain: {
    id: "soul_drain",
    name: "吸魂",
    style: "ranged",
    mult: 1.1,
    flat: 2,
    weight: 0.25,
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
};

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
};

/** Boss 随层解锁更强技能（与小怪种类解锁同节奏） */
export function bossSkillIdsForFloor(floor) {
  const f = Math.max(1, floor || 1);
  const ids = ["crush", "quake_roar", "soul_drain"];
  if (f >= 15) ids.push("boss_cleave");
  if (f >= 25) ids.push("boss_meteor");
  if (f >= 35) ids.push("boss_void");
  if (f >= 45) ids.push("boss_apocalypse");
  return ids;
}

export function pickMonsterSkill(monster) {
  const ids = monster.skillIds || TYPE_SKILL_IDS[monster.kind] || ["gnaw"];
  const pool = ids
    .map((id) => MONSTER_SKILLS[id])
    .filter(Boolean);
  if (!pool.length) return MONSTER_SKILLS.gnaw;
  const total = pool.reduce((s, sk) => s + (sk.weight || 1), 0);
  let r = Math.random() * total;
  for (const sk of pool) {
    r -= sk.weight || 1;
    if (r <= 0) return sk;
  }
  return pool[pool.length - 1];
}

export function monsterSkillDamage(monster, skill) {
  const mult = skill.mult ?? 1;
  const flat = skill.flat ?? 0;
  return Math.max(1, Math.floor((monster.atk || 0) * mult) + flat);
}
