import {covers} from './covers.js';
import {formatText} from './typography.js';

const $ = id => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const pad = n => String(n).padStart(2, '0');
const figma = node => 'https://www.figma.com/design/CSJO6EHIsKkp0TfBQavCxt/AI-STREAM-PP?node-id=' + node.replace(':', '-');
const works = [...covers, {id:'deck', title:'ИИ-стрим презентаций', type:'Интерактивная презентация'}];
const workImage = work => work.id === 'deck' ? 'assets/cover-deck.webp' : 'assets/cover-' + work.id + '.webp';
const scene = $('scene'), wire = $('wire'), ctx = wire.getContext('2d'), walls = $('walls');
const dialogue = $('work-dialog'), announce = $('announce');
let active = 0, current = -1, deckMode = false, reading = false, slides, slideAnimation = 0;
let width = 0, height = 0, ratio = 1, cameraFrame = 0;
const points = works.map((work,i) => ({work,i,side:i % 2 ? 1 : -1,z:6.3+Math.floor(i/2)*8+(i%2)*2.6}));
const camera = {z:0,yaw:-.085};
const target = {...camera};
const roomHalf = 4.6, roomHeight = 2.74, nearPlane = .42;
let restoreFocus;

function button(className, label) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  if (label) b.setAttribute('aria-label', label);
  return b;
}

function imageFor(work, lazy = false) {
  const image = document.createElement('img');
  image.src = workImage(work);
  image.alt = '';
  image.width = 1440;
  image.height = 810;
  image.decoding = 'async';
  image.draggable = false;
  if (lazy) image.loading = 'lazy';
  return image;
}

const dots = [], panels = [];
for (const [i,work] of works.entries()) {
  const dot = button('', 'Работа ' + (i + 1) + ': ' + work.title);
  dot.title = work.title;
  dot.addEventListener('click', () => selectWork(i));
  $('position').append(dot);
  dots.push(dot);

  const panel = button('wall-work', 'Смотреть: ' + work.title);
  panel.tabIndex = -1;
  panel.hidden = true;
  if (i < 8) {
    const artwork = imageFor(work);
    artwork.decoding = 'sync';
    if (i < 3) artwork.fetchPriority = 'high';
    panel.append(artwork);
  }
  // Adjacent works are attached only once they can be seen in the room.
  panel.addEventListener('click', () => openWork(i));
  walls.append(panel);
  panels.push(panel);

  const card = button('catalogue-item');
  const cover = document.createElement('span');
  cover.className = 'catalogue-cover';
  cover.append(imageFor(work, i > 2));
  const label = document.createElement('span');
  label.className = 'catalogue-label';
  const serial = document.createElement('span');
  serial.className = 'serial';
  serial.textContent = pad(i + 1);
  const name = document.createElement('strong');
  name.textContent = work.title;
  formatText(name);
  const arrow = document.createElement('span');
  arrow.textContent = '↗'; arrow.className = 'external'; arrow.setAttribute('aria-hidden', 'true');
  label.append(serial, name, arrow);
  card.append(cover, label);
  card.addEventListener('click', () => openWork(i));
  $('catalogue-grid').append(card);
}
$('catalogue-count').textContent = covers.length + '\u00a0шаблонов · 1\u00a0презентация';

function openWork(i) {
  selectWork(i, false);
  const item = works[i];
  if (item.id === 'deck') {
    location.hash = 'deck/1';
    return;
  }
  restoreFocus = document.activeElement;
  $('detail-index').textContent = pad(i + 1) + ' / ' + pad(works.length);
  $('detail-title').textContent = item.title;
  formatText($('detail-title'));
  $('detail-type').textContent = item.type;
  $('detail-img').src = workImage(item);
  $('detail-img').alt = 'Обложка: ' + item.title;
  $('detail-source').href = figma(item.node);
  dialogue.showModal();
  $('detail-close').focus();
}
$('detail-close').onclick = () => dialogue.close();
dialogue.addEventListener('click', e => {
  if (e.target !== dialogue) return;
  const r = dialogue.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialogue.close();
});
dialogue.addEventListener('close', () => {
  if (!deckMode && restoreFocus?.isConnected) restoreFocus.focus({preventScroll:true});
});

