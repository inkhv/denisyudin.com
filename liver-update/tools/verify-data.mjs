#!/usr/bin/env node
/* Сверка /liver-update/ с оригиналом /liver/ (Node 22, без зависимостей).
   Запуск из корня репозитория:  node liver-update/tools/verify-data.mjs
   1. Константы данных из liver/app.js (FLOW, COHORTS, CYCLE, STUDIES, TAGNAME, CASE_Q, QUIZ, COLORS
      и конфиг графика клинического примера) глубоко равны экспортам liver-update/data.js.
   2. Тексты <main> из liver/index.html (без <script>, <svg>, <style>) входят в текст
      liver-update/index.html; ключевые атрибуты тоже; список литературы (42) и подвал совпадают.
      Проверка «старое ⊆ новое», поэтому новая разметка и обёртки её не ломают.
   3. Все строки liver/app.js с не-ASCII символами (кириллица, ≤, ↑, —, неразрывный пробел) — тексты
      динамических результатов и форматирование чисел — есть в JS liver-update.
   4. Мета-теги и намеренные отличия: canonical/og, robots, ключ localStorage, нет старого URL.
   Единственное разрешённое расхождение текста: denisyudin.com/liver → denisyudin.com/liver-update.
   Код выхода 1 при любой ошибке. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const NEW_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(NEW_DIR, '..');
const OLD_DIR = path.join(ROOT, 'liver');
const read = (p) => fs.readFileSync(p, 'utf8');
const rel = (p) => path.relative(ROOT, p);

/* ------------------------------------------------------------ reporting */
const results = [];
let section = '';
function heading(title) { section = title; console.log('\n' + title); }
function check(name, ok, detail, problems) {
  results.push({ section, name, ok });
  console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? ' — ' + detail : ''));
  if (!ok && problems && problems.length) {
    problems.slice(0, 12).forEach((p) => console.log('        · ' + p));
    if (problems.length > 12) console.log('        · … and ' + (problems.length - 12) + ' more');
  }
}
const short = (s, n = 110) => { s = s === undefined ? '(missing)' : JSON.stringify(s); return s.length > n ? s.slice(0, n - 1) + '…"' : s; };

/* ------------------------------------------------------------ allowlist: the one intentional text change */
const urlMap = (s) => s.replace(/denisyudin\.com\/liver(?!-update)/g, 'denisyudin.com/liver-update');

/* ============================================================ 1. data constants */
// returns the balanced {...} / [...] literal starting at `from`, skipping string contents
function sliceLiteral(src, from) {
  const open = src[from];
  if (open !== '{' && open !== '[') throw new Error('no literal at ' + from);
  let depth = 0, q = null;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
    if (c === "'" || c === '"' || c === '`') { q = c; continue; }
    if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') { depth--; if (depth === 0) return src.slice(from, i + 1); }
  }
  throw new Error('unbalanced literal at ' + from);
}
function literalAfter(src, marker) {
  const at = src.indexOf(marker);
  if (at < 0) throw new Error('marker not found: ' + marker);
  if (src.indexOf(marker, at + 1) >= 0) throw new Error('marker is not unique: ' + marker);
  return vm.runInNewContext('(' + sliceLiteral(src, at + marker.length) + ')');
}
const kind = (v) => (Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v);
// exact structural comparison (works across vm realms); counts compared leaves
function compare(a, b, p, out, stat) {
  const ka = kind(a), kb = kind(b);
  if (ka !== kb) { out.push(p + ': ' + ka + ' in liver/, ' + kb + ' in data.js'); return; }
  if (ka === 'array') {
    if (a.length !== b.length) out.push(p + ': length ' + a.length + ' ≠ ' + b.length);
    for (let i = 0; i < Math.max(a.length, b.length); i++) compare(a[i], b[i], p + '[' + i + ']', out, stat);
  } else if (ka === 'object') {
    const ak = Object.keys(a), bk = Object.keys(b);
    if (ak.join('\u0000') !== bk.join('\u0000')) out.push(p + ': keys [' + ak.join(', ') + '] ≠ [' + bk.join(', ') + ']');
    new Set([...ak, ...bk]).forEach((k) => { compare(a[k], b[k], p + '.' + k, out, stat); });
  } else {
    stat.leaves++;
    if (!Object.is(a, b)) out.push(p + ': ' + short(a, 70) + ' ≠ ' + short(b, 70));
  }
}
async function loadData() {
  const file = path.join(NEW_DIR, 'data.js');
  // data: URL keeps Node from guessing the module type of a .js file outside a "type": "module" package
  try { return await import('data:text/javascript;base64,' + Buffer.from(read(file)).toString('base64')); }
  catch (e) { return import(pathToFileURL(file).href); }
}

