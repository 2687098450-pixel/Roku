/** 关卡出口守护 Boss（按层固定主题 kind） */

import { getMonsterStats, DEFAULT_MONSTER_SPEED } from "./stats.js?v=113";
import {
  MONSTER_SKILLS,
  bossSkillIdsForFloor,
  monsterSkillBrief,
  monsterSkillRangeLabel,
} from "./skills.js?v=113";
import { bossKindForFloor, bossMilestoneMult } from "./bossKinds.js?v=113";

export function createBoss({
  pos = { x: 8, y: 4 },
  ox = 2,
  oy = 2,
  scale = 1,
  floor = 1,
  combatFloor = null,
} = {}) {
  const kind = bossKindForFloor(floor);
  const sheet = getMonsterStats(kind);
  const abs = { x: ox + pos.x, y: oy + pos.y };
  const cf = combatFloor || floor;
  const s = Math.max(1, scale) * 1.55 * bossMilestoneMult(floor);
  const hp = Math.floor(sheet.hp * s);
  const atk = Math.floor(sheet.atk * s);
  const def = Math.floor(sheet.def * s);
  const spd = Math.max(
    8,
    Math.floor((sheet.spd ?? DEFAULT_MONSTER_SPEED) * (0.9 + scale * 0.05))
  );
  const skillIds = bossSkillIdsForFloor(cf);

  return {
    id: `m_boss_${floor}_${Math.random().toString(36).slice(2, 6)}`,
    type: "boss",
    kind,
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
    exp: Math.max(1, Math.round((sheet.exp || 12) * (0.9 + scale * 0.45))),
    gold: Math.max(1, Math.round((sheet.gold || 80) * (0.9 + scale * 0.5))),
    floor,
    combatFloor: cf,
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
        nums: monsterSkillRangeLabel(sk),
        desc: monsterSkillBrief(sk),
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
