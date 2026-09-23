import { monthlyMarkup, ACTIVITY_COLORS } from './monthly.js';
const $=selector=>document.querySelector(selector);
const TYPES=['HIIT','Yoga','Cycling','Pilates','Strength','Run','Other'];
const colors=ACTIVITY_COLORS;
let data,tab='overview',busy=false,goalsDirty=false,monthFilter='completed';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateLabel=(date,options={month:'short',day:'numeric'})=>new Intl.DateTimeFormat('en-CA',{...options,timeZone:'America/Toronto'}).format(new Date(date.length===10?date+'T12:00:00-04:00':date));
const timeLabel=date=>new Intl.DateTimeFormat('en-CA',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'America/Toronto'}).format(new Date(date));
function notify(message,error=false){$('#feedback').textContent=message;$('#feedback').hidden=!message;$('#feedback').classList.toggle('error',error);$('#feedback').setAttribute('role',error?'alert':'status');}
async function api(path,{method='GET',body}={}){
  const response=await fetch('/api/'+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,credentials:'same-origin',cache:'no-store'});
  const result=await response.json();
  if(response.status===401){showSignedOut(true);throw new Error('Please sign in again.');}
  if(!response.ok)throw new Error(result.error||'Please try again.');
  return result;
}
function showSignedOut(configured){
  $('#welcome').hidden=false;$('#workspace').hidden=true;$('#navigation').hidden=true;$('#motion-add').hidden=true;$('#refresh').hidden=true;$('#reconnect').hidden=true;$('#sign-out').hidden=true;
  $('#google-signin').hidden=!configured;$('#connection-status').textContent=configured?'Not connected':'Setup in progress';
  $('#welcome-title').textContent=configured?'Your private fitness journal':'Your tracker is ready for setup';
  $('#welcome-copy').textContent=configured?'Sign in with your Google account to connect your calendar.':'Your private database and Google connection still need to be configured.';
}
function metric(title,label,s){const percent=s.percentage??0;return `<section class="panel"><div class="row"><h2>${title}</h2><span class="small">${label}</span></div><div class="metricbody"><div><div class="big">${s.completed} <span>/ ${s.target??'—'}</span></div><div class="small">Classes completed</div></div><div class="ring" role="img" aria-label="${s.target?percent+'% of '+s.target+'-class goal':'Goal not set'}"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="51" fill="none" stroke="var(--track)" stroke-width="9"/><circle cx="60" cy="60" r="51" fill="none" stroke="#e65b98" stroke-width="9" stroke-linecap="round" stroke-dasharray="${320.442*percent/100} 320.442"/></svg><div class="ringtext"><strong>${s.target?percent+'%':'—'}</strong><span class="small">of goal</span></div></div></div><div class="foot"><span><b>${s.upcoming}</b> upcoming</span><span>${s.target?(s.remaining?'<b>'+s.remaining+'</b> to your goal':'Goal reached'):'<button type="button" data-set-goal>Set goal</button>'}</span></div></section>`;}
function showTab(value){tab=value;document.querySelectorAll('[data-view]').forEach(e=>e.hidden=e.dataset.view!==tab);document.querySelectorAll('[data-tab]').forEach(e=>e.setAttribute('aria-pressed',String(e.dataset.tab===tab)));$('#motion-add').hidden=tab!=='overview';}
function renderMonthly(){
  $('#monthly-period').textContent=dateLabel(data.periods.month,{month:'long',year:'numeric'});
  $('#monthly-content').innerHTML=monthlyMarkup(data.monthEvents||[],monthFilter);
  document.querySelectorAll('[data-month-filter]').forEach(button=>{
    const status=button.dataset.monthFilter;
    const count=(data.monthEvents||[]).filter(e=>status==='all'||(status==='completed'?e.completed:!e.completed)).length;
    button.textContent=({completed:'Completed',upcoming:'Upcoming',all:'All'})[status]+' · '+count;
    button.setAttribute('aria-pressed',String(status===monthFilter));
  });
}
document.querySelectorAll('[data-month-filter]').forEach(button=>button.onclick=()=>{monthFilter=button.dataset.monthFilter;renderMonthly();});
function render(){
  if(!data?.authenticated)return showSignedOut(data?.configured);
  $('#welcome').hidden=true;$('#workspace').hidden=false;$('#navigation').hidden=false;$('#refresh').hidden=false;$('#reconnect').hidden=false;$('#sign-out').hidden=false;showTab(tab);
  renderMonthly();
  $('#connection-status').textContent=data.error?'Needs attention':data.connected?'Calendar connected':'Not connected';
  $('#last-sync').textContent='Last synced with Google Calendar · '+(data.lastSync?dateLabel(data.lastSync,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}):'Not yet synced');
  const days=data.periods.days,range=dateLabel(days[0])+' – '+dateLabel(days[6]);
  $('.metrics').innerHTML=metric('This week',range,data.week)+metric('This month',dateLabel(data.periods.month,{month:'long',year:'numeric'}),data.month);
  document.querySelectorAll('[data-set-goal]').forEach(b=>b.onclick=()=>showTab('goals'));
  $('#motion-total').textContent=data.events.length+' classes';$('#mix-period').textContent='Completed + upcoming · '+range;$('#calendar-period').textContent=range;
  $('#motion-mix').innerHTML=TYPES.filter(type=>type!=='Other'||data.events.some(e=>e.type==='Other')).map(type=>{const n=data.events.filter(e=>e.type===type).length,p=data.events.length?n/data.events.length*100:0;return `<div class="mixrow"><div class="row"><span>${type}</span><span>${n}${n?' · '+Math.round(p)+'%':''}</span></div><div class="bar" role="img" aria-label="${type}: ${n} classes"><div style="width:${p}%;background:${colors[type]}"></div></div></div>`;}).join('');
  $('#motion-events').innerHTML=days.map(day=>{const events=data.events.filter(e=>e.date===day);return `<section class="calendar-day ${day===data.periods.today?'today':''}" aria-label="${dateLabel(day,{weekday:'long',month:'long',day:'numeric'})}"><div class="day-heading"><span>${dateLabel(day,{weekday:'short'})}</span><strong>${Number(day.slice(-2))}</strong></div>${events.length?events.map(e=>`<article class="calendar-class ${Date.parse(e.end)<=Date.now()?'is-completed':'is-upcoming'}" aria-label="${esc(e.name)}, ${Date.parse(e.end)<=Date.now()?'completed':'upcoming'}"><div class="class-time">${e.allDay?'All day':timeLabel(e.start)+'–'+timeLabel(e.end)}</div><div class="class-type">${esc(e.type)}</div><div class="eventname">${esc(e.name)}</div><div class="class-location">${esc(e.location)}</div>${e.source==='manual'?`<button type="button" class="remove-manual" data-remove="${esc(e.id)}" aria-label="Remove ${esc(e.name)}">Remove</button>`:''}</article>`).join(''):'<div class="empty-day">No classes</div>'}</section>`;}).join('');
  document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await api('exercises',{method:'DELETE',body:{id:b.dataset.remove}});await load();notify('Manual exercise removed.');}catch(e){notify(e.message,true);b.disabled=false;}});
  if(!goalsDirty){$('#motion-goals').dataset.week=data.periods.week;$('#motion-goals').dataset.month=data.periods.month;$('#weekly-goal-period').textContent=range;$('#monthly-goal-period').textContent=dateLabel(data.periods.month,{month:'long',year:'numeric'});$('#motion-weekly').value=data.week.target??'';$('#motion-monthly').value=data.month.target??'';$('#matching-rules').innerHTML=TYPES.map(type=>`<label>${type}<input data-rule="${type}" value="${esc(data.rules.find(r=>r.type===type)?.words.join(', ')||'')}" maxlength="1800" placeholder="Matching words"></label>`).join('');}
}
async function load(){data=await api('data');render();return data;}
async function sync(){
  if(busy||!data?.authenticated)return;busy=true;$('#refresh').disabled=true;$('#refresh').textContent='Refreshing…';
  try{const result=await api('sync',{method:'POST',body:{}});await load();if(result.busy)notify('A refresh is already running.');else if(result.synced)notify('Calendar refreshed.');else if(result.connected)notify('Calendar is up to date.');else notify('Connect Google Calendar to refresh.',true);}
  catch(e){notify(e.message,true);}finally{busy=false;$('#refresh').disabled=false;$('#refresh').textContent='Refresh';}
}
function toggleForm(open){$('#motion-manual').hidden=!open;$('#motion-add').setAttribute('aria-expanded',String(open));$('#exercise-error').hidden=true;if(open){$('#exercise-date').value ||= data.periods.today;$('#exercise-name').focus();}else $('#motion-add').focus();}
$('#motion-add').onclick=()=>toggleForm($('#motion-manual').hidden);$('#motion-cancel').onclick=()=>toggleForm(false);$('#refresh').onclick=sync;
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
$('#motion-manual').onsubmit=async event=>{event.preventDefault();const button=event.target.querySelector('[type=submit]');button.disabled=true;const input={name:$('#exercise-name').value.trim(),type:$('#exercise-type').value,date:$('#exercise-date').value,startTime:$('#exercise-start').value,endTime:$('#exercise-end').value,location:$('#exercise-location').value.trim()};try{await api('exercises',{method:'POST',body:input});await load();event.target.reset();toggleForm(false);notify(input.name+' saved to your tracker.');}catch(e){$('#exercise-error').textContent=e.message;$('#exercise-error').hidden=false;}finally{button.disabled=false;}};
$('#motion-goals').oninput=()=>{goalsDirty=true;$('#motion-save').textContent='Unsaved changes';};
$('#motion-goals').onsubmit=async event=>{event.preventDefault();const button=event.target.querySelector('[type=submit]');button.disabled=true;const rules=[...document.querySelectorAll('[data-rule]')].map(e=>({type:e.dataset.rule,words:e.value.split(',').map(s=>s.trim()).filter(Boolean)}));const changed=JSON.stringify(rules)!==JSON.stringify(data.rules);try{await api('goals',{method:'POST',body:{week:$('#motion-goals').dataset.week,month:$('#motion-goals').dataset.month,weekly:Number($('#motion-weekly').value),monthly:Number($('#motion-monthly').value),rules}});goalsDirty=false;await load();$('#motion-save').textContent='Goals saved';if(changed)notify('Matching rules saved. They will apply at the next calendar refresh.');}catch(e){$('#motion-save').textContent=e.message;}finally{button.disabled=false;}};
$('#sign-out').onclick=async()=>{try{await api('logout',{method:'POST',body:{}});data=null;showSignedOut(true);notify('Signed out.');}catch(e){notify(e.message,true);}};
async function init(){try{await load();const params=new URLSearchParams(location.search);if(params.get('auth')==='failed')notify('Google sign-in could not be completed. Use the owner’s account and approve only read-only Calendar access, then try again.',true);history.replaceState(null,'',location.pathname);if(data.authenticated){if(data.error)notify(data.error,true);await sync();}}catch(e){showSignedOut(false);notify('The tracker could not load. Please reload the page.',true);}}
init();
// Recalculate completion from saved events as classes finish; this does NOT read Google Calendar.
setInterval(()=>{if(data?.authenticated&&!document.hidden&&!busy)load().catch(()=>{});},60000);
