import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { sign,verify,encrypt,decrypt,owner,assertOrigin } from '../lib/security.js';
import { handler } from '../lib/handler.js';

process.env.SESSION_SECRET='test-only-'+randomBytes(32).toString('hex');
process.env.TOKEN_ENCRYPTION_KEY=randomBytes(32).toString('base64url');
process.env.ALLOWED_GOOGLE_EMAIL='owner@example.com';
process.env.APP_URL='https://tracker.example.com';
test('Signed cookies reject tampering, wrong purpose, expiry and other users',()=>{
  const token=sign({email:'owner@example.com'},'session',60);
  assert(verify(token,'session'));assert.equal(verify(token+'x','session'),null);assert.equal(verify(token,'oauth'),null);
  assert.equal(verify(sign({},'session',-1),'session'),null);
  assert(owner({headers:{cookie:'fitness_session='+token}}));
  assert.equal(owner({headers:{cookie:'fitness_session='+sign({email:'other@example.com'},'session',60)}}),null);
});
test('Refresh tokens are encrypted and authenticated',()=>{
  const token=encrypt('fake-refresh-token');assert(!token.includes('fake-refresh-token'));assert.equal(decrypt(token),'fake-refresh-token');
  const bytes=Buffer.from(token,'base64url');bytes[20]^=1;assert.throws(()=>decrypt(bytes.toString('base64url')));
});
test('Cross-origin and missing-origin writes are rejected',()=>{
  assertOrigin({headers:{origin:'https://tracker.example.com'}});
  assert.throws(()=>assertOrigin({headers:{origin:'https://other.example.com'}}));assert.throws(()=>assertOrigin({headers:{}}));
});
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},end(value){this.body=value;}};}
test('Unconfigured app reveals no secrets and makes no external requests',async()=>{
  const res=response();await handler('data')({method:'GET',url:'/api/data',headers:{}},res);
  assert.deepEqual(JSON.parse(res.body),{configured:false,authenticated:false});
});
test('Unauthenticated writes and cron calls are rejected before database access',async()=>{
  Object.assign(process.env,{GOOGLE_CLIENT_ID:'fake',GOOGLE_CLIENT_SECRET:'fake',DATABASE_URL:'postgres://fake',CRON_SECRET:'fake-cron-secret'});
  for(const action of ['goals','exercises','sync']){const res=response();await handler(action)({method:'POST',url:'/api/'+action,headers:{}},res);assert.equal(res.statusCode,401);}
  const res=response();await handler('cron')({method:'GET',url:'/api/cron',headers:{}},res);assert.equal(res.statusCode,401);
  delete process.env.DATABASE_URL;
});