function selectWork(index, say = true) {
  const next = Math.max(0, Math.min(works.length - 1, index));
  active = next;
  const item = works[next], point = points[next];
  target.z = point.z - 6.3;
  target.yaw = point.side * (width < 580 ? .31 : .085);
  $('work-index').textContent = pad(next + 1) + ' / ' + pad(works.length);
  $('coord').textContent = 'ЗАЛ / ' + pad(next + 1);
  $('work-title').textContent = item.title;
  formatText($('work-title'));
  $('work-type').textContent = item.type;
  $('walk-prev').disabled = next === 0;
  $('walk-next').disabled = next === works.length - 1;
  dots.forEach((d,i) => {
    for (const el of [d,panels[i]]) {
      if (i === next) el.setAttribute('aria-current','true');
      else el.removeAttribute('aria-current');
    }
  });
  if (say) announce.textContent = 'Работа ' + (next + 1) + ' из ' + works.length + ': ' + item.title;
  scheduleCamera();
}
$('walk-prev').onclick = () => selectWork(active - 1);
$('walk-next').onclick = () => selectWork(active + 1);
$('work-open').onclick = () => openWork(active);

function bend(z) { return 1.15 * Math.sin(z / 10.5) + .58 * Math.sin(z / 4.8); }
function eye(x, y, z) {
  const xx = x + bend(z) - bend(camera.z);
  const zz = z - camera.z;
  const s = Math.sin(camera.yaw), c = Math.cos(camera.yaw);
  return [xx*c - zz*s, y, xx*s + zz*c];
}
function project([x,y,z]) {
  const f = Math.min(width * .68, height * .94);
  return [width * .5 + f*x/z, height * .51 + f*y/z];
}
function worldLine(a,b) {
  let p = eye(...a), q = eye(...b);
  if (p[2] < nearPlane && q[2] < nearPlane) return;
  if (p[2] < nearPlane || q[2] < nearPlane) {
    const t = (nearPlane-p[2])/(q[2]-p[2]);
    const clipped = [p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t,nearPlane];
    if (p[2] < nearPlane) p = clipped; else q = clipped;
  }
  const A = project(p), B = project(q);
  ctx.moveTo(...A); ctx.lineTo(...B);
}

// Project a rectangular DOM surface into the four corners of the artwork plane.
function matrix([a,b,c,d]) {
  const [x0,y0]=a,[x1,y1]=b,[x2,y2]=c,[x3,y3]=d;
  const dx1=x1-x2,dx2=x3-x2,dx3=x0-x1+x2-x3;
  const dy1=y1-y2,dy2=y3-y2,dy3=y0-y1+y2-y3;
  const det=dx1*dy2-dx2*dy1;
  if (Math.abs(det)<.00001) return null;
  const g=(dx3*dy2-dx2*dy3)/det, h=(dx1*dy3-dx3*dy1)/det;
  return 'matrix3d(' + [(x1-x0+g*x1)/320,(y1-y0+g*y1)/320,0,g/320,
    (x3-x0+h*x3)/180,(y3-y0+h*y3)/180,0,h/180,0,0,1,0,x0,y0,0,1].join(',') + ')';
}

function drawRoom() {
  if (!width || !height || deckMode) return;
  if (ctx) {
    ctx.setTransform(ratio,0,0,ratio,0,0);
    ctx.clearRect(0,0,width,height);
    const start = Math.floor(camera.z / 3.15)*3.15-3.15;
    const end = camera.z + 63;
    ctx.lineWidth = .83;
    for (let z=start;z<end;z+=3.15) {
      const alpha = Math.max(.08, .49 - Math.max(0,z-camera.z)*.008);
      ctx.strokeStyle = 'rgba(178,187,205,'+alpha+')';
      ctx.beginPath();
      const corners = [[-roomHalf,-roomHeight],[roomHalf,-roomHeight],[roomHalf,roomHeight],[-roomHalf,roomHeight]];
      corners.forEach(([x,y],i) => worldLine([x,y,z],[...corners[(i+1)%4],z]));
      ctx.stroke();
      ctx.strokeStyle = 'rgba(177,187,208,' + alpha * .84 + ')';
      ctx.beginPath();
      for (const y of [-roomHeight, roomHeight]) for (let j=0;j<=6;j++) {
        const x = -roomHalf + j*2*roomHalf/6;
        worldLine([x,y,z],[x,y,z+3.15]);
      }
      for (const side of [-1,1]) for (const y of [-.9,.9]) worldLine([side*roomHalf,y,z],[side*roomHalf,y,z+3.15]);
      ctx.stroke();
    }
  }

  for (const {work,i,z,side} of points) {
    const panel = panels[i];
    const x = (roomHalf-.04)*side, span = 2.35;
    const y = i % 4 < 2 ? .22 : .12, half = 1.19;
    const za=z+side*span, zb=z-side*span;
    const world = [[x,y-half,za],[x,y-half,zb],[x,y+half,zb],[x,y+half,za]];
    const verts = world.map(a => eye(...a));
    if (z-camera.z>49 || verts.some(v=>v[2]<nearPlane)) {
      panel.hidden=true;
      continue;
    }
    const quad = verts.map(project);
    const maxX = Math.max(...quad.map(q=>q[0])), minX = Math.min(...quad.map(q=>q[0]));
    const transform = maxX > 0 && minX < width && matrix(quad);
    if (!transform) {panel.hidden=true;continue;}
    if (!panel.firstChild) {
      const artwork = imageFor(work);
      artwork.decoding = 'sync';
      panel.append(artwork);
    }
    panel.style.transform = transform;
    panel.style.zIndex = String(Math.round(90-(z-camera.z)));
    panel.style.opacity = String(Math.max(.27, 1-Math.max(0,z-camera.z-9)*.016));
    panel.hidden=false;
  }
}

