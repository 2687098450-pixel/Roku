/** 全能：从总表读取基础属性，并计算最终数值 */

import { getCharacterStats } from "../stats.js?v=112";
import { levelStatBonus } from "../progression.js?v=112";

const sheet = getCharacterStats("omni");

export const BASE = { ...sheet.base };
export const PASSIVE_BOOST = { ...sheet.passiveBoost };

export function calcStats(base, passiveBoost, equipBonus, level = 1) {
  const lv = levelStatBonus(level);
  return {
    maxHp: base.hp + passiveBoost.hp + (equipBonus.hp || 0) + lv.hp,
    atk: base.atk + passiveBoost.atk + (equipBonus.atk || 0) + lv.atk,
    def: base.def + passiveBoost.def + (equipBonus.def || 0) + lv.def,
    spd: base.spd + (passiveBoost.spd || 0) + (equipBonus.spd || 0) + lv.spd,
  };
}