const appSrc = read(path.join(OLD_DIR, 'app.js'));
heading('[1] Data constants: liver/app.js → liver-update/data.js');
let data = null;
try { data = await loadData(); } catch (e) { check('import data.js', false, e.message); }
if (data) {
  const NAMES = ['FLOW', 'COHORTS', 'CYCLE', 'STUDIES', 'TAGNAME', 'CASE_Q', 'QUIZ', 'COLORS'];
  const targets = NAMES.map((n) => [n, 'var ' + n + ' = ']).concat([['CASE_CHART', "vbar($('#caseChart'), "]]);
  for (const [name, marker] of targets) {
    try {
      const orig = literalAfter(appSrc, marker);
      const out = [], stat = { leaves: 0 };
      if (!(name in data)) out.push('data.js does not export ' + name);
      else compare(orig, data[name], name, out, stat);
      check(name.padEnd(10), out.length === 0, stat.leaves + ' strings/numbers/booleans compared', out);
    } catch (e) { check(name.padEnd(10), false, e.message); }
  }
}

/* ============================================================ 2. HTML text */
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', laquo: '«', raquo: '»', hellip: '…', times: '×', rarr: '→', larr: '←', middot: '·', le: '≤', ge: '≥', minus: '−', shy: '­' };
const decode = (s) => s.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  return NAMED[e] !== undefined ? NAMED[e] : m;
});
// collapse ordinary whitespace only; a non-breaking space stays significant
const norm = (s) => s.replace(/[ \t\n\r\f]+/g, ' ');
const normTrim = (s) => norm(s).replace(/^ | $/g, '');

function parseAttrs(s) {
  const attrs = {}, re = /([^\s=/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m;
  while ((m = re.exec(s))) attrs[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? '');
  return attrs;
}
// minimal tokenizer: open/close tags, text, raw <script>/<style> content; comments and doctype dropped
function tokenize(html) {
  const tokens = [];
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt < 0) { tokens.push({ type: 'text', text: html.slice(i) }); break; }
    if (lt > i) tokens.push({ type: 'text', text: html.slice(i, lt) });
    if (html.startsWith('<!--', lt)) { const e = html.indexOf('-->', lt + 4); i = e < 0 ? html.length : e + 3; continue; }
    if (html[lt + 1] === '!' || html[lt + 1] === '?') { const e = html.indexOf('>', lt); i = e < 0 ? html.length : e + 1; continue; }
    const m = /^<\/?([a-zA-Z][a-zA-Z0-9-]*)/.exec(html.slice(lt, lt + 80));
    if (!m) { tokens.push({ type: 'text', text: '<' }); i = lt + 1; continue; }
    const name = m[1].toLowerCase(), closing = html[lt + 1] === '/';
    let j = lt + m[0].length, q = null;
    for (; j < html.length; j++) { const c = html[j]; if (q) { if (c === q) q = null; } else if (c === '"' || c === "'") q = c; else if (c === '>') break; }
    const inner = html.slice(lt + m[0].length, j);
    i = j + 1;
    if (closing) { tokens.push({ type: 'close', name }); continue; }
    const selfClosing = /\/\s*$/.test(inner);
    tokens.push({ type: 'open', name, attrs: parseAttrs(inner.replace(/\/\s*$/, '')), selfClosing });
    if (name === 'script' || name === 'style') {
      const em = new RegExp('</' + name + '\\s*>', 'i').exec(html.slice(i));
      const end = em ? i + em.index : html.length;
      tokens.push({ type: 'raw', text: html.slice(i, end) });
      tokens.push({ type: 'close', name });
      i = em ? end + em[0].length : html.length;
    }
  }
  return tokens;
}
// [start, end] token indexes of the first element matching pred and its closing tag
function findElement(tokens, pred, from = 0, to = tokens.length) {
  for (let s = from; s < to; s++) {
    const t = tokens[s];
    if (t.type !== 'open' || !pred(t)) continue;
    if (t.selfClosing) return [s, s];
    let depth = 0;
    for (let e = s; e < to; e++) {
      const u = tokens[e];
      if (u.name !== t.name) continue;
      if (u.type === 'open' && !u.selfClosing) depth++;
      else if (u.type === 'close' && --depth === 0) return [s, e];
    }
    return [s, to - 1];
  }
  return null;
}
const hasClass = (t, c) => (t.attrs.class || '').split(/\s+/).includes(c);
const textOf = (tokens, s, e) => tokens.slice(s, e + 1).filter((t) => t.type === 'text').map((t) => decode(t.text)).join('');
function refsItems(tokens) {
  const ol = findElement(tokens, (t) => t.name === 'ol' && hasClass(t, 'refs'));
  if (!ol) return null;
  const items = [];
  for (let k = ol[0] + 1; k < ol[1]; k++) {
    const t = tokens[k];
    if (t.type === 'open' && t.name === 'li') { const li = findElement(tokens, () => true, k, ol[1] + 1); items.push(normTrim(textOf(tokens, li[0], li[1]))); k = li[1]; }
  }
  return items;
}

