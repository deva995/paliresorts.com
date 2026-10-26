import assert from 'node:assert/strict';
import { randomUUID, createHash, randomBytes } from 'node:crypto';
import type pg from 'pg';
import request from 'supertest';
import { fixtureSession } from './runtime-test-fixtures.js';

export async function verifyPhase4(pool:pg.Pool,check:(name:string,fn:()=>Promise<void>)=>Promise<void>,native=false,runtimePool?:pg.Pool) {
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
    VALUES($1,$2,'Phase4','Admin',$3,$4,'test-only-unusable-hash')`,[admin,`P4-${suffix}`,`${admin}@isolated.test`,admin.slice(0,20)]);
  await pool.query("INSERT INTO staff_roles(staff_id,role_id) VALUES($1,'SUPER_ADMIN')",[admin]);
  await pool.query("INSERT INTO staff_outlet_access(staff_id,outlet_id,is_primary) VALUES($1,'rest-1',true)",[admin]);
  const staffAuth=`Bearer ${runtimePool ? await fixtureSession(pool,admin) : 'dev-token-'+admin}`;
  let nextTable=0,nextPhone=0;
  const staffPost=(path:string,body:object={})=>request(app).post('/api/v1'+path).set('Authorization',staffAuth).send(body);
  async function fixture(outlet='rest-1',seat=true) {
    const zone=(await pool.query('SELECT id FROM dining_zones WHERE outlet_id=$1 AND is_active=true LIMIT 1',[outlet])).rows[0].id;
    const created=await staffPost(`/outlets/${outlet}/tables`,{tableNumber:`P4-${suffix}-${++nextTable}`,zoneId:zone,capacity:4});assert.equal(created.status,201);
    const qr=await staffPost(`/tables/${created.body.id}/ordering-qr`);assert.equal(qr.status,200);
    let session:string|undefined;
    if(seat){const opened=await staffPost('/guest/table/open',{tableId:created.body.id,outletId:outlet,guestCount:2});assert.equal(opened.status,200);session=opened.body.sessionId;}
    return {id:created.body.id,outlet,session,qr:qr.body as {qrPublicCode:string;qrSecretToken:string}};
  }
  const a=await fixture();
  const actors:Record<string,string>={};
  for(const [role,outlet] of [['WAITER','rest-1'],['KITCHEN_COOKING','rest-1'],['WAITER_MANAGER','rest-2']]) {
    const id=randomUUID();actors[role]=`Bearer dev-token-${id}`;
    await pool.query('INSERT INTO roles(id,display_name) VALUES($1,$1) ON CONFLICT DO NOTHING',[role]);
    await pool.query("INSERT INTO staff(id,employee_code,first_name,last_name,email,phone,password_hash) VALUES($1,$2,'Phase4',$3,$4,$5,'test-only-unusable-hash')",[id,`P4-${id.slice(0,8)}`,role,`${id}@isolated.test`,id.slice(0,20)]);
    await pool.query('INSERT INTO staff_roles(staff_id,role_id) VALUES($1,$2)',[id,role]);
    await pool.query('INSERT INTO staff_outlet_access(staff_id,outlet_id,is_primary) VALUES($1,$2,true)',[id,outlet]);
    if (runtimePool) actors[role]=`Bearer ${await fixtureSession(pool,id)}`;
    const perms=role==='KITCHEN_COOKING'?['kds:view','kds:update']:role==='WAITER'?['order:view','order:create','order:serve','table:view','table:assign','kds:view']:['order:view','order:create','order:update','order:cancel','table:view','table:assign','kds:view'];
    for(const perm of perms) {await pool.query("INSERT INTO permissions(id,module,description) VALUES($1,'ORDER','Phase4 isolated') ON CONFLICT DO NOTHING",[perm]);await pool.query('INSERT INTO role_permissions(role_id,permission_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[role,perm]);}
  }
  const post=(path:string,body:object={},actor=staffAuth,key?:string)=>{
    const req=request(app).post('/api/v1'+path).set('Authorization',actor);if(key) req.set('Idempotency-Key',key);return req.send(body);
  };
  const get=(path:string,actor=staffAuth)=>request(app).get('/api/v1'+path).set('Authorization',actor);
  const property=(await pool.query("SELECT property_id FROM outlets WHERE id='rest-1'")).rows[0].property_id;
  const category=randomUUID();await pool.query('INSERT INTO menu_categories(id,property_id,name,code) VALUES($1,$2,$3,$3)',[category,property,`P4-${suffix}`]);
  for(const code of ['CURRY','BAR']) await pool.query("INSERT INTO kitchen_stations(outlet_id,code,name) VALUES('rest-1',$1,$1) ON CONFLICT(outlet_id,code) DO NOTHING",[code]);
  const dish=await post('/outlets/rest-1/menu/items',{name:'Phase4 persisted dish',categoryId:category,priceRupees:125,targetKitchenStationCode:'CURRY'});assert.equal(dish.status,201);
  const drink=await post('/outlets/rest-1/menu/items',{name:'Phase4 persisted drink',categoryId:category,priceRupees:75,targetKitchenStationCode:'BAR'});assert.equal(drink.status,201);
  const payload={outletId:a.outlet,tableId:a.id,items:[{menuItemId:dish.body.id,quantity:2},{menuItemId:drink.body.id,quantity:1}]};
  const create=(body=payload,key=randomUUID(),actor=actors.WAITER)=>post('/orders',body,actor,key);
  let order:any,kots:any[];
  await check('P4 Authorized waiter persists order snapshots and routes station KOTs atomically',async()=>{
    const res=await create();assert.equal(res.status,201);order=res.body;assert.equal(order.roundNumber,1);assert.equal(order.subtotalPaise,32500);
    const list=await get(`/outlets/rest-1/kots?orderId=${order.id}`);assert.equal(list.status,200);kots=list.body.items || list.body.kots;assert.equal(kots.length,2);
    assert.deepEqual(kots.map(k=>k.stationCode).sort(),['BAR','CURRY']);assert.ok(kots.every(k=>k.orderId===order.id));
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM order_items WHERE order_id=$1',[order.id])).rows[0].n,2);
  });
  await check('P4 Duplicate request replays once and another actor cannot steal the response',async()=>{
    const key=randomUUID();const first=await create(payload,key);assert.equal(first.status,201);
    const retry=await create(payload,key);assert.equal(retry.status,201);assert.equal(retry.body.id,first.body.id);assert.equal(retry.body.roundNumber,2);
    const other=await create(payload,key,staffAuth);assert.equal(other.status,422);
  });
  await check('P4 Foreign staff cannot create read mutate or cancel another outlet order',async()=>{
    const actor=actors.WAITER_MANAGER;
    assert.equal((await create(payload,randomUUID(),actor)).status,403);
    assert.equal((await get(`/orders/${order.id}`,actor)).status,403);
    assert.equal((await post(`/orders/${order.id}/status`,{status:'SERVED'},actor)).status,403);
    assert.equal((await post(`/orders/${order.id}/cancel`,{reason:'Isolated negative'},actor)).status,403);
  });
  await check('P4 Staff permissions and invalid transitions fail without database changes',async()=>{
    assert.equal((await post(`/orders/${order.id}/status`,{status:'READY'},actors.WAITER)).status,403);
    assert.equal((await post(`/orders/${order.id}/cancel`,{reason:'Waiter unauthorized'},actors.WAITER)).status,403);
    assert.equal((await create(payload,randomUUID(),actors.KITCHEN_COOKING)).status,403);
    assert.equal((await post(`/orders/${order.id}/status`,{status:'SERVED'},actors.WAITER)).status,409);
    assert.equal((await post(`/kots/${kots[0].id}/ready`,{},actors.KITCHEN_COOKING)).status,kots[0].stationCode==='BAR'?403:409);
    assert.equal((await get(`/orders/${order.id}`)).body.status,'ACCEPTED');
  });
  await check('P4 Kitchen station scope rejects bar tickets for cooking staff',async()=>{
    const bar=kots.find(k=>k.stationCode==='BAR');assert.equal((await post(`/kots/${bar.id}/accept`,{},actors.KITCHEN_COOKING)).status,403);
    const queue=await get('/outlets/rest-1/kots',actors.KITCHEN_COOKING);assert.equal(queue.status,200);assert.ok((queue.body.items || queue.body.kots).every((k:any)=>k.stationCode!=='BAR'));
  });
  await check('P4 Accept prepare ready and waiter serve synchronize items tickets and histories',async()=>{
    for(const kot of kots) {const actor=kot.stationCode==='CURRY'?actors.KITCHEN_COOKING:staffAuth;
      for(const action of ['accept','start','ready']) assert.equal((await post(`/kots/${kot.id}/${action}`,{},actor)).status,200);
    }
    assert.equal((await get(`/orders/${order.id}`)).body.status,'READY');
    assert.equal((await post(`/orders/${order.id}/status`,{status:'SERVED'},actors.WAITER)).status,200);
    const persisted=(await get(`/orders/${order.id}`)).body;assert.equal(persisted.status,'SERVED');assert.ok(persisted.items.every((i:any)=>i.status==='SERVED'));assert.equal(persisted.items[0].itemName,'Phase4 persisted dish');
    const statuses=(await pool.query('SELECT status FROM kots WHERE order_id=$1',[order.id])).rows;assert.ok(statuses.every(r=>r.status==='SERVED'));
    assert.ok((await pool.query('SELECT count(*)::int AS n FROM kot_status_history WHERE kot_id=$1',[kots[0].id])).rows[0].n>=5);
    assert.equal((await post(`/orders/${order.id}/cancel`,{reason:'Served negative'})).status,409);
  });
  await check('P4 Cancelled orders retain records and atomically cancel station tickets',async()=>{
    const res=await create();assert.equal(res.status,201);assert.equal((await post(`/orders/${res.body.id}/cancel`,{reason:'Isolated cancellation'})).status,200);
    const persisted=(await get(`/orders/${res.body.id}`)).body;assert.equal(persisted.status,'CANCELLED');assert.ok(persisted.items.every((i:any)=>i.status==='CANCELLED'));
    assert.ok((await pool.query('SELECT status FROM kots WHERE order_id=$1',[res.body.id])).rows.every(r=>r.status==='CANCELLED'));
    assert.equal((await post(`/orders/${res.body.id}/status`,{status:'PREPARING'})).status,409);
  });
  await check('P4 Invalid catalog on idle table rolls back seating order and KOT',async()=>{
    const idle=await fixture('rest-1',false);const res=await create({...payload,tableId:idle.id,items:[{menuItemId:randomUUID(),quantity:1}]});assert.ok([404,422].includes(res.status));
    const table=(await pool.query('SELECT status,active_dining_session_id FROM restaurant_tables WHERE id=$1',[idle.id])).rows[0];assert.equal(table.status,'AVAILABLE');assert.equal(table.active_dining_session_id,null);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM dining_sessions WHERE table_id=$1',[idle.id])).rows[0].n,0);
  });
  await check('P4 Inactive outlet denies new orders and preserves existing historical orders',async()=>{
    await pool.query("UPDATE outlets SET is_active=false WHERE id='rest-1'");
    try{assert.equal((await create()).status,403);assert.equal((await get(`/orders/${order.id}`)).body.id,order.id);}
    finally{await pool.query("UPDATE outlets SET is_active=true WHERE id='rest-1'");}
  });
  await check('P4 Staff service requests persist and foreign staff cannot create or resolve them',async()=>{
    const created=await post(`/tables/${a.id}/service-requests`,{requestType:'WATER'},actors.WAITER);assert.equal(created.status,201);
    assert.equal((await post(`/tables/${a.id}/service-requests`,{requestType:'WATER'},actors.WAITER_MANAGER)).status,403);
    assert.equal((await post(`/service-requests/${created.body.id}/resolve`,{},actors.WAITER_MANAGER)).status,403);
    assert.equal((await post(`/service-requests/${created.body.id}/resolve`,{},actors.WAITER)).status,200);
    assert.equal((await pool.query('SELECT status FROM service_requests WHERE id=$1',[created.body.id])).rows[0].status,'RESOLVED');
  });
  await check('P4 Ready item returned to preparation synchronizes ticket and order; reasonless cancellation cannot mutate',async()=>{
    const created=await create();assert.equal(created.status,201);
    const list=await get(`/outlets/rest-1/kots?orderId=${created.body.id}`);const tickets=list.body.items || list.body.kots;
    for(const ticket of tickets) for(const milestone of ['accept','start','ready']) assert.equal((await post(`/kots/${ticket.id}/${milestone}`,{},actors.KITCHEN_EXECUTIVE)).status,200);
    const ticket=tickets.find((k:any)=>k.stationCode==='CURRY');const item=ticket.items[0];
    const unreasoned=await post(`/kot-items/${item.id}/status`,{status:'CANCELLED'},actors.KITCHEN_COOKING);assert.equal(unreasoned.status,400);
    const returned=await post(`/kot-items/${item.id}/status`,{status:'PREPARING'},actors.KITCHEN_COOKING);assert.equal(returned.status,200);assert.equal(returned.body.kot.status,'PREPARING');
    assert.equal((await pool.query('SELECT status FROM orders WHERE id=$1',[created.body.id])).rows[0].status,'PREPARING');
    assert.equal((await pool.query('SELECT status FROM order_items WHERE id=$1',[item.orderItemId])).rows[0].status,'PREPARING');
    assert.equal((await post(`/kot-items/${item.id}/status`,{status:'READY'},actors.KITCHEN_COOKING)).status,200);
    assert.equal((await pool.query('SELECT status FROM orders WHERE id=$1',[created.body.id])).rows[0].status,'READY');
  });
  await check('P4 Individual kitchen items retain snapshots and audit history through cancellation',async()=>{
    const res=await create();assert.equal(res.status,201);const list=await get(`/outlets/rest-1/kots?orderId=${res.body.id}`);const ticket=(list.body.items || list.body.kots).find((k:any)=>k.stationCode==='CURRY');const item=ticket.items[0];
    assert.equal((await post(`/kot-items/${item.id}/status`,{status:'PREPARING'},actors.KITCHEN_COOKING)).status,200);
    assert.equal((await post(`/orders/${res.body.id}/items/${item.orderItemId}/cancel`,{reason:'Foreign negative'},actors.WAITER_MANAGER)).status,403);
    assert.equal((await post(`/orders/${res.body.id}/items/${randomUUID()}/cancel`,{reason:'Missing negative'})).status,404);
    assert.equal((await post(`/orders/${res.body.id}/items/${item.orderItemId}/cancel`,{reason:'Isolated cancellation'})).status,200);
    assert.equal((await post(`/kot-items/${item.id}/status`,{status:'READY'},actors.KITCHEN_COOKING)).status,409);
    const row=(await pool.query('SELECT status,item_name_snapshot,unit_price_paise FROM order_items WHERE id=$1',[item.orderItemId])).rows[0];assert.equal(row.status,'CANCELLED');assert.equal(row.item_name_snapshot,'Phase4 persisted dish');assert.equal(Number(row.unit_price_paise),12500);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM audit_logs WHERE entity_id=$1 AND action='KOT_ITEM_STATUS_CHANGED'",[item.id])).rows[0].n,2);
  });
  await check('P4 Event failure rolls back seating orders KOTs histories and retry keys together',async()=>{
    const table=await fixture('rest-1',false);const key=randomUUID();const before=(await pool.query('SELECT count(*)::int AS n FROM orders')).rows[0].n;
    const fn=`p4_fail_${suffix}`;
    await pool.query(`CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_type='KOT_CREATED' THEN RAISE EXCEPTION 'Isolated Phase4 event failure'; END IF; RETURN NEW; END $$`);
    await pool.query(`CREATE TRIGGER ${fn} BEFORE INSERT ON outlet_event_log FOR EACH ROW EXECUTE FUNCTION ${fn}()`);
    try {const res=await create({...payload,tableId:table.id},key);assert.equal(res.status,422);assert.match(res.body.detail,/Kitchen order ticket/);assert.equal((await pool.query('SELECT count(*)::int AS n FROM orders')).rows[0].n,before);assert.equal((await pool.query('SELECT active_dining_session_id FROM restaurant_tables WHERE id=$1',[table.id])).rows[0].active_dining_session_id,null);}
    finally {await pool.query(`DROP TRIGGER ${fn} ON outlet_event_log`);await pool.query(`DROP FUNCTION ${fn}()`);}
    assert.equal((await create({...payload,tableId:table.id},key)).status,201);
  });
  if(native) {
    await check('P4 Competing kitchen transitions serialize with one success and one conflict',async()=>{
      const res=await create();const list=await get(`/outlets/rest-1/kots?orderId=${res.body.id}`);const ticket=(list.body.items || list.body.kots)[0];
      const replies=await Promise.all([post(`/kots/${ticket.id}/accept`),post(`/kots/${ticket.id}/accept`)]);assert.deepEqual(replies.map(r=>r.status).sort(),[200,409]);
    });
    await check('P4 Staff order racing sitting closure cannot deadlock or orphan table pointers',async()=>{
      const table=await fixture();const [created,closed]=await Promise.all([create({...payload,tableId:table.id}),post(`/dining-sessions/${table.session}/close`)]);
      assert.ok([201,409].includes(created.status));assert.ok([200,409].includes(closed.status));
      const pointer=(await pool.query('SELECT active_dining_session_id FROM restaurant_tables WHERE id=$1',[table.id])).rows[0].active_dining_session_id;
      if(created.status===201) {assert.equal(closed.status,409);assert.equal(pointer,table.session);} else {assert.equal(closed.status,200);assert.equal(pointer,null);}
    });
    await check('P4 Concurrent duplicate order submissions produce one order and one round',async()=>{
      const table=await fixture('rest-1',false),key=randomUUID(),body={...payload,tableId:table.id};
      const replies=await Promise.all([create(body,key),create(body,key)]);assert.ok(replies.every(r=>r.status===201));assert.equal(replies[0].body.id,replies[1].body.id);
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM orders WHERE dining_session_id=$1',[replies[0].body.diningSessionId])).rows[0].n,1);
    });
    await check('P4 Concurrent different rounds serialize and station transitions cannot deadlock',async()=>{
      const table=await fixture(),body={...payload,tableId:table.id};const replies=await Promise.all([create(body),create(body)]);assert.ok(replies.every(r=>r.status===201));assert.deepEqual(replies.map(r=>r.body.roundNumber).sort(),[1,2]);
      const list=await get(`/outlets/rest-1/kots?orderId=${replies[0].body.id}`);const tickets=list.body.items || list.body.kots;
      const accepts=await Promise.all(tickets.map((k:any)=>post(`/kots/${k.id}/accept`)));assert.ok(accepts.every((r:any)=>r.status===200));
      const starts=await Promise.all(tickets.map((k:any)=>post(`/kots/${k.id}/start`)));assert.ok(starts.every((r:any)=>r.status===200));
    });
  }
}
