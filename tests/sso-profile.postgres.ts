// Synthetic, loopback-only disposable fixture. Never imports application startup.
import assert from 'node:assert/strict';
import pg from 'pg';
import { fillSsoProfile } from '../server/sso-profile';
import { completionState } from '../shared/profile-completion';
const url = new URL(process.env.SSO_TEST_DATABASE_URL || 'http://invalid');
assert.equal(url.hostname,'127.0.0.1'); assert.equal(url.port,'5433');
assert.equal(url.pathname,'/fasos_apply_local'); assert.equal(process.env.SSO_DISPOSABLE,'1');
const schema='sso_profile_'+Date.now();
const owner=new pg.Pool({connectionString:url.href});
const role=schema+'_runtime';
let runtime:pg.Pool|undefined;
try {
  assert.equal((await owner.query('SELECT current_database() AS db')).rows[0].db,'fasos_apply_local');
  await owner.query(`CREATE SCHEMA ${schema}; CREATE ROLE ${role} LOGIN NOSUPERUSER NOBYPASSRLS; GRANT USAGE ON SCHEMA ${schema} TO ${role};
    CREATE TABLE ${schema}.agencies(id varchar PRIMARY KEY,name text NOT NULL CHECK(name<>'Reject Agency'),status text,country text,contact_email text,contact_phone text,primary_contact_name text,primary_contact_email text);
    CREATE TABLE ${schema}.users(id varchar PRIMARY KEY,name text,email text,role text,status text,external_id text,agency_id varchar REFERENCES ${schema}.agencies(id),company_name text,country text,phone text);
    GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA ${schema} TO ${role};`);
  const runtimeUrl=new URL(url);runtimeUrl.username=role;runtimeUrl.password='';
  runtime=new pg.Pool({connectionString:runtimeUrl.href,options:`-c search_path=${schema}`});
  await runtime.query("INSERT INTO users(id,name,email,role,status,external_id) VALUES('test','Migration Test','test@example.invalid','agent','active','3732')");
  const payload={company:'Test Agency',country:'United States',phone:'+12025550123'};
  await Promise.all(Array.from({length:4},()=>fillSsoProfile(runtime!,'test','3732',payload)));
  const user=(await runtime.query('SELECT *,agency_id AS "agencyId" FROM users WHERE id=$1',['test'])).rows[0];
  const agency=(await runtime.query('SELECT *,contact_email AS "contactEmail",contact_phone AS "contactPhone" FROM agencies')).rows;
  assert.equal(agency.length,1);assert.equal(user.agencyId,agency[0].id);assert.equal(user.country,'US');
  assert.equal(completionState(user,agency[0]).required,false);
  await fillSsoProfile(runtime,'test','3732',{...payload,company:'Other Agency',country:'TR'});
  assert.equal((await runtime.query('SELECT country FROM users WHERE id=$1',['test'])).rows[0].country,'US');
  await runtime.query("INSERT INTO users(id,name,email,role,status,external_id) VALUES('fail','Failure Test','fail@example.invalid','agent','active','3733')");
  await assert.rejects(fillSsoProfile(runtime,'fail','3733',{...payload,company:'Reject Agency'}));
  assert.equal((await runtime.query('SELECT country FROM users WHERE id=$1',['fail'])).rows[0].country,null);
  assert.equal((await runtime.query('SELECT count(*)::int AS n FROM agencies')).rows[0].n,1);
  await fillSsoProfile(runtime,'fail','wrong',payload);
  assert.equal((await runtime.query('SELECT country FROM users WHERE id=$1',['fail'])).rows[0].country,null);
  console.log('PASS: real PostgreSQL profile completion, four-way concurrency, repeat preservation, rollback, identity denial');
} finally {
  await runtime?.end();
  await owner.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE; DROP ROLE IF EXISTS ${role}`);
  await owner.end();
}
