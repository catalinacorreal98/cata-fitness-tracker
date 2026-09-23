import test from 'node:test';
import assert from 'node:assert/strict';
import { monthlyEvents, periods, stats } from '../lib/domain.js';
import { monthlyMarkup, ACTIVITY_COLORS } from '../public/monthly.js';
const now=new Date('2026-09-23T15:00:00Z');
const event=(id,start,end,type='Yoga',source='calendar')=>({id,name:id,type,source,start,end,date:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto'}).format(new Date(start)),allDay:false});
const events=[
  event('Future run','2026-09-28T18:00:00Z','2026-09-28T19:00:00Z','Run'),
  event('Manual yoga','2026-09-22T18:00:00Z','2026-09-22T19:00:00Z','Yoga','manual'),
  event('First class','2026-09-01T04:00:00Z','2026-09-01T05:00:00Z','HIIT'),
  event('Too early','2026-09-01T02:00:00Z','2026-09-01T03:00:00Z'),
  event('Next month','2026-10-01T04:00:00Z','2026-10-01T05:00:00Z'),
  event('Ongoing','2026-09-23T14:30:00Z','2026-09-23T15:30:00Z','Pilates'),
  event('Just ended','2026-09-23T14:00:00Z','2026-09-23T15:00:00Z','Strength')
];
test('Monthly detail reconciles with overview, includes manual entries, honors Toronto boundaries',()=>{
  const p=periods(now),list=monthlyEvents(events,p,now),summary=stats(events,p.month,p.monthEnd,6,now);
  assert.equal(list.filter(e=>e.completed).length,summary.completed);
  assert.equal(list.filter(e=>!e.completed).length,summary.upcoming);
  assert.equal(summary.completed,3);assert.equal(summary.upcoming,2);
  assert.deepEqual(list.map(e=>e.name),['First class','Manual yoga','Just ended','Ongoing','Future run']);
  assert.equal(list.find(e=>e.name==='Ongoing').completed,false);
});
test('Monthly filters keep chart counts and chronological rows consistent',()=>{
  const list=monthlyEvents(events,periods(now),now);
  const completed=monthlyMarkup(list);
  assert(completed.includes('3 classes'));
  assert(completed.includes('Yoga: 1 classes, 33%'));
  assert(completed.indexOf('First class')<completed.indexOf('Manual yoga'));
  assert(!completed.includes('Future run'));assert(!completed.includes('Ongoing'));
  const upcoming=monthlyMarkup(list,'upcoming');
  assert(upcoming.includes('2 classes'));assert(upcoming.includes('Run: 1 classes, 50%'));
  assert(!upcoming.includes('Manual yoga'));
  const all=monthlyMarkup(list,'all');assert(all.includes('5 classes'));assert(all.includes('Status'));
  assert(all.includes('Completed'));assert(all.includes('Upcoming'));
});
test('Monthly row accents and charts share distinct activity colors, with escaped class names',()=>{
  assert.equal(new Set(Object.values(ACTIVITY_COLORS)).size,7);
  const html=monthlyMarkup([{...events[1],completed:true,name:'<img src=x onerror=alert(1)>'}]);
  assert(html.includes('--activity-color:'+ACTIVITY_COLORS.Yoga));
  assert(html.includes('width:100%;background:'+ACTIVITY_COLORS.Yoga));
  assert(!html.includes('<img'));assert(html.includes('&lt;img'));
  const empty=monthlyMarkup([]);assert(empty.includes('No completed classes'));assert(!empty.includes('NaN'));
});
