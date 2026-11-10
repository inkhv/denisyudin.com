const shortWords = new Set([
  'а', 'без', 'близ', 'в', 'во', 'для', 'до', 'за', 'и', 'из', 'из-за', 'из-под',
  'или', 'к', 'ко', 'как', 'либо', 'меж', 'между', 'на', 'над', 'не', 'ни', 'но',
  'о', 'об', 'обо', 'от', 'ото', 'перед', 'по', 'под', 'подо', 'при', 'про',
  'с', 'со', 'у', 'через',
]);
const month = /^(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?=$|[^а-яё])/iu;

// Bind spaces across inline markup, including bold text, links and slide counters.
function protectLine(nodes, keepEnding) {
  const text = nodes.map(node => node.data).join('');
  const words = [...text.matchAll(/\S+/gu)];
  const bindings = new Set();
  for (const [i, word] of words.entries()) {
    const normalized = word[0].toLowerCase().replace(/^[«„“"‘(\[]+/u, '');
    const next = words[i + 1]?.[0];
    const date = /^\d{1,2}$/u.test(normalized) && next && month.test(next);
    if (next && (shortWords.has(normalized) || date)) bindings.add(i);
  }
  if (keepEnding) {
    let last = words.length - 1;
    while (last > 0 && !/[\p{L}\p{N}]/u.test(words[last][0])) last--;
    if (last > 0) bindings.add(last - 1);
  }
  if (!bindings.size) return;

  const replacements = new Map();
  for (const i of bindings) {
    const start = words[i].index + words[i][0].length;
    const end = words[i + 1].index;
    for (let pos = start; pos < end; pos++) {
      replacements.set(pos, pos === start ? '\u00a0' : '');
    }
  }
  let offset = 0;
  for (const node of nodes) {
    const value = node.data;
    node.data = Array.from({length: value.length}, (_, i) =>
      replacements.get(offset + i) ?? value[i]
    ).join('');
    offset += value.length;
  }
}

export function formatText(block, {reflow = false, keepEnding = true} = {}) {
  if (reflow) {
    block.querySelectorAll('br').forEach(br => br.replaceWith(' '));
  }
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let line = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.nodeType === Node.TEXT_NODE) {
      if (reflow) node.data = node.data.replace(/[\r\n\u2028\u2029]+/gu, ' ');
      line.push(node);
    } else if (node.tagName === 'BR') {
      protectLine(line, keepEnding);
      line = [];
    }
  }
  protectLine(line, keepEnding);
}
