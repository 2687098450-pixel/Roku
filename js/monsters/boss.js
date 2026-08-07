/** 关卡出口守护 Boss（按层固定主题 kind） */

import { getMonsterStats, DEFAULT_MONSTER_SPEED, MONSTER_ATK_MULT } from "./stats.js?v=164";
import {
  MONSTER_SKILLS,
  bossSkillIdsForFloor,
  monsterSkillBrief,
  monsterSkillRangeLabel,
} from "./skills.js?v=164";
import { bossKindForFloor, bossMilestoneMult, isSpecialBossFloor } from "./bossKinds.js?v=164";
import { floorHasUniqueBossLoot } from "../loot/drops.js?v=164";

export function createBoss({
  pos = { x: 8, y: 4 },
  ox = 2,
  oy = 2,
  scale = 1,
  floor = 1,
  combatFloor = null,
  kindOverride = null,
  skillIdsOverride = null,
  nameOverride = null,
  hidden = false,
} = {}) {
  const kind = kindOverride || bossKindForFloor(floor);
  const sheet = getMonsterStats(kind);
  const abs = { x: ox + pos.x, y: oy + pos.y };
  const cf = combatFloor || floor;
  const special = !hidden && isSpecialBossFloor(floor);
  const s = Math.max(1, scale) * 1.55 * bossMilestoneMult(floor) * (hidden ? 0.92 : 1);
  const hp = Math.floor(sheet.hp * s);
  const atk = Math.max(1, Math.floor(sheet.atk * s * MONSTER_ATK_MULT));
  const def = Math.floor(sheet.def * s);
  const spd = Math.max(
    8,
    Math.floor((sheet.spd ?? DEFAULT_MONSTER_SPEED) * (0.9 + scale * 0.05))
  );
  const skillIds =
    skillIdsOverride ||
    (hidden
      ? ["crush", "boss_mass_slow", "quake_roar"]
      : bossSkillIdsForFloor(cf, kind));

  return {
    id: `m_boss_${hidden ? "hide_" : ""}${floor}_${Math.random().toString(36).slice(2, 6)}`,
    type: "boss",
    kind,
    isBoss: true,
    isHiddenBoss: !!hidden || kind === "boss_fool",
    isSpecialBoss: special,
    name: nameOverride || `${sheet.name}·${floor}层`,
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
    exp: Math.max(
      1,
      Math.round(
        (sheet.exp || 12) * (0.9 + scale * 0.45) * (hidden ? 1.15 : special ? 1.2 : 1)
      )
    ),
    gold: Math.max(
      1,
      Math.round(
        (sheet.gold || 80) * (0.9 + scale * 0.38) * (hidden ? 1.1 : special ? 1.15 : 1)
      )
    ),
    floor,
    combatFloor: cf,
    hasUniqueLoot: hidden ? false : floorHasUniqueBossLoot(floor),
    dropsFoolSeal: !!hidden || kind === "boss_fool",
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

/** 14 层墙内隐藏愚人 Boss */
export function createFoolHiddenBoss(opts = {}) {
  return createBoss({
    ...opts,
    kindOverride: "boss_fool",
    skillIdsOverride: ["crush", "boss_mass_slow", "quake_roar", "soul_drain"],
    nameOverride: "愚人隐者",
    hidden: true,
  });
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
