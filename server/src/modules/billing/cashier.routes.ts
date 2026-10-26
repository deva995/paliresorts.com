import { checkStaffOutletAccess } from '../../utils/outletAccess.js';
import {validateBillingIdempotencyKey} from './idempotency.validation.js';
import {Router,Request} from 'express';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {authenticateStaff,requireModuleAccess,requirePermission,requireOutletAccess} from '../../middleware/auth.js';
import {validate} from '../../middleware/validate.js';
import {withTransaction,getDbPool} from '../../db/pool.js';
import {BadRequestError,ConflictError,ForbiddenError,NotFoundError} from '../../utils/errors.js';
import {OrdersService} from '../orders/orders.service.js';
import {DiningService} from '../dining/dining.service.js';
import {BillingService} from './billing.service.js';
import {IdempotencyService} from '../../services/idempotency.service.js';
import {writeAuditLog} from '../../services/audit.service.js';
import {publishOutletEvent} from '../../services/outletEvent.service.js';
import {orderItemInputSchema} from '../orders/orders.validation.js';

export const cashierRouter=Router();
const uuid=z.string().uuid();
const billParams=z.object({billId:uuid});
const mutation=[authenticateStaff,validateBillingIdempotencyKey,requireModuleAccess('billing','edit')];
function outletAccess(req:Request,outletId:string) {
  checkStaffOutletAccess(req.staff!,outletId);
}
async function billFor(req:Request,client:any,lock=false) {
  const bill=(await client.query(`SELECT * FROM public.bills WHERE id=$1${lock?' FOR UPDATE':''}`,[req.params.billId])).rows[0];
  if(!bill) throw new NotFoundError('Bill');outletAccess(req,bill.outlet_id);return bill;
}
async function evidence(req:Request,client:any,outletId:string,id:string,action:string,state:Record<string,unknown>) {
  await writeAuditLog({actorType:'STAFF',actorId:req.staff!.id,action,entityType:'bills',entityId:id,outletId,newState:state,requestId:String(req.headers['x-request-id']||'unknown'),ipAddress:req.ip},client);
  await publishOutletEvent({outletId,channel:'billing',entityId:id,eventType:action,payload:state},client);
}
async function idempotent(req:Request,client:any,outletId:string,operationType:any,payload:object,perform:()=>Promise<any>) {
  const key=String(req.headers['idempotency-key']||randomUUID());
  const acquired=await IdempotencyService.acquireOrCheck({idempotencyKey:key,operationType,outletId,actorStaffId:req.staff!.id,payload:{...payload,staffId:req.staff!.id}},client);
  if(acquired.status==='REPLAY') return acquired.body;
  const result=await perform();await IdempotencyService.complete(acquired.keyId,201,result,operationType==='ORDER_CREATE'?'orders':'bills',result.id,client);return result;
}

