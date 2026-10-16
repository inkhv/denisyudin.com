export const todayInMoscow = (now = new Date()) => new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export const isClosed = task => ['closed','cancelled'].includes(task.mode);
export function completedOn(item) {
  const changed=new Date(item.changedAt || '');
  return Number.isNaN(changed.getTime()) ? item.date : todayInMoscow(changed);
}
export function dailyItems(data, today=todayInMoscow()) {
  const explicit=data.plan?.items || [];
  const planned=new Set(explicit.filter(i=>i.date===today).map(i=>i.taskId));
  const derived=data.tasks.filter(t=>!isClosed(t)&&t.due===today&&!planned.has(t.id)).map(t=>({id:'due-'+t.id,taskId:t.id,date:today,time:'',title:t.title,detail:t.dueLabel,state:'open',derived:true}));
  const order=i=>i.time || (i.kind==='evening'?'25:00':'24:00');
  const archived=i=>i.state!=='open'&&completedOn(i)<today;
  return {
    today:[...explicit.filter(i=>i.state==='open'?i.date===today:!archived(i)),...derived].sort((a,b)=>order(a).localeCompare(order(b))),
    carry:explicit.filter(i=>i.date<today&&i.state==='open').sort((a,b)=>b.date.localeCompare(a.date)),
    upcoming:explicit.filter(i=>i.date>today&&i.state==='open').sort((a,b)=>a.date.localeCompare(b.date)||order(a).localeCompare(order(b))),
    completed:explicit.filter(archived).sort((a,b)=>completedOn(b).localeCompare(completedOn(a))||(b.changedAt||'').localeCompare(a.changedAt||'')||b.date.localeCompare(a.date)),
  };
}
