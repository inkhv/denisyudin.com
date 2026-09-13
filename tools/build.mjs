// Run `node tools/build.mjs` from the repository root after editing the catalog.
// Generates a complete static page; the public site does not need a build server.
import {writeFileSync} from 'node:fs';
import {tools} from './catalog.mjs';
import {gridGeometry, shapeGeometry, exampleNodes} from '../hofmann/geometry.mjs';

const wrap = (id, background, drawing) => `<svg viewBox="0 0 640 480" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="640" height="480" fill="${background}"/>${drawing}</svg>`;
const grid = (color='#999', radius=2) => Array.from({length:7}, (_,r) => Array.from({length:10},(_,c) => `<circle cx="${50+c*60}" cy="${60+r*60}" r="${radius}" fill="${color}"/>`).join('')).join('');
const hgrid = gridGeometry({width:420,height:420,cols:4,rows:4,margin:8,diameter:88});
const hofmann = `<g transform="translate(110 30)">${Array.from({length:16},(_,i)=>{const p=hgrid.point(i%4,Math.floor(i/4));return `<circle cx="${p.x}" cy="${p.y}" r="${hgrid.radius}" fill="none" stroke="#b3b3ad" stroke-width="1.2"/>`;}).join('')}<path d="${shapeGeometry({nodes:exampleNodes(0),closed:true},hgrid).d}" fill="none" stroke="#151513" stroke-width="5"/></g>`;
const organic = `<g fill="#ff7b9c" stroke="#4b0429" stroke-width="16" stroke-linejoin="round"><path d="M-20-20H180Q226 50 150 146Q40 203-20 112Z"/><path d="M180-20H399Q438 73 347 152Q251 205 182 135Q231 39 180-20Z"/><path d="M399-20H660V156Q600 198 519 154Q448 138 406 80Z"/><path d="M-20 144Q63 173 160 165Q228 209 195 318Q133 369-20 306Z"/><path d="M224 188Q288 152 359 180Q435 221 409 323Q338 371 235 318Q195 250 224 188Z"/><path d="M426 174Q520 132 600 197L663 222V339Q580 407 463 327Q417 275 426 174Z"/><path d="M-20 342Q71 320 144 371Q175 415 125 500H-20Z"/><path d="M193 351Q300 357 343 419L368 500H132Q174 454 168 400Z"/><path d="M373 365Q427 317 510 373Q566 430 526 500H373Q415 446 373 365Z"/><path d="M553 391Q600 373 660 360V500H546Q573 441 553 391Z"/></g>`;
const softPath = 'M140 350C65 355 53 257 116 226C163 203 220 217 231 161C247 66 342 65 356 153C370 226 433 234 477 203C563 143 617 244 552 294C498 338 426 305 376 355C317 418 248 360 222 311C186 253 199 347 140 350Z';
const next = `<defs><linearGradient id="next-color" x1="0" y1="1" x2=".7" y2="0"><stop stop-color="#5924df"/><stop offset=".45" stop-color="#9d83ff"/><stop offset=".73" stop-color="#f5a4c9"/><stop offset="1" stop-color="#ffe9b8"/></linearGradient></defs>${grid('#403f4b')}<path d="${softPath}" fill="url(#next-color)"/>`;
const classic = `${grid('#c5c4bc')}<path d="${softPath}" fill="#e34b66"/><g fill="#541d31"><circle cx="140" cy="300" r="3"/><circle cx="290" cy="150" r="3"/><circle cx="320" cy="300" r="3"/><circle cx="510" cy="250" r="3"/></g>`;
const simple = `${grid('#b9b9ad')}<path d="M140 340V140H260V280H380V140H500V340" fill="none" stroke="#b2cf33" stroke-width="78" stroke-linecap="round" stroke-linejoin="round"/>`;
const brush = `<defs><linearGradient id="brush-color" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#87f6e1"/><stop offset=".3" stop-color="#d2c5ff"/><stop offset=".55" stop-color="#f7a3ef"/><stop offset=".8" stop-color="#ffdea4"/><stop offset="1" stop-color="#a2e3ff"/></linearGradient></defs><g fill="none" stroke-linecap="round"><path d="M115 320C25 60 353 80 279 248S270 475 384 228S610 195 529 351" stroke="url(#brush-color)" stroke-width="48"/><path d="M107 308C40 78 337 92 270 243S272 449 376 227S591 198 524 343" stroke="#fff" stroke-opacity=".65" stroke-width="5"/></g>`;
const glitch = Array.from({length:75},(_,i)=>{const y=25+i*6, x=70+(Math.sin(i*3.1)*35), width=260+Math.cos(i*.65)*65; const color=['#b6d83c','#8e62e7','#e6a5ee','#d8cbee'][i%4]; return `<rect x="${x}" y="${y}" width="${width}" height="4" fill="${color}"/><rect x="${380+Math.sin(i*.8)*30}" y="${y}" width="${110+Math.sin(i)*50}" height="4" fill="${color}"/>`;}).join('');
const vfx = id => `<defs><linearGradient id="${id}-color"><stop stop-color="#c4f54b"/><stop offset=".3" stop-color="#27d8c9"/><stop offset=".55" stop-color="#a268ed"/><stop offset=".8" stop-color="#f6a1d8"/><stop offset="1" stop-color="#f9d97c"/></linearGradient></defs>${Array.from({length:22},(_,i)=>`<path d="M${i*34-36} -20C${i*34+90} 100 ${i*34-105} 360 ${i*34+65} 500" fill="none" stroke="url(#${id}-color)" stroke-width="${id==='vfx2'?25:14}"/>`).join('')}`;
const previews = {
  hofmann:wrap('hofmann','#fafaf7',hofmann), 'metaball-next':wrap('next','#171622',next), organic:wrap('organic','#4b0429',organic),
  'signal-shredder':wrap('signal','#161517',glitch), brush:wrap('brush','#08080c',brush), 'colorvfx-2':wrap('vfx2','#102831',vfx('vfx2')),
  metaball:wrap('metaball','#f6e8e4',classic), 'metaball-simple':wrap('simple','#eeefe4',simple), colorvfx:wrap('vfx1','#402961',vfx('vfx1')),
};
const cards = tools.map(tool=>`<article class="tool" data-group="${tool.group}">
  <a class="tool-link" href="${tool.href}" aria-labelledby="title-${tool.id}">
    <div class="preview">${previews[tool.id]}</div>
    <div class="tool-title"><h2 id="title-${tool.id}">${tool.name}</h2><span class="open-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 19 19 5M5 5h14v14"/></svg></span></div>
    <span class="kind">${tool.kind}</span>
  </a>
  <p class="description">${tool.description}</p><span class="formats">${tool.formats}</span>
</article>`).join('\n');
const html = `<!doctype html>
<html lang="ru"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Инструменты для дизайна — Denis Yudin</title>
  <meta name="description" content="Инструменты Дениса Юдина для формы, цвета и экспериментов: Hofmann, Metaball, Organic Cells, Signal Shredder, Liquid Light Brush и Color VFX.">
  <meta name="theme-color" content="#efede8"><link rel="canonical" href="https://denisyudin.com/tools/">
  <meta property="og:title" content="Инструменты для дизайна — Denis Yudin"><meta property="og:description" content="Форма, цвет и эксперименты. 9 инструментов в браузере."><meta property="og:type" content="website"><meta property="og:url" content="https://denisyudin.com/tools/">
  <link rel="icon" href="/assets/694eb3c01c94deb52f44b88a_p10%200062_24.png">
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css"><script type="module" src="menu.mjs"></script><script type="module" src="app.mjs"></script>
</head><body>
  <a class="skip-link" href="#catalog">К инструментам</a>
  <header class="site-header"><a href="/" class="brand">Denis Yudin</a><nav class="site-nav" aria-label="Навигация сайта"><a href="/portfolio.html">Портфолио</a><dy-tool-menu><a href="/tools/">Инструменты</a></dy-tool-menu></nav></header>
  <main id="catalog"><div class="intro"><h1>Инструменты</h1><p>Форма, цвет и эксперименты.<br>Мои инструменты для работы с графикой — прямо в браузере.</p></div>
    <div class="filter-bar"><div class="filters" role="group" aria-label="Категории инструментов"><button data-filter="all" aria-pressed="true">Все</button><button data-filter="form" aria-pressed="false">Форма и сетка</button><button data-filter="effect" aria-pressed="false">Цвет и эффекты</button><button data-filter="draw" aria-pressed="false">Рисование</button></div><p class="count" id="toolCount" aria-live="polite">${tools.length} инструментов</p></div>
    <div class="tool-grid">${cards}</div>
  </main>
  <footer class="site-footer"><span>Denis Yudin · Инструменты</span><a href="/">На главную</a></footer>
</body></html>`;
writeFileSync(new URL('./index.html',import.meta.url),html);
console.log(`Built /tools/ with ${tools.length} tools.`);
