const $ = id => document.getElementById(id);
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const ease = 'cubic-bezier(.16,1,.3,1)';
const milestones = [
  ['15.09','Собрали задачи в YouTrack','Команда подняла задачи на презентации и завела отдельный чат инициативы.'],
  ['23.09','Перенесли первый дек Халвы','Claude перенёс из PPTX в Figma 22 слайда. Это был первый из трёх переносов, описанных в отчёте.'],
  ['12.10','Запустили общий пул скиллов','Шаблоны и правила сборки стали доступны в общем репозитории. Правки можно было публиковать для всей команды.'],
  ['21.10','Описали работу с данными','Команда зафиксировала схему: подготовить копию с масками, сверстать её и вернуть значения уже в Figma.'],
  ['30.10','Проверили полный цикл','Презентация из 25 слайдов прошла обезличивание и обратную подстановку значений.'],
  ['03.11','Подвели итоги теста ОВИ','Вёрстку по шаблону оставили за Claude, подготовку текста и структуры — за ОВИ. Тесты решили продолжить.'],
];

function showMilestone(index, animate = true) {
  const [,title,text] = milestones[index];
  const heading = document.createElement('h4');
  const copy = document.createElement('p');
  heading.textContent=title;
  copy.textContent=text;
  $('timeline-story').replaceChildren(heading,copy);
  [...$('timeline-nav').children].forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
  if (animate && !reduce.matches) $('timeline-story').animate(
    [{opacity:.15,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}], {duration:410,easing:ease}
  );
}
milestones.forEach(([date,title],i)=>{
  const button=document.createElement('button');
  button.type='button';
  button.textContent=date;
  button.setAttribute('aria-label',date+' — '+title);
  button.addEventListener('click',()=>showMilestone(i));
  button.addEventListener('keydown',e=>{
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
    e.preventDefault();
    const next=e.key==='Home'?0:e.key==='End'?milestones.length-1:
      (i+(e.key==='ArrowRight'?1:-1)+milestones.length)%milestones.length;
    $('timeline-nav').children[next].focus();
    showMilestone(next);
  });
  $('timeline-nav').append(button);
});
showMilestone(0,false);

const demo = [
  {phase:'ДО ОБЕЗЛИЧИВАНИЯ',name:'Проект «Север»',kpi:'42 заявки',values:[8,14,20],scale:45,
    label:'Распределение: 8, 14 и 20 заявок',note:'Исходные значения находятся в рабочем файле.'},
  {phase:'КОПИЯ ДЛЯ ВЁРСТКИ',name:'Проект А',kpi:'88 заявок',values:[18,32,38],scale:45,
    label:'Вымышленные значения: 18, 32 и 38 заявок',note:'На этом этапе Claude получает только копию с подменными названиями и цифрами.'},
  {phase:'ПОСЛЕ ВЁРСТКИ',name:'Проект «Север»',kpi:'42 заявки',values:[8,14,20],scale:45,
    label:'Возвращённые значения: 8, 14 и 20 заявок',note:'Плагин возвращает исходные значения и перестраивает график в готовом макете.'},
];
let demoIndex=0;
$('demo-controls').addEventListener('click',e=>{
  const button=e.target.closest('[data-demo]');
  if (!button) return;
  const i=Number(button.dataset.demo);
  if (i===demoIndex) return;
  demoIndex=i;
  const item=demo[i];
  $('demo-phase').textContent=item.phase;
  $('demo-name').textContent=item.name;
  $('demo-kpi').textContent=item.kpi;
  $('demo-note').textContent=item.note;
  $('demo-slide').classList.toggle('masked',i===1);
  $('demo-plot').setAttribute('aria-label',item.label);
  [...$('demo-plot').children].forEach((bar,j)=>{
    bar.style.setProperty('--level',(item.values[j]/item.scale*100)+'%');
    bar.firstElementChild.textContent=item.values[j];
  });
  [...$('demo-controls').children].forEach((el,j)=>el.setAttribute('aria-pressed',String(i===j)));
  if (!reduce.matches) $('demo-name').animate([{opacity:.2},{opacity:1}],{duration:390,easing:ease});
});

const formatter = new Intl.NumberFormat('ru');
const observeMotion=new IntersectionObserver(entries=>{
  for (const {target,isIntersecting} of entries) {
    if (!isIntersecting) continue;
    observeMotion.unobserve(target);
    if (reduce.matches) continue;
    if (target.hasAttribute('data-draw')) {
      target.firstElementChild.animate([{transform:'scaleX(0)'},{transform:'scaleX(1)'}],{duration:1050,easing:ease});
    } else if (target.hasAttribute('data-strip')) {
      [...target.children].forEach((img,i)=>img.animate(
        [{clipPath:'inset(100% 0 0 0)',opacity:.15},{clipPath:'inset(0 0 0 0)',opacity:1}],
        {duration:640,delay:i*65,easing:ease,fill:'backwards'}
      ));
    } else {
      const final=target.textContent;
      const visual=document.createElement('span');
      const spoken=document.createElement('span');
      visual.setAttribute('aria-hidden','true');
      Object.assign(spoken.style,{position:'absolute',width:'1px',height:'1px',overflow:'hidden',clipPath:'inset(50%)'});
      spoken.textContent=final;
      target.replaceChildren(visual,spoken);
      const value=Number(target.dataset.count);
      const start=performance.now();
      const tick=now=>{
        const t=Math.max(0,Math.min(1,(now-start)/840));
        if (reduce.matches || t===1) {target.textContent=final;return;}
        visual.textContent=formatter.format(Math.round(value*(1-(1-t)**3)));
        requestAnimationFrame(tick);
      };
      tick(start);
    }
  }
},{threshold:.24});
document.querySelectorAll('[data-count],[data-draw],[data-strip]').forEach(el=>observeMotion.observe(el));

const contents=[...document.querySelectorAll('.contents a')];
const chapters=contents.map(link=>document.querySelector(link.hash));
let frame=0;
function trackScroll(){
  frame=0;
  const max=document.documentElement.scrollHeight-innerHeight;
  $('read-progress').style.transform='scaleX('+(max>0?Math.min(1,scrollY/max):0)+')';
  let active=-1;
  chapters.forEach((chapter,i)=>{if(chapter.getBoundingClientRect().top<innerHeight*.46) active=i;});
  contents.forEach((link,i)=>{if(i===active) link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});
}
function scheduleTrack(){if(!frame) frame=requestAnimationFrame(trackScroll);}
addEventListener('scroll',scheduleTrack,{passive:true});
addEventListener('resize',scheduleTrack);
scheduleTrack();