function scheduleCamera() {
  if (cameraFrame || deckMode) return;
  cameraFrame = requestAnimationFrame(tick);
}
let previousTime = 0;
function tick(now) {
  cameraFrame=0;
  const ease = reduced.matches ? 1 : 1 - Math.exp(-Math.min(now-previousTime,40)/125);
  previousTime=now;
  camera.z += (target.z-camera.z)*ease;
  camera.yaw += (target.yaw-camera.yaw)*ease;
  const moving = Math.abs(target.z-camera.z) > .012 || Math.abs(target.yaw-camera.yaw) > .001;
  if (!moving) Object.assign(camera,target);
  drawRoom();
  if (moving) scheduleCamera();
}
new ResizeObserver(() => {
  const w = scene.clientWidth, h = scene.clientHeight;
  if (!w || !h) return;
  width=w; height=h; ratio=Math.min(devicePixelRatio || 1,2);
  wire.width=Math.round(w*ratio); wire.height=Math.round(h*ratio);
  target.yaw=points[active].side*(w<580?.31:.085);
  scheduleCamera();
}).observe(scene);

let wheelLast = -Infinity, wheelSum = 0;
scene.addEventListener('wheel', e => {
  if (e.ctrlKey || e.metaKey) return;
  const factor = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 150 : 1;
  const delta = (Math.abs(e.deltaX)>Math.abs(e.deltaY) ? e.deltaX:e.deltaY)*factor;
  if ((active === 0 && delta < 0) || (active === works.length-1 && delta > 0)) return;
  e.preventDefault();
  const time = performance.now();
  if (time-wheelLast < 400) return;
  wheelSum += delta;
  if (Math.abs(wheelSum) >= 30) {
    selectWork(active + Math.sign(wheelSum));
    wheelSum = 0; wheelLast=time;
  }
}, {passive:false});
scene.addEventListener('keydown',e => {
  if (e.target !== scene) return;
  if (e.key==='Enter') {e.preventDefault();openWork(active);}
  if (['ArrowRight','ArrowDown','ArrowLeft','ArrowUp','Home','End'].includes(e.key)) {
    e.preventDefault();
    selectWork(e.key==='Home'?0:e.key==='End'?works.length-1:active+(['ArrowRight','ArrowDown'].includes(e.key)?1:-1));
  }
});

function swipe(element,onDirection) {
  let touch;
  element.addEventListener('touchstart',e => {
    touch=e.touches.length===1 ? [e.touches[0].clientX,e.touches[0].clientY] : null;
  },{passive:true});
  element.addEventListener('touchcancel',()=>{touch=null;},{passive:true});
  element.addEventListener('touchend',e=>{
    if (!touch || !e.changedTouches.length) return;
    const dx=e.changedTouches[0].clientX-touch[0], dy=e.changedTouches[0].clientY-touch[1];
    touch=null;
    if (Math.abs(dx)>44 && Math.abs(dx)>Math.abs(dy)*1.35) onDirection(dx<0?1:-1);
  },{passive:true});
}
swipe(scene,direction=>selectWork(active+direction));

const deck=$('deck'), viewer=$('viewer'), stage=$('deck-viewport'), slide=$('slide'), readingPanel=$('reading'), picker=$('slide-select');
let deckLoad;
function loadDeck() {
  if (!deckLoad) deckLoad=import('./slides.js?v=typography-1').then(module => {
    slides=module.slides;
    slides.forEach((s,i)=>picker.add(new Option(pad(i+1)+' · '+s.title,String(i))));
    return slides;
  }).catch(error=>{deckLoad=null;throw error;});
  return deckLoad;
}

function scaleSlide() {
  if (stage.clientWidth) slide.style.transform='scale('+stage.clientWidth/1920+')';
}
new ResizeObserver(scaleSlide).observe(stage);