cashierRouter.post('/outlets/:outletId/counter-orders',authenticateStaff,validateBillingIdempotencyKey,requireModuleAccess('orders','edit'),requirePermission('order:counter_create'),requireOutletAccess('outletId'),validate({body:z.object({items:z.array(orderItemInputSchema).min(1).max(50),specialInstructions:z.string().trim().max(500).optional()})}),async(req,res,next)=>{
  try {
    const result=await withTransaction(client=>idempotent(req,client,req.params.outletId,'ORDER_CREATE',{outletId:req.params.outletId,...req.body},()=>OrdersService.createOrder({outletId:req.params.outletId,orderSource:'COUNTER_POS',items:req.body.items,specialInstructions:req.body.specialInstructions,staffId:req.staff!.id,idempotencyKey:String(req.headers['idempotency-key']||randomUUID()),reqCorrelationId:String(req.headers['x-request-id']||'unknown'),ipAddress:req.ip},client)));
    res.status(201).json(result);
  } catch(err){next(err);}
});
cashierRouter.post('/orders/:orderId/bills',...mutation,requirePermission('bill:generate'),validate({params:z.object({orderId:uuid}),body:z.object({notes:z.string().max(500).optional()})}),async(req,res,next)=>{
  try {
    const result=await withTransaction(async client=>{
      const order=(await client.query('SELECT outlet_id FROM public.orders WHERE id=$1',[req.params.orderId])).rows[0];
      if(!order) throw new NotFoundError('Order');outletAccess(req,order.outlet_id);
      return idempotent(req,client,order.outlet_id,'BILL_GENERATE',{counterOrderId:req.params.orderId,...req.body},()=>BillingService.generateBillForSession({counterOrderId:req.params.orderId,staffId:req.staff!.id,notes:req.body.notes},client));
    });res.status(201).json(result);
  } catch(err){next(err);}
});
cashierRouter.post('/orders/:orderId/counter-serve',authenticateStaff,requireModuleAccess('orders','edit'),requirePermission('order:counter_create'),validate({params:z.object({orderId:uuid})}),async(req,res,next)=>{
  try{
    const order=(await getDbPool().query('SELECT outlet_id,order_source FROM public.orders WHERE id=$1',[req.params.orderId])).rows[0];
    if(!order) throw new NotFoundError('Order');outletAccess(req,order.outlet_id);
    if(order.order_source!=='COUNTER_POS') throw new ForbiddenError('Counter pickup authority applies only to counter orders.');
    res.json(await OrdersService.updateOrderStatus(req.params.orderId,'SERVED',req.staff!.id,'Counter pickup confirmed.'));
  }catch(err){next(err);}
});
cashierRouter.get('/outlets/:outletId/discount-reasons',authenticateStaff,requireModuleAccess('billing','view'),requirePermission('bill:view'),requireOutletAccess('outletId'),async(req,res,next)=>{
  try{res.json((await getDbPool().query('SELECT r.id,r.code,r.description,r.requires_notes AS "requiresNotes" FROM public.discount_reason_codes r JOIN public.outlets o ON o.property_id=r.property_id WHERE o.id=$1 AND r.is_active=true ORDER BY r.code',[req.params.outletId])).rows);}catch(err){next(err);}
});
cashierRouter.post('/outlets/:outletId/discount-reasons',...mutation,requirePermission('bill:approve_discount'),requireOutletAccess('outletId'),validate({body:z.object({code:z.string().trim().min(2).max(50).regex(/^[A-Z0-9_-]+$/),description:z.string().trim().min(3).max(150)})}),async(req,res,next)=>{
  try{
    if(!req.staff!.roles.some(r=>['SUPER_ADMIN','RESTAURANT_OWNER'].includes(r.id))) throw new ForbiddenError('An Owner or Super Admin must configure financial reason codes.');
    const result=await withTransaction(async client=>{
      const outlet=(await client.query('SELECT property_id FROM public.outlets WHERE id=$1',[req.params.outletId])).rows[0];if(!outlet) throw new NotFoundError('Outlet');
      const inserted=(await client.query('INSERT INTO public.discount_reason_codes(property_id,code,description,requires_notes) VALUES($1,$2,$3,true) ON CONFLICT(code) DO NOTHING RETURNING id,code,description',[outlet.property_id,req.body.code,req.body.description])).rows[0];
      if(!inserted) throw new ConflictError('Reason code already exists.');
      await writeAuditLog({actorType:'STAFF',actorId:req.staff!.id,entityType:'discount_reason_codes',entityId:inserted.id,outletId:req.params.outletId,action:'DISCOUNT_REASON_CREATED',newState:inserted,requestId:String(req.headers['x-request-id']||'unknown'),ipAddress:req.ip},client);
      await publishOutletEvent({outletId:req.params.outletId,channel:'billing',eventType:'DISCOUNT_REASON_CREATED',entityId:inserted.id,payload:inserted},client);return inserted;
    });res.status(201).json(result);
  }catch(err){next(err);}
});
cashierRouter.get('/bills/:billId/discount-requests',authenticateStaff,requireModuleAccess('billing','view'),requirePermission('bill:view'),validate({params:billParams}),async(req,res,next)=>{
  try{await billFor(req,getDbPool());res.json((await getDbPool().query("SELECT id,status,amount_paise AS \"amountPaise\",requested_by_staff_id AS \"requestedByStaffId\",notes FROM public.approval_requests WHERE bill_id=$1 AND request_type='DISCOUNT' ORDER BY created_at DESC",[req.params.billId])).rows);}catch(err){next(err);}
});
cashierRouter.post('/bills/:billId/discount-requests',...mutation,requirePermission('bill:apply_discount'),validate({params:billParams,body:z.object({amountPaise:z.number().int().positive().safe(),reasonCodeId:uuid,notes:z.string().trim().max(500).optional()})}),async(req,res,next)=>{
  try{
    const result=await withTransaction(async client=>{
      const bill=await billFor(req,client,true);
      if(!['DRAFT','APPROVED'].includes(bill.status)||Number(bill.paid_paise)>0) throw new ConflictError('Discount requires an unpaid, non-voided bill.');
      if(req.body.amountPaise>Number(bill.subtotal_paise)) throw new BadRequestError('Discount exceeds subtotal.');
      const reason=(await client.query('SELECT r.* FROM public.discount_reason_codes r JOIN public.outlets o ON o.property_id=r.property_id WHERE r.id=$1 AND o.id=$2 AND r.is_active=true',[req.body.reasonCodeId,bill.outlet_id])).rows[0];
      if(!reason || (reason.requires_notes&&!req.body.notes)) throw new BadRequestError('An active outlet reason and required notes are necessary.');
      const request=(await client.query("INSERT INTO public.approval_requests(outlet_id,request_type,bill_id,reason_code_id,notes,amount_paise,escalate_after,requested_by_staff_id) VALUES($1,'DISCOUNT',$2,$3,$4,$5,CURRENT_TIMESTAMP+interval '5 minutes',$6) RETURNING id,status",[bill.outlet_id,bill.id,reason.id,req.body.notes||null,req.body.amountPaise,req.staff!.id])).rows[0];
      await evidence(req,client,bill.outlet_id,bill.id,'DISCOUNT_REQUESTED',{approvalRequestId:request.id,amountPaise:req.body.amountPaise});return request;
    });res.status(201).json(result);
  }catch(err){next(err);}
});
cashierRouter.post('/bills/:billId/discount-requests/:discountRequestId/review',...mutation,requirePermission('bill:approve_discount'),validate({params:billParams.extend({discountRequestId:uuid}),body:z.object({decision:z.enum(['APPROVED','REJECTED']),reason:z.string().trim().min(3).max(500)})}),async(req,res,next)=>{
  try{
    const result=await withTransaction(async client=>{
      const bill=await billFor(req,client,true);
      const request=(await client.query('SELECT * FROM public.approval_requests WHERE id=$1 AND bill_id=$2 FOR UPDATE',[req.params.discountRequestId,bill.id])).rows[0];
      if(!request || request.outlet_id!==bill.outlet_id || request.request_type!=='DISCOUNT') throw new NotFoundError('Discount request');
      if(request.requested_by_staff_id===req.staff!.id) throw new ForbiddenError('Maker-checker: requester cannot review their own discount.');
      if(request.status!=='PENDING') throw new ConflictError('Discount request has already been reviewed.');
      if(!['DRAFT','APPROVED'].includes(bill.status)||Number(bill.paid_paise)>0) throw new ConflictError('Bill can no longer be discounted.');
      const settings=(await client.query('SELECT manager_max_discount_percent,manager_max_discount_paise FROM public.outlet_settings WHERE outlet_id=$1',[bill.outlet_id])).rows[0];
      const executive=req.staff!.roles.some(r=>['SUPER_ADMIN','RESTAURANT_OWNER'].includes(r.id));
      if(req.body.decision==='APPROVED' && !executive && (!settings || Number(request.amount_paise)>Number(settings.manager_max_discount_paise) || Number(request.amount_paise)*100>Number(bill.subtotal_paise)*Number(settings.manager_max_discount_percent))) throw new ForbiddenError('Discount exceeds outlet manager authorization limit; an independent Owner must review it.');
      await client.query('INSERT INTO public.approval_actions(request_id,action,actor_staff_id,rejection_reason) VALUES($1,$2,$3,$4)',[request.id,req.body.decision,req.staff!.id,req.body.reason]);
      await client.query('UPDATE public.approval_requests SET status=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1',[request.id,req.body.decision]);
      await evidence(req,client,bill.outlet_id,bill.id,`DISCOUNT_${req.body.decision}`,{approvalRequestId:request.id,reason:req.body.reason});return {id:request.id,status:req.body.decision};
    });res.json(result);
  }catch(err){next(err);}
});
cashierRouter.post('/bills/:billId/void',...mutation,requirePermission('bill:void'),validate({params:billParams,body:z.object({reason:z.string().trim().min(3).max(500)})}),async(req,res,next)=>{
  try{
    await withTransaction(async client=>{
      // Session precedes bill in the locking order used by order creation and settlement.
      const ref=await billFor(req,client);
      if(ref.dining_session_id) await client.query('SELECT id FROM public.dining_sessions WHERE id=$1 FOR UPDATE',[ref.dining_session_id]);
      const bill=await billFor(req,client,true);
      if(!['DRAFT','APPROVED'].includes(bill.status) || Number(bill.paid_paise)!==0 || (await client.query('SELECT id FROM public.payments WHERE bill_id=$1 LIMIT 1',[bill.id])).rows.length) throw new ConflictError('Only an unpaid bill without payment history can be voided.');
      await client.query("UPDATE public.bills SET status='VOIDED',updated_at=CURRENT_TIMESTAMP WHERE id=$1",[bill.id]);
      if(bill.dining_session_id) await client.query("UPDATE public.dining_sessions SET status='ACTIVE',updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND status='BILLED'",[bill.dining_session_id]);
      await evidence(req,client,bill.outlet_id,bill.id,'BILL_VOIDED',{reason:req.body.reason});
    });res.json(await BillingService.getBillById(req.params.billId));
  }catch(err){next(err);}
});
cashierRouter.post('/bills/:billId/close-zero-balance',...mutation,requirePermission('bill:settle'),validate({params:billParams,body:z.object({reason:z.string().trim().min(3).max(500)})}),async(req,res,next)=>{
  try{
    const result=await withTransaction(async client=>{
      const ref=await billFor(req,client);
      if(ref.dining_session_id){
        await client.query('SELECT rt.id FROM public.restaurant_tables rt JOIN public.dining_sessions ds ON ds.table_id=rt.id WHERE ds.id=$1 FOR UPDATE OF rt',[ref.dining_session_id]);
        await client.query('SELECT id FROM public.dining_sessions WHERE id=$1 FOR UPDATE',[ref.dining_session_id]);
      }
      const bill=await billFor(req,client,true);
      if(Number(bill.grand_total_paise)!==0||Number(bill.balance_paise)!==0||Number(bill.paid_paise)!==0||!['DRAFT','APPROVED','SETTLED'].includes(bill.status)) throw new ConflictError('Only a verified zero-total bill can close without payment.');
      if(bill.status!=='SETTLED'){
        await client.query("UPDATE public.bills SET status='SETTLED',settled_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=$1",[bill.id]);
        if(bill.dining_session_id) await DiningService.closeDiningSession(bill.dining_session_id,req.staff!.id,String(req.headers['x-request-id']||'unknown'),req.ip,client);
        await evidence(req,client,bill.outlet_id,bill.id,'BILL_ZERO_BALANCE_SETTLED',{reason:req.body.reason,grandTotalPaise:0,paymentRecorded:false});
      }
      return BillingService.getBillById(bill.id,client);
    });res.json(result);
  }catch(err){next(err);}
});
