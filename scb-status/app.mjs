const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const modes = {work:'В работе',waiting:'Ждём',verify:'На сверку',backlog:'Бэклог',paused:'Пауза',reference:'Справка'};
let data, manifest, envelope, view='board', mode='current', lane='all', query='', limit=30, opened;
const phone = matchMedia('(max-width:560px)');
const externalIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg>';
const date = value => value ? new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short'}).format(new Date(value+'T00:00:00')) : 'Без даты';
const fullDate = value => value ? new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric'}).format(new Date(value+'T00:00:00')) : 'Дата не указана';
const laneName = id => data.lanes.find(item=>item.id===id)?.title || id;
const isBackground = task => ['backlog','paused','reference'].includes(task.mode);
const needsCheck = task => !isBackground(task) && (task.mode==='verify' || task.stale);
const matches = (item, fields) => (!query || fields.map(key=>item[key] || '').join(' ').toLocaleLowerCase('ru').includes(query));
const sortTasks = tasks => [...tasks].sort((a,b)=>(b.confirmed || '').localeCompare(a.confirmed || '') || (a.due || '9999').localeCompare(b.due || '9999') || a.title.localeCompare(b.title,'ru'));
function modeMatch(task, selected=mode){
  if(selected==='all') return true;
  if(selected==='active') return !isBackground(task);
  if(selected==='current') return !task.stale && ['work','waiting'].includes(task.mode);
  if(selected==='verify') return needsCheck(task);
  if(selected==='backlog') return isBackground(task);
  return task.mode===selected;
}
function candidates(){return data.tasks.filter(task=>lane==='all' ? task.lane!=='ai' : task.lane===lane).filter(task=>matches(task,['id','title','status','action','owner']));}
function taskButton(task, compact=false){
  if(compact) return `<button data-open="${esc(task.id)}"><span class="id">${esc(task.id)}</span><span>${esc(task.title)}</span></button>`;
  const shownMode=needsCheck(task)?'verify':task.mode;
  return `<button class="task" data-open="${esc(task.id)}" aria-label="${esc(task.id+' · '+task.title)}"><div class="task-meta"><span class="id">${esc(task.id)}</span><span class="mode-label ${esc(shownMode)}">${esc(modes[shownMode])}</span></div><h3>${esc(task.title)}</h3><p>${esc(task.action)}</p>${task.due?`<span class="due-label">${date(task.due)} · ${esc(task.dueLabel)}</span>`:''}<div class="task-bottom"><span>${esc(task.owner || 'Участники не указаны')}</span><time datetime="${esc(task.confirmed || '')}" title="Дата подтверждения">${date(task.confirmed)}</time></div></button>`;
}
function chart(tasks, title){
  const counts=[tasks.filter(t=>!needsCheck(t)&&t.mode==='work').length,tasks.filter(t=>!needsCheck(t)&&t.mode==='waiting').length,tasks.filter(needsCheck).length];
  const total=counts.reduce((a,b)=>a+b,0);let x=0;
  const rects=counts.map((count,i)=>{const width=total?count/total*100:0;const rect=`<rect x="${x}" width="${width}" height="8" class="${['work','waiting','verify'][i]}"/>`;x+=width;return rect;}).join('');
  return `<svg class="count-chart" role="img" aria-label="${esc(title)}: в работе ${counts[0]}, ждём ${counts[1]}, на сверку ${counts[2]}" viewBox="0 0 100 8" preserveAspectRatio="none">${rects}</svg>`;
}
function datedTasks(tasks){
  const groups = new Map();
  for(const task of tasks){const key=task.confirmed || '';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(task);}
  return [...groups].map(([confirmed,items])=>`<section class="task-date-group"><h4>${confirmed?`<time datetime="${esc(confirmed)}">${fullDate(confirmed)}</time>`:'Дата не указана'}<span>${items.length} записей</span></h4><div class="dated-tasks">${items.map(task=>taskButton(task)).join('')}</div></section>`).join('');
}
function renderOverview(){
  $('#updated').textContent=`Обновлено ${date(data.updated)} ${data.updated.slice(0,4)} · Свежие подтверждения первыми`;
  $('#edition').textContent=manifest.mode==='preview'?'Локальный предпросмотр':'Закрытый рабочий статус';
  $('#teams').innerHTML=data.teams.map(team=>{
    const tasks=data.tasks.filter(task=>task.lane===team.lane&&!isBackground(task));
    const checks=tasks.filter(needsCheck).length;
    return `<button class="team team-${esc(team.lane)}" data-lane="${esc(team.lane)}" aria-label="Открыть все незакрытые задачи: ${esc(laneName(team.lane))}"><span class="team-top"><strong>${esc(laneName(team.lane))}</strong><span class="signal ${esc(team.status)}">${{yellow:'Есть вопросы',red:'Требует решения',green:'Без рисков'}[team.status]} · ${date(team.date)}</span></span><span class="team-summary">${esc(team.summary)}</span><span class="team-data"><span><strong>${tasks.length}</strong> открытых задач</span><span><strong>${checks}</strong> на сверку</span></span>${chart(tasks,laneName(team.lane))}<span class="team-action">Все задачи по датам ${externalIcon}</span></button>`;
  }).join('');
  $('#focus').innerHTML=sortTasks(data.tasks.filter(task=>task.priority==='focus')).map(task=>taskButton(task,true)).join('');
  $('#deferred').innerHTML=data.tasks.filter(task=>task.priority==='deferred').map(task=>taskButton(task,true)).join('');
  $('#ai-branches').innerHTML=sortTasks(data.ai.branches).map(branch=>`<article class="ai-branch"><div class="branch-heading"><h3><button data-open="${esc(branch.id)}" class="text-link">${esc(branch.title)} ${externalIcon}</button></h3><time datetime="${esc(branch.confirmed)}">${date(branch.confirmed)}</time></div><ol class="branch-milestones">${branch.milestones.map(text=>`<li>${esc(text)}</li>`).join('')}</ol><p class="branch-next"><strong>Далее</strong>${esc(branch.current)}</p><div class="reference-links">${referenceLinks(branch.references)}</div></article>`).join('');
  $('#total-count').textContent=`${data.tasks.length} записей · AI Stream отдельно`;
  $('#lane').innerHTML='<option value="all">Все направления</option>'+data.lanes.map(item=>`<option value="${esc(item.id)}">${esc(item.title)}</option>`).join('');
}
function referenceLinks(references){return references.map(item=>`<a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.title)} ${externalIcon}</a>`).join('');}
function render(){
  if(phone.matches && view==='board' && lane==='all')lane='branding';
  $('#lane option[value="all"]').hidden=phone.matches&&view==='board';
  $('#lane').value=lane;
  for(const button of document.querySelectorAll('[data-view]')) button.setAttribute('aria-pressed',String(button.dataset.view===view));
  $('#modes').hidden=view!=='board';
  $('#workspace-title').textContent=view==='board'&&lane!=='all'?`${laneName(lane)} · задачи`:'Рабочая доска';
  if(view==='board'){
    const pool=candidates();
    $('#modes').innerHTML=[['current','Свежие'],['active','Все открытые'],['waiting','Ждём'],['verify','На сверку'],['backlog','Бэклог'],['all','Все записи']].map(([id,title])=>`<button data-mode="${id}" aria-pressed="${mode===id}">${title}<span class="count">${pool.filter(task=>modeMatch(task,id)).length}</span></button>`).join('');
    const tasks=sortTasks(pool.filter(task=>modeMatch(task)));
    const lanes=data.lanes.filter(item=>lane==='all'?item.id!=='ai':item.id===lane);
    const notes={current:'Подтверждено в последние 21 день. Более старые и недатированные обязательства доступны в «На сверку».',active:'Все незакрытые задачи, сначала свежие подтверждения. Старые записи помечены «На сверку»; бэклог доступен отдельно.',waiting:'Все ожидания ответа, ревью или решения. Более старые подтверждения помечены «На сверку».',verify:'Нет подтверждения за последние 21 день либо прямо требуется сверка. Это не означает, что работа остановлена.',backlog:'Отложенные задачи, паузы и справочные треки. Приоритетные отложенные инициативы также показаны выше.',all:'Все записи, включая бэклог. AI Stream показан отдельным блоком; выберите его в направлениях для полного списка.'};
    $('#view-note').textContent=`${tasks.length} записей. ${notes[mode]}`;
    $('#content').innerHTML=tasks.length?`<div class="board ${lanes.length===1?'single':''}">${lanes.map(item=>{const group=tasks.filter(task=>task.lane===item.id);return `<section class="lane lane-${esc(item.id)}" aria-label="${esc(item.title)}"><div class="lane-head"><h3>${esc(item.title)}</h3><span>${group.length}</span></div><div class="lane-tasks">${group.length?(lanes.length===1?datedTasks(group):group.map(task=>taskButton(task)).join('')):'<p class="lane-empty">В этом срезе записей нет.<br>Посмотрите другие режимы.</p>'}</div></section>`;}).join('')}</div>`:empty('Задачи не найдены','Измените поиск или выберите другой режим.');
  }else if(view==='results'){
    const items=data.results.filter(item=>(lane==='all'||item.lane===lane)&&matches(item,['id','title','outcome','remaining']));
    $('#view-note').textContent=`${items.length} результатов и этапов. Сначала свежие срезы; дата отчёта не всегда совпадает с днём завершения.`;
    $('#content').innerHTML=items.length?`<div class="log">${items.slice(0,limit).map(item=>`<article class="log-item"><div class="log-date"><span>${date(item.eventDate)}</span><span>${esc(item.id)} · ${esc(laneName(item.lane))}</span></div><div><h3>${esc(item.title)}</h3><p>${esc(item.outcome)}</p>${item.remaining&&!/^—(?: |$)/.test(item.remaining)?`<p class="remaining">Остаток: ${esc(item.remaining)}</p>`:''}<p>${esc(item.dateLabel)}</p>${item.taskIds.filter(id=>data.tasks.some(task=>task.id===id)).map(id=>`<a href="#${esc(id)}" data-open="${esc(id)}">К задаче ${esc(id)}</a>`).join(' · ')}</div></article>`).join('')}${more(items.length)}</div>`:empty('Результаты не найдены','Попробуйте другое направление или поисковый запрос.');
  }else{
    const items=data.changes.filter(item=>matches(item,['text']));
    $('#view-note').textContent='Журнал правок документа. Старые записи перенесены из update_type; даты внутри формулировок сохранены. Фильтр направления применяется к задачам и результатам.';
    $('#content').innerHTML=items.length?`<div class="log">${items.slice(0,limit).map(item=>`<article class="log-item"><div class="log-date">${item.date?date(item.date):'До перестройки'}</div><p class="change-text">${esc(item.text)}</p></article>`).join('')}${more(items.length)}</div>`:empty('Изменения не найдены','Очистите поиск, чтобы увидеть весь журнал.');
  }
}
const empty=(title,message)=>`<div class="empty"><h3>${esc(title)}</h3><p>${esc(message)}</p><button data-reset>Сбросить фильтры</button></div>`;
const more=total=>total>limit?`<button class="show-more" data-more>Показать ещё ${Math.min(30,total-limit)}</button>`:'';
function openTask(id){
  const task=data?.tasks.find(item=>item.id===id);if(!task)return;
  opened=id;$('#task-id').textContent=`${task.id} · ${laneName(task.lane)}`;$('#task-title').textContent=task.title;
  $('#task-detail').innerHTML=`<dl><dt>Статус</dt><dd>${esc(task.status)}</dd><dt>Следующее действие</dt><dd>${esc(task.action)}</dd><dt>Участники</dt><dd>${esc(task.owner || 'Не указаны')}</dd>${task.due?`<dt>Ориентир</dt><dd>${date(task.due)} · ${esc(task.dueLabel)}</dd>`:''}<dt>Последнее подтверждение</dt><dd>${date(task.confirmed)}${task.stale?' · требуется сверка':''}</dd><dt>Источник</dt><dd>${esc(task.source)}</dd></dl>${task.references.length?`<div class="reference-links">${referenceLinks(task.references)}</div>`:''}`;
  $('#copy-status').textContent='';
  if(!$('#task-dialog').open)$('#task-dialog').showModal();
  history.replaceState(null,'',`#${id}`);
}
function closeDetail(){ $('#task-dialog').close();history.replaceState(null,'',location.pathname+location.search);opened=null; }
async function getJSON(file){const response=await fetch(new URL(file,location.href),{cache:'no-store'});if(!response.ok)throw new Error(`Не найден файл текущей сборки (${response.status}). Пересоберите статус и обновите страницу.`);return response.json();}
function fail(error){$('#loading').hidden=true;$('#access').hidden=true;$('#dashboard').hidden=true;$('#failure').hidden=false;$('#failure-message').textContent=error.message;}
async function start(){
  try{
    manifest=await getJSON('manifest.json');
    if(manifest.mode==='encrypted'){envelope=await getJSON(manifest.payload);$('#loading').hidden=true;$('#access').hidden=false;$('#password').focus();}
    else if(manifest.mode==='preview'){data=await getJSON(manifest.payload);show();}
    else throw new Error('Неизвестный формат сборки. Пересоберите статус.');
  }catch(error){fail(error);}
}
function show(){
  $('#loading').hidden=true;$('#access').hidden=true;$('#dashboard').hidden=false;$('#lock').hidden=manifest.mode!=='encrypted';
  renderOverview();render();if(location.hash)openTask(location.hash.slice(1));
}
async function decrypt(password){
  const decode=value=>Uint8Array.from(atob(value),char=>char.charCodeAt(0));
  const keyMaterial=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:decode(envelope.salt),iterations:envelope.iterations,hash:'SHA-256'},keyMaterial,{name:'AES-GCM',length:256},false,['decrypt']);
  const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(envelope.iv)},key,decode(envelope.ciphertext));
  return JSON.parse(new TextDecoder().decode(bytes));
}
$('#unlock').addEventListener('submit',async event=>{
  event.preventDefault();const button=event.submitter;button.disabled=true;button.textContent='Открываем…';$('#access-error').textContent='';
  try{if(!crypto.subtle)throw new Error('Для открытия нужна защищённая страница HTTPS.');data=await decrypt($('#password').value);$('#password').value='';show();}
  catch(error){$('#access-error').textContent=error.name==='OperationError'?'Пароль не подошёл. Проверьте его и попробуйте снова.':error.message;$('#password').focus();}
  finally{button.disabled=false;button.textContent='Открыть статус';}
});
$('#lock').addEventListener('click',()=>{
  closeDetail();data=null;$('#dashboard').hidden=true;$('#lock').hidden=true;$('#access').hidden=false;
  for(const selector of ['#teams','#focus','#deferred','#ai-branches','#content','#task-detail','#task-title','#task-id'])$(selector).replaceChildren();
  query='';$('#search').value='';view='board';mode='current';lane='all';limit=30;$('#password').focus();
});
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-open],[data-mode],[data-view],[data-lane],[data-more],[data-reset]');if(!button||!data)return;
  if(button.dataset.open){event.preventDefault();openTask(button.dataset.open);return;}
  if(button.dataset.mode)mode=button.dataset.mode;
  if(button.dataset.view){view=button.dataset.view;limit=30;}
  if(button.dataset.lane){lane=button.dataset.lane;view='board';mode='active';query='';$('#search').value='';limit=30;}
  if(button.hasAttribute('data-more'))limit+=30;
  if(button.hasAttribute('data-reset')){query='';$('#search').value='';lane='all';mode='current';}
  render();
  if(button.dataset.lane){$('#workspace-title').tabIndex=-1;$('#workspace-title').focus({preventScroll:true});$('#workspace').scrollIntoView();}
});
$('#lane').addEventListener('change',event=>{lane=event.target.value;limit=30;render();});
$('#search').addEventListener('input',event=>{query=event.target.value.trim().toLocaleLowerCase('ru');limit=30;render();});
$('#close-detail').addEventListener('click',closeDetail);
$('#task-dialog').addEventListener('cancel',event=>{event.preventDefault();closeDetail();});
$('#task-dialog').addEventListener('click',event=>{if(event.target===$('#task-dialog')){const r=event.target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeDetail();}});
$('#copy-link').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(new URL(`#${opened}`,location.href).href);$('#copy-status').textContent='Ссылка скопирована.';}catch{$('#copy-status').textContent='Скопируйте адрес из строки браузера — он ведёт на эту задачу.';}});
$('#retry').addEventListener('click',()=>location.reload());
window.addEventListener('hashchange',()=>{if(data&&location.hash)openTask(location.hash.slice(1));});
phone.addEventListener('change',()=>{if(data)render();});
start();