function animateSlide() {
  slide.getAnimations({subtree:true}).forEach(animation=>animation.cancel());
  cancelAnimationFrame(slideAnimation);
  if (reduced.matches) return;
  const animate = (selector, keys, duration, interval) => {
    slide.querySelectorAll(selector).forEach((element,i) => element.animate(keys, {
      duration, delay:Math.min(i*interval,490), easing:'cubic-bezier(.16,1,.3,1)',fill:'backwards'
    }));
  };
  animate('.draw-rule',[{clipPath:'inset(0 100% 0 0)'},{clipPath:'inset(0 0 0 0)'}],870,27);
  animate('.draw-dot',[{scale:'.15',opacity:0},{scale:'1',opacity:1}],470,49);
  animate('.stage-label',[{opacity:.25,translate:'0 12px'},{opacity:1,translate:'0 0'}],620,43);
  animate('.chart-fill, .draw-bar',[
    {scale:'0 1',transformOrigin:'left center'},{scale:'1 1',transformOrigin:'left center'}
  ],980,90);
  animate('.draw-tile',[{clipPath:'inset(98% 0 0 0)'},{clipPath:'inset(0 0 0 0)'}],760,64);
  animate('.artwork-reveal',[{clipPath:'inset(0 100% 0 0)'},{clipPath:'inset(0 0 0 0)'}],770,54);

  const values = [...slide.querySelectorAll('.count')].map((node,i) => {
    const original = node.textContent;
    const normalized = original.replace(/[ \u00a0\u202f]/g,'').replace(',','.');
    const value = Number(normalized), fraction=(normalized.split('.')[1]||'').length;
    const seen=document.createElement('span'), accessible=document.createElement('span');
    seen.setAttribute('aria-hidden','true');
    accessible.className='sr-only'; accessible.textContent=original;
    node.replaceChildren(seen,accessible);
    const formatter=new Intl.NumberFormat('ru-RU',{useGrouping:/\s/.test(original),minimumFractionDigits:fraction,maximumFractionDigits:fraction});
    return {seen,original,value,formatter,offset:Math.min(i*47,260)};
  });
  if (!values.length) return;
  const start=performance.now();
  const tickCount = now => {
    let running=false;
    for (const item of values) {
      const t=Math.max(0,Math.min(1,(now-start-item.offset)/760));
      if (t<1) running=true;
      item.seen.textContent=t===1?item.original:item.formatter.format(item.value*(1-(1-t)**3));
    }
    if (running) slideAnimation=requestAnimationFrame(tickCount);
  };
  tickCount(start);
}

function renderReading(content) {
  const heading = document.createElement('h2');
  heading.textContent=content.title;
  formatText(heading);
  const fragment=document.createDocumentFragment();
  fragment.append(heading);
  const paragraphs = content.id==='1644:51' ? [2,1,4,3,6,5,0].map(i=>content.text[i]) : content.text;
  paragraphs.forEach(([kind,text]) => {
    const p=document.createElement('p');
    if (kind==='heading') {
      const strong=document.createElement('strong');
      strong.textContent=text;
      p.append(strong);
    } else p.textContent=text;
    formatText(p, {reflow:true});
    fragment.append(p);
  });
  readingPanel.replaceChildren(fragment);
}
function setReading(value) {
  reading=value;
  stage.hidden=reading;
  readingPanel.hidden=!reading;
  $('reading-toggle').setAttribute('aria-pressed', String(reading));
  $('reading-toggle').textContent=reading?'Вид слайда':'Текст слайда';
  if (!reading && current>=0) {
    scaleSlide();
    showSlide(current, true);
  }
}

// These two charts use the exact ranges and counts stated on the source slides.
const charts = {
  '1644:51': {x:1212,y:376,width:612,start:0,end:148/216*100,color:'#176cff',label:'Доля задач ДПМ: 148 из 216'},
  '1644:133': {x:64,y:754,width:1020,start:70,end:80,color:'#f63b42',label:'70–80 процентов слайдов повторяют типовые'}
};
function addChart(spec) {
  const chart = document.createElement('div');
  chart.className='metric-chart';
  chart.setAttribute('role','img');
  chart.setAttribute('aria-label',spec.label);
  Object.assign(chart.style,{left:spec.x+'px',top:spec.y+'px',width:spec.width+'px',color:spec.color});
  const filled=document.createElement('span');
  filled.className='chart-fill';
  Object.assign(filled.style,{left:spec.start+'%',width:(spec.end-spec.start)+'%'});
  chart.append(filled);
  slide.append(chart);
}

