import {todayInMoscow, isClosed, dailyItems} from './daily.mjs?v=20261016-add';
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const modes = {work:'В работе',waiting:'Ждём',approval:'На согласовании',verify:'На сверку',backlog:'Бэклог',paused:'Пауза',reference:'Справка',closed:'Выполнено',cancelled:'Не актуально'};
let data, manifest, envelope, view='board', mode='current', lane='all', query='', limit=30, opened;
const phone = matchMedia('(max-width:560px)');
const externalIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg>';
const date = value => value ? new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short'}).format(new Date(value+'T00:00:00')) : 'Без даты';
const fullDate = value => value ? new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric'}).format(new Date(value+'T00:00:00')) : 'Дата не указана';
const laneName = id => data.lanes.find(item=>item.id===id)?.title || id;
const isBackground = task => ['backlog','paused','reference'].includes(task.mode);
const needsCheck = task => !isClosed(task) && !isBackground(task) && (task.mode==='verify' || task.stale);
// Only an explicit, current review state counts as approval. Mixed-branch notes
// and an unconfirmed handoff remain waiting; dated-out records remain verification.
function onApproval(task){
  if(task.mode!=='waiting'||needsCheck(task))return false;
  const status=task.status.replace(/^[🟡🟢🔴]\s*;?\s*/u,'').trim();
  return !/[;—]|(?:^|\s)не(?:\s|$)|переда[её]тся/iu.test(status) && /(?:^|\s)(?:на (?:внешнем )?ревью|внешнее ревью|на согласовании)$/iu.test(status);
}
const shownMode = task => needsCheck(task)?'verify':onApproval(task)?'approval':task.mode;