heading('[2] HTML text: <main> of liver/index.html ⊆ liver-update/index.html');
const oldTok = tokenize(read(path.join(OLD_DIR, 'index.html')));
const newTok = tokenize(read(path.join(NEW_DIR, 'index.html')));
const ATTRS = ['aria-label', 'alt', 'placeholder', 'data-title', 'title'];
{
  const main = findElement(oldTok, (t) => t.name === 'main');
  const oldTexts = [], oldAttrs = [];
  let svgDepth = 0;
  for (let k = main[0]; k <= main[1]; k++) {
    const t = oldTok[k];
    if (t.type === 'open' && t.name === 'svg') { if (!t.selfClosing) svgDepth++; continue; }
    if (t.type === 'close' && t.name === 'svg') { svgDepth--; continue; }
    if (svgDepth > 0) continue;
    if (t.type === 'text') { const s = urlMap(normTrim(decode(t.text))); if (s.length >= 2) oldTexts.push(s); }
    if (t.type === 'open') ATTRS.forEach((a) => { if (t.attrs[a]) oldAttrs.push([a, urlMap(normTrim(t.attrs[a]))]); });
  }
  // new side: whole document, text nodes joined without separators so added inline wrappers do not split words
  const newText = norm(newTok.filter((t) => t.type === 'text').map((t) => decode(t.text)).join(''));
  const newAttrs = new Set();
  newTok.forEach((t) => { if (t.type === 'open') ATTRS.forEach((a) => { if (t.attrs[a] != null) newAttrs.add(a + '\u0000' + normTrim(t.attrs[a])); }); });
  const missT = oldTexts.filter((s) => !newText.includes(s));
  check('text nodes', missT.length === 0, (oldTexts.length - missT.length) + '/' + oldTexts.length + ' found', missT.map((s) => short(s)));
  const missA = oldAttrs.filter(([a, v]) => !newAttrs.has(a + '\u0000' + v));
  check('attributes', missA.length === 0, (oldAttrs.length - missA.length) + '/' + oldAttrs.length + ' found (' + ATTRS.join(', ') + ')', missA.map(([a, v]) => a + '=' + short(v)));

  const ro = refsItems(oldTok), rn = refsItems(newTok);
  const refProblems = [];
  if (!ro || ro.length !== 42) refProblems.push('liver/index.html: ' + (ro ? ro.length : 'no') + ' items in <ol class="refs">, expected 42');
  if (!rn || rn.length !== 42) refProblems.push('liver-update/index.html: ' + (rn ? rn.length : 'no') + ' items in <ol class="refs">, expected 42');
  if (ro && rn) ro.forEach((s, k) => { if (urlMap(s) !== rn[k]) refProblems.push('item ' + (k + 1) + ': ' + short(s, 60) + ' ≠ ' + short(rn[k], 60)); });
  if (ro && rn && rn.length > ro.length) rn.slice(ro.length).forEach((s, k) => { refProblems.push('extra item ' + (ro.length + k + 1) + ': ' + short(s, 60)); });
  check('references', refProblems.length === 0, (ro ? ro.length : 0) + ' / ' + (rn ? rn.length : 0) + ' items, identical text per item', refProblems);

  const fo = findElement(oldTok, (t) => t.name === 'footer' && hasClass(t, 'foot'));
  const fn = findElement(newTok, (t) => t.name === 'footer' && hasClass(t, 'foot'));
  const fto = fo ? urlMap(normTrim(textOf(oldTok, fo[0], fo[1]))) : null, ftn = fn ? normTrim(textOf(newTok, fn[0], fn[1])) : null;
  const firstDiff = (a, b) => { let k = 0; while (k < a.length && a[k] === b[k]) k++; return k; };
  const at = fo && fn ? Math.max(0, firstDiff(fto, ftn) - 30) : 0;
  check('footer text', !!fo && !!fn && fto === ftn, fn ? 'footer.foot compared' : 'footer.foot missing in liver-update',
    fto !== ftn && fo && fn ? ['liver/:        …' + short(fto.slice(at), 90), 'liver-update/: …' + short(ftn.slice(at), 90)] : []);
}

