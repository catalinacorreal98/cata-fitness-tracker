import { randomBytes, createHash } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { CALENDAR_SCOPE } from './domain.js';
import { checkScopes } from './calendar.js';
import { appOrigin, cookie, cookies, sign, verify, same, encrypt } from './security.js';
import { database } from './store.js';

const keys=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
export function startAuth(res) {
  const state=randomBytes(32).toString('base64url'),nonce=randomBytes(32).toString('base64url'),verifier=randomBytes(32).toString('base64url');
  res.setHeader('Set-Cookie',cookie('fitness_oauth',sign({state,nonce,verifier},'oauth',600),600));
  const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search=new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID,redirect_uri:appOrigin()+'/api/auth',response_type:'code',scope:`openid email ${CALENDAR_SCOPE}`,access_type:'offline',prompt:'consent select_account',include_granted_scopes:'false',state,nonce,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();
  res.statusCode=302;res.setHeader('Location',url.toString());res.end();
}
export async function finishAuth(req,res,url) {
  const context=verify(cookies(req).fitness_oauth,'oauth');
  res.setHeader('Set-Cookie',cookie('fitness_oauth',''));
  if(!context||!same(url.searchParams.get('state'),context.state))throw Object.assign(new Error('Sign-in expired. Please try again.'),{status:400});
  if(url.searchParams.has('error'))throw Object.assign(new Error('Sign-in was cancelled.'),{status:400});
  const code=url.searchParams.get('code');if(!code)throw Object.assign(new Error('Missing sign-in code.'),{status:400});
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID,client_secret:process.env.GOOGLE_CLIENT_SECRET,code,code_verifier:context.verifier,redirect_uri:appOrigin()+'/api/auth',grant_type:'authorization_code'}),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error('Sign-in could not be completed.');
  const tokens=await response.json();
  const {payload}=await jwtVerify(tokens.id_token,keys,{issuer:['https://accounts.google.com','accounts.google.com'],audience:process.env.GOOGLE_CLIENT_ID,algorithms:['RS256']});
  if(!same(payload.nonce,context.nonce)||payload.email_verified!==true||!same(String(payload.email||'').toLowerCase(),process.env.ALLOWED_GOOGLE_EMAIL.trim().toLowerCase()))throw Object.assign(new Error('This tracker is private. Use the owner’s Google account.'),{status:403});
  checkScopes(tokens.scope);
  if(!tokens.refresh_token)throw new Error('Google did not grant background access. Please reconnect and approve read-only Calendar access.');
  const db=await database();
  await db`UPDATE fitness_connection SET refresh_token=${encrypt(tokens.refresh_token)},error=NULL WHERE id=1`;
  res.setHeader('Set-Cookie',[cookie('fitness_oauth',''),cookie('fitness_session',sign({sub:payload.sub,email:payload.email.toLowerCase()},'session',30*86400),30*86400)]);
  res.statusCode=303;res.setHeader('Location',appOrigin()+'/?connected=1');res.end();
}
