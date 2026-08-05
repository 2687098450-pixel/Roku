/** 史莱姆 / 通用小怪巡逻 */

import { skillPowerText } from "../core/utils.js?v=84";
import { OX, OY, canWalk } from "../map/island15.js?v=84";
import { createMonster } from "./roster.js?v=84";
import { MONSTER_SKILLS, TYPE_SKILL_IDS } from "./skills.js?v=84";

export const GNAW = { mult: 1.0, flat: 0, style: "melee" };

function skillListFor(kind) {
  const ids = TYPE_SKILL_IDS[kind] || ["gnaw"];
  return ids.map((id) => {
    const sk = MONSTER_SKILLS[id];
    return {
      id,
      name: sk?.name || id,
      kind: "active",
      style: sk?.style || "melee",
      nums: skillPowerText(sk?.mult ?? 1, sk?.flat ?? 0),
      desc: `${sk?.name || id}。伤害：${skillPowerText(sk?.mult ?? 1, sk?.flat ?? 0)}。`,
    };
  });
}

/** 地图巡逻小怪（多类型） */
export function createPatrolMonster(
  kind,
  {
    from = { x: 5, y: 2 },
    to = { x: 9, y: 2 },
    ox = OX,
    oy = OY,
    scale = 1,
    floor = 1,
  } = {}
) {
  const absFrom = { x: ox + from.x, y: oy + from.y };
  const absTo = { x: ox + to.x, y: oy + to.y };
  const base = createMonster(kind, {
    x: absFrom.x,
    y: absFrom.y,
    scale,
    role: "trash",
  });
  return {
    ...base,
    type: kind,
    kind,
    from: absFrom,
    to: absTo,
    dir: 1,
    floor,
    isBoss: false,
    skills: skillListFor(kind),
    skillIds: [...(TYPE_SKILL_IDS[kind] || ["gnaw"])],
  };
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
