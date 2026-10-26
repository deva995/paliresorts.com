import assert from 'node:assert/strict';
import { randomUUID, createHash, randomBytes } from 'node:crypto';
import type pg from 'pg';
import request from 'supertest';
import { fixtureSession } from './runtime-test-fixtures.js';

export async function verifyPhase3(pool:pg.Pool,check:(name:string,fn:()=>Promise<void>)=>Promise<void>,native=false,runtimePool?:pg.Pool) {
  process.env.NODE_ENV='test';process.env.ALLOW_DEV_AUTH='true';process.env.OTP_DELIVERY='sms';process.env.DUMMY_OTP_ENABLED='false';
  const {resetEnvCache}=await import('../server/src/config/env.js');
  const {setDbPool}=await import('../server/src/db/pool.js');
  const {createApp}=await import('../server/src/app.js');
  const {getSmsTransport,setSmsTransport}=await import('../server/src/services/sms.service.js');
  const {clearOtpPhoneRateLimits}=await import('../server/src/modules/dining/dining.service.js');
  resetEnvCache();setDbPool(runtimePool || pool);clearOtpPhoneRateLimits();
  const app=createApp(),admin=randomUUID(),suffix=randomUUID().slice(0,6);
  await pool.query("INSERT INTO roles(id,display_name) VALUES('SUPER_ADMIN','Super Admin') ON CONFLICT DO NOTHING");
  await pool.query(`INSERT INTO staff(id,employee_code,first_name,last_name,email,phone,password_hash)
    VALUES($1,$2,'Phase3','Admin',$3,$4,'test-only-unusable-hash')`,[admin,`P3-${suffix}`,`${admin}@isolated.test`,admin.slice(0,20)]);
  await pool.query("INSERT INTO staff_roles(staff_id,role_id) VALUES($1,'SUPER_ADMIN')",[admin]);
  await pool.query("INSERT INTO staff_outlet_access(staff_id,outlet_id,is_primary) VALUES($1,'rest-1',true)",[admin]);
  const staffAuth=`Bearer ${runtimePool ? await fixtureSession(pool,admin) : 'dev-token-'+admin}`;
  let nextTable=0,nextPhone=0;
  const staffPost=(path:string,body:object={})=>request(app).post('/api/v1'+path).set('Authorization',staffAuth).send(body);
  async function fixture(outlet='rest-1',seat=true) {
    const zone=(await pool.query('SELECT id FROM dining_zones WHERE outlet_id=$1 AND is_active=true LIMIT 1',[outlet])).rows[0].id;
    const created=await staffPost(`/outlets/${outlet}/tables`,{tableNumber:`P3-${suffix}-${++nextTable}`,zoneId:zone,capacity:4});assert.equal(created.status,201);
    const qr=await staffPost(`/tables/${created.body.id}/ordering-qr`);assert.equal(qr.status,200);
    let session:string|undefined;
    if(seat){const opened=await staffPost('/guest/table/open',{tableId:created.body.id,outletId:outlet,guestCount:2});assert.equal(opened.status,200);session=opened.body.sessionId;}
    return {id:created.body.id,outlet,session,qr:qr.body as {qrPublicCode:string;qrSecretToken:string}};
  }
  const a=await fixture(),b=await fixture('rest-2');
  for(const outlet of ['rest-1','rest-2']) await pool.query("INSERT INTO kitchen_stations(outlet_id,code,name) VALUES($1,'CURRY','Isolated curry station') ON CONFLICT(outlet_id,code) DO NOTHING",[outlet]);
  async function challenge(table=a) {
    const phone=String(9800000000+(++nextPhone));
    const res=await request(app).post('/api/v1/guest/otp/request').send({...table.qr,phone,name:'Phase3 Guest'});
    assert.equal(res.status,200);assert.equal(res.body.devOtp,undefined);
    const code=getSmsTransport().getLastOtp?.(phone);assert.ok(Boolean(code),'Isolated delivery must capture a verification code');
    return {id:res.body.sessionTokenId as string,code:code!};
  }
  const verify=(id:string,otp:string)=>request(app).post('/api/v1/guest/otp/verify').send({sessionTokenId:id,otp});
  async function login(table=a) {const c=await challenge(table);const res=await verify(c.id,c.code);assert.equal(res.status,200);assert.ok(Boolean(res.body.token));return {token:res.body.token as string,id:c.id};}
  const guestGet=(path:string,token:string)=>request(app).get('/api/v1'+path).set('Authorization',`Bearer ${token}`);
  const guestPost=(path:string,token:string,body:object)=>request(app).post('/api/v1'+path).set('Authorization',`Bearer ${token}`).send(body);
  let guest:{token:string;id:string};
  await check('P3 Public QR and menu remain read-only and never issue guest credentials',async()=>{
    for(const body of [{qrPublicCode:a.qr.qrPublicCode},{...a.qr}]) {
      const res=await request(app).post('/api/v1/guest/table/resolve').send(body);assert.equal(res.status,200);assert.equal(res.body.token,undefined);assert.equal(res.body.tokenType,undefined);
    }
    assert.equal((await request(app).get('/api/v1/guest/menu').query({qrPublicCode:a.qr.qrPublicCode})).status,200);
    assert.equal((await request(app).get('/api/v1/guest/session')).status,401);
    assert.equal((await request(app).post('/api/v1/guest/otp/request').send({qrPublicCode:a.qr.qrPublicCode,phone:'9899999999'})).status,400);
    assert.equal((await request(app).post('/api/v1/guest/otp/request').send({qrPublicCode:a.qr.qrPublicCode,qrSecretToken:'forged-proof',phone:'9899999999'})).status,401);
  });
  await check('P3 Public seating denied; authorized canonical seating persists table and session together',async()=>{
    const idle=await fixture('rest-1',false);
    assert.equal((await request(app).post('/api/v1/guest/table/open').send({tableId:idle.id})).status,401);
    assert.equal((await pool.query('SELECT active_dining_session_id FROM restaurant_tables WHERE id=$1',[idle.id])).rows[0].active_dining_session_id,null);
    const opened=await staffPost('/guest/table/open',{tableId:idle.id,outletId:'rest-1',guestCount:2});assert.equal(opened.status,200);
    assert.equal((await staffPost('/guest/table/open',{tableId:idle.id,outletId:'rest-1'})).status,409);
    const row=(await pool.query('SELECT status,active_dining_session_id FROM restaurant_tables WHERE id=$1',[idle.id])).rows[0];assert.equal(row.status,'OCCUPIED');assert.equal(row.active_dining_session_id,opened.body.sessionId);
    assert.equal((await staffPost('/guest/table/open',{tableId:idle.id,outletId:'rest-2'})).status,400);
  });
  await check('P3 OTP success persists verification marker and consumes the challenge once',async()=>{
    const c=await challenge();const res=await verify(c.id,c.code);assert.equal(res.status,200);guest={token:res.body.token,id:c.id};
    const row=(await pool.query('SELECT verified_at,otp_hash,token_hash FROM guest_session_tokens WHERE id=$1',[c.id])).rows[0];
    assert.ok(Boolean(row.verified_at));assert.equal(row.otp_hash,null);assert.ok(row.token_hash===createHash('sha256').update(guest.token).digest('hex'));
    assert.equal((await verify(c.id,c.code)).status,400);
    const summary=await guestGet('/guest/session',guest.token);assert.equal(summary.status,200);assert.equal(summary.body.tableId,a.id);assert.equal(summary.body.sessionId,a.session);
  });
  await check('P3 Wrong OTP persists all three attempts and cannot bypass lockout with the correct code',async()=>{
    const c=await challenge();const wrong=c.code==='111111'?'222222':'111111';
    for(let i=1;i<=3;i++){assert.equal((await verify(c.id,wrong)).status,400);assert.equal((await pool.query('SELECT otp_attempts FROM guest_session_tokens WHERE id=$1',[c.id])).rows[0].otp_attempts,i);}
    assert.equal((await verify(c.id,c.code)).status,400);
    assert.equal((await pool.query('SELECT verified_at FROM guest_session_tokens WHERE id=$1',[c.id])).rows[0].verified_at,null);
  });
  await check('P3 Expired revoked forged and legacy proofless tokens fail closed',async()=>{
    assert.equal((await guestGet('/guest/session','gst_forged')).status,401);
    const c=await challenge();await pool.query("UPDATE guest_session_tokens SET otp_expires_at=CURRENT_TIMESTAMP-INTERVAL '1 second' WHERE id=$1",[c.id]);assert.equal((await verify(c.id,c.code)).status,400);
    for(const field of ['expires_at','is_revoked','verified_at']) {
      const authorized=await login();
      if(field==='expires_at') await pool.query("UPDATE guest_session_tokens SET expires_at=CURRENT_TIMESTAMP-INTERVAL '1 second' WHERE id=$1",[authorized.id]);
      if(field==='is_revoked') await pool.query('UPDATE guest_session_tokens SET is_revoked=true WHERE id=$1',[authorized.id]);
      if(field==='verified_at') await pool.query('UPDATE guest_session_tokens SET verified_at=NULL WHERE id=$1',[authorized.id]);
      assert.equal((await guestGet('/guest/session',authorized.token)).status,401);
    }
  });
  await check('P3 Failed delivery rolls back the challenge without disclosing credentials',async()=>{
    const transport=getSmsTransport();const before=(await pool.query('SELECT count(*)::int AS n FROM guest_session_tokens')).rows[0].n;
    try {
      setSmsTransport({sendOtp:async()=>false});
      const res=await request(app).post('/api/v1/guest/otp/request').send({...a.qr,phone:'9888888888'});
      assert.equal(res.status,400);assert.equal(res.body.token,undefined);assert.equal(res.body.devOtp,undefined);
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM guest_session_tokens')).rows[0].n,before);
    } finally {setSmsTransport(transport);}
  });
  await check('P3 Inactive outlets and tables deny verification and operational access',async()=>{
    const table=await fixture();const authorized=await login(table);const pending=await challenge(table);
    await pool.query('UPDATE restaurant_tables SET is_active=false WHERE id=$1',[table.id]);
    assert.equal((await guestGet('/guest/session',authorized.token)).status,403);
    assert.equal((await verify(pending.id,pending.code)).status,403);
    await pool.query('UPDATE restaurant_tables SET is_active=true WHERE id=$1',[table.id]);
    await pool.query('UPDATE outlets SET is_active=false WHERE id=$1',[table.outlet]);
    try {
      assert.equal((await guestGet('/guest/session',authorized.token)).status,403);
      assert.equal((await verify(pending.id,pending.code)).status,403);
      assert.equal((await staffPost(`/tables/${table.id}/ordering-qr`)).status,409);
    } finally {await pool.query('UPDATE outlets SET is_active=true WHERE id=$1',[table.outlet]);}
  });
  await check('P3 Guest context rejects other table session and outlet IDs',async()=>{
    for(const body of [{tableId:b.id},{diningSessionId:b.session},{outletId:b.outlet}]) {
      assert.equal((await guestPost('/guest/service-requests',guest.token,{requestType:'WATER',...body})).status,403);
    }
    assert.equal((await guestGet(`/guest/orders?diningSessionId=${b.session}`,guest.token)).status,403);
  });
  let firstOrder:string;
  await check('P3 Multiple order rounds persist with server prices and idempotent retries',async()=>{
    const property=(await pool.query("SELECT property_id FROM outlets WHERE id='rest-1'")).rows[0].property_id;
    const category=randomUUID();await pool.query('INSERT INTO menu_categories(id,property_id,name,code) VALUES($1,$2,$3,$3)',[category,property,`P3-${suffix}`]);
    const item=await staffPost('/outlets/rest-1/menu/items',{name:'Phase3 fixture dish',categoryId:category,priceRupees:125});assert.equal(item.status,201);
    const payload={items:[{menuItemId:item.body.id,quantity:2}]};const key=randomUUID();
    const submit=(idempotencyKey:string)=>request(app).post('/api/v1/guest/orders').set('Authorization',`Bearer ${guest.token}`).set('Idempotency-Key',idempotencyKey).send(payload);
    const first=await submit(key);assert.equal(first.status,201);firstOrder=first.body.id;assert.equal(first.body.roundNumber,1);assert.equal(first.body.subtotalPaise,25000);
    const retry=await submit(key);assert.equal(retry.status,201);assert.equal(retry.body.id,firstOrder);
    const second=await submit(randomUUID());assert.equal(second.status,201);assert.equal(second.body.roundNumber,2);
    const list=await guestGet('/guest/orders',guest.token);assert.equal(list.status,200);assert.equal(list.body.total,2);
    const other=await login(b);assert.equal((await guestGet(`/guest/orders/${firstOrder}`,other.token)).status,404);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM orders WHERE dining_session_id=$1',[a.session])).rows[0].n,2);
  });
  await check('P3 Service requests persist and remain private to the authorized sitting',async()=>{
    const service=await guestPost('/guest/service-requests',guest.token,{requestType:'WATER'});assert.equal(service.status,201);assert.equal(service.body.tableId,a.id);
    const list=await guestGet('/guest/service-requests',guest.token);assert.equal(list.status,200);assert.ok(list.body.items.some((r:any)=>r.id===service.body.id));
    const other=await login(b);const foreign=await guestGet('/guest/service-requests',other.token);assert.equal(foreign.status,200);assert.ok(!foreign.body.items.some((r:any)=>r.id===service.body.id));
  });
  await check('P3 Closing seating revokes guest access and preserves canonical table pointers',async()=>{
    const table=await fixture();const authorized=await login(table);
    assert.equal((await staffPost(`/dining-sessions/${table.session}/close`)).status,200);
    assert.equal((await guestGet('/guest/session',authorized.token)).status,401);
    const row=(await pool.query('SELECT status,active_dining_session_id FROM restaurant_tables WHERE id=$1',[table.id])).rows[0];assert.equal(row.status,'CLEANING');assert.equal(row.active_dining_session_id,null);
    assert.equal((await staffPost('/guest/table/open',{tableId:table.id,outletId:table.outlet})).status,409);
  });
  await check('P3 Logout revokes only the device token and keeps its sitting intact',async()=>{
    const authorized=await login();assert.equal((await guestPost('/guest/logout',authorized.token,{})).status,204);
    assert.equal((await guestGet('/guest/session',authorized.token)).status,401);
    assert.equal((await guestGet('/guest/session',guest.token)).status,200);
  });
  if(native) {
    await check('P3 Concurrent bad OTP requests serialize and stop exactly at maximum attempts',async()=>{
      const c=await challenge();const wrong=c.code==='111111'?'222222':'111111';
      const replies=await Promise.all(Array.from({length:5},()=>verify(c.id,wrong)));assert.ok(replies.every(r=>r.status===400));
      assert.equal((await pool.query('SELECT otp_attempts FROM guest_session_tokens WHERE id=$1',[c.id])).rows[0].otp_attempts,3);
    });
    await check('P3 Concurrent valid OTP requests issue only one operational credential',async()=>{
      const c=await challenge();const replies=await Promise.all([verify(c.id,c.code),verify(c.id,c.code)]);assert.deepEqual(replies.map(r=>r.status).sort(),[200,400]);
    });
    await check('P3 OTP verification racing closure leaves no usable guest credential',async()=>{
      const table=await fixture();const pending=await challenge(table);
      const [verified,closed]=await Promise.all([verify(pending.id,pending.code),staffPost(`/dining-sessions/${table.session}/close`)]);
      assert.equal(closed.status,200);assert.ok([200,401,403].includes(verified.status));
      if(verified.status===200) assert.equal((await guestGet('/guest/session',verified.body.token)).status,401);
      const row=(await pool.query('SELECT is_revoked FROM guest_session_tokens WHERE id=$1',[pending.id])).rows[0];assert.equal(row.is_revoked,true);
    });
    await check('P3 Concurrent authenticated seating prevents duplicate sessions',async()=>{
      const table=await fixture('rest-1',false);const replies=await Promise.all([staffPost('/guest/table/open',{tableId:table.id}),staffPost('/guest/table/open',{tableId:table.id})]);
      assert.deepEqual(replies.map(r=>r.status).sort(),[200,409]);assert.equal((await pool.query("SELECT count(*)::int AS n FROM dining_sessions WHERE table_id=$1 AND status='ACTIVE'",[table.id])).rows[0].n,1);
    });
  }
}
