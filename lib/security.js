import { createHmac, timingSafeEqual, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

export function appOrigin() {
  const url = new URL(process.env.APP_URL || 'http://localhost:3000');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost' && !process.env.VERCEL)) throw new Error('Invalid APP_URL');
  if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new Error('Invalid APP_URL');
  return url.origin;
}
function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('Session secret is not configured.');
  return s;
}
export function same(a,b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x=Buffer.from(a),y=Buffer.from(b);
  return x.length===y.length && timingSafeEqual(x,y);
}
export function sign(data, purpose, seconds) {
  const body=Buffer.from(JSON.stringify({...data,purpose,exp:Math.floor(Date.now()/1000)+seconds})).toString('base64url');
  return body+'.'+createHmac('sha256',secret()).update(body).digest('base64url');
}
export function verify(token,purpose) {
  if (typeof token !== 'string' || token.length > 10000) return null;
  const parts=token.split('.');
  if(parts.length!==2 || !same(parts[1],createHmac('sha256',secret()).update(parts[0]).digest('base64url'))) return null;
  try {const data=JSON.parse(Buffer.from(parts[0],'base64url').toString());return data.purpose===purpose && data.exp>Math.floor(Date.now()/1000)?data:null;}catch{return null;}
}
export function cookies(req) {
  const result={};
  for(const part of (req.headers.cookie||'').split(';')){const i=part.indexOf('=');if(i>0)result[part.slice(0,i).trim()]=part.slice(i+1).trim();}
  return result;
}
export function cookie(name,value,seconds=0) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${appOrigin().startsWith('https:')?'; Secure':''}`;
}
export function owner(req) {
  const session=verify(cookies(req).fitness_session,'session');
  return session && same(session.email,(process.env.ALLOWED_GOOGLE_EMAIL||'').trim().toLowerCase())?session:null;
}
export function assertOrigin(req) {
  if (req.headers.origin !== appOrigin()) throw Object.assign(new Error('Request not allowed.'),{status:403});
}
function encryptionKey() {
  const key=Buffer.from(process.env.TOKEN_ENCRYPTION_KEY||'','base64url');
  if(key.length!==32)throw new Error('Token encryption is not configured.');
  return key;
}
export function encrypt(value) {
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey(),iv);
  const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64url');
}
export function decrypt(value) {
  const data=Buffer.from(value,'base64url'),decipher=createDecipheriv('aes-256-gcm',encryptionKey(),data.subarray(0,12));
  decipher.setAuthTag(data.subarray(12,28));
  return Buffer.concat([decipher.update(data.subarray(28)),decipher.final()]).toString('utf8');
}
export function isConfigured() {
  return ['APP_URL','ALLOWED_GOOGLE_EMAIL','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','DATABASE_URL','SESSION_SECRET','TOKEN_ENCRYPTION_KEY','CRON_SECRET'].every(k=>Boolean(process.env[k]?.trim()));
}
