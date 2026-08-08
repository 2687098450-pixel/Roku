/** 史莱姆 / 通用小怪巡逻 */

import { OX, OY, canWalk } from "../map/island15.js?v=178";
import { createMonster } from "./roster.js?v=178";
import {
  MONSTER_SKILLS,
  TYPE_SKILL_IDS,
  trashControlSkillIdsForFloor,
  monsterSkillBrief,
  monsterSkillRangeLabel,
} from "./skills.js?v=178";

export const GNAW = { mult: 1.0, flat: 0, style: "melee" };

function skillListFor(kind, floor = 1) {
  const ids = [...(TYPE_SKILL_IDS[kind] || ["gnaw"])];
  for (const id of trashControlSkillIdsForFloor(floor)) {
    if (!ids.includes(id)) ids.push(id);
  }
  return ids.map((id) => {
    const sk = MONSTER_SKILLS[id];
    return {
      id,
      name: sk?.name || id,
      kind: "active",
      style: sk?.style || "melee",
      nums: monsterSkillRangeLabel(sk),
      desc: monsterSkillBrief(sk) || `${sk?.name || id}`,
    };
  });
}

/** 地图巡逻小怪（多类型）；约 10% 强化：属性 ×1.3 */
export function createPatrolMonster(
  kind,
  {
    from = { x: 5, y: 2 },
    to = { x: 9, y: 2 },
    ox = OX,
    oy = OY,
    scale = 1,
    floor = 1,
    combatFloor = null,
    /** null=随机；true/false=强制 */
    elite = null,
  } = {}
) {
  const absFrom = { x: ox + from.x, y: oy + from.y };
  const absTo = { x: ox + to.x, y: oy + to.y };
  const cf = combatFloor || floor;
  const base = createMonster(kind, {
    x: absFrom.x,
    y: absFrom.y,
    scale,
    role: "trash",
    floor,
    combatFloor: cf,
  });
  const isElite = elite == null ? Math.random() < 0.1 : !!elite;
  const m = {
    ...base,
    type: kind,
    kind,
    from: absFrom,
    to: absTo,
    dir: 1,
    floor,
    combatFloor: cf,
    isBoss: false,
    isElite: false,
    skills: skillListFor(kind, cf),
    skillIds: [...(base.skillIds || TYPE_SKILL_IDS[kind] || ["gnaw"])],
  };
  if (isElite) applyEliteTrash(m);
  return m;
}

const ELITE_STAT_MULT = 1.3;

/** 强化小怪：约 1.3 倍属性 */
export function applyEliteTrash(m) {
  if (!m || m.isBoss) return m;
  const mult = ELITE_STAT_MULT;
  m.isElite = true;
  m.maxHp = Math.max(1, Math.floor((m.maxHp || m.hp || 1) * mult));
  m.hp = m.maxHp;
  m.atk = Math.max(1, Math.floor((m.atk || 1) * mult));
  m.def = Math.max(0, Math.floor((m.def || 0) * mult));
  m.spd = Math.max(4, Math.floor((m.spd || 8) * mult));
  m.exp = Math.max(1, Math.round((m.exp || 1) * mult));
  m.gold = Math.max(1, Math.round((m.gold || 1) * mult));
  const baseName = String(m.name || "").replace(/·强化$/, "");
  m.name = `${baseName}·强化`;
  return m;
}

export function createSlime(opts = {}) {
  return createPatrolMonster("slime", opts);
}

export function moveSlimeOnce(m, map = null) {
  if (m.isBoss) return;
  const target = m.dir === 1 ? m.to : m.from;
  if (m.x === target.x && m.y === target.y) m.dir *= -1;
  const next = m.dir === 1 ? m.to : m.from;
  const dx = Math.sign(next.x - m.x);
  const dy = Math.sign(next.y - m.y);
  let nx = m.x;
  let ny = m.y;
  if (dx !== 0) nx += dx;
  else if (dy !== 0) ny += dy;
  else return;

  if (map && !canWalk(map, nx, ny)) {
    m.dir *= -1;
    return;
  }
  m.x = nx;
  m.y = ny;
}

export function gnawPower(atk) {
  return Math.floor(atk * GNAW.mult) + GNAW.flat;
}
