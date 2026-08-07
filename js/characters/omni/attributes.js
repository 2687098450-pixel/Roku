/** 从力智敏换算战斗属性，再叠装备 */

import { getCharacterStats } from "../stats.js?v=166";
import { levelPrimaryBonus } from "../progression.js?v=166";
import {
  addPrimary,
  convertPrimary,
  readPrimary,
} from "../primary.js?v=166";

const sheet = getCharacterStats("omni");
export const BASE = { ...sheet.base };
export const PASSIVE_BOOST = { ...sheet.passiveBoost };

export function calcStats(base, passiveBoost, equipBonus, level = 1, growth = null) {
  const prim = addPrimary(
    addPrimary(readPrimary(base), readPrimary(passiveBoost)),
    levelPrimaryBonus(level, growth)
  );
  const core = convertPrimary(prim.str, prim.int, prim.agi);
  const eq = equipBonus || {};
  return {
    primary: prim,
    maxHp: core.maxHp + (eq.hp || 0),
    atk: core.atk + (eq.atk || 0),
    def: core.def + (eq.def || 0),
    spd: core.spd + (eq.spd || 0),
    skillAtk: core.skillAtk + Math.floor((eq.atk || 0) * 0.35),
    maxMp: core.maxMp,
    critRateFromAgi: core.critRate,
  };
}