const matches = (item, fields) => (!query || fields.map(key=>item[key] || '').join(' ').toLocaleLowerCase('ru').includes(query));
const sortTasks = tasks => [...tasks].sort((a,b)=>(b.confirmed || '').localeCompare(a.confirmed || '') || (a.due || '9999').localeCompare(b.due || '9999') || a.title.localeCompare(b.title,'ru'));
function modeMatch(task, selected=mode){
  if(selected==='closed') return isClosed(task);
  if(isClosed(task)) return false;
  if(selected==='all') return true;
  if(selected==='active') return !isBackground(task);
  if(selected==='current') return !task.stale && ['work','waiting'].includes(task.mode);
  if(selected==='verify') return needsCheck(task);
  if(selected==='approval'||selected==='waiting') return shownMode(task)===selected;
  if(selected==='backlog') return isBackground(task);
  return task.mode===selected;
}
function candidates(){return data.tasks.filter(task=>lane==='all' ? task.lane!=='ai' : task.lane===lane).filter(task=>matches(task,['id','title','status','action','owner']));}
function taskButton(task, compact=false){
  if(compact) return `<button data-open="${esc(task.id)}"><span class="id">${esc(task.id)}</span><span>${esc(task.title)}</span></button>`;
  const displayMode=shownMode(task);
  return `<button class="task" data-open="${esc(task.id)}" aria-label="${esc(task.id+' · '+task.title)}"><div class="task-meta"><span class="id">${esc(task.id)}</span><span class="mode-label ${esc(displayMode)}">${esc(modes[displayMode])}</span></div><h3>${esc(task.title)}</h3><p>${esc(task.action)}</p>${task.due?`<span class="due-label">${date(task.due)} · ${esc(task.dueLabel)}</span>`:''}<div class="task-bottom"><span>${esc(task.owner || 'Участники не указаны')}</span><time datetime="${esc(task.confirmed || '')}" title="Дата подтверждения">${date(task.confirmed)}</time></div></button>`;
}
function chart(tasks, title){
  const states=['work','waiting','approval','verify'];
  const counts=states.map(state=>tasks.filter(task=>shownMode(task)===state).length);
  const total=counts.reduce((a,b)=>a+b,0);let x=0;
  const rects=counts.map((count,i)=>{const width=total?count/total*100:0;const rect=`<rect x="${x}" width="${width}" height="8" class="${states[i]}"/>`;x+=width;return rect;}).join('');
  const labels=['В работе','Ждём','Согласование','На сверку'];
  return `<span class="team-chart"><span class="chart-heading">Состояния задач <span>${total} открытых</span></span><svg class="count-chart" role="img" aria-label="${esc(title)}: в работе ${counts[0]}, ждём ${counts[1]}, на согласовании ${counts[2]}, на сверку ${counts[3]}" viewBox="0 0 100 8" preserveAspectRatio="none">${rects}</svg><span class="chart-breakdown">${counts.map((count,i)=>`<span class="chart-value"><span class="chart-key"><i class="${states[i]}" aria-hidden="true"></i>${labels[i]}</span><strong>${count}</strong></span>`).join('')}</span></span>`;
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
    const tasks=data.tasks.filter(task=>task.lane===team.lane&&!isBackground(task)&&!isClosed(task));
    return `<button class="team team-${esc(team.lane)}" data-lane="${esc(team.lane)}" aria-label="Открыть все незакрытые задачи: ${esc(laneName(team.lane))}" aria-describedby="team-summary-${esc(team.lane)}"><span class="team-top"><strong>${esc(laneName(team.lane))}</strong><span class="signal ${esc(team.status)}">Связка: ${{yellow:'есть вопросы',red:'требует решения',green:'без рисков'}[team.status]} · ${date(team.date)}</span></span><span class="team-summary" id="team-summary-${esc(team.lane)}">${esc(team.summary)}</span>${chart(tasks,laneName(team.lane))}<span class="team-action">Все задачи по датам ${externalIcon}</span></button>`;
  }).join('');
  $('#focus').innerHTML=sortTasks(data.tasks.filter(task=>task.priority==='focus'&&!isClosed(task))).map(task=>taskButton(task,true)).join('');
  $('#deferred').innerHTML=data.tasks.filter(task=>task.priority==='deferred'&&!isClosed(task)).map(task=>taskButton(task,true)).join('');
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
    $('#modes').innerHTML=[['current','Свежие'],['active','Все открытые'],['waiting','Ждём'],['approval','Согласование'],['verify','На сверку'],['backlog','Бэклог'],['all','Все записи'],['closed','Закрытые']].map(([id,title])=>`<button data-mode="${id}" aria-pressed="${mode===id}">${title}<span class="count">${pool.filter(task=>modeMatch(task,id)).length}</span></button>`).join('');
    const tasks=sortTasks(pool.filter(task=>modeMatch(task)));
    const lanes=data.lanes.filter(item=>lane==='all'?item.id!=='ai':item.id===lane);
    const notes={closed:'Выполненные и неактуальные задачи. При необходимости можно вернуть в работу.',current:'Подтверждено в последние 21 день. Более старые и недатированные обязательства доступны в «На сверку».',active:'Все незакрытые задачи, сначала свежие подтверждения. Старые записи помечены «На сверку»; бэклог доступен отдельно.',waiting:'Ожидаем ответ, следующие шаги или подтверждение передачи. Задачи на ревью показаны в «Согласование», старые обязательства — в «На сверку».',approval:'Задачи с прямым актуальным подтверждением внешнего ревью или согласования. Неподтверждённая передача и смешанные статусы остаются в «Ждём».',verify:'Нет подтверждения за последние 21 день либо прямо требуется сверка. Это не означает, что работа остановлена.',backlog:'Отложенные задачи, паузы и справочные треки. Приоритетные отложенные инициативы также показаны выше.',all:'Все записи, включая бэклог. AI Stream показан отдельным блоком; выберите его в направлениях для полного списка.'};
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
  renderTaskActions(task);
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
  renderOverview();render();renderToday();if(location.hash)openTask(location.hash.slice(1));
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
  try{if(!crypto.subtle)throw new Error('Для открытия нужна защищённая страница HTTPS.');data=await decrypt($('#password').value);syncPassword=$('#password').value;$('#password').value='';show();if(location.hostname==='127.0.0.1')connectSync();}
  catch(error){$('#access-error').textContent=error.name==='OperationError'?'Пароль не подошёл. Проверьте его и попробуйте снова.':error.message;$('#password').focus();}
  finally{button.disabled=false;button.textContent='Открыть статус';}
});
$('#lock').addEventListener('click',()=>{
  closeDetail();syncPassword='';connected=false;syncEpoch++;data=null;createAttempt=null;$('#add-todo-form').reset();$('#add-todo-status').textContent='';$('#add-todo').open=false;$('#dashboard').hidden=true;$('#lock').hidden=true;$('#access').hidden=false;
  for(const selector of ['#teams','#focus','#deferred','#ai-branches','#content','#task-detail','#task-title','#task-id','#today-list','#carry-list','#upcoming-list','#task-actions','#action-status','#task-action-status','#todo-count','#today-date','#updated','#total-count','#sync-status'])$(selector).replaceChildren();
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
let syncPassword='', connected=false, busy=false, syncEpoch=0, polling=false, agendaKey='', taskActionsKey='', createAttempt=null;
const apiBase=location.hostname==='127.0.0.1'?location.origin:'http://127.0.0.1:8846';
async function api(route, body){
  const response=await fetch(apiBase+route,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+syncPassword,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(10000),targetAddressSpace:'loopback'});
  const result=await response.json();if(!response.ok)throw Object.assign(new Error(result.error||'Не удалось сохранить изменение.'),{status:response.status});return result;
}
function syncLabel(sync){
  return sync.local==='error'?'Ошибка локальной сборки. Изменения недоступны.':sync.publish==='published'?'Mac и сайт синхронизированы':sync.publish==='error'?'На Mac сохранено · публикация отложена':sync.publish==='deploying'?'На Mac сохранено · сайт обновляется':'Mac подключён · изменения сохраняются локально';
}
function acceptSnapshot(result){
  const changed=data?.revision!==result.data.revision;
  data=result.data;connected=result.sync.local!=='error';$('#sync-status').textContent=syncLabel(result.sync);$('#connect-sync').textContent=connected?'Обновить':'Подключить Mac';
  if(changed){renderOverview();render();if(opened)openTask(opened);}
  renderToday();if(opened)renderTaskActions(data.tasks.find(t=>t.id===opened));
}
async function connectSync(){
  if(!syncPassword||polling)return;const epoch=syncEpoch;polling=true;$('#connect-sync').disabled=true;
  try{const result=await api('/api/snapshot');if(epoch===syncEpoch&&data)acceptSnapshot(result);}
  catch(error){if(epoch!==syncEpoch||!data)return;connected=false;$('#connect-sync').textContent='Подключить Mac';$('#sync-status').textContent='Mac не подключён. Разрешите локальный доступ или откройте локальную версию.';renderToday();if(opened)renderTaskActions(data.tasks.find(t=>t.id===opened));}
  finally{polling=false;$('#connect-sync').disabled=false;}
}
function actionButtons(kind,item){
  const closed=kind==='task'?isClosed(item):item.state!=='open';
  const attrs=`data-change-kind="${kind}" data-change-id="${esc(item.id)}"`;
  const disabled=(!connected||busy)?'disabled':'';
  return closed?`<button ${attrs} data-change-state="open" ${disabled}>Вернуть</button>`:`<button ${attrs} data-change-state="done" ${disabled}>Выполнено</button><button ${attrs} data-change-state="cancelled" ${disabled}>Не актуально</button>`;
}
function renderTaskActions(task){
  if(!task)return;const key=[task.id,task.revision,connected,busy].join(':');
  if(key===taskActionsKey&&$('#task-actions').childElementCount)return;taskActionsKey=key;$('#task-actions').innerHTML=actionButtons('task',task);
  $('#task-action-status').textContent=connected?(isClosed(task)?'Задача закрыта. История сохранена.':'Действие закроет всю задачу. Для отдельной встречи используйте план дня.'):'Для изменения задачи подключите Mac в блоке «План дня».';
}
function todoRow(item,carry=false){
  const closed=item.state!=='open';
  return `<article class="todo-row ${closed?'todo-closed':''}"><div class="todo-time">${esc(item.time||(item.kind==='evening'?'Вечером':'В течение дня'))}${carry?`<small>${fullDate(item.date)}</small>`:''}</div><div class="todo-copy"><h3>${esc(item.title)}</h3>${item.detail?`<p>${esc(item.detail)}</p>`:''}${item.taskId?`<button class="todo-project" data-open="${esc(item.taskId)}">Открыть ${esc(item.taskId)}</button>`:''}${closed?`<span class="todo-state">${item.state==='done'?'Выполнено':'Не актуально'}</span>`:''}</div><div class="todo-actions">${item.derived?`<button data-open="${esc(item.taskId)}">Открыть задачу</button>`:actionButtons('todo',item)}</div></article>`;
}
function renderToday(){
  if(!data)return;renderAddTodo();const today=todayInMoscow();
  const key=[data.revision,today,connected,busy].join(':');if(key===agendaKey&&$('#today-list').childElementCount)return;agendaKey=key;
  $('#today-date').textContent=new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date())+' · Москва';
  const agenda=dailyItems(data,today),done=agenda.today.filter(i=>i.state==='done').length;
  $('#todo-count').textContent=agenda.today.length?`${done} из ${agenda.today.length} выполнено`:'Без назначенных действий';
  $('#today-list').innerHTML=agenda.today.length?agenda.today.map(i=>todoRow(i)).join(''):'<p class="today-empty">На сегодня действий не назначено. Задачи с сегодняшним ориентиром появятся здесь автоматически.</p>';
  $('#carry-wrap').hidden=!agenda.carry.length;$('#carry-title').textContent=`Не закрыто ранее · ${agenda.carry.length}`;$('#carry-list').innerHTML=agenda.carry.map(i=>todoRow(i,true)).join('');
  $('#upcoming-list').innerHTML=agenda.upcoming.length?'<h3>Далее</h3>'+agenda.upcoming.map(i=>todoRow(i,true)).join(''):'';
}
function renderAddTodo(){
  $('#add-todo-submit').disabled=!connected||busy;
  $('#add-todo-submit').textContent=busy?'Сохраняем…':'Добавить';
  for(const input of $('#add-todo-form').querySelectorAll('input'))input.disabled=busy;
  $('#add-todo-hint').textContent=connected?'Без времени — задача на весь день.':'Подключите Mac, чтобы сохранить задачу. Черновик можно заполнить сейчас.';
  if(!$('#new-todo-date').value)$('#new-todo-date').value=todayInMoscow();
}
$('#add-todo').addEventListener('toggle',()=>{
  if($('#add-todo').open){renderAddTodo();$('#new-todo-title').focus();}
});
$('#add-todo-form').addEventListener('submit',async event=>{
  event.preventDefault();if(!data||!connected||busy)return;
  const title=$('#new-todo-title').value.trim().replace(/\s+/g,' ');
  if(!title){$('#add-todo-status').textContent='Введите название задачи.';$('#new-todo-title').focus();return;}
  const item={title,date:$('#new-todo-date').value,time:$('#new-todo-time').value};
  const signature=JSON.stringify(item);
  if(!createAttempt||createAttempt.signature!==signature)createAttempt={signature,event:{eventId:crypto.randomUUID(),kind:'todo',state:'create',item}};
  const epoch=syncEpoch;busy=true;renderToday();if(opened)renderTaskActions(data.tasks.find(t=>t.id===opened));$('#add-todo-status').textContent='Сохраняем…';
  try{
    const result=await api('/api/change',createAttempt.event);
    if(epoch!==syncEpoch||!data)return;
    acceptSnapshot(result);createAttempt=null;$('#new-todo-title').value='';$('#new-todo-time').value='';
    $('#add-todo-status').textContent=(result.duplicate?'Такая задача уже есть в плане.':`Добавлено: «${title}».`)+(item.date>todayInMoscow()?' Смотрите в блоке «Далее».':item.date<todayInMoscow()?' Смотрите в «Не закрыто ранее».':'');
  }catch(error){
    if(epoch!==syncEpoch||!data)return;
    $('#add-todo-status').textContent=error.message+' Введённые данные сохранены в форме.';
    if(!error.status||error.status>=500||error.status===401){connected=false;$('#sync-status').textContent='Связь с Mac требует проверки. Подключитесь и повторите сохранение.';$('#connect-sync').textContent='Подключить Mac';}
  }finally{
    busy=false;if(epoch===syncEpoch&&data){renderToday();if(opened)renderTaskActions(data.tasks.find(t=>t.id===opened));$('#new-todo-title').focus({preventScroll:true});}
  }
});
$('#connect-sync').addEventListener('click',connectSync);
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-change-kind]');if(!button||!data||busy||!connected)return;
  const kind=button.dataset.changeKind,id=button.dataset.changeId,state=button.dataset.changeState;
  const item=(kind==='task'?data.tasks:data.plan.items).find(i=>i.id===id);if(!item)return;
  const epoch=syncEpoch;busy=true;renderToday();if(opened)renderTaskActions(data.tasks.find(t=>t.id===opened));
  const message=kind==='task'?$('#task-action-status'):$('#action-status');message.textContent='Сохраняем…';
  try{
    const result=await api('/api/change',{eventId:crypto.randomUUID(),kind,id,state,revision:item.revision});
    if(epoch!==syncEpoch||!data)return;acceptSnapshot(result);message.textContent=state==='open'?'Возвращено.':kind==='todo'?'Сохранено. Связанный проект остаётся открытым.':'Сохранено. Задача доступна в «Закрытых».';
  }catch(error){if(epoch!==syncEpoch||!data)return;message.textContent=error.message+' Обновите данные перед повторной попыткой.';connected=false;$('#sync-status').textContent='Связь с Mac требует проверки. Обновите данные перед следующим изменением.';$('#connect-sync').textContent='Подключить Mac';}
  finally{busy=false;if(epoch===syncEpoch&&data){renderToday();if(opened){$('#task-actions').innerHTML=actionButtons('task',data.tasks.find(t=>t.id===opened));taskActionsKey='';}const target=document.querySelector(`[data-change-kind="${kind}"][data-change-id="${CSS.escape(id)}"]:not(:disabled)`);target?.focus({preventScroll:true});}}
});
setInterval(()=>{if(data){renderToday();if(connected&&!busy)connectSync();}},15000);
window.addEventListener('focus',()=>{if(data){renderToday();if(connected)connectSync();}});
start();
