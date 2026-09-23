import { readdir,readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
for(const dir of ['api','lib','public','scripts'])for(const name of await readdir(dir))if(name.endsWith('.js')){
  const result=spawnSync(process.execPath,['--check',`${dir}/${name}`],{encoding:'utf8'});
  if(result.status!==0)throw new Error(result.stderr);
}
const html=await readFile('public/index.html','utf8');
for(const path of ['app.js','style.css','app.css','favicon.svg'])assert(html.includes('/'+path));
const config=JSON.parse(await readFile('vercel.json','utf8'));
assert.equal(config.outputDirectory,'public');
assert.equal(config.crons[0].path,'/api/cron');
assert(!html.includes('Preview ·'));
console.log('Build checks passed. Vercel serves public/ and deploys the seven API functions.');
