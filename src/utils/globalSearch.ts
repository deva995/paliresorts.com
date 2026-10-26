import type {User} from '../types';
import {checkRouteAccess} from './rbac';

export type SearchCategory='Employees'|'Customers'|'Tables'|'Orders'|'Reservations'|'Rooms'|'Menu Items'|'Reports';
export interface SearchResult {id:string;category:SearchCategory;title:string;subtitle:string;path:string}
const text=(value:unknown):string=>typeof value==='string'||typeof value==='number'?String(value):'';
export function buildGlobalSearch(query:string, records:Record<string,any[]>, user:User, outletId:string):SearchResult[] {
  const q=query.trim().toLowerCase();if(!q)return [];
  const results:SearchResult[]=[];
  const waiter=['WAITER','WAITER_MANAGER'].includes(user.role);
  const add=(category:SearchCategory,row:any,title:unknown,subtitle:unknown,path:string,fields:unknown[])=>{
    if(!row || !row.id || !checkRouteAccess(path,user.role,user).allowed)return;
    if(['Tables','Orders','Menu Items'].includes(category) && row.restaurantId!==outletId)return;
    if(fields.some(value=>text(value).toLowerCase().includes(q)))results.push({id:category+':'+row.id,category,title:text(title),subtitle:text(subtitle),path});
  };
  for(const row of records.employees||[])if(row)add('Employees',row,row.name,[row.roleTitle,row.department].map(text).filter(Boolean).join(' • '),'/users',[row.name,row.role,row.department]);
  for(const row of records.customers||[])if(row)add('Customers',row,row.name,[row.phone,row.tier].map(text).filter(Boolean).join(' • '),'/crm/customers',[row.name,row.phone,row.tier]);
  for(const row of records.tables||[])if(row)add('Tables',row,'Table '+text(row.number),[row.section,row.status].map(text).filter(Boolean).join(' • '),waiter?'/waiter/tables':'/restaurant/tables',[row.number,row.section,row.status]);
  for(const row of records.orders||[])if(row)add('Orders',row,'Order #'+text(row.orderNumber||row.id),[row.tableNumber,row.status].map(text).filter(Boolean).join(' • '),waiter?'/waiter/orders':'/restaurant/orders',[row.orderNumber,row.tableNumber,row.status]);
  for(const row of records.reservations||[])if(row)add('Reservations',row,'Booking: '+text(row.guestName),'Room '+text(row.roomNumber),'/hotel/reservations',[row.guestName,row.roomNumber]);
  for(const row of records.rooms||[])if(row)add('Rooms',row,'Room '+text(row.number),[row.type,row.status].map(text).filter(Boolean).join(' • '),'/hotel/rooms',[row.number,row.type,row.status]);
  for(const row of records.menuItems||[])if(row)add('Menu Items',row,row.name,text(row.category),'/restaurant/menu',[row.name,row.category,row.description]);
  add('Reports',{id:'financial'},'Restaurant financial reports','Saved outlet financial records','/reports/dashboard',['financial','reports','collections']);
  return results.slice(0,15);
}
