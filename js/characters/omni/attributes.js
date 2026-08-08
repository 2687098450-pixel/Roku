/** 力智敏（含装备）→ convertPrimary → 战斗属性 */

import { getCharacterStats } from "../stats.js?v=180";
import { levelPrimaryBonus } from "../progression.js?v=180";
import {
  addPrimary,
  convertPrimary,
  readPrimary,
} from "../primary.js?v=180";

const sheet = getCharacterStats("omni");
export const BASE = { ...sheet.base };
export const PASSIVE_BOOST = { ...sheet.passiveBoost };

export function calcStats(base, passiveBoost, equipBonus, level = 1, growth = null) {
  const eq = equipBonus || {};
  const prim = addPrimary(
    addPrimary(
      addPrimary(readPrimary(base), readPrimary(passiveBoost)),
      levelPrimaryBonus(level, growth)
    ),
    readPrimary(eq)
  );
  const core = convertPrimary(prim.str, prim.int, prim.agi);
  return {
    primary: prim,
    maxHp: core.maxHp,
    atk: core.atk,
    def: core.def,
    spd: core.spd,
    skillAtk: core.skillAtk,
    maxMp: core.maxMp,
    critRateFromAgi: core.critRate,
  };
}
