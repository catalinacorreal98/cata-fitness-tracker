import { neon } from '@neondatabase/serverless';
import { DEFAULT_RULES } from './domain.js';

let sql,init;
export async function database() {
  if(!process.env.DATABASE_URL)throw new Error('Database is not configured.');
  sql ||= neon(process.env.DATABASE_URL);
  if(!init)init=sql.transaction([
    sql`CREATE TABLE IF NOT EXISTS fitness_settings (id integer PRIMARY KEY CHECK(id=1), weekly integer, monthly integer, rules jsonb NOT NULL)`,
    sql`CREATE TABLE IF NOT EXISTS fitness_goals (kind text NOT NULL, period text NOT NULL, target integer, PRIMARY KEY(kind,period))`,
    sql`CREATE TABLE IF NOT EXISTS fitness_manual (id uuid PRIMARY KEY, data jsonb NOT NULL)`,
    sql`CREATE TABLE IF NOT EXISTS fitness_connection (id integer PRIMARY KEY CHECK(id=1), refresh_token text, events jsonb NOT NULL DEFAULT '[]'::jsonb, last_sync timestamptz, error text, lease_until timestamptz)`,
    sql`INSERT INTO fitness_settings(id,rules) VALUES (1,${JSON.stringify(DEFAULT_RULES)}::jsonb) ON CONFLICT DO NOTHING`,
    sql`INSERT INTO fitness_connection(id) VALUES (1) ON CONFLICT DO NOTHING`
  ]).catch(e=>{init=null;throw e;});
  await init;return sql;
}
export async function settings() {const db=await database();return (await db`SELECT weekly,monthly,rules FROM fitness_settings WHERE id=1`)[0];}
export async function connection() {const db=await database();return (await db`SELECT * FROM fitness_connection WHERE id=1`)[0];}
export async function snapshotGoals(p, dbOverride) {
  const db=dbOverride || await database();
  await db.transaction([
    db`INSERT INTO fitness_goals(kind,period,target) SELECT 'week',${p.week},weekly FROM fitness_settings WHERE id=1 ON CONFLICT DO NOTHING`,
    db`INSERT INTO fitness_goals(kind,period,target) SELECT 'month',${p.month},monthly FROM fitness_settings WHERE id=1 ON CONFLICT DO NOTHING`
  ]);
  const rows=await db`SELECT kind,target FROM fitness_goals WHERE (kind='week' AND period=${p.week}) OR (kind='month' AND period=${p.month})`;
  return Object.fromEntries(rows.map(r=>[r.kind,r.target]));
}
export async function saveGoals(p,weekly,monthly,rules,dbOverride) {
  const db=dbOverride || await database();await db.transaction([
    db`UPDATE fitness_settings SET weekly=${weekly},monthly=${monthly},rules=${JSON.stringify(rules)}::jsonb WHERE id=1`,
    db`INSERT INTO fitness_goals(kind,period,target) VALUES ('week',${p.week},${weekly}) ON CONFLICT(kind,period) DO UPDATE SET target=excluded.target`,
    db`INSERT INTO fitness_goals(kind,period,target) VALUES ('month',${p.month},${monthly}) ON CONFLICT(kind,period) DO UPDATE SET target=excluded.target`
  ]);
}
