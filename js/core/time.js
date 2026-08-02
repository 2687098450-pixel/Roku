/**
 * 游戏默认时间单位
 * 逻辑跳：每 TICK_SECONDS 秒结算一次（行动条、可扩展其它逻辑）
 */
export const TICK_SECONDS = 0.1;

export function createTicker() {
  let acc = 0;
  return {
    /** 喂入真实流逝时间(秒)，返回本帧应结算的逻辑跳数 */
    step(dt) {
      acc += dt;
      let n = 0;
      while (acc >= TICK_SECONDS) {
        acc -= TICK_SECONDS;
        n += 1;
      }
      return n;
    },
    reset() {
      acc = 0;
    },
  };
}
