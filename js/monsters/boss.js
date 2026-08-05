/** 关卡出口守护 Boss */

import { skillPowerText } from "../core/utils.js?v=68";
import { getMonsterStats, DEFAULT_MONSTER_SPEED } from "./stats.js?v=68";
import { MONSTER_SKILLS, bossSkillIdsForFloor } from "./skills.js?v=68";

export function createBoss({
  pos = { x: 8, y: 4 },
  ox = 2,
  oy = 2,
  scale = 1,
  floor = 1,
} = {}) {
  const sheet = getMonsterStats("boss");
  const abs = { x: ox + pos.x, y: oy + pos.y };
  const s = Math.max(1, scale) * 1.55;
  const hp = Math.floor(sheet.hp * s);
  const atk = Math.floor(sheet.atk * s);
  const def = Math.floor(sheet.def * s);
  const spd = Math.max(
    8,
    Math.floor((sheet.spd ?? DEFAULT_MONSTER_SPEED) * (0.9 + scale * 0.05))
  );
  const skillIds = bossSkillIdsForFloor(floor);

  return {
    id: `m_boss_${floor}_${Math.random().toString(36).slice(2, 6)}`,
    type: "boss",
    kind: "boss",
    isBoss: true,
    name: `${sheet.name}·${floor}层`,
    color: sheet.color,
    shape: "square",
    x: abs.x,
    y: abs.y,
    from: { ...abs },
    to: { ...abs },
    dir: 1,
    maxHp: hp,
    hp,
    atk,
    def,
    spd,
    exp: Math.max(1, Math.round((sheet.exp || 120) * (0.9 + scale * 0.45))),
    gold: Math.max(1, Math.round((sheet.gold || 80) * (0.9 + scale * 0.5))),
    floor,
    row: "back",
    col: 1,
    skillIds,
    skills: skillIds.map((id) => {
      const sk = MONSTER_SKILLS[id];
      return {
        id,
        name: sk.name,
        kind: "active",
        style: sk.style,
        nums: skillPowerText(sk.mult, sk.flat),
        desc: `Boss：${sk.name}。伤害：${skillPowerText(sk.mult, sk.flat)}。`,
      };
    }),
  };
}

export function bossSkillPower(atk, skillId) {
  const s = MONSTER_SKILLS[skillId] || MONSTER_SKILLS.crush;
  return Math.floor(atk * (s.mult || 1)) + (s.flat || 0);
}

export function bossSkillDef(skillId) {
  return MONSTER_SKILLS[skillId] || MONSTER_SKILLS.crush;
}

export function pickBossSkill(boss) {
  const list = boss.skillIds || (boss.skills || []).map((s) => s.id);
  if (!list.length) return "crush";
  return list[Math.floor(Math.random() * list.length)];
}
