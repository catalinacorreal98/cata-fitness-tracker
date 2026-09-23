import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarURL,readFitnessEvents,checkScopes } from '../lib/calendar.js';
import { EARLIEST_INSTANT,CALENDAR_SCOPE,DEFAULT_RULES,parseEvent,periods,stats,validateManual,classify } from '../lib/domain.js';

const fixture=(id,start,end,name='Pilates')=>({id,status:'confirmed',summary:name,start:{dateTime:start},end:{dateTime:end},location:'Studio'});
test('Every page uses GET with a hard cutoff, selected calendar and expanded occurrences',async()=>{
  const requests=[];
  const result=await readFitnessEvents('FAKE_TOKEN',DEFAULT_RULES,{until:'2026-11-01T04:00:00Z',calendarId:'primary',fetcher:async(url,options)=>{
    requests.push({url,options});
    return {ok:true,json:async()=>requests.length===1?{items:[fixture('one','2026-09-21T10:00:00-04:00','2026-09-21T11:00:00-04:00')],nextPageToken:'page2'}:{items:[fixture('two','2026-09-23T10:00:00-04:00','2026-09-23T11:00:00-04:00','Yoga')]}};
  }});
  assert.equal(result.length,2);assert.equal(requests.length,2);
  for(const {url,options}of requests){assert.equal(options.method,'GET');assert.equal(url.origin,'https://www.googleapis.com');assert.equal(url.pathname,'/calendar/v3/calendars/primary/events');assert.equal(url.searchParams.get('timeMin'),EARLIEST_INSTANT);assert.equal(url.searchParams.get('singleEvents'),'true');assert(!url.searchParams.has('syncToken'));assert.equal(url.searchParams.get('showDeleted'),'false');}
});
test('Reject unbounded or backwards query windows',()=>{assert.throws(()=>calendarURL({}));assert.throws(()=>calendarURL({until:'2026-08-01T00:00:00Z'}));});
test('Read-only grants only; existing Gmail or calendar write access is rejected',()=>{
  checkScopes(`openid email ${CALENDAR_SCOPE}`);
  assert.throws(()=>checkScopes('https://www.googleapis.com/auth/calendar'));
  assert.throws(()=>checkScopes(`${CALENDAR_SCOPE} https://www.googleapis.com/auth/gmail.readonly`));
  assert.throws(()=>checkScopes(`${CALENDAR_SCOPE} https://www.googleapis.com/auth/calendar.events`));
});
test('Cutoff includes Toronto midnight, excludes earlier dates and deleted events',()=>{
  assert(parseEvent(fixture('yes','2026-09-01T00:00:00-04:00','2026-09-01T01:00:00-04:00')));
  assert.equal(parseEvent(fixture('no','2026-08-31T23:00:00-04:00','2026-08-31T23:59:00-04:00')),null);
  assert.equal(parseEvent({...fixture('deleted','2026-09-01T10:00:00-04:00','2026-09-01T11:00:00-04:00'),status:'cancelled'}),null);
  assert.equal(parseEvent({id:'all-day-old',summary:'Yoga',start:{date:'2026-08-31'},end:{date:'2026-09-01'}}),null);
  assert(parseEvent({id:'all-day',summary:'Yoga',start:{date:'2026-09-01'},end:{date:'2026-09-02'}}));
});
test('The seven approved screenshot titles are classified correctly',()=>{
  const titles=[['Booty HIIT','HIIT'],['Candlelit Vinyasa Slow Flow, Hot: Heart Opening','Yoga'],['Top HIIT: Throwback Hits','HIIT'],['Candlelit Yoga Nidra Sound Bath (60 Min), Warm','Yoga'],['Abs & Assets HIIT','HIIT'],['Beat Ride: High School Musical Karaoke','Cycling'],['Vinyasa Slow Flow, Hot','Yoga']];
  for(const [title,expected]of titles)assert.equal(classify(title),expected);
  assert.equal(classify('Meeting with Yvonne'),null);assert.equal(classify('Brunch'),null);
});
test('Toronto weeks, months and daylight saving are respected',()=>{
  assert.equal(periods(new Date('2026-09-28T02:00:00Z')).week,'2026-09-21');
  assert.equal(periods(new Date('2026-10-01T02:00:00Z')).month,'2026-09-01');
  assert.equal(periods(new Date('2026-11-03T05:30:00Z')).today,'2026-11-03');
});
test('Past and upcoming classes count separately and 6/3 stays 100%',()=>{
  const past=Array.from({length:6},(_,i)=>({id:String(i),date:'2026-09-21',end:'2026-09-21T20:00:00Z'}));
  const s=stats([...past,{date:'2026-09-23',end:'2026-09-23T20:00:00Z'},{date:'2026-08-31',end:'2026-08-31T20:00:00Z'}],'2026-09-21','2026-09-28',3,new Date('2026-09-22T10:00:00Z'));
  assert.deepEqual(s,{completed:6,upcoming:1,target:3,percentage:100,remaining:0});
});
test('Manual exercise dates obey cutoff and invalid/DST times are rejected',()=>{
  const input={name:'Run',type:'Run',date:'2026-09-21',startTime:'18:00',endTime:'19:00',location:''};
  assert.equal(validateManual(input).start,'2026-09-21T22:00:00.000Z');
  assert.throws(()=>validateManual({...input,date:'2026-08-31'}));
  assert.throws(()=>validateManual({...input,endTime:'17:00'}));
  assert.throws(()=>validateManual({...input,date:'2027-03-14',startTime:'02:30',endTime:'04:00'}));
});
test('A failed later page never returns an incomplete replacement cache',async()=>{
  let count=0;await assert.rejects(readFitnessEvents('FAKE',DEFAULT_RULES,{until:'2026-11-01T04:00:00Z',fetcher:async()=>++count===1?{ok:true,json:async()=>({items:[],nextPageToken:'p2'})}:{ok:false,status:500}}));
});
