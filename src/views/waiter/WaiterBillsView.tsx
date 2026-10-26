import React from 'react';
import {useApp} from '../../context/AppContext';
import {scopeServiceTables} from './waiterHelpers';
interface WaiterBillsViewProps{onOpenBillForTable:(tableNumber:string)=>void;onSelectTableByNumber:(tableNumber:string)=>void;}
export const WaiterBillsView:React.FC<WaiterBillsViewProps>=({onOpenBillForTable,onSelectTableByNumber})=>{
  const {tables,currentUser,activeRestaurantId}=useApp();
  const outlet=currentUser.role==='SUPER_ADMIN'?activeRestaurantId:(currentUser.restaurantId||activeRestaurantId);
  const scoped=scopeServiceTables(tables,outlet,currentUser).filter(t=>t.activeSessionId);
  return <div className="space-y-4"><h2 className="font-bold">Table billing</h2><p>Open a table to load its saved bill or preview. Cash settlement and historical receipts are available through authorized Cashier & Billing.</p>
    {!scoped.length&&<p>No active assigned tables.</p>}{scoped.map(t=><div key={t.id} className="bg-white border rounded-xl p-4">Table {t.number} - {t.status}
      <button onClick={()=>onOpenBillForTable(t.number)}>View bill for {t.number}</button><button onClick={()=>onSelectTableByNumber(t.number)}>View table {t.number}</button>
    </div>)}
  </div>;
};
