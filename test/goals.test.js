import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { saveGoals, snapshotGoals } from '../lib/store.js';
import { DEFAULT_RULES } from '../lib/domain.js';

test('Postgres retains one final independent target per week and month across periods', async () => {
  // Local PostgreSQL engine only: no live database, credentials or Calendar requests.
  const pg = new PGlite();
  try {
    await pg.exec(`CREATE TABLE fitness_settings (id integer PRIMARY KEY, weekly integer, monthly integer, rules jsonb);
      CREATE TABLE fitness_goals (kind text, period text, target integer, PRIMARY KEY(kind,period));
      INSERT INTO fitness_settings VALUES (1,NULL,NULL,'[]');`);
    const db = (parts,...values) => {
      const text=parts.reduce((s,part,i)=>s+(i?'$'+i:'')+part,'');
      return {text,values,then(resolve,reject){return pg.query(text,values).then(r=>r.rows).then(resolve,reject);}};
    };
    db.transaction=queries=>pg.transaction(async tx=>{
      const rows=[];
      for(const q of queries)rows.push((await tx.query(q.text,q.values)).rows);
      return rows;
    });
    const september={week:'2026-09-21',month:'2026-09-01'};
    await saveGoals(september,3,4,DEFAULT_RULES,db);
    await saveGoals(september,3,6,DEFAULT_RULES,db);
    assert.deepEqual(await snapshotGoals(september,db),{week:3,month:6});
    assert.equal((await pg.query('SELECT * FROM fitness_goals')).rows.length,2);
    // Another week in September inherits its weekly default without overwriting September.
    const nextWeek={week:'2026-09-28',month:'2026-09-01'};
    assert.deepEqual(await snapshotGoals(nextWeek,db),{week:3,month:6});
    await saveGoals(nextWeek,8,6,DEFAULT_RULES,db);
    assert.deepEqual(await snapshotGoals(september,db),{week:3,month:6});
    // A month boundary within the same week must retain that week's target.
    const october={week:'2026-09-28',month:'2026-10-01'};
    assert.deepEqual(await snapshotGoals(october,db),{week:8,month:6});
    await saveGoals(october,8,20,DEFAULT_RULES,db);
    assert.deepEqual(await snapshotGoals(september,db),{week:3,month:6});
    assert.deepEqual(await snapshotGoals(october,db),{week:8,month:20});
    // Repeated reads never reset final goals from changed defaults.
    await pg.exec('UPDATE fitness_settings SET weekly=99,monthly=99');
    assert.deepEqual(await snapshotGoals(september,db),{week:3,month:6});
    assert.deepEqual(await snapshotGoals(october,db),{week:8,month:20});
    assert.equal((await pg.query('SELECT * FROM fitness_goals')).rows.length,4);
  } finally { await pg.close(); }
});
