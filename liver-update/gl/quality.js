/* Уровни качества high / medium / low.
   Начальная оценка — по устройству, затем проба FPS в первые секунды рендера:
   если кадров мало, ступенчато снижаем разрешение canvas; если и это не помогает — постеры. */
export const DPR_CAP = { high: 2, medium: 1.5, low: 1 };

export function detectTier() {
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const small = Math.min(screen.width, screen.height) < 500;
  let tier = 'high';
  if (mem <= 2 || cores <= 2) tier = 'low';
  else if (mem <= 4 || cores <= 4 || coarse || small) tier = 'medium';
  try {
    const forced = new URLSearchParams(location.search).get('q');
    if (forced && DPR_CAP[forced]) tier = forced;
  } catch (e) { /* no URL API */ }
  return tier;
}

/* Скользящая проба FPS. step() вызывается каждый кадр; onVerdict получает 'down' / 'fail'. */
export function fpsProbe(onVerdict, o = {}) {
  const warm = o.warm ?? 600, window_ = o.window ?? 2000, low = o.low ?? 42, fail = o.fail ?? 20;
  let t0 = 0, frames = 0, started = 0, rounds = 0, done = false, last = 0;
  const samples = [];
  return {
    get samples() { return samples; },
    reset() { t0 = 0; frames = 0; started = 0; done = false; },
    stop() { done = true; },
    step(now) {
      if (done) return;
      if (!started) { started = now; last = now; return; }
      // пропуск длинных пауз (вкладка в фоне, прокрутка за пределы сцены)
      if (now - last > 250) { t0 = 0; frames = 0; }
      last = now;
      if (now - started < warm) return;
      if (!t0) { t0 = now; frames = 0; return; }
      frames++;
      const span = now - t0;
      if (span >= window_) {
        const fps = frames * 1000 / span;
        samples.push(Math.round(fps * 10) / 10);
        t0 = now; frames = 0; rounds++;
        if (fps < fail) onVerdict('fail', fps);
        else if (fps < low) onVerdict('down', fps);
        else if (rounds >= 2) { done = true; onVerdict('ok', fps); }
      }
    }
  };
}
