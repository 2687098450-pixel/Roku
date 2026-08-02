/**
 * 怪物技能（小怪强度弱于 Boss）
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
  // —— Boss（更强）——
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
};

export const TYPE_SKILL_IDS = {
  slime: ["gnaw"],
  bat: ["fang", "sonic"],
  goblin: ["stab", "throw_rock"],
  mushroom: ["spore", "puff"],
  golem: ["smash", "quake"],
  wisp: ["bolt", "flare"],
  boss: ["crush", "quake_roar", "soul_drain"],
};

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
