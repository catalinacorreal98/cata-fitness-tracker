export const ACTIVITY_COLORS = {
  HIIT: '#548ed4', Yoga: '#9570d4', Cycling: '#dc9962',
  Pilates: '#db71a4', Strength: '#588b9b', Run: '#65a581', Other: '#8493ab'
};
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = value => new Intl.DateTimeFormat('en-CA', {month:'short',day:'numeric',timeZone:'America/Toronto'}).format(new Date(value));
const time = value => new Intl.DateTimeFormat('en-CA', {hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'America/Toronto'}).format(new Date(value));
export function monthlyMarkup(events, filter = 'completed') {
  const selected = events.filter(e => filter === 'all' || (filter === 'completed' ? e.completed : !e.completed))
    .slice().sort((a,b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name));
  const types = Object.keys(ACTIVITY_COLORS);
  const counts = types.map(type => ({type, count:selected.filter(e=>e.type===type).length}));
  const chart = counts.map(({type,count}) => {
    const share = selected.length ? count/selected.length*100 : 0;
    return `<div class="monthly-bar-row"><div class="row"><span class="activity-label"><i style="background:${ACTIVITY_COLORS[type]}" aria-hidden="true"></i>${type}</span><span><b>${count}</b><span class="small"> · ${Math.round(share)}%</span></span></div><div class="bar" role="img" aria-label="${type}: ${count} classes, ${Math.round(share)}%"><div style="width:${share}%;background:${ACTIVITY_COLORS[type]}"></div></div></div>`;
  }).join('');
  const rows = selected.map(e => {
    const color = ACTIVITY_COLORS[e.type] || ACTIVITY_COLORS.Other;
    return `<tr style="--activity-color:${color}"><td class="monthly-date">${date(e.start)}<span class="small">${e.allDay?'All day':time(e.start)+'–'+time(e.end)}</span></td><td class="monthly-name">${escape(e.name)}${e.source==='manual'?'<span class="small">Manual</span>':''}</td><td><span class="activity-label"><i style="background:${color}" aria-hidden="true"></i>${escape(e.type)}</span></td>${filter==='all'?`<td class="small">${e.completed?'Completed':'Upcoming'}</td>`:''}</tr>`;
  }).join('');
  const label = {completed:'Completed',upcoming:'Upcoming',all:'All classes'}[filter] || 'Completed';
  return `<div class="monthly-layout"><section class="panel monthly-chart"><div class="row"><h2>By activity</h2><span class="pill">${selected.length} classes</span></div>${chart}</section><section class="panel monthly-list"><div class="row"><h2>${label}</h2><span class="small">Date ↑</span></div><div class="monthly-table-wrap"><table class="monthly-table"><caption class="sr-only">${label} this month, sorted by date</caption><thead><tr><th scope="col">Date</th><th scope="col">Class</th><th scope="col">Type</th>${filter==='all'?'<th scope="col">Status</th>':''}</tr></thead><tbody>${rows || `<tr><td colspan="${filter==='all'?4:3}" class="monthly-empty">No ${filter==='all'?'':filter+' '}classes</td></tr>`}</tbody></table></div></section></div>`;
}
