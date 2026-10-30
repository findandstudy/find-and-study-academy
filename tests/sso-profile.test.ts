import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fillSsoProfile, ssoProfileFields } from '../server/sso-profile';
import { completionState } from '../shared/profile-completion';

const claims={company:'Test Agency',country:'United States',phone:'+12025550123'};
const base={id:'test',externalId:'3732',role:'agent',status:'active',name:'Migration Test',email:'test@example.invalid',companyName:null,country:null,phone:null,agencyId:null};
function harness(user:any={...base},failInsert=false) {
  const calls:{sql:string; values:any[]}[]=[];
  let released=false;
  return {calls,user,get released(){return released},pool:{async connect(){return {
    async query(sql:string,values:any[]=[]){calls.push({sql,values}); if(sql.startsWith('SELECT'))return {rows:[user]}; if(sql.startsWith('INSERT')&&failInsert)throw Error('injected'); if(sql.startsWith('UPDATE'))Object.assign(user,{companyName:values[1],country:values[2],phone:values[3],agencyId:values[4]}); return {rows:[]};},
    release(){released=true;}
  };}}};
}
test('ISO and legacy English/Turkish countries normalize; invalid inputs stay absent',()=>{
  for(const country of ['US',' us ','United States'])assert.equal(ssoProfileFields({country}).country,'US');
  for(const country of ['TR','Türkiye','Turkey'])assert.equal(ssoProfileFields({country}).country,'TR');
  assert.deepEqual(ssoProfileFields({company:{},country:'ZZ',phone:'bad'}),{companyName:null,country:null,phone:null});
});
test('new linked agent receives a complete own agency without name lookup',async()=>{
  const h=harness();await fillSsoProfile(h.pool,'test','3732',claims);
  assert.equal(h.user.country,'US');assert.equal(h.user.companyName,'Test Agency');
  const inserted=h.calls.find(c=>c.sql.startsWith('INSERT'))!;
  assert.ok(inserted);assert.equal(inserted.values[0],h.user.agencyId);
  assert.equal(completionState(h.user,{name:inserted.values[1],country:inserted.values[3],contactEmail:inserted.values[4],contactPhone:inserted.values[5]}).required,false);
  assert.equal(h.calls.some(c=>c.sql.includes('FROM agencies')),false);
  assert.equal(h.calls.at(-1)?.sql,'COMMIT');assert.ok(h.released);
});
test('second handoff is idempotent and preserves completed information',async()=>{
  const h=harness({...base,companyName:'Completed Agency',country:'TR',phone:'+905551234567',agencyId:'existing'});
  await fillSsoProfile(h.pool,'test','3732',claims);
  assert.equal(h.calls.some(c=>/^(UPDATE|INSERT)/.test(c.sql)),false);
  assert.equal(h.user.country,'TR');
});
test('missing user fields fill without modifying an existing shared agency',async()=>{
  const h=harness({...base,agencyId:'shared'});await fillSsoProfile(h.pool,'test','3732',claims);
  assert.equal(h.user.agencyId,'shared');assert.equal(h.user.country,'US');
  assert.equal(h.calls.some(c=>c.sql.includes('INTO agencies')||c.sql.startsWith('UPDATE agencies')),false);
});
for(const [label,overrides] of Object.entries({inactive:{status:'inactive'},admin:{role:'admin'},differentIdentity:{externalId:'999'}})){
  test(label+' cannot receive profile writes',async()=>{const h=harness({...base,...overrides});await fillSsoProfile(h.pool,'test','3732',claims);assert.equal(h.calls.some(c=>/^(UPDATE|INSERT)/.test(c.sql)),false);assert.equal(h.calls.at(-1)?.sql,'ROLLBACK');});
}
test('missing stable identity cannot acquire an agency',async()=>{const h=harness();await fillSsoProfile(h.pool,'test',null,claims);assert.equal(h.calls.length,0);});
test('failed agency creation rolls back and releases connection',async()=>{const h=harness({...base},true);await assert.rejects(fillSsoProfile(h.pool,'test','3732',claims));assert.equal(h.calls.at(-1)?.sql,'ROLLBACK');assert.ok(h.released);assert.equal(h.calls.some(c=>c.sql.startsWith('UPDATE')),false);});
test('invalid country leaves completion gate active instead of guessing',async()=>{const h=harness();await fillSsoProfile(h.pool,'test','3732',{...claims,country:'unlisted'});assert.equal(h.user.agencyId,null);assert.ok(completionState(h.user,null).required);});
