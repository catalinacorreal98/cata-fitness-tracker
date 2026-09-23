import { randomUUID } from 'node:crypto';
import { owner, assertOrigin, cookie, isConfigured, appOrigin, same } from './security.js';
import { startAuth, finishAuth } from './auth.js';
import { database, settings, connection, snapshotGoals, saveGoals } from './store.js';
import { syncCalendar } from './calendar.js';
import { periods, stats, validTarget, validateRules, validateManual, EARLIEST_DATE, ZONE } from './domain.js';

function json(res,status,data){res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));}
async function body(req){
  if(!String(req.headers['content-type']||'').startsWith('application/json'))throw Object.assign(new Error('JSON required.'),{status:415});
  if(req.body!==undefined){const raw=typeof req.body==='string'?req.body:JSON.stringify(req.body);if(raw.length>16000)throw Object.assign(new Error('Request too large.'),{status:413});return JSON.parse(raw);}
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>16000)throw Object.assign(new Error('Request too large.'),{status:413});}return JSON.parse(raw);
}
function method(req,res,allowed){if(!allowed.includes(req.method)){res.setHeader('Allow',allowed.join(', '));json(res,405,{error:'Method not allowed.'});return false;}return true;}
export function handler(action){return async(req,res)=>{
  res.setHeader('Cache-Control','private, no-store, max-age=0');res.setHeader('Pragma','no-cache');
  try{
    if(action==='data'&&!isConfigured())return json(res,200,{configured:false,authenticated:false});
    if(!isConfigured())return json(res,503,{error:'The tracker setup is not complete.'});
    const url=new URL(req.url,appOrigin());
    if(action==='auth'){
      if(!method(req,res,['GET']))return;
      if(url.searchParams.get('action')==='start')return startAuth(res);
      try{return await finishAuth(req,res,url);}catch{
        // Do not expose Google responses, codes, tokens or email addresses in errors.
        res.statusCode=303;res.setHeader('Location',appOrigin()+'/?auth=failed');return res.end();
      }
    }
    if(action==='cron'){
      if(!method(req,res,['GET']))return;
      if(!same(req.headers.authorization,`Bearer ${process.env.CRON_SECRET}`))return json(res,401,{error:'Unauthorized.'});
      return json(res,200,await syncCalendar({force:false}));
    }
    const session=owner(req);
    if(!session)return json(res,action==='data'?200:401,action==='data'?{configured:true,authenticated:false}:{error:'Sign in to continue.'});
    if(['POST','PUT','PATCH','DELETE'].includes(req.method))assertOrigin(req);
    if(action==='logout'){
      if(!method(req,res,['POST']))return;res.setHeader('Set-Cookie',cookie('fitness_session',''));return json(res,200,{ok:true});
    }
    if(action==='data'){
      if(!method(req,res,['GET']))return;
      const p=periods(),db=await database();const [config,c,manual,goals]=await Promise.all([settings(),connection(),db`SELECT id,data FROM fitness_manual`,snapshotGoals(p)]);
      const events=[...c.events,...manual.map(r=>({...r.data,id:r.id}))].filter(e=>e.date>=EARLIEST_DATE);
      return json(res,200,{configured:true,authenticated:true,zone:ZONE,periods:p,connected:Boolean(c.refresh_token),lastSync:c.last_sync,error:c.error,rules:config.rules,
        week:stats(events,p.week,p.weekEnd,goals.week),month:stats(events,p.month,p.monthEnd,goals.month),
        events:events.filter(e=>e.date>=p.week&&e.date<p.weekEnd).sort((a,b)=>a.start.localeCompare(b.start))});
    }
    if(action==='goals'){
      if(!method(req,res,['POST']))return;const data=await body(req);
      const current=periods();
      if(data.week!==current.week||data.month!==current.month)return json(res,409,{error:'The week or month has changed. Reload the page before saving your goals.'});
      if(!validTarget(data.weekly)||!validTarget(data.monthly))return json(res,400,{error:'Goals must be whole numbers from 1 to 999.'});
      let rules;try{rules=validateRules(data.rules);}catch(e){return json(res,400,{error:e.message});}
      await saveGoals(current,data.weekly,data.monthly,rules);return json(res,200,{ok:true});
    }
    if(action==='exercises'){
      if(!method(req,res,['POST','DELETE']))return;const data=await body(req),db=await database();
      if(req.method==='DELETE'){
        if(typeof data.id!=='string'||!/^[0-9a-f-]{36}$/i.test(data.id))return json(res,400,{error:'Invalid exercise.'});
        await db`DELETE FROM fitness_manual WHERE id=${data.id}::uuid`;return json(res,200,{ok:true});
      }
      let exercise;try{exercise=validateManual(data);}catch(e){return json(res,400,{error:e.message});}
      const id=randomUUID();await db`INSERT INTO fitness_manual(id,data) VALUES (${id}::uuid,${JSON.stringify(exercise)}::jsonb)`;return json(res,201,{ok:true,id});
    }
    if(action==='sync'){
      if(!method(req,res,['POST']))return;
      // Coalesce refresh-on-open, refresh clicks and scheduled jobs within five minutes.
      return json(res,200,await syncCalendar());
    }
    return json(res,404,{error:'Not found.'});
  }catch(e){
    if(e.status)return json(res,e.status,{error:e.message});
    if(e instanceof SyntaxError)return json(res,400,{error:'Invalid request.'});
    return json(res,500,{error:action==='sync'?'Calendar refresh failed. Saved data is unchanged; reconnect if this continues.':'The request could not be completed. Please try again.'});
  }
};}
