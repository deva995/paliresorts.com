import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import request from 'supertest';
import type pg from 'pg';
import {fixtureSession} from './runtime-test-fixtures.js';
import {GuestQrContextStore,createSecureOrderingQrUrl} from '../src/utils/guestQrContext.js';

/** Injected disposable fixture pools only; never loads URLs or provider configuration. */
export async function verifySecureQrRuntime(admin:pg.Pool,check:(name:string,fn:()=>Promise<void>)=>Promise<void>,raw?:pg.Pool) {
  process.env.NODE_ENV='test';process.env.ALLOW_DEV_AUTH='false';process.env.OTP_DELIVERY='sms';process.env.DUMMY_OTP_ENABLED='false';
  const {resetEnvCache}=await import('../server/src/config/env.js');
  const {setDbPool}=await import('../server/src/db/pool.js');
  const {createApp}=await import('../server/src/app.js');
  const {getSmsTransport}=await import('../server/src/services/sms.service.js');
  resetEnvCache();setDbPool(raw||admin);const app=createApp();
  const owner=randomUUID(),viewer=randomUUID(),suffix=randomUUID().slice(0,8);
  for(const [id,role] of [[owner,'RESTAURANT_OWNER'],[viewer,'QR_READ_ONLY']]) {
    await admin.query('INSERT INTO roles(id,display_name) VALUES($1,$1) ON CONFLICT DO NOTHING',[role]);
    await admin.query("INSERT INTO staff(id,employee_code,first_name,last_name,email,phone,password_hash) VALUES($1,$2,'QR','Fixture',$3,$4,repeat('x',64))",[id,'QR-'+id.slice(0,8),id+'@isolated.test',id.slice(0,20)]);
    await admin.query('INSERT INTO staff_roles(staff_id,role_id) VALUES($1,$2)',[id,role]);
    await admin.query("INSERT INTO staff_outlet_access(staff_id,outlet_id,is_primary) VALUES($1,'rest-1',true)",[id]);
  }
  for(const permission of ['table:view','table:manage']) {
    await admin.query("INSERT INTO permissions(id,module,description) VALUES($1,'FLOOR','Isolated QR test') ON CONFLICT DO NOTHING",[permission]);
    await admin.query("INSERT INTO role_permissions(role_id,permission_id) VALUES('RESTAURANT_OWNER',$1) ON CONFLICT DO NOTHING",[permission]);
  }
  await admin.query("INSERT INTO role_permissions(role_id,permission_id) VALUES('QR_READ_ONLY','table:view') ON CONFLICT DO NOTHING");
  const ownerToken=await fixtureSession(admin,owner),viewerToken=await fixtureSession(admin,viewer);
  const tables:Record<string,string>={};
  for(const outlet of ['rest-1','rest-2']) {
    const id=randomUUID(),zone=(await admin.query('SELECT id FROM dining_zones WHERE outlet_id=$1 AND is_active LIMIT 1',[outlet])).rows[0].id;
    await admin.query('INSERT INTO restaurant_tables(id,outlet_id,zone_id,table_number,qr_public_code,qr_secret_token_hash) VALUES($1,$2,$3,$4,$4,$5)',[id,outlet,zone,'QR-'+suffix+'-'+outlet,createHash('sha256').update(randomUUID()).digest('hex')]);tables[outlet]=id;
  }
  const own=tables['rest-1'],foreign=tables['rest-2'];
  const issue=(id=own,token:string|null=ownerToken)=>{const r=request(app).post('/api/v1/tables/'+id+'/ordering-qr');return token?r.set('Authorization','Bearer '+token):r;};
  const resolve=(qr:object)=>request(app).post('/api/v1/guest/table/resolve').send(qr);
  const hash=async(id=own)=>(await admin.query('SELECT qr_secret_token_hash FROM restaurant_tables WHERE id=$1',[id])).rows[0].qr_secret_token_hash;
  const audit=async()=>(await admin.query("SELECT actor_id,outlet_id,new_state,old_state FROM audit_logs WHERE action='TABLE_QR_ISSUED' AND entity_id=$1",[own])).rows;
  let qr:{qrPublicCode:string;qrSecretToken:string};
  await check('QR issuance requires staff authentication and edit permission without hash or audit changes',async()=>{
    const before=await hash(),count=(await audit()).length;
    assert.equal((await issue(own,null)).status,401);assert.equal((await issue(own,viewerToken)).status,403);
    assert.equal(await hash(),before);assert.equal((await audit()).length,count);
  });
  await check('Assigned Owner issues QR using runtime row lock, hash update and atomic redacted audit',async()=>{
    const r=await issue();assert.equal(r.status,200);qr=r.body;
    assert.ok(typeof qr.qrSecretToken==='string'&&qr.qrSecretToken.length===64,'generated secret shape');
    assert.ok(await hash()===createHash('sha256').update(qr.qrSecretToken).digest('hex'),'only hash persisted');
    const records=await audit();assert.equal(records.length,1);assert.equal(records[0].actor_id,owner);assert.equal(records[0].outlet_id,'rest-1');
    assert.deepEqual(records[0].new_state,{rotated:true});assert.equal(records[0].old_state,null);
    assert.ok(!JSON.stringify(records).includes(qr.qrSecretToken),'audit contains no QR secret');
  });
  await check('Owner cannot rotate foreign table by resource substitution and foreign hash is unchanged',async()=>{
    const before=await hash(foreign),r=await issue(foreign);assert.ok([403,404].includes(r.status));assert.equal(r.body.qrSecretToken,undefined);assert.equal(await hash(foreign),before);
  });
  await check('QR audit insertion failure rolls back hash rotation and keeps previous credential valid',async()=>{
    const before=await hash(),count=(await audit()).length;
    await admin.query(`CREATE FUNCTION public.qr_fixture_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='TABLE_QR_ISSUED' AND NEW.entity_id='${own}'::uuid THEN RAISE EXCEPTION 'isolated audit failure'; END IF; RETURN NEW; END $$`);
    await admin.query('CREATE TRIGGER qr_fixture_audit_failure BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION public.qr_fixture_audit_failure()');
    try {assert.equal((await issue()).status,500);assert.equal(await hash(),before);assert.equal((await audit()).length,count);}
    finally {await admin.query('DROP TRIGGER qr_fixture_audit_failure ON audit_logs');await admin.query('DROP FUNCTION public.qr_fixture_audit_failure()');}
    assert.equal((await resolve(qr)).status,200);
  });
  await check('Rotation rejects old and forged secrets; public resolution exposes no operational token',async()=>{
    const previous=qr;const r=await issue();assert.equal(r.status,200);qr=r.body;
    assert.equal((await resolve(previous)).status,401);
    assert.equal((await resolve({...qr,qrSecretToken:'f'.repeat(64)})).status,401);
    for(const body of [qr,{qrPublicCode:qr.qrPublicCode}]) {const response=await resolve(body);assert.equal(response.status,200);assert.equal(response.body.tableId,own);assert.equal(response.body.token,undefined);assert.equal(response.body.qrSecretToken,undefined);}
    const detail=await request(app).get('/api/v1/tables/'+own).set('Authorization','Bearer '+ownerToken);
    assert.equal(detail.status,200);assert.equal(detail.body.qrSecretToken,undefined);assert.equal(detail.body.qrSecretTokenHash,undefined);assert.equal(detail.body.qr_secret_token_hash,undefined);
  });
  if(raw) await check('Concurrent QR rotations serialize; exactly one returned credential matches final persisted hash',async()=>{
    const before=(await audit()).length;const replies=await Promise.all([issue(),issue()]);assert.ok(replies.every(r=>r.status===200));
    const finalHash=await hash();const active=replies.filter(r=>createHash('sha256').update(r.body.qrSecretToken).digest('hex')===finalHash);
    assert.equal(active.length,1);qr=active[0].body;assert.equal((await audit()).length,before+2);
    const resolutions=await Promise.all(replies.map(r=>resolve(r.body)));assert.deepEqual(resolutions.map(r=>r.status).sort(),[200,401]);
  });
  await check('Session-scoped QR handoff survives refresh and requests/verifies isolated OTP with canonical credentials',async()=>{
    const opened=await request(app).post('/api/v1/guest/table/open').set('Authorization','Bearer '+ownerToken).send({outletId:'rest-1',tableId:own,guestCount:2});assert.equal(opened.status,200);
    const values=new Map<string,string>(),storage={getItem:(k:string)=>values.get(k)||null,setItem:(k:string,v:string)=>{values.set(k,v);},removeItem:(k:string)=>{values.delete(k);}};
    const store=new GuestQrContextStore(()=>storage),snapshot=store.capture(createSecureOrderingQrUrl('http://isolated.test',qr));
    const table=await resolve(qr);assert.equal(table.status,200);assert.equal(store.bind(snapshot,table.body),true);
    const restored=new GuestQrContextStore(()=>storage);const credentials=restored.credentials(own,'rest-1');assert.ok(credentials);assert.equal(restored.credentials(foreign,'rest-2'),null);
    const phone='9891234501';const challenge=await request(app).post('/api/v1/guest/otp/request').send({...credentials,phone});assert.equal(challenge.status,200);assert.equal(challenge.body.devOtp,undefined);
    const otp=getSmsTransport().getLastOtp?.(phone);assert.ok(!!otp,'isolated delivery only');
    const verified=await request(app).post('/api/v1/guest/otp/verify').send({sessionTokenId:challenge.body.sessionTokenId,otp});assert.equal(verified.status,200);
    const session=await request(app).get('/api/v1/guest/session').set('Authorization','Bearer '+verified.body.token);assert.equal(session.status,200);assert.equal(session.body.tableId,own);assert.equal(session.body.outletId,'rest-1');
    const denied=await request(app).post('/api/v1/guest/otp/request').send({qrPublicCode:qr.qrPublicCode,phone:'9891234502'});assert.equal(denied.status,400);
    restored.capture('/customer/qr-ordering?c='+encodeURIComponent(qr.qrPublicCode));assert.equal(restored.credentials(own,'rest-1'),null);
  });
}
