import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import type pg from 'pg';
import request from 'supertest';
import { fixtureSession } from './runtime-test-fixtures.js';

export async function verifyPhase5(pool:pg.Pool,check:(name:string,fn:()=>Promise<void>)=>Promise<void>,native=false,runtimePool?:pg.Pool){
  process.env.NODE_ENV='test';process.env.ALLOW_DEV_AUTH='true';
  const {resetEnvCache}=await import('../server/src/config/env.js');const {setDbPool}=await import('../server/src/db/pool.js');const {createApp}=await import('../server/src/app.js');
  resetEnvCache();setDbPool(runtimePool || pool);const app=createApp(),suffix=randomUUID().slice(0,6);
  const actors:Record<string,string>={};
  const tokens:Record<string,string>={};
  for(const [name,role,outlet] of [['maker','SUPER_ADMIN','rest-1'],['checker','SUPER_ADMIN','rest-1'],['foreign','CASHIER','rest-2'],['cashier','CASHIER','rest-1'],['waiter','WAITER','rest-1'],['manager','WAITER_MANAGER','rest-1']]){
    const id=randomUUID();actors[name]=id;
    await pool.query('INSERT INTO roles(id,display_name) VALUES($1,$1) ON CONFLICT DO NOTHING',[role]);
    await pool.query("INSERT INTO staff(id,employee_code,first_name,last_name,email,phone,password_hash) VALUES($1,$2,'Phase5',$3,$4,$5,'test-only-unusable-hash')",[id,`P5-${id.slice(0,8)}`,name,`${id}@isolated.test`,id.slice(0,20)]);
    await pool.query('INSERT INTO staff_roles(staff_id,role_id) VALUES($1,$2)',[id,role]);await pool.query('INSERT INTO staff_outlet_access(staff_id,outlet_id,is_primary) VALUES($1,$2,true)',[id,outlet]);
    if (runtimePool) tokens[name]=await fixtureSession(pool,id);
    const permissions=role==='CASHIER'?['bill:view','bill:generate','bill:apply_discount','payment:process','order:view','order:counter_create']:role==='WAITER_MANAGER'?['bill:view','bill:approve_discount']:[];
    for(const perm of permissions){await pool.query("INSERT INTO permissions(id,module,description) VALUES($1,'BILLING','Phase5 isolated') ON CONFLICT DO NOTHING",[perm]);await pool.query('INSERT INTO role_permissions(role_id,permission_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[role,perm]);}
  }
  const post=(path:string,body:object={},actor='maker',key=randomUUID())=>request(app).post('/api/v1'+path).set('Authorization',`Bearer ${tokens[actor] || 'dev-token-'+actors[actor]}`).set('Idempotency-Key',key).send(body);
  const get=(path:string,actor='maker')=>request(app).get('/api/v1'+path).set('Authorization',`Bearer ${tokens[actor] || 'dev-token-'+actors[actor]}`);
  await pool.query("UPDATE outlet_settings SET service_charge_percent=0,max_auto_round_off_paise=0,manager_max_discount_percent=15,manager_max_discount_paise=150000 WHERE outlet_id='rest-1'");
  const property=(await pool.query("SELECT property_id FROM outlets WHERE id='rest-1'")).rows[0].property_id;
  const category=randomUUID();await pool.query('INSERT INTO menu_categories(id,property_id,name,code) VALUES($1,$2,$3,$3)',[category,property,`P5-${suffix}`]);
  const reasonResult=await post('/outlets/rest-1/discount-reasons',{code:`P5_${suffix.toUpperCase()}`,description:'Isolated business reason'});assert.equal(reasonResult.status,201);const reason=reasonResult.body.id;
  const dish=await post('/outlets/rest-1/menu/items',{name:`Phase5 dish ${suffix}`,categoryId:category,priceRupees:126.01});assert.equal(dish.status,201);
  let nextTable=0;
  async function order(session:string|undefined){const created=await post(session?'/orders':'/outlets/rest-1/counter-orders',session?{outletId:'rest-1',diningSessionId:session,items:[{menuItemId:dish.body.id,quantity:1}]}:{items:[{menuItemId:dish.body.id,quantity:1}]});assert.equal(created.status,201);return created.body;}
  async function serve(id:string){const tickets=await get('/outlets/rest-1/kots?orderId='+id);assert.equal(tickets.status,200);for(const kot of tickets.body.kots||tickets.body.items)for(const action of ['accept','start','ready'])assert.equal((await post(`/kots/${kot.id}/${action}`)).status,200);assert.equal((await post(`/orders/${id}/status`,{status:'SERVED'})).status,200);}
  async function sitting(served=true){
    const zone=(await pool.query("SELECT id FROM dining_zones WHERE outlet_id='rest-1' AND is_active=true LIMIT 1")).rows[0].id;
    const table=await post('/outlets/rest-1/tables',{tableNumber:`P5-${suffix}-${++nextTable}`,capacity:4,zoneId:zone});assert.equal(table.status,201);
    const opened=await post('/guest/table/open',{outletId:'rest-1',tableId:table.body.id,guestCount:2});assert.equal(opened.status,200);
    const one=await order(opened.body.sessionId);if(served)await serve(one.id);
    return {table:table.body.id,session:opened.body.sessionId,order:one};
  }
  async function bill(session:string){const saved=await post(`/dining-sessions/${session}/bills`);assert.equal(saved.status,201);return saved.body;}
  let base:any,saved:any,payment:any;
  await check('P5 Unverified guest and staff online references never create financial records',async()=>{
    base=await sitting();const token=randomUUID();await pool.query("INSERT INTO guest_session_tokens(dining_session_id,token_hash,verified_at,expires_at) VALUES($1,$2,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP+interval '1 hour')",[base.session,createHash('sha256').update(token).digest('hex')]);
    for(const method of ['CASH','UPI','CARD']){const rejected=await request(app).post('/api/v1/guest/bill/pay').set('Authorization',`Bearer ${token}`).send({paymentMethod:method,transactionReference:'ISOLATED-UNVERIFIED'});assert.equal(rejected.status,422);}
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM bills WHERE dining_session_id=$1',[base.session])).rows[0].n,0);
    saved=await bill(base.session);
    if (runtimePool) {
      const guestBill=await request(app).get('/api/v1/guest/bill').set('Authorization',`Bearer ${token}`);
      assert.equal(guestBill.status,200);assert.equal(guestBill.body.id,saved.id);
      assert.equal(guestBill.body.items.length,1);assert.equal(guestBill.body.grandTotalPaise,saved.grandTotalPaise);
    }
    for(const method of ['UPI','CARD'])assert.equal((await post(`/bills/${saved.id}/payments`,{paymentMethod:method,amountPaise:saved.balancePaise,transactionReference:'ISOLATED-UNVERIFIED'})).status,422);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM payments WHERE bill_id=$1',[saved.id])).rows[0].n,0);assert.equal((await get(`/bills/${saved.id}`)).body.balancePaise,saved.balancePaise);
  });
  await check('P5 Cashier scope and narrow permissions reject foreign staff and waiter access',async()=>{
    assert.equal((await get(`/bills/${saved.id}`,'foreign')).status,403);assert.equal((await post(`/bills/${saved.id}/payments`,{paymentMethod:'CASH',amountPaise:1},'foreign')).status,403);
    assert.equal((await post(`/bills/${saved.id}/payments`,{paymentMethod:'CASH',amountPaise:1},'waiter')).status,403);
    assert.equal((await post(`/payments/${randomUUID()}/refunds`,{amountPaise:1,reason:'Isolated negative'},'waiter')).status,403);
    assert.equal((await post('/outlets/rest-1/discount-reasons',{code:'ISOLATED_DENIED',description:'Unauthorized financial master'},'manager')).status,403);
  });
  await check('P5 Discount request review rejection limits and maker-checker enforce actual bill scope',async()=>{
    const body={amountPaise:2000,reasonCodeId:reason,notes:'Isolated discount'};
    const created=await post(`/bills/${saved.id}/discount-requests`,body);assert.equal(created.status,201);
    const path=`/bills/${saved.id}/discount-requests/${created.body.id}/review`;
    assert.equal((await post(path,{decision:'APPROVED',reason:'Self approval'})).status,403);
    assert.equal((await post(path,{decision:'APPROVED',reason:'Over limit'},'manager')).status,403);
    assert.equal((await post(path,{decision:'APPROVED',reason:'Foreign negative'},'foreign')).status,403);
    assert.equal((await post(path,{decision:'REJECTED',reason:'Checker rejected'},'checker')).status,200);
    assert.equal((await post(`/bills/${saved.id}/discount`,{approvalRequestId:created.body.id})).status,422);
    const approved=await post(`/bills/${saved.id}/discount-requests`,{...body,amountPaise:1000});assert.equal(approved.status,201);
    assert.equal((await post(`/bills/${saved.id}/discount-requests/${approved.body.id}/review`,{decision:'APPROVED',reason:'Checker approved'},'manager')).status,200);
    await pool.query("UPDATE outlet_settings SET cgst_rate_percent=4,sgst_rate_percent=1,discount_gst_treatment='POST_TAX_CREDIT' WHERE outlet_id='rest-1'");
    let applied:any;
    try{applied=await post(`/bills/${saved.id}/discount`,{approvalRequestId:approved.body.id,amountPaise:999999});assert.equal(applied.status,200);saved=applied.body;}
    finally{await pool.query("UPDATE outlet_settings SET cgst_rate_percent=2.5,sgst_rate_percent=2.5,discount_gst_treatment='PRE_TAX_DISCOUNT' WHERE outlet_id='rest-1'");}
    assert.equal(saved.discountPaise,1000);assert.equal(saved.grandTotalPaise,12181);assert.equal(saved.cgstPaise+saved.sgstPaise,580);
    assert.equal(saved.cgstPaise,290);assert.equal(saved.sgstPaise,290);
    const lines=(await pool.query('SELECT * FROM bill_items WHERE bill_id=$1',[saved.id])).rows;assert.equal(Number(lines[0].unit_price_paise),12601);assert.equal(Number(lines[0].line_discount_paise),1000);
  });
  await check('P5 Partial cash replay full settlement and receipt preserve allocation and audit evidence',async()=>{
    const key=randomUUID(),payload={paymentMethod:'CASH',amountPaise:5000};const first=await post(`/bills/${saved.id}/payments`,payload,'cashier',key);assert.equal(first.status,201);
    const replay=await post(`/bills/${saved.id}/payments`,payload,'cashier',key);assert.equal(replay.status,201);assert.equal(replay.body.id,first.body.id);
    assert.equal((await post(`/bills/${saved.id}/payments`,payload,'maker',key)).status,422);
    let receipt=(await get(`/bills/${saved.id}`)).body;assert.equal(receipt.paidPaise,5000);assert.equal(receipt.balancePaise,7181);assert.equal((await pool.query('SELECT status FROM dining_sessions WHERE id=$1',[base.session])).rows[0].status,'BILLED');
    const full=await post(`/bills/${saved.id}/payments`,{paymentMethod:'CASH',amountPaise:8000},'cashier');assert.equal(full.status,201);payment=full.body;assert.equal(payment.changeReturnedPaise,819);
    receipt=(await get(`/bills/${saved.id}`)).body;assert.equal(receipt.status,'SETTLED');assert.equal(receipt.balancePaise,0);
    assert.equal((await get(`/bills/${saved.id}/payments`)).body.length,2);assert.equal((await pool.query('SELECT status FROM dining_sessions WHERE id=$1',[base.session])).rows[0].status,'CLOSED');
    assert.equal((await pool.query('SELECT active_dining_session_id FROM restaurant_tables WHERE id=$1',[base.table])).rows[0].active_dining_session_id,null);
    assert.ok((await pool.query("SELECT count(*)::int AS n FROM audit_logs WHERE entity_id=$1 AND action='PAYMENT_CAPTURED'",[payment.id])).rows[0].n>0);
  });
  await check('P5 Refund replay and paying historical bill cannot clear a newer sitting',async()=>{
    const payload={amountPaise:1000,reason:'Isolated cash returned'},key=randomUUID();
    const returned=await post(`/payments/${payment.id}/refunds`,payload,'maker',key);assert.equal(returned.status,201);
    assert.equal((await post(`/payments/${payment.id}/refunds`,payload,'maker',key)).body.id,returned.body.id);
    assert.equal((await post(`/payments/${payment.id}/refunds`,{amountPaise:999999,reason:'Over refund'})).status,400);
    const opened=await post('/guest/table/open',{outletId:'rest-1',tableId:base.table,guestCount:2});assert.equal(opened.status,200);
    const repay=await post(`/bills/${saved.id}/payments`,{paymentMethod:'CASH',amountPaise:1000});assert.equal(repay.status,201);
    const table=(await pool.query('SELECT status,active_dining_session_id FROM restaurant_tables WHERE id=$1',[base.table])).rows[0];assert.equal(table.active_dining_session_id,opened.body.sessionId);assert.equal(table.status,'OCCUPIED');
    assert.equal((await get(`/payments/${payment.id}/refunds`)).body.length,1);
  });
  await check('P5 Incomplete orders deny settlement and failed transaction leaves no partial bill',async()=>{
    const active=await sitting(false);const rejected=await post(`/dining-sessions/${active.session}/settle`,{paymentMethod:'CASH'});assert.equal(rejected.status,409);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM bills WHERE dining_session_id=$1',[active.session])).rows[0].n,0);
    assert.equal((await pool.query('SELECT status FROM dining_sessions WHERE id=$1',[active.session])).rows[0].status,'ACTIVE');
  });
  await check('P5 Multiple rounds and catalog changes retain immutable prices and exact paise taxes',async()=>{
    const active=await sitting();const second=await order(active.session);await serve(second.id);
    await pool.query('UPDATE outlet_menu_items SET price_override_paise=99999 WHERE outlet_id=$1 AND menu_item_id=$2',['rest-1',dish.body.id]);
    try{const value=await bill(active.session);assert.equal(value.items.length,2);assert.equal(value.subtotalPaise,25202);assert.equal(value.grandTotalPaise,26462);assert.ok(value.items.every((i:any)=>i.unitPricePaise===12601));}finally{await pool.query('UPDATE outlet_menu_items SET price_override_paise=12601 WHERE outlet_id=$1 AND menu_item_id=$2',['rest-1',dish.body.id]);}
  });
  await check('P5 Nonzero configured service charges fail closed without persisting a bill',async()=>{
    const active=await sitting();await pool.query("UPDATE outlet_settings SET service_charge_percent=5 WHERE outlet_id='rest-1'");
    try{assert.equal((await post(`/dining-sessions/${active.session}/bills`)).status,422);assert.equal((await pool.query('SELECT count(*)::int AS n FROM bills WHERE dining_session_id=$1',[active.session])).rows[0].n,0);}finally{await pool.query("UPDATE outlet_settings SET service_charge_percent=0 WHERE outlet_id='rest-1'");}
  });
  await check('P5 Voiding preserves history releases items for rebilling and rejects payment history',async()=>{
    assert.equal((await post(`/bills/${saved.id}/void`,{reason:'Has payment history'})).status,409);
    const active=await sitting(),value=await bill(active.session);assert.equal((await post(`/bills/${value.id}/void`,{reason:'Isolated void'})).status,200);
    assert.equal((await get(`/bills/${value.id}`)).body.status,'VOIDED');assert.equal((await get(`/bills/${value.id}`)).body.items.length,1);
    assert.equal((await post(`/bills/${value.id}/payments`,{paymentMethod:'CASH',amountPaise:1})).status,409);
    const replacement=await bill(active.session);assert.notEqual(replacement.id,value.id);
  });
  await check('P5 Fully approved complimentary bill closes without invented payment or revenue',async()=>{
    assert.equal((await post(`/bills/${saved.id}/close-zero-balance`,{reason:'Positive bill negative'})).status,409);
    const active=await sitting(),value=await bill(active.session);
    const proposal=await post(`/bills/${value.id}/discount-requests`,{amountPaise:value.subtotalPaise,reasonCodeId:reason,notes:'Isolated full complimentary approval'});assert.equal(proposal.status,201);
    assert.equal((await post(`/bills/${value.id}/discount-requests/${proposal.body.id}/review`,{decision:'APPROVED',reason:'Independent executive comp approval'},'checker')).status,200);
    const applied=await post(`/bills/${value.id}/discount`,{approvalRequestId:proposal.body.id});assert.equal(applied.status,200);assert.equal(applied.body.grandTotalPaise,0);
    assert.equal((await post(`/bills/${value.id}/close-zero-balance`,{reason:'Foreign negative'},'foreign')).status,403);
    const closed=await post(`/bills/${value.id}/close-zero-balance`,{reason:'Approved complimentary bill closure'});assert.equal(closed.status,200);assert.equal(closed.body.status,'SETTLED');assert.equal(closed.body.paidPaise,0);
    assert.equal((await post(`/bills/${value.id}/close-zero-balance`,{reason:'Repeated approved closure'})).status,200);
    assert.equal((await get(`/bills/${value.id}/payments`)).body.length,0);assert.equal((await pool.query('SELECT status FROM dining_sessions WHERE id=$1',[active.session])).rows[0].status,'CLOSED');
    assert.equal((await pool.query('SELECT active_dining_session_id FROM restaurant_tables WHERE id=$1',[active.table])).rows[0].active_dining_session_id,null);
  });
  await check('P5 Counter orders persist kitchen tickets without synthetic tables or sessions',async()=>{
    const key=randomUUID(),body={items:[{menuItemId:dish.body.id,quantity:1}]};
    assert.equal((await post('/outlets/rest-1/counter-orders',body,'foreign')).status,403);
    const created=await post('/outlets/rest-1/counter-orders',body,'cashier',key);assert.equal(created.status,201);assert.equal((await post('/outlets/rest-1/counter-orders',body,'cashier',key)).body.id,created.body.id);
    const row=(await pool.query('SELECT dining_session_id,hotel_stay_id,room_id,order_source FROM orders WHERE id=$1',[created.body.id])).rows[0];assert.equal(row.dining_session_id,null);assert.equal(row.hotel_stay_id,null);assert.equal(row.order_source,'COUNTER_POS');
    assert.equal((await post(`/orders/${created.body.id}/bills`)).status,409);assert.equal((await post(`/orders/${created.body.id}/counter-serve`,{},'cashier')).status,409);assert.equal((await post(`/orders/${base.order.id}/counter-serve`,{},'cashier')).status,403);assert.equal((await post(`/orders/${created.body.id}/counter-serve`,{},'foreign')).status,403);
    const tickets=await get('/outlets/rest-1/kots?orderId='+created.body.id);for(const kot of tickets.body.kots||tickets.body.items)for(const action of ['accept','start','ready'])assert.equal((await post(`/kots/${kot.id}/${action}`)).status,200);assert.equal((await post(`/orders/${created.body.id}/counter-serve`,{},'cashier')).status,200);
    const value=await post(`/orders/${created.body.id}/bills`);assert.equal(value.status,201);assert.equal(value.body.diningSessionId,null);assert.equal(value.body.subtotalPaise,12601);
    assert.equal((await post(`/bills/${value.body.id}/payments`,{paymentMethod:'CASH',amountPaise:value.body.balancePaise},'cashier')).status,201);
  });
  await check('P5 Payment register and report net totals agree after partial cash refunds',async()=>{
    const active=await sitting(),value=await bill(active.session);const paid=await post(`/bills/${value.id}/payments`,{paymentMethod:'CASH',amountPaise:value.balancePaise});assert.equal(paid.status,201);
    const before=await get('/outlets/rest-1/payments');assert.equal(before.status,200);
    assert.equal((await post(`/payments/${paid.body.id}/refunds`,{amountPaise:100,reason:'Net total check'})).status,201);
    const after=await get('/outlets/rest-1/payments');assert.equal(after.body.totalAmountPaise,before.body.totalAmountPaise-100);
    const report=await get('/outlets/rest-1/reports/summary');assert.equal(report.status,200);assert.equal(report.body.metrics.totalRevenuePaise,after.body.totalAmountPaise);
    const rows=(await pool.query("SELECT COALESCE(SUM(p.amount_paise-COALESCE((SELECT SUM(r.amount_paise) FROM refunds r WHERE r.payment_id=p.id AND r.status='PROCESSED'),0)),0)::bigint AS net FROM payments p WHERE p.outlet_id='rest-1' AND p.status IN ('CAPTURED','PARTIALLY_REFUNDED') AND p.created_at>=date_trunc('day',CURRENT_TIMESTAMP AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'")).rows;assert.equal(after.body.totalAmountPaise,Number(rows[0].net));
  });
  if(native){
    await check('P5 PostgreSQL concurrent cancellation cannot invoice cancelled items',async()=>{
      const active=await sitting(false);
      const [invoice,cancel]=await Promise.all([post(`/dining-sessions/${active.session}/bills`),post(`/orders/${active.order.id}/cancel`,{reason:'Concurrent cancellation'})]);
      assert.ok((invoice.status===201&&cancel.status===409)||(invoice.status===422&&cancel.status===200));
      const invalid=await pool.query("SELECT count(*)::int AS n FROM bill_items bi JOIN bills b ON b.id=bi.bill_id JOIN order_items oi ON oi.id=bi.order_item_id WHERE b.dining_session_id=$1 AND b.status!='VOIDED' AND oi.status='CANCELLED'",[active.session]);assert.equal(invalid.rows[0].n,0);
    });
    await check('P5 PostgreSQL concurrent cash settlements capture exactly once',async()=>{
      const active=await sitting(),value=await bill(active.session),body={paymentMethod:'CASH',amountPaise:value.balancePaise};const results=await Promise.all([post(`/bills/${value.id}/payments`,body),post(`/bills/${value.id}/payments`,body)]);assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);assert.equal((await get(`/bills/${value.id}/payments`)).body.length,1);
    });
    await check('P5 PostgreSQL audit failure rolls back capture allocations bill session and idempotency',async()=>{
      const active=await sitting(),value=await bill(active.session),key=randomUUID();
      await pool.query("CREATE FUNCTION public.p5_reject_payment_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='PAYMENT_CAPTURED' THEN RAISE EXCEPTION 'isolated audit failure'; END IF; RETURN NEW; END $$");
      await pool.query('CREATE TRIGGER p5_audit_fail BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION public.p5_reject_payment_audit()');
      try{assert.equal((await post(`/bills/${value.id}/payments`,{paymentMethod:'CASH',amountPaise:value.balancePaise},'maker',key)).status,500);}finally{await pool.query('DROP TRIGGER p5_audit_fail ON audit_logs');await pool.query('DROP FUNCTION public.p5_reject_payment_audit()');}
      assert.equal((await get(`/bills/${value.id}/payments`)).body.length,0);assert.equal((await get(`/bills/${value.id}`)).body.balancePaise,value.balancePaise);assert.equal((await pool.query('SELECT status FROM dining_sessions WHERE id=$1',[active.session])).rows[0].status,'BILLED');assert.equal((await pool.query('SELECT count(*)::int AS n FROM idempotency_keys WHERE idempotency_key=$1',[key])).rows[0].n,0);
    });
    await check('P5 PostgreSQL concurrent bill generation and refund limits preserve unique financial history',async()=>{
      const active=await sitting();const bills=await Promise.all([post(`/dining-sessions/${active.session}/bills`),post(`/dining-sessions/${active.session}/bills`)]);assert.deepEqual(bills.map(r=>r.status).sort(),[201,409]);const value=bills.find(r=>r.status===201)!.body;
      const paid=await post(`/bills/${value.id}/payments`,{paymentMethod:'CASH',amountPaise:value.balancePaise});assert.equal(paid.status,201);
      const refunds=await Promise.all([post(`/payments/${paid.body.id}/refunds`,{amountPaise:10000,reason:'Concurrent return one'}),post(`/payments/${paid.body.id}/refunds`,{amountPaise:10000,reason:'Concurrent return two'})]);assert.deepEqual(refunds.map(r=>r.status).sort(),[201,400]);assert.equal((await get(`/payments/${paid.body.id}/refunds`)).body.length,1);
    });
  }
}
