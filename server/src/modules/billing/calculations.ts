import {BadRequestError,UnprocessableEntityError} from '../../utils/errors.js';
export function calculateBill(lines:any[],settings:any={},discountPaise=0) {
  for(const row of lines){
    const quantity=Number(row.quantity),price=Number(row.unitPricePaise ?? row.unit_price_paise);
    if(!Number.isSafeInteger(quantity)||quantity<=0||!Number.isSafeInteger(price)||price<0)throw new BadRequestError('Invalid bill line amount or quantity.');
  }
  const subtotalPaise=lines.reduce((sum,row)=>sum+Number(row.unitPricePaise ?? row.unit_price_paise)*Number(row.quantity),0);
  if(!Number.isSafeInteger(subtotalPaise) || !Number.isSafeInteger(discountPaise) || discountPaise<0 || discountPaise>subtotalPaise) throw new BadRequestError('Invalid bill amount.');
  if(Number(settings.service_charge_percent || 0)!==0) throw new UnprocessableEntityError('Nonzero service charge is blocked pending accounting policy.');
  const cgstRate=Number(settings.cgst_rate_percent ?? 2.5),sgstRate=Number(settings.sgst_rate_percent ?? 2.5);
  if(cgstRate<0 || sgstRate<0 || !Number.isFinite(cgstRate+sgstRate)) throw new UnprocessableEntityError('Invalid outlet tax configuration.');
  const preTax=(settings.discount_gst_treatment || 'PRE_TAX_DISCOUNT')==='PRE_TAX_DISCOUNT';
  let allocated=0,cumulative=0,cgstPaise=0,sgstPaise=0;
  const items=lines.map((row)=>{
    const totalPricePaise=Number(row.unitPricePaise ?? row.unit_price_paise)*Number(row.quantity);
    if(!Number.isSafeInteger(totalPricePaise) || totalPricePaise<0) throw new BadRequestError('Invalid line amount.');
    cumulative+=totalPricePaise;
    const nextAllocation=subtotalPaise ? Number(BigInt(discountPaise)*BigInt(cumulative)/BigInt(subtotalPaise)) : 0;
    const lineDiscountPaise=nextAllocation-allocated;allocated=nextAllocation;
    const rate=Number(row.gstRatePercent ?? row.gst_rate_snapshot ?? row.gst_rate_percent ?? settings.default_gst_rate_percent ?? 5);
    if(!Number.isFinite(rate) || rate<0 || rate>100 || (rate>0 && cgstRate+sgstRate===0)) throw new UnprocessableEntityError('Invalid item GST snapshot or outlet split.');
    const tax=Math.round((totalPricePaise-(preTax?lineDiscountPaise:0))*rate/100);
    const cgst=cgstRate+sgstRate ? Math.round(tax*cgstRate/(cgstRate+sgstRate)) : 0,sgst=tax-cgst;
    cgstPaise+=cgst;sgstPaise+=sgst;
    return {...row,totalPricePaise,lineDiscountPaise,cgstPaise:cgst,sgstPaise:sgst};
  });
  const raw=subtotalPaise-discountPaise+cgstPaise+sgstPaise;
  if(!Number.isSafeInteger(raw)) throw new BadRequestError('Invalid bill total.');
  const desired=Math.round(raw/100)*100-raw;
  const roundingPaise=Math.abs(desired)<=Number(settings.max_auto_round_off_paise ?? 0) ? desired : 0;
  return {subtotalPaise,discountPaise,cgstPaise,sgstPaise,serviceChargePaise:0,tipPaise:0,roundingPaise,grandTotalPaise:raw+roundingPaise,items};
}