function showSlide(i, replay = false) {
  if (!slides) return;
  i=Math.max(0,Math.min(slides.length-1,i));
  if (i===current && !replay) return;
  const content=slides[i];
  current=i;
  slide.style.backgroundColor=content.bg;
  // The slide pack is generated locally from source layouts. No remote HTML is inserted.
  slide.innerHTML=content.html;
  slide.querySelectorAll('p').forEach(block => {
    const prose = block.style.width && parseFloat(block.style.fontSize) < 48
      && block.style.whiteSpace !== 'nowrap';
    formatText(block, {reflow:Boolean(prose)});
    if (prose) block.classList.add('slide-prose');
  });
  if (charts[content.id]) addChart(charts[content.id]);
  if (!reading) {scaleSlide();animateSlide();}
  renderReading(content);
  readingPanel.scrollTop=0;
  $('chapter-title').textContent=pad(i+1)+' / '+pad(slides.length)+' · '+content.title;
  formatText($('chapter-title'));
  $('deck-progress').style.width=(100*(i+1)/slides.length)+'%';
  picker.value=String(i);
  $('slide-prev').disabled=i===0;
  $('slide-next').disabled=i===slides.length-1;
  announce.textContent='Слайд '+(i+1)+' из '+slides.length+': '+content.title;
  for (const next of slides.slice(i+1,i+3)) {
    for (const match of next.html.matchAll(/src="(assets\/[^"]+)"/g)) {const asset=new Image();asset.src=match[1];}
  }
}

function goSlide(index) {
  if (!slides) return;
  const i=Math.max(0,Math.min(slides.length-1,index));
  if (i!==current) location.hash='deck/'+(i+1);
}
$('slide-prev').onclick=()=>goSlide(current-1);
$('slide-next').onclick=()=>goSlide(current+1);
picker.onchange=()=>goSlide(Number(picker.value));
$('reading-toggle').onclick=()=>setReading(!reading);
$('deck-fullscreen').hidden=!document.fullscreenEnabled;
$('deck-fullscreen').onclick=async()=>{
  try {if (document.fullscreenElement) await document.exitFullscreen();else await viewer.requestFullscreen();}
  catch {announce.textContent='Полноэкранный режим недоступен';}
};
document.addEventListener('fullscreenchange',()=>{
  $('deck-fullscreen').setAttribute('aria-label', document.fullscreenElement?'Выйти из полноэкранного режима':'На весь экран');
  scaleSlide();
});
swipe(stage,direction=>goSlide(current+direction));
document.addEventListener('keydown',e=>{
  if (!deckMode || e.ctrlKey || e.altKey || e.metaKey || /SELECT|INPUT|TEXTAREA/.test(e.target.tagName)) return;
  if (e.key==='ArrowRight' || e.key==='PageDown') {e.preventDefault();goSlide(current+1);}
  else if (e.key==='ArrowLeft' || e.key==='PageUp') {e.preventDefault();goSlide(current-1);}
  else if (e.key==='Home' || e.key==='End') {e.preventDefault();goSlide(e.key==='Home'?0:(slides?.length??1)-1);}
});
reduced.addEventListener('change',()=>{
  scheduleCamera();
  if (deckMode && current>=0) showSlide(current,true);
});

let routeVersion=0;
async function route() {
  const version=++routeVersion;
  const hash=location.hash.slice(1);
  const match=/^deck(?:\/(\d+))?$/.exec(hash);
  const wasDeck=deckMode;
  deckMode=Boolean(match);
  document.querySelectorAll('[data-route]').forEach(a=>{
    if (a.dataset.route===(deckMode?'deck':'gallery')) a.setAttribute('aria-current','page');
    else a.removeAttribute('aria-current');
  });
  $('gallery').hidden=deckMode;
  deck.hidden=!deckMode;
  if (wasDeck!==deckMode) window.scrollTo(0,0);
  if (!deckMode) {
    if (document.fullscreenElement===viewer) document.exitFullscreen().catch(()=>{});
    current=-1;
    cancelAnimationFrame(slideAnimation);
    scheduleCamera();
    return;
  }
  if (dialogue.open) dialogue.close();
  $('chapter-title').textContent=slides?'':'Загрузка…';
  try {
    await loadDeck();
    if (version===routeVersion) showSlide(Math.max(0,Number(match[1]||1)-1),true);
  } catch {
    if (version===routeVersion) $('chapter-title').textContent='Презентация не загрузилась. Обновите страницу.';
  }
}
window.addEventListener('hashchange',route);
document.querySelectorAll('.scene-caption p, .scene-help span, .noscript').forEach(block => formatText(block));
selectWork(0,false);
route();
