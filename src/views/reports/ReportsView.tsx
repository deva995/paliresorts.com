import React,{useEffect,useState} from 'react';
import {useApp} from '../../context/AppContext';
import {api} from '../../api/client';
const money=(n:number)=>`INR ${(Number(n)/100).toFixed(2)}`;
export const ReportsView:React.FC=()=>{
  const {activeRestaurantId,currentUser}=useApp();
  const outlet=currentUser.role==='SUPER_ADMIN'?activeRestaurantId:(currentUser.restaurantId||activeRestaurantId);
  const [start,setStart]=useState(''),[end,setEnd]=useState(''),[range,setRange]=useState({startDate:'',endDate:''}),[refresh,setRefresh]=useState(0);
  const [summary,setSummary]=useState<any>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  useEffect(()=>{
    let active=true;setSummary(null);setError('');setLoading(true);
    api.getOutletReportsSummary(outlet,{startDate:range.startDate||undefined,endDate:range.endDate||undefined})
      .then(data=>active&&setSummary(data)).catch(e=>active&&setError(e.detail||e.message||'Financial report could not be loaded.')).finally(()=>active&&setLoading(false));
    return()=>{active=false;};
  },[outlet,range.startDate,range.endDate,refresh]);
  return <div className="p-6 max-w-6xl mx-auto space-y-6"><h1 className="text-2xl font-bold">Restaurant financial reports</h1><p>Outlet: {outlet}. Saved financial records only.</p>
    <form className="flex flex-wrap gap-4" onSubmit={e=>{e.preventDefault();setRange({startDate:start,endDate:end});setRefresh(n=>n+1);}}>
      <label>From <input aria-label="Report start date" type="date" value={start} onChange={e=>setStart(e.target.value)}/></label>
      <label>To <input aria-label="Report end date" type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label>
      <button disabled={loading} type="submit">Load financial report</button>
    </form>
    {loading&&<p role="status">Loading saved financial report...</p>}{error&&<p role="alert" className="bg-red-50 text-red-800 p-3">{error}</p>}
    {summary&&<section aria-label="Saved financial report" className="bg-white border rounded-xl p-5 space-y-4">
      <p>Period: {summary.period.startDate||'All dates'} to {summary.period.endDate||'present'} (Asia/Kolkata)</p>
      <p data-testid="report-net">Net recorded collections: {money(summary.metrics.totalRevenuePaise)}</p>
      <p>Collections are grouped by payment date, reduced by all processed refunds against those payments. This is not a refund-date cash-flow ledger.</p>
      <p>Settled bill snapshots: {summary.metrics.billCount}; subtotal {money(summary.metrics.subtotalPaise)}; discount {money(summary.metrics.discountPaise)}; CGST {money(summary.metrics.cgstPaise)}; SGST {money(summary.metrics.sgstPaise)}; round-off {money(summary.metrics.roundOffPaise)}.</p>
      <h2 className="font-bold">Payment method totals</h2>{summary.paymentMethods.map((p:any)=><p key={p.method}>{p.method}: {money(p.totalPaise)}</p>)}
      <h2 className="font-bold">Settled item totals before GST</h2>{!summary.topSellingItems.length&&<p>No settled items in this period.</p>}{summary.topSellingItems.map((i:any)=><p key={i.menuItemId}>{i.name}: {i.quantity} units; {money(i.totalRevenuePaise)}</p>)}
      <button onClick={()=>window.print()}>Print saved financial report</button>
    </section>}
    <p>Hotel reporting, comparative sales trends, staff performance, profit and loss, and statutory filing exports are unavailable pending their verified accounting workflows.</p>
  </div>;
};