/* ============================================================ 3. dynamic texts in JS */
// string literals of a classic script; comments and regex literals are skipped
function stringLiterals(src) {
  const out = [];
  let i = 0, prev = '';
  while (i < src.length) {
    const c = src[i], c2 = src[i + 1];
    if (c === '/' && c2 === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 2; continue; }
    if (c === '/' && c2 === '/') { const e = src.indexOf('\n', i); i = e < 0 ? src.length : e; continue; }
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      while (j < src.length && src[j] !== c) { if (src[j] === '\\') j++; j++; }
      out.push(src.slice(i + 1, j)); i = j + 1; prev = 'x'; continue;
    }
    if (c === '/' && (!prev || '(,=:[!&|?{};+-*%<>~^'.includes(prev))) {
      let j = i + 1, cls = false;
      while (j < src.length) { const d = src[j]; if (d === '\\') { j += 2; continue; } if (d === '[') cls = true; else if (d === ']') cls = false; else if (d === '/' && !cls) break; j++; }
      j++; while (j < src.length && /[a-z]/i.test(src[j])) j++;
      i = j; prev = 'x'; continue;
    }
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return out;
}
const jsFiles = [path.join(NEW_DIR, 'main.js'), path.join(NEW_DIR, 'data.js')]
  .concat(fs.readdirSync(path.join(NEW_DIR, 'ui')).filter((f) => f.endsWith('.js')).map((f) => path.join(NEW_DIR, 'ui', f)))
  .filter((f) => fs.existsSync(f));
const newJs = jsFiles.map(read).join('\n');

// \uXXXX / \xXX escapes count as the characters they encode (' ' ≡ a literal non-breaking space)
const unescape = (s) => s.replace(/\\u\{([0-9a-fA-F]+)\}|\\u([0-9a-fA-F]{4})|\\x([0-9a-fA-F]{2})/g, (m, a, b, c) => String.fromCodePoint(parseInt(a || b || c, 16)));

heading('[3] Dynamic texts: non-ASCII string literals of liver/app.js (Cyrillic, symbols, NBSP) ⊆ liver-update JS');
{
  // pure-ASCII literals are markup/class fragments and may change with a restyle; anything non-ASCII is content
  const lits = [...new Set(stringLiterals(appSrc).map(unescape).filter((s) => /[^\x00-\x7F]/.test(s)))];
  const hay = unescape(newJs);
  const miss = lits.filter((s) => !hay.includes(s));
  check('JS strings', miss.length === 0, (lits.length - miss.length) + '/' + lits.length + ' found in ' + jsFiles.length + ' files (main.js, data.js, ui/*.js)', miss.map((s) => short(s)));
}

/* ============================================================ 4. meta & intentional changes */
heading('[4] Page meta and intentional changes');
{
  const head = (pred, attr) => { const t = newTok.find((x) => x.type === 'open' && pred(x)); return t ? t.attrs[attr] : undefined; };
  const want = [
    ['canonical', head((t) => t.name === 'link' && t.attrs.rel === 'canonical', 'href'), 'https://denisyudin.com/liver-update/'],
    ['og:url', head((t) => t.name === 'meta' && t.attrs.property === 'og:url', 'content'), 'https://denisyudin.com/liver-update/'],
    ['og:image', head((t) => t.name === 'meta' && t.attrs.property === 'og:image', 'content'), 'https://denisyudin.com/liver-update/cover.png'],
    ['robots', head((t) => t.name === 'meta' && t.attrs.name === 'robots', 'content'), 'noindex, follow'],
  ];
  want.forEach(([n, got, exp]) => { check(n, got === exp, String(got), got === exp ? [] : ['expected ' + exp]); });
  const stale = [];
  const html = read(path.join(NEW_DIR, 'index.html'));
  if (/denisyudin\.com\/liver(?!-update)/.test(html)) stale.push('index.html mentions denisyudin.com/liver');
  jsFiles.forEach((f) => { if (/denisyudin\.com\/liver(?!-update)/.test(read(f))) stale.push(rel(f) + ' mentions denisyudin.com/liver'); });
  check('no old URL', stale.length === 0, 'index.html + JS', stale);
  const keyOk = newJs.includes("'liver-update-v1'") && !newJs.includes('liver-talk-v1');
  check('storage key', keyOk, keyOk ? "'liver-update-v1' (separate from /liver/ progress)" : "expected 'liver-update-v1' and no 'liver-talk-v1'");
  const shareOk = newJs.includes("'https://denisyudin.com/liver-update'");
  check('share URL', shareOk, shareOk ? 'https://denisyudin.com/liver-update' : 'share URL not found in JS');
}

/* ------------------------------------------------------------ summary */
const failed = results.filter((r) => !r.ok);
console.log('\n' + (failed.length ? 'RESULT: FAIL — ' + failed.length + ' of ' + results.length + ' checks failed' : 'RESULT: PASS — ' + results.length + ' checks'));
process.exit(failed.length ? 1 : 0);
