/* Мост между интерактивом доклада (события lu:*) и 3D-движком.
   Загружается лениво, после первой отрисовки, и только если 3D разрешено (см. ui/scenes.js). */
import { createEngine } from './engine.js';
import { lobuleParams } from './bindings.js';
import { on, state } from '../ui/core.js';

/* какие сцены нужны главе — остальные освобождаются (dispose) */
const NEEDS = {
  start: ['hero'], ch1: ['rail', 'lobule'], ch2: ['rail', 'cycle', 'targets'], ch3: ['rail'], ch4: ['rail'],
  ch5: ['rail', 'lobule'], ch6: ['rail'], final: ['rail']
};

/* смещение композиции, чтобы сцена не пряталась под текстом сцены или под бланком обложки */
function frameFor(host, aspect) {
  if (host.classList.contains('cover-host')) return aspect < 0.95 ? [0, -0.29] : [0.17, 0.02];
  if (host.classList.contains('stage-pin')) return aspect < 0.95 ? [0, -0.17] : [0.16, -0.05];
  return [0, 0];
}

export function boot({ onFail, tier }) {
  const eng = createEngine({ onFail, tier, frameFor });
  if (!eng) return null;
  const hosts = Array.from(document.querySelectorAll('.gl-host'));
  hosts.forEach((h) => eng.register(h));

  const ch1Hosts = hosts.filter((h) => h.dataset.gl === 'lobule' && h.closest('#ch1'));
  const offs = [];
  offs.push(on('flow', (e) => {
    const p = lobuleParams(e.detail.key);
    const json = JSON.stringify(p);
    ch1Hosts.forEach((h) => { h.dataset.state = json; });
    if (ch1Hosts.includes(eng.active)) eng.setState('lobule', p);
  }));
  offs.push(on('cycle', (e) => eng.setState('cycle', { sel: e.detail.n })));
  offs.push(on('break', (e) => eng.setState('cycle', { broken: e.detail.on })));
  offs.push(on('target', (e) => eng.setState('targets', { mode: e.detail.mode })));

  const done = () => ({ 1: !!state.t[1], 2: !!state.t[2], 3: !!state.t[3], 4: !!state.t[4], 5: !!state.t[5], 6: !!state.caseDone, 7: !!state.quizDone });
  const pushRail = () => eng.setState('rail', { done: done() });
  ['unlock', 'case', 'quiz'].forEach((t) => offs.push(on(t, pushRail)));
  pushRail();

  offs.push(on('route', (e) => {
    eng.retain(NEEDS[e.detail.id] || []);
    if (e.detail.prev !== e.detail.id) eng.route();
  }));
  const cur = document.querySelector('.chapter.is-active');
  if (cur) eng.retain(NEEDS[cur.id] || []);

  const destroy = eng.destroy;
  eng.destroy = () => { offs.forEach((f) => f()); destroy(); };
  return eng;
}
