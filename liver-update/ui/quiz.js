/* Финал: самопроверка из пяти вопросов (QUIZ) и итоговый список выводов. */
import { QUIZ } from '../data.js';
import { $, $$, esc, state, save, toast, progressChanged, emit } from './core.js';

/* ------------------------------------------------------------ final: quiz */
export function initQuiz() {
  const box = $('#quizBox'); if (!box) return;
  const KEYS = ['А', 'Б', 'В', 'Г'];
  box.innerHTML = QUIZ.map((q, qi) => '<div class="q" data-qi="' + qi + '"><p class="q-title">' + (qi + 1) + '. ' + esc(q.q) + '</p><div class="opts">' +
    q.o.map((o, i) => '<button type="button" class="opt" data-i="' + i + '"><span class="key">' + KEYS[i] + '</span><span>' + esc(o) + '</span></button>').join('') +
    '</div><div class="fb" hidden></div></div>').join('');
  function paint(qi) {
    const q = QUIZ[qi], wrap = $('.q[data-qi="' + qi + '"]', box), ans = state.quiz[qi];
    if (ans == null) return;
    $$('.opt', wrap).forEach((b) => {
      const i = +b.getAttribute('data-i');
      b.classList.toggle('right', i === q.a); b.classList.toggle('wrong', i === ans && ans !== q.a);
      b.disabled = true;
    });
    const fb = $('.fb', wrap); fb.hidden = false; fb.className = 'fb ' + (ans === q.a ? 'right' : 'wrong');
    fb.textContent = (ans === q.a ? 'Верно. ' : 'Правильный ответ — ' + KEYS[q.a] + '. ') + q.e;
  }
  function score() {
    const n = Object.keys(state.quiz).length, ok = QUIZ.filter((q, i) => state.quiz[i] === q.a).length;
    $('#quizScore').textContent = n ? 'Правильных ответов: ' + ok + ' из ' + QUIZ.length + (n < QUIZ.length ? ' · отвечено ' + n + ' из ' + QUIZ.length : '') : '';
    if (n === QUIZ.length && !state.quizDone) { state.quizDone = true; save(); progressChanged(); toast('Самопроверка завершена'); }
  }
  box.addEventListener('click', (e) => {
    const b = e.target.closest('.opt'); if (!b || b.disabled) return;
    const qi = +b.closest('.q').getAttribute('data-qi');
    state.quiz[qi] = +b.getAttribute('data-i'); save(); paint(qi); score();
    emit('quiz', { qi, correct: state.quiz[qi] === QUIZ[qi].a });
  });
  QUIZ.forEach((_, i) => { paint(i); }); score();
}

/* ------------------------------------------------------------ final: conclusions opened along the way */
export function renderFinal() {
  let got = 0;
  $$('#conclusions .conclusion').forEach((li) => { const on = !!state.t[li.getAttribute('data-c')]; li.classList.toggle('got', on); if (on) got++; });
  $('#finalLead').textContent = got === 5
    ? 'Вы открыли все пять выводов по ходу доклада. Ниже — итоги, самопроверка и литература.'
    : 'По ходу доклада вы открыли ' + got + ' из 5 выводов. Здесь все пять — с переходом к главе, где каждый обоснован.';
}
