import { EARLIEST_INSTANT, CALENDAR_SCOPE, periods, parseEvent } from './domain.js';
import { database, connection, settings } from './store.js';
import { decrypt, encrypt } from './security.js';

const IDENTITY_SCOPES=new Set(['openid','email','https://www.googleapis.com/auth/userinfo.email']);
export function checkScopes(scopes) {
  const granted=String(scopes||'').split(/\s+/).filter(Boolean);
  if(!granted.includes(CALENDAR_SCOPE)||granted.some(s=>s!==CALENDAR_SCOPE&&!IDENTITY_SCOPES.has(s)))throw new Error('Only read-only Calendar and basic identity permissions are allowed.');
}
export function calendarURL({calendarId='primary',until,pageToken}) {
  if(!Number.isFinite(Date.parse(until))||Date.parse(until)<=Date.parse(EARLIEST_INSTANT))throw new Error('Invalid sync period.');
  const url=new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
  url.search=new URLSearchParams({timeMin:EARLIEST_INSTANT,timeMax:until,singleEvents:'true',orderBy:'startTime',showDeleted:'false',maxResults:'2500',timeZone:'America/Toronto',fields:'nextPageToken,items(id,status,summary,location,start,end)'}).toString();
  if(pageToken)url.searchParams.set('pageToken',pageToken);
  return url;
}
export async function readFitnessEvents(accessToken,rules,{until,calendarId='primary',fetcher=fetch}={}) {
  let pageToken;const result=new Map();const seen=new Set();
  for(let page=0;page<100;page++){
    const url=calendarURL({calendarId,until,pageToken});
    // This is the ONLY Calendar API call. It is always GET and always bounded.
    const response=await fetcher(url,{method:'GET',headers:{Authorization:`Bearer ${accessToken}`},signal:AbortSignal.timeout(15000),redirect:'error'});
    if(!response.ok)throw new Error(response.status===401?'Reconnect Google Calendar.':'Calendar sync failed. Try again later.');
    const data=await response.json();
    if(!Array.isArray(data.items)&&data.items!==undefined)throw new Error('Calendar returned an invalid response.');
    for(const item of data.items||[]){const event=parseEvent(item,rules);if(event)result.set(event.id,event);}
    pageToken=data.nextPageToken;
    if(!pageToken)return [...result.values()];
    if(typeof pageToken!=='string'||seen.has(pageToken))throw new Error('Calendar pagination failed.');
    seen.add(pageToken);
  }
  throw new Error('Calendar sync exceeded its safe page limit.');
}
async function refreshToken(encrypted) {
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID,client_secret:process.env.GOOGLE_CLIENT_SECRET,refresh_token:decrypt(encrypted),grant_type:'refresh_token'}),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error('Reconnect Google Calendar.');
  const token=await response.json();if(!token.access_token)throw new Error('Reconnect Google Calendar.');
  if(token.scope)checkScopes(token.scope);
  if(token.refresh_token){const db=await database();await db`UPDATE fitness_connection SET refresh_token=${encrypt(token.refresh_token)} WHERE id=1`;}
  return token.access_token;
}
export async function syncCalendar({force=false}={}) {
  const db=await database();const c=await connection();
  if(!c.refresh_token)return {connected:false,synced:false};
  if(!force&&c.last_sync&&Date.now()-new Date(c.last_sync).getTime()<5*60*1000)return {connected:true,synced:false};
  const lease=await db`UPDATE fitness_connection SET lease_until=now()+interval '90 seconds' WHERE id=1 AND (lease_until IS NULL OR lease_until<now()) RETURNING id`;
  if(!lease.length)return {connected:true,synced:false,busy:true};
  try {
    const config=await settings(),token=await refreshToken(c.refresh_token);
    const events=await readFitnessEvents(token,config.rules,{until:periods().horizon,calendarId:process.env.GOOGLE_CALENDAR_ID||'primary'});
    // Replace only on complete success: deleted and moved events disappear atomically.
    await db`UPDATE fitness_connection SET events=${JSON.stringify(events)}::jsonb,last_sync=now(),error=NULL WHERE id=1`;
    return {connected:true,synced:true};
  }catch(error){
    const message=error.message==='Reconnect Google Calendar.'?error.message:'Sync failed. Your last saved data has been kept.';
    await db`UPDATE fitness_connection SET error=${message} WHERE id=1`;
    throw new Error(message);
  }finally{await db`UPDATE fitness_connection SET lease_until=NULL WHERE id=1`;}
}
