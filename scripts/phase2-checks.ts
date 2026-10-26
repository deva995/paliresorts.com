import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import request from 'supertest';
import { fixtureSession } from './runtime-test-fixtures.js';

// This harness receives an explicitly owned test pool. It never loads .env or opens a pool.
export async function verifyPhase2(pool: pg.Pool, check: (name: string, fn: () => Promise<void>) => Promise<void>, native = false, runtimePool?: pg.Pool) {
  process.env.NODE_ENV = 'test';
  process.env.ALLOW_DEV_AUTH = 'true';
  const { resetEnvCache } = await import('../server/src/config/env.js');
  const { setDbPool } = await import('../server/src/db/pool.js');
  const { createApp } = await import('../server/src/app.js');
  resetEnvCache(); setDbPool(runtimePool || pool);
  const app = createApp();
  const admin = randomUUID(), owner = randomUUID(), manager = randomUUID(), foreign = randomUUID();
  const suffix = randomUUID().slice(0, 8);
  const tokens: Record<string,string> = {};
  const auth = (id: string) => `Bearer ${tokens[id] || 'dev-token-'+id}`;
  for (const [id, role, outlet] of [[admin, 'SUPER_ADMIN', 'rest-1'], [owner, 'RESTAURANT_OWNER', 'rest-1'],
    [manager, 'RESTAURANT_MANAGER', 'rest-1'], [foreign, 'WAITER', 'rest-2']]) {
    await pool.query('INSERT INTO roles(id,display_name) VALUES($1,$1) ON CONFLICT DO NOTHING', [role]);
    await pool.query(`INSERT INTO staff(id,employee_code,first_name,last_name,email,phone,password_hash)
      VALUES($1,$2,'Phase2',$3,$4,$5,$6)`, [id, `P2-${id.slice(0,8)}`, role, `${id}@isolated.test`, id.slice(0, 20), 'test-only-unusable-hash']);
    await pool.query('INSERT INTO staff_roles(staff_id,role_id) VALUES($1,$2)', [id,role]);
    await pool.query('INSERT INTO staff_outlet_access(staff_id,outlet_id,is_primary) VALUES($1,$2,true)',[id,outlet]);
    if (runtimePool) tokens[id] = await fixtureSession(pool,id);
  }
  for (const role of ['RESTAURANT_OWNER','RESTAURANT_MANAGER']) {
    for (const permission of ['menu:view','menu:edit','menu:approve_revisions','table:view','table:manage','table:assign']) {
      await pool.query("INSERT INTO permissions(id,module,description) VALUES($1,$2,'Phase2 fixture') ON CONFLICT DO NOTHING",[permission,permission.startsWith('menu:') ? 'MENU' : 'FLOOR']);
      await pool.query('INSERT INTO role_permissions(role_id,permission_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[role,permission]);
    }
  }
  const property = (await pool.query("SELECT property_id FROM outlets WHERE id='rest-1'")).rows[0].property_id;
  const category = randomUUID();
  await pool.query('INSERT INTO menu_categories(id,property_id,name,code) VALUES($1,$2,$3,$3)',[category,property,`P2-${suffix}`]);
  const item = randomUUID();
  await pool.query(`INSERT INTO menu_items(id,property_id,category_id,name,base_price_paise,target_kitchen_station_code)
    VALUES($1,$2,$3,'Phase2 original',10000,'CURRY')`,[item,property,category]);
  await pool.query(`INSERT INTO outlet_menu_items(outlet_id,menu_item_id,price_override_paise,is_available)
    VALUES('rest-1',$1,11000,true),('rest-2',$1,22000,true)`,[item]);
  const zones = (await pool.query("SELECT DISTINCT ON (outlet_id) id,outlet_id FROM dining_zones WHERE outlet_id IN ('rest-1','rest-2') ORDER BY outlet_id,id")).rows;
  const zone1 = zones.find(row => row.outlet_id === 'rest-1')!.id;
  const zone2 = zones.find(row => row.outlet_id === 'rest-2')!.id;
  const putMenu = (actor: string, body: object) => request(app).put(`/api/v1/outlets/rest-1/menu/items/${item}`).set('Authorization',auth(actor)).send(body);
  const propose = async (actor: string, name: string, outletId?: string) => {
    const res = await request(app).post('/api/v1/menu/revisions').set('Authorization',auth(actor))
      .send({menuItemId:item,outletId,changeSummary:'Phase2 verification proposal',proposedData:outletId ? {priceOverridePaise:33300} : {name}});
    assert.equal(res.status,201); return res.body.id as string;
  };
  const review = (id: string, actor: string, decision: 'approve'|'reject') => request(app)
    .post(`/api/v1/menu/revisions/${id}/${decision}`).set('Authorization',auth(actor)).send({reviewNotes:'Isolated verification'});
  let pending: string;
  await check('P2 Owner direct shared edit queues approval and only changes own outlet price', async () => {
    const res = await putMenu(owner,{name:'Phase2 approved',priceRupees:0,isAvailable:false});
    assert.equal(res.status,200); assert.ok(res.body.pendingRevisionId); pending=res.body.pendingRevisionId;
    assert.equal((await pool.query('SELECT name FROM menu_items WHERE id=$1',[item])).rows[0].name,'Phase2 original');
    const allocations=(await pool.query('SELECT outlet_id,price_override_paise,is_available FROM outlet_menu_items WHERE menu_item_id=$1 ORDER BY outlet_id',[item])).rows;
    assert.equal(Number(allocations[0].price_override_paise),0); assert.equal(allocations[0].is_available,false);
    assert.equal(Number(allocations[1].price_override_paise),22000); assert.equal(allocations[1].is_available,true);
  });
  await check('P2 Super Admin direct shared edit also queues approval',async()=>{
    const res=await putMenu(admin,{description:'Administrator proposal'});
    assert.equal(res.status,200); assert.ok(res.body.pendingRevisionId);
    assert.equal((await pool.query('SELECT description FROM menu_items WHERE id=$1',[item])).rows[0].description,null);
  });
  await check('P2 Pending list/detail and proposal audit persist',async()=>{
    const list=await request(app).get('/api/v1/menu/revisions?status=PENDING').set('Authorization',auth(admin));
    assert.equal(list.status,200); assert.ok(list.body.revisions.some((r:any)=>r.id===pending));
    const detail=await request(app).get(`/api/v1/menu/revisions/${pending}`).set('Authorization',auth(admin));
    assert.equal(detail.status,200); assert.equal(detail.body.status,'PENDING');
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM audit_logs WHERE entity_id=$1 AND action='MENU_REVISION_CREATED'",[pending])).rows[0].n,1);
  });
  await check('P2 Maker cannot approve or reject own proposal, including Super Admin',async()=>{
    assert.equal((await review(pending,owner,'approve')).status,422);
    assert.equal((await review(pending,owner,'reject')).status,422);
    const id=await propose(admin,'Admin own proposal');
    assert.equal((await review(id,admin,'approve')).status,422);
    assert.equal((await review(id,admin,'reject')).status,422);
  });
  await check('P2 Checker approval propagates to both outlets with audit and events',async()=>{
    const res=await review(pending,admin,'approve'); assert.equal(res.status,200);
    assert.equal((await pool.query('SELECT status FROM menu_item_revisions WHERE id=$1',[pending])).rows[0].status,'APPROVED');
    for (const outlet of ['rest-1','rest-2']) {
      const menu=await request(app).get(`/api/v1/outlets/${outlet}/menu`).set('Authorization',auth(admin));
      assert.equal(menu.status,200); assert.equal(menu.body.items.find((i:any)=>i.itemId===item)?.name,'Phase2 approved');
    }
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM audit_logs WHERE entity_id=$1 AND action='MENU_REVISION_APPROVED'",[pending])).rows[0].n,1);
    const events=await pool.query("SELECT outlet_id FROM outlet_event_log WHERE entity_id=$1 AND payload->>'revisionId'=$2 ORDER BY outlet_id",[item,pending]);
    assert.deepEqual(events.rows.map(row=>row.outlet_id),['rest-1','rest-2']);
    assert.equal((await review(pending,admin,'approve')).status,409);
  });
  await check('P2 Rejection leaves master and both allocations unchanged and is terminal',async()=>{
    const id=await propose(owner,'Must not propagate');
    const before=await pool.query('SELECT * FROM outlet_menu_items WHERE menu_item_id=$1 ORDER BY outlet_id',[item]);
    assert.equal((await review(id,admin,'reject')).status,200);
    assert.equal((await pool.query('SELECT name FROM menu_items WHERE id=$1',[item])).rows[0].name,'Phase2 approved');
    assert.deepEqual((await pool.query('SELECT * FROM outlet_menu_items WHERE menu_item_id=$1 ORDER BY outlet_id',[item])).rows,before.rows);
    assert.equal((await review(id,admin,'approve')).status,409);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM audit_logs WHERE entity_id=$1 AND action='MENU_REVISION_REJECTED'",[id])).rows[0].n,1);
  });
  await check('P2 Scoped reviewer cannot read another outlet revision',async()=>{
    const id=await propose(admin,'Outlet2 revision','rest-2');
    const detail=await request(app).get(`/api/v1/menu/revisions/${id}`).set('Authorization',auth(manager));
    assert.equal(detail.status,403,'Cross-outlet revision detail must be denied');
  });
  await check('P2 Scoped reviewer cannot approve another outlet revision',async()=>{
    const id=await propose(admin,'Outlet2 approval isolation','rest-2');
    assert.equal((await review(id,manager,'approve')).status,403);
  });
  let table: string;
  const createTable=async(number:string,outlet='rest-1',zoneId=zone1)=>request(app).post(`/api/v1/outlets/${outlet}/tables`)
    .set('Authorization',auth(admin)).send({tableNumber:number,zoneId,capacity:4});
  const editTable=(id:string,body:object,actor=admin)=>request(app).put(`/api/v1/tables/${id}`).set('Authorization',auth(actor)).send(body);
  const open=async(id:string,outlet='rest-1')=>request(app).post('/api/v1/dining-sessions').set('Authorization',auth(admin))
    .send({outletId:outlet,tableId:id,guestCount:2});
  await check('P2 Table create/edit, canonical duplicate, zone validation and audit',async()=>{
    const created=await createTable(`P2-${suffix}`); assert.equal(created.status,201); table=created.body.id;
    assert.equal((await createTable(`P2-${suffix}`)).status,409);
    assert.equal((await editTable(table,{zoneId:zone2})).status,400);
    assert.equal((await editTable(table,{capacity:6})).status,200);
    assert.equal((await pool.query('SELECT capacity FROM restaurant_tables WHERE id=$1',[table])).rows[0].capacity,6);
    const audit=await pool.query("SELECT action FROM audit_logs WHERE entity_id=$1 AND action IN ('TABLE_CREATED','TABLE_UPDATED') ORDER BY action",[table]);
    assert.deepEqual(audit.rows.map(row=>row.action),['TABLE_CREATED','TABLE_UPDATED']);
  });
  await check('P2 Table IDs and outlet hints cannot bypass multi-outlet access',async()=>{
    const created=await createTable(`P2B-${suffix}`,'rest-2',zone2); assert.equal(created.status,201);
    const id=created.body.id;
    const detail=await request(app).get(`/api/v1/tables/${id}`).set('Authorization',auth(manager));
    assert.equal(detail.status,403);
    assert.equal((await editTable(id,{capacity:9,outletId:'rest-1'},manager)).status,403);
    assert.equal((await open(id,'rest-1')).status,400);
  });
  await check('P2 Assignment persists with history and synchronizes active session',async()=>{
    const assigned=await request(app).post(`/api/v1/tables/${table}/assign`).set('Authorization',auth(admin)).send({staffId:manager});
    assert.equal(assigned.status,200,'Assignment must work on native PostgreSQL');
    assert.equal((await pool.query('SELECT current_waiter_staff_id FROM restaurant_tables WHERE id=$1',[table])).rows[0].current_waiter_staff_id,manager);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM table_assignment_history WHERE table_id=$1 AND released_at IS NULL',[table])).rows[0].n,1);
    const sitting=await open(table);assert.equal(sitting.status,201);
    const linked=(await pool.query('SELECT waiter_staff_id,dining_session_id FROM table_assignment_history WHERE table_id=$1 AND released_at IS NULL',[table])).rows;
    assert.deepEqual(linked,[{waiter_staff_id:manager,dining_session_id:sitting.body.id}]);

  });
  await check('P2 Assignment rejects staff belonging only to another outlet',async()=>{
    const created=await createTable(`P2C-${suffix}`); assert.equal(created.status,201);
    const res=await request(app).post(`/api/v1/tables/${created.body.id}/assign`).set('Authorization',auth(admin)).send({staffId:foreign});
    assert.equal(res.status,403);
  });
  await check('P2 Table cannot be made occupied without an operational session',async()=>{
    const created=await createTable(`P2D-${suffix}`); assert.equal(created.status,201);
    assert.equal((await editTable(created.body.id,{status:'OCCUPIED'})).status,409);
  });
  await check('P2 Active session prevents deactivation or manual occupancy reset',async()=>{
    const created=await createTable(`P2E-${suffix}`); assert.equal(created.status,201);
    const id=created.body.id; const session=await open(id); assert.equal(session.status,201);
    assert.equal((await editTable(id,{isActive:false})).status,409);
    assert.equal((await editTable(id,{status:'AVAILABLE'})).status,409);
    const row=(await pool.query('SELECT status,is_active,active_dining_session_id FROM restaurant_tables WHERE id=$1',[id])).rows[0];
    assert.equal(row.status,'OCCUPIED'); assert.equal(row.is_active,true); assert.equal(row.active_dining_session_id,session.body.id);
  });
  await check('P2 Active session prevents manual occupancy reset independently of deactivation',async()=>{
    const created=await createTable(`P2I-${suffix}`); assert.equal(created.status,201);
    const id=created.body.id; assert.equal((await open(id)).status,201);
    assert.equal((await editTable(id,{status:'AVAILABLE'})).status,409);
  });
  await check('P2 Dining-session create/cancel/close maintain table pointers',async()=>{
    const created=await createTable(`P2F-${suffix}`); assert.equal(created.status,201); const id=created.body.id;
    const session=await open(id); assert.equal(session.status,201);
    assert.equal((await open(id)).status,409);
    assert.equal((await editTable(id,{tableNumber:`P2G-${suffix}`})).status,409);
    const cancelled=await request(app).post(`/api/v1/dining-sessions/${session.body.id}/cancel`).set('Authorization',auth(admin)).send({reason:'Phase2 test'});
    assert.equal(cancelled.status,200);
    let row=(await pool.query('SELECT status,active_dining_session_id FROM restaurant_tables WHERE id=$1',[id])).rows[0];
    assert.equal(row.status,'AVAILABLE'); assert.equal(row.active_dining_session_id,null);
    const next=await open(id); assert.equal(next.status,201);
    const closed=await request(app).post(`/api/v1/dining-sessions/${next.body.id}/close`).set('Authorization',auth(admin)).send({});
    assert.equal(closed.status,200);
    row=(await pool.query('SELECT status,active_dining_session_id FROM restaurant_tables WHERE id=$1',[id])).rows[0];
    assert.equal(row.status,'CLEANING'); assert.equal(row.active_dining_session_id,null);
  });
  await check('P2 Deactivation preserves table history and prevents new sessions',async()=>{
    const created=await createTable(`P2H-${suffix}`); assert.equal(created.status,201); const id=created.body.id;
    assert.equal((await editTable(id,{isActive:false,status:'OUT_OF_SERVICE'})).status,200);
    assert.equal((await open(id)).status,409);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM restaurant_tables WHERE id=$1',[id])).rows[0].n,1);
  });
  await check('P2 Revision filtering occurs before pagination and blocks foreign rejection',async()=>{
    const own=await propose(owner,'Own outlet','rest-1');
    const other=await propose(admin,'Foreign outlet','rest-2');
    const list=await request(app).get(`/api/v1/menu/revisions?menuItemId=${item}&limit=1`).set('Authorization',auth(manager));
    assert.equal(list.status,200); assert.equal(list.body.revisions.length,1);
    const expected=await pool.query(`SELECT count(*)::int AS n FROM menu_item_revisions r WHERE menu_item_id=$1
      AND (outlet_id='rest-1' OR outlet_id IS NULL)`,[item]);
    assert.equal(list.body.total,expected.rows[0].n);
    assert.notEqual(list.body.revisions[0].outletId,'rest-2');
    const filtered=await request(app).get(`/api/v1/menu/revisions?outletId=rest-2&limit=1`).set('Authorization',auth(manager));
    assert.equal(filtered.status,200); assert.equal(filtered.body.total,0); assert.equal(filtered.body.revisions.length,0);
    assert.equal((await review(other,manager,'reject')).status,403);
    assert.equal((await review(own,manager,'approve')).status,200);
  });
  await check('P2 Shared master visible to affected staff but review requires every affected outlet',async()=>{
    const id=await propose(owner,'All outlet review required');
    assert.equal((await request(app).get(`/api/v1/menu/revisions/${id}`).set('Authorization',auth(manager))).status,200);
    assert.equal((await review(id,manager,'approve')).status,403);
    assert.equal((await review(id,manager,'reject')).status,403);
    for(const [outletId,proposedData] of [['rest-1',{name:'Cannot smuggle master field'}],[null,{priceOverridePaise:1}]]) {
      const res=await request(app).post('/api/v1/menu/revisions').set('Authorization',auth(owner))
        .send({menuItemId:item,outletId,changeSummary:'Invalid mixed scope',proposedData});
      assert.equal(res.status,400);
    }
  });
  await check('P2 Cached approval cannot bypass maker checker or changed outlet membership',async()=>{
    const id=await propose(owner,'Replay authorization','rest-1');const key=randomUUID();
    const call=(actor:string)=>request(app).post(`/api/v1/menu/revisions/${id}/approve`).set('Authorization',auth(actor))
      .set('Idempotency-Key',key).send({reviewNotes:'Isolated replay verification'});
    assert.equal((await call(manager)).status,200);
    assert.equal((await call(manager)).status,200);
    assert.equal((await call(owner)).status,422);
    await pool.query("DELETE FROM staff_outlet_access WHERE staff_id=$1 AND outlet_id='rest-1'",[manager]);
    try {assert.equal((await call(manager)).status,403);}
    finally {await pool.query("INSERT INTO staff_outlet_access(staff_id,outlet_id,is_primary) VALUES($1,'rest-1',true)",[manager]);}
  });
  await check('P2 Assignment release authority, inactive staff denial, history and session link',async()=>{
    // Two ordinary waiters in rest-1, with actual outlet membership and no manager rights.
    const waiters=[randomUUID(),randomUUID()];
    for(const id of waiters) {
      await pool.query(`INSERT INTO staff(id,employee_code,first_name,last_name,email,phone,password_hash)
        VALUES($1,$2,'Phase2','Waiter',$3,$4,'test-only-unusable-hash')`,[id,`P2-${id.slice(0,8)}`,`${id}@isolated.test`,id.slice(0,20)]);
      await pool.query("INSERT INTO staff_roles(staff_id,role_id) VALUES($1,'WAITER')",[id]);
      await pool.query("INSERT INTO staff_outlet_access(staff_id,outlet_id) VALUES($1,'rest-1')",[id]);
      if (runtimePool) tokens[id] = await fixtureSession(pool,id);
    }
    for(const permission of ['table:view','table:assign']) await pool.query("INSERT INTO role_permissions(role_id,permission_id) VALUES('WAITER',$1) ON CONFLICT DO NOTHING",[permission]);
    const created=await createTable(`P2J-${suffix}`); assert.equal(created.status,201);const id=created.body.id;
    const session=await open(id);assert.equal(session.status,201);
    const assign=(actor:string,body:object)=>request(app).post(`/api/v1/tables/${id}/assign`).set('Authorization',auth(actor)).send(body);
    assert.equal((await assign(admin,{unassign:true})).status,200);
    assert.equal((await assign(waiters[0],{})).status,200);
    assert.equal((await assign(waiters[0],{})).status,200);
    assert.equal((await assign(waiters[1],{unassign:true})).status,403);
    assert.equal((await assign(waiters[1],{})).status,409);
    const history=await pool.query('SELECT dining_session_id FROM table_assignment_history WHERE table_id=$1 AND released_at IS NULL',[id]);
    assert.equal(history.rows.length,1);assert.equal(history.rows[0].dining_session_id,session.body.id);
    const sessionView=await request(app).get(`/api/v1/dining-sessions/${session.body.id}`).set('Authorization',auth(admin));
    assert.equal(sessionView.status,200);
    assert.equal((await assign(waiters[0],{unassign:true})).status,200);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM table_assignment_history WHERE table_id=$1 AND released_at IS NULL',[id])).rows[0].n,0);
    await pool.query('UPDATE staff SET is_active=false WHERE id=$1',[waiters[1]]);
    assert.equal((await assign(admin,{staffId:waiters[1]})).status,403);
    assert.equal((await assign(admin,{staffId:'not-an-id'})).status,400);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM audit_logs WHERE entity_id=$1 AND action='TABLE_ASSIGNMENT_CHANGED'",[id])).rows[0].n,4);
  });
  await check('P2 Canonical zone inventory rejects unknown inactive and foreign zones without mutation',async()=>{
    const inventory=await request(app).get('/api/v1/outlets/rest-1/zones').set('Authorization',auth(manager));
    const badOccupancy=await request(app).post('/api/v1/outlets/rest-1/tables').set('Authorization',auth(admin)).send({tableNumber:`P2U-${suffix}`,zoneId:zone1,status:'OCCUPIED'});
    assert.equal(badOccupancy.status,409);
    assert.equal(inventory.status,200);assert.ok(inventory.body.zones.some((z:any)=>z.id===zone1));
    assert.equal((await request(app).get('/api/v1/outlets/rest-2/zones').set('Authorization',auth(manager))).status,403);
    const invalid=await request(app).post('/api/v1/outlets/rest-1/tables').set('Authorization',auth(admin)).send({tableNumber:`P2K-${suffix}`,zoneName:'Not a real zone'});
    assert.equal(invalid.status,400);
    const inactive=randomUUID();await pool.query("INSERT INTO dining_zones(id,outlet_id,name,code,is_active) VALUES($1,'rest-1','Inactive test zone',$2,false)",[inactive,`P2-${suffix}`]);
    assert.equal((await createTable(`P2L-${suffix}`,'rest-1',inactive)).status,400);
    assert.equal((await editTable(table,{zoneId:inactive})).status,400);
    assert.equal((await editTable(table,{zoneName:'Unknown zone'})).status,400);
    const roster=await request(app).get('/api/v1/outlets/rest-1/floor-staff').set('Authorization',auth(manager));
    assert.equal(roster.status,200);assert.ok(roster.body.staff.some((s:any)=>s.id===manager));assert.ok(!roster.body.staff.some((s:any)=>s.id===foreign));
  });
  await check('P2 DELETE deactivates even unused tables and preserves identifiers and history',async()=>{
    const created=await createTable(`P2M-${suffix}`);assert.equal(created.status,201);const id=created.body.id;
    assert.equal((await request(app).delete(`/api/v1/tables/${id}`).set('Authorization',auth(admin))).status,200);
    const row=(await pool.query('SELECT is_active,status FROM restaurant_tables WHERE id=$1',[id])).rows[0];
    assert.deepEqual(row,{is_active:false,status:'OUT_OF_SERVICE'});
    assert.equal((await open(id)).status,409);
  });
  await check('P2 Table create/edit/deactivation and assignment roll back with audit/event failure',async()=>{
    const created=await createTable(`P2N-${suffix}`);assert.equal(created.status,201);const id=created.body.id;
    const fn=`p2_fail_${suffix}`;
    async function failEvent(eventType:string,run:()=>Promise<void>) {
      await pool.query(`CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.event_type='${eventType}' THEN RAISE EXCEPTION 'Isolated Phase2 event failure'; END IF;
        RETURN NEW; END $$;`);
      await pool.query(`CREATE TRIGGER ${fn} BEFORE INSERT ON outlet_event_log FOR EACH ROW EXECUTE FUNCTION ${fn}();`);
      try {await run();} finally {await pool.query(`DROP TRIGGER ${fn} ON outlet_event_log`); await pool.query(`DROP FUNCTION ${fn}()`);}
    }
    const counts=async()=> (await pool.query('SELECT (SELECT count(*)::int FROM audit_logs) AS audits,(SELECT count(*)::int FROM outlet_event_log) AS events')).rows[0];
    await failEvent('TABLE_CREATED',async()=>{
      const before=await counts();assert.equal((await createTable(`P2O-${suffix}`)).status,500);
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM restaurant_tables WHERE table_number=$1',[`P2O-${suffix}`])).rows[0].n,0);
      assert.deepEqual(await counts(),before);
    });
    for(const event of ['TABLE_UPDATED','TABLE_DELETED','TABLE_ASSIGNMENT_CHANGED']) await failEvent(event,async()=>{
      const before=await counts();const row=(await pool.query('SELECT * FROM restaurant_tables WHERE id=$1',[id])).rows[0];
      const response=event==='TABLE_UPDATED' ? await editTable(id,{capacity:9}) : event==='TABLE_DELETED'
        ? await request(app).delete(`/api/v1/tables/${id}`).set('Authorization',auth(admin))
        : await request(app).post(`/api/v1/tables/${id}/assign`).set('Authorization',auth(admin)).send({staffId:manager});
      assert.equal(response.status,500);assert.deepEqual((await pool.query('SELECT * FROM restaurant_tables WHERE id=$1',[id])).rows[0],row);
      assert.deepEqual(await counts(),before);
    });
  });
  // The embedded adapter shares one connection; parallel transaction semantics require native PostgreSQL.
  if(native) {
    await check('P2 Concurrent duplicate creates yield one durable table and one conflict',async()=>{
      const responses=await Promise.all([createTable(`P2P-${suffix}`),createTable(`P2P-${suffix}`)]);
      assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM restaurant_tables WHERE table_number=$1',[`P2P-${suffix}`])).rows[0].n,1);
    });
    await check('P2 Concurrent assignments serialize to one waiter and one open history',async()=>{
      const created=await createTable(`P2Q-${suffix}`);const id=created.body.id;
      const responses=await Promise.all([manager,owner].map(staffId=>request(app).post(`/api/v1/tables/${id}/assign`).set('Authorization',auth(admin)).send({staffId})));
      assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM table_assignment_history WHERE table_id=$1 AND released_at IS NULL',[id])).rows[0].n,1);
    });
    await check('P2 Concurrent session create versus deactivate never leaves an inactive occupied table',async()=>{
      const created=await createTable(`P2R-${suffix}`);const id=created.body.id;
      const responses=await Promise.all([open(id),editTable(id,{isActive:false})]);
      assert.ok([[201,409],[409,200]].some(expected=>responses.every((r,i)=>r.status===expected[i])));
      const row=(await pool.query('SELECT is_active,status,active_dining_session_id FROM restaurant_tables WHERE id=$1',[id])).rows[0];
      assert.ok(row.is_active ? row.status==='OCCUPIED' && row.active_dining_session_id : row.status==='OUT_OF_SERVICE' && !row.active_dining_session_id);
    });
    await check('P2 Concurrent session create versus renumber or occupancy edit preserves invariants',async()=>{
      const created=await createTable(`P2S-${suffix}`);const id=created.body.id;
      const responses=await Promise.all([open(id),editTable(id,{tableNumber:`P2T-${suffix}`,status:'RESERVED'})]);
      assert.equal(responses[0].status,201);assert.ok([200,409].includes(responses[1].status));
      const row=(await pool.query('SELECT status,active_dining_session_id FROM restaurant_tables WHERE id=$1',[id])).rows[0];
      assert.equal(row.status,'OCCUPIED');assert.ok(row.active_dining_session_id);
    });
  }
}
