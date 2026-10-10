/* Привязка анимации к данным доклада: параметры сцен вычисляются из data.js, а не задаются на глаз.
   Каждое число ниже — цитата из FLOW (тексты и подписи /liver/). */
import { FLOW } from '../data.js';

/* «Печень извлекает около 73 % портального аммиака — половину превращает в мочевину …,
   половину связывает в глутамин …» (FLOW.norm.text) */
export const EXTRACT = 0.73;
/* «цикл мочевины сохранён, но 65 % портальной крови минует печень» (FLOW.shunt.capNote) */
export const SHUNT_SHARE = 0.65;
/* «аммиак в ткани печени … в 5 раз при стеатозе и ещё вдвое при НАСГ» (FLOW.nash.text) */
export const TISSUE = { steatosis: 5, nash: 10 };

export function lobuleParams(key) {
  const f = FLOW[key] || FLOW.norm;
  return {
    cap: f.cap / 100,                                   // скорость «турбины» = мощность цикла мочевины
    shunt: f.shunt ? SHUNT_SHARE : 0,                   // доля потока по обходному сосуду
    fat: key === 'steatosis' || key === 'nash' ? 1 : 0, // липидные капли — только там, где речь о стеатозе
    tissue: TISSUE[key] || 1,                           // задержка аммиака в ткани
    therapy: 0
  };
}

/* лечение (глава 5) показывается на фоне стеатоза */
export const TREATMENT_BASE = lobuleParams('steatosis');
