import type {User} from '../types/index.js';

/** Match the effective module AND the concrete endpoint permission; missing grants deny. */
export function staffLoadPlan(user:User|null,authenticated:boolean,outletId:string,area='all') {
  const signedIn=authenticated&&!!user?.id&&user.status==='active';
  const superAdmin=signedIn&&user?.role==='SUPER_ADMIN';
  const view=(module:string)=>!!signedIn&&(superAdmin||user?.moduleAccess?.[module]?.canView===true);
  const allowed=(module:string,permissions:string[])=>view(module)&&(superAdmin||permissions.some(p=>user?.permissions?.includes(p)));
  const outlet=!!outletId&&!!signedIn&&(superAdmin||user?.restaurantId===outletId);
  const inventory=view('inventory')&&(superAdmin||area==='all'||area==='inventory');
  const hotel=superAdmin||area==='all'||area==='hotel';
  const roles=user?.roles||[user?.role||''];
  return {
    tables:outlet&&allowed('floor',['table:view']),
    serviceRequests:outlet&&allowed('floor',['table:view','table:assign']),
    menu:outlet&&allowed('menu',['menu:view']),
    orders:outlet&&allowed('orders',['order:view']),
    kots:outlet&&allowed('kitchen',['kds:view']),
    payments:outlet&&allowed('billing',['bill:view','payment:process'])&&(superAdmin||!roles.some(r=>r==='WAITER'||r==='WAITER_MANAGER'||r.startsWith('KITCHEN'))),
    settlementRequests:outlet&&(allowed('billing',['bill:view','bill:settle','payment:process'])||allowed('floor',['table:view'])||superAdmin),
    rooms:hotel&&allowed('hotel',['hotel:view','hotel:manage','housekeeping:view']),
    stays:hotel&&allowed('hotel',['hotel:view','hotel:manage']),
    reservations:hotel&&allowed('hotel',['hotel:view','hotel:manage']),
    housekeeping:hotel&&allowed('housekeeping',['housekeeping:view','housekeeping:update','hotel:view']),
    maintenance:hotel&&view('housekeeping'),
    inventoryItems:inventory&&allowed('inventory',['inventory:view','inventory:manage','menu:view']),
    inventoryLocations:inventory&&allowed('inventory',['inventory:view','inventory:manage']),
    inventoryBalances:inventory&&allowed('inventory',['inventory:view','inventory:manage']),
    recipes:inventory&&allowed('inventory',['inventory:view','inventory:manage','menu:view']),
    staff:allowed('staff',['staff:view','table:assign','table:manage'])
  };
}

export class StaleStaffLoad extends Error {}
/** One in-flight task per resource and authorization generation, shared by polling/manual refresh. */
export class StaffLoadCoordinator {
  private scope='';
  private generation=0;
  private pending=new Map<string,Promise<void>>();
  setScope(scope:string):number {
    if(scope!==this.scope){this.scope=scope;this.generation++;this.pending.clear();}
    return this.generation;
  }
  isCurrent(generation:number):boolean{return generation===this.generation;}
  invalidate():void{this.generation++;this.pending.clear();}
  run(generation:number,key:string,task:()=>Promise<void>):Promise<void> {
    if(!this.isCurrent(generation))return Promise.resolve();
    const existing=this.pending.get(key);if(existing)return existing;
    const result=task().finally(()=>{if(this.pending.get(key)===result)this.pending.delete(key);});
    this.pending.set(key,result);return result;
  }
}

/** Guards before dispatch and after completion. A stale loader cannot dispatch its next request. */
export function scopedStaffApi<T extends object>(api:T,isCurrent:()=>boolean):T {
  return new Proxy(api,{get(target,property){const value=Reflect.get(target,property);if(typeof value!=='function')return value;
    return async(...args:unknown[])=>{if(!isCurrent())throw new StaleStaffLoad();const result=await value.apply(target,args);if(!isCurrent())throw new StaleStaffLoad();return result;};
  }});
}
