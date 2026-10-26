import { parseMenuPrice } from './menuPrice';
import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { MenuItem, RestaurantTable, Order, OrderStatus, DiningReservation, TableStatus } from '../../types';
import { MenuApprovalsView } from './MenuApprovalsView';
import { RestaurantOwnerDashboard } from './RestaurantOwnerDashboard';
import { DiningAreaView } from './DiningAreaView';
import { TableQRStudio } from './TableQRStudio';
import { GenerateQRCodeModal } from './GenerateQRCodeModal';
import {
  UtensilsCrossed,
  Plus,
  Search,
  Filter,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  QrCode,
  DollarSign,
  ChefHat,
  ChevronRight,
  TrendingUp,
  Receipt,
  Eye,
  Trash2,
  Leaf,
  Flame,
  X,
  CalendarCheck,
  Wine,
  Coffee,
  Store,
  CookingPot,
  BellRing,
  ArrowUpRight,
  Upload,
  Image as ImageIcon,
  Pencil,
  LayoutGrid,
  RefreshCw
} from 'lucide-react';
import { FEATURES } from '../../config/features';
import { FeatureDisabledView } from '../../components/common/FeatureDisabledView';

export const RestaurantViews: React.FC = () => {
  const {
    currentRoute,
    pushRoute,
    tables: allTables,
    menuItems,
    menuCategories,
    diningZones,
    deactivateTable,
    orders: allOrders,
    createRestaurantOrder,
    restaurantSyncError,
    updateOrderStatus,
    updateTableStatus,
    addMenuItem,
    updateMenuItem,
    toggleMenuItemAvailability,
    addTable,
    updateTable,
    diningReservations: allReservations,
    seatDiningReservation,
    addDiningReservation,
    activeRestaurant
  } = useApp();

  const [floorError,setFloorError]=useState('');
  const [floorSaving,setFloorSaving]=useState(false);
  const MENU_CATEGORIES = menuCategories;
  const [menuError, setMenuError] = useState<string | null>(null);
  const [menuNotice, setMenuNotice] = useState<string | null>(null);
  const [isMenuSaving, setIsMenuSaving] = useState(false);

  // Multi-Tenant Isolation: strictly scoped to Pali Resort & Club / activeRestaurant.id
  const targetRestId = activeRestaurant?.id || 'rest-1';
  const tables = useMemo(
    () => allTables.filter(t => t.restaurantId === targetRestId),
    [allTables, targetRestId]
  );
  const orders = useMemo(
    () => allOrders.filter(o => o.restaurantId === targetRestId),
    [allOrders, targetRestId]
  );
  const diningReservations = useMemo(
    () => allReservations.filter(r => r.restaurantId === targetRestId),
    [allReservations, targetRestId]
  );

  const cleanSubpath = currentRoute.split('?')[0].replace(/^\/restaurant\/?/, '');
  const subpath = cleanSubpath.split('/')[0] || 'dashboard';

  // State for Modals
  const [orderSaving,setOrderSaving]=useState(false);
  const [orderSaveError,setOrderSaveError]=useState('');
  const [orderKey,setOrderKey]=useState(()=>crypto.randomUUID());
  const [showAddOrderModal, setShowAddOrderModal] = useState(false);
  const [selectedTableForOrder, setSelectedTableForOrder] = useState<RestaurantTable | null>(null);
  const [cartItems, setCartItems] = useState<{ item: MenuItem; quantity: number }[]>([]);
  const [orderGuestName, setOrderGuestName] = useState('');
  const [orderGuestPhone, setOrderGuestPhone] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  // Add Menu Item Modal
  const [showAddMenuModal, setShowAddMenuModal] = useState(false);

  // Table QR Modal State (Floor Plan access)
  const [selectedTableForQr, setSelectedTableForQr] = useState<RestaurantTable | null>(null);
  const [showTableQrModal, setShowTableQrModal] = useState(false);
  const [newMenuName, setNewMenuName] = useState('');
  const [newMenuPrice, setNewMenuPrice] = useState('');
  const [newMenuType, setNewMenuType] = useState<'food' | 'drink'>('food');
  const [newMenuCategory, setNewMenuCategory] = useState((MENU_CATEGORIES[0]?.name || ''));
  const [newMenuDesc, setNewMenuDesc] = useState('');
  const [newMenuIsVeg, setNewMenuIsVeg] = useState(true);
  const [newMenuIsSpicy, setNewMenuIsSpicy] = useState(false);
  const [newMenuPrepTime, setNewMenuPrepTime] = useState('15');
  const [newMenuImage, setNewMenuImage] = useState('');
  const [newMenuImageUrlInput, setNewMenuImageUrlInput] = useState('');

  // Portion pricing states (Bar & Beverages / Food)
  const [newMenuPortions, setNewMenuPortions] = useState<{ label: string; price: number }[]>([]);
  const [newPortionLabel, setNewPortionLabel] = useState('');
  const [newPortionPrice, setNewPortionPrice] = useState('');

  const [editMenuPortions, setEditMenuPortions] = useState<{ label: string; price: number }[]>([]);
  const [editPortionLabel, setEditPortionLabel] = useState('');
  const [editPortionPrice, setEditPortionPrice] = useState('');

  // Remove confirmation modal (preserves historical orders)
  const [itemToRemove, setItemToRemove] = useState<MenuItem | null>(null);
  const [isRemovingItem, setIsRemovingItem] = useState(false);

  // Edit Menu Item Modal State
  const [showEditMenuModal, setShowEditMenuModal] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null);
  const [editMenuForm, setEditMenuForm] = useState<{
    name: string;
    description: string;
    categoryName: string;
    price: string;
    isVeg: boolean;
    isSpicy: boolean;
    isAvailable: boolean;
    preparationTimeMinutes: string;
    image: string;
    menuType: 'food' | 'drink';
  }>({
    name: '',
    description: '',
    categoryName: (MENU_CATEGORIES[0]?.name || ''),
    price: '',
    isVeg: true,
    isSpicy: false,
    isAvailable: true,
    preparationTimeMinutes: '15',
    image: '',
    menuType: 'food'
  });
  const [editMenuImageUrlInput, setEditMenuImageUrlInput] = useState('');

  // Floor Plan: Floor View Mode ('layout' | 'tables') & Filters
  const [floorViewMode, setFloorViewMode] = useState<'layout' | 'tables'>('layout');
  const [tableSearch, setTableSearch] = useState('');
  const [tableSectionFilter, setTableSectionFilter] = useState('all');
  const [tableStatusFilter, setTableStatusFilter] = useState('all');

  // Add Table Modal State
  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [newTableSection, setNewTableSection] = useState<string>('');
  const [newTableCapacity, setNewTableCapacity] = useState('4');
  const [newTableStatus, setNewTableStatus] = useState<TableStatus>('available');

  // Edit Table Modal State
  const [showEditTableModal, setShowEditTableModal] = useState(false);
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);
  const [editTableNumber, setEditTableNumber] = useState('');
  const [editTableSection, setEditTableSection] = useState<string>('');
  const [editTableCapacity, setEditTableCapacity] = useState('4');
  const [editTableStatus, setEditTableStatus] = useState<TableStatus>('available');

  // Helper for FileReader image uploads
  const handleImageFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    onSuccess: (dataUrl: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        onSuccess(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Search & Filters
  const [menuSearch, setMenuSearch] = useState('');
  const [menuCatalogTab, setMenuCatalogTab] = useState<'all' | 'food' | 'drink'>(
    subpath === 'food' ? 'food' : 'all'
  );

  React.useEffect(() => {
    if (subpath === 'food') {
      setMenuCatalogTab('food');
    } else if (subpath === 'menu') {
      setMenuCatalogTab('all');
    }
  }, [subpath]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [vegOnlyFilter, setVegOnlyFilter] = useState(false);
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');

  // Mask Phone helper (+91 ******4521)
  const maskPhone = (phone?: string): string => {
    if (!phone) return '+91 ******4521';
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 10) {
      const last4 = digits.slice(-4);
      return `+91 ******${last4}`;
    }
    return '+91 ******4521';
  };

  // Subtotal in order modal
  const modalSubtotal = cartItems.reduce((acc, curr) => acc + curr.item.price * curr.quantity, 0);

  const handleOpenOrderModal = (table?: RestaurantTable) => {
    if (table) setSelectedTableForOrder(table);
    else setSelectedTableForOrder(tables[0]);
    setCartItems([]);
    setOrderGuestName('');
    setOrderGuestPhone('');
    setOrderNotes('');
    setShowAddOrderModal(true);
  };

  const handleAddToCart = (item: MenuItem) => {
    setCartItems(prev => {
      const exists = prev.find(p => p.item.id === item.id);
      if (exists) {
        return prev.map(p => (p.item.id === item.id ? { ...p, quantity: p.quantity + 1 } : p));
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const handleRemoveFromCart = (itemId: string) => {
    setCartItems(prev => prev.filter(p => p.item.id !== itemId));
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cartItems.length === 0 || orderSaving) return;
    setOrderSaving(true);setOrderSaveError('');
    try {
    await createRestaurantOrder({
      restaurantId: activeRestaurant.id,
      type: 'dine-in',
      tableId: selectedTableForOrder?.id,
      tableNumber: selectedTableForOrder?.number,
      guestName: orderGuestName || 'Dining Guest',
      guestPhone: orderGuestPhone || '+91 98200 45210',
      items: cartItems.map(c => ({
        id: `oi-${Date.now()}-${c.item.id}`,
        menuItemId: c.item.id,
        name: c.item.name,
        price: c.item.price,
        quantity: c.quantity,
        isVeg: c.item.isVeg,
        menuType: c.item.menuType || 'food',
        categoryName: c.item.categoryName,
        status: 'pending'
      })),
      notes: orderNotes
    },orderKey);

    setShowAddOrderModal(false);
    setOrderKey(crypto.randomUUID());
    } catch(error:any) {setOrderSaveError(error.detail || error.message || 'Order could not be saved.');}
    finally {setOrderSaving(false);}
  };

  const handleCreateMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isMenuSaving) return;
    setMenuError(null); setMenuNotice(null); setIsMenuSaving(true);
    try {
    if (!newMenuName.trim() || !newMenuPrice.trim() || !Number.isFinite(Number(newMenuPrice)) || Number(newMenuPrice) < 0) throw new Error('Enter an item name and a price zero or greater.');

    const finalImage = newMenuImage.trim() || (
      newMenuType === 'drink'
        ? 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=400&q=80'
        : 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&auto=format&fit=crop&q=80'
    );

    const baseDesc = newMenuDesc.trim() || 'Specially crafted culinary specialty.';
    const finalDesc = newMenuPortions.length > 0
      ? `${baseDesc}<!--portions:${JSON.stringify(newMenuPortions)}-->`
      : baseDesc;

    await addMenuItem({
      restaurantId: activeRestaurant.id,
      name: newMenuName.trim(),
      categoryId: (MENU_CATEGORIES.find(c => c.name === newMenuCategory) || MENU_CATEGORIES[0])?.id || '',
      categoryName: (MENU_CATEGORIES.find(c => c.name === newMenuCategory) || MENU_CATEGORIES[0])?.name || '',
      menuType: newMenuType,
      description: finalDesc,
      price: parseMenuPrice(newMenuPrice),
      portionOptions: newMenuPortions.length > 0 ? newMenuPortions : undefined,
      isVeg: newMenuIsVeg,
      isSpicy: newMenuIsSpicy,
      preparationTimeMinutes: parseInt(newMenuPrepTime) || 15,
      isAvailable: true,
      image: finalImage,
      taxRate: activeRestaurant.taxRate || 5
    });

    setMenuNotice('Menu item saved.');
    setShowAddMenuModal(false);
    setNewMenuName('');
    setNewMenuPrice('');
    setNewMenuDesc('');
    setNewMenuImage('');
    setNewMenuImageUrlInput('');
    setNewMenuIsSpicy(false);
    setNewMenuPortions([]);
    setNewPortionLabel('');
    setNewPortionPrice('');
    } catch (error: any) { setMenuError(error.detail || error.message || 'Menu save failed. Please retry.'); }
    finally { setIsMenuSaving(false); }
  };

  const handleOpenEditMenu = (item: MenuItem) => {
    setEditingMenuItem(item);
    setEditMenuForm({
      name: item.name,
      description: item.description || '',
      categoryName: item.categoryName,
      price: item.price.toString(),
      isVeg: item.isVeg,
      isSpicy: !!item.isSpicy,
      isAvailable: item.isAvailable,
      preparationTimeMinutes: (item.preparationTimeMinutes || 15).toString(),
      image: item.image || '',
      menuType: item.menuType || 'food'
    });
    setEditMenuPortions(item.portionOptions ? [...item.portionOptions] : []);
    setEditPortionLabel('');
    setEditPortionPrice('');
    setEditMenuImageUrlInput('');
    setShowEditMenuModal(true);
  };

  const handleSaveEditMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isMenuSaving) return;
    setMenuError(null); setMenuNotice(null); setIsMenuSaving(true);
    try {
    if (!editingMenuItem || !editMenuForm.name.trim() || !editMenuForm.price.trim() || !Number.isFinite(Number(editMenuForm.price)) || Number(editMenuForm.price) < 0) throw new Error('Enter an item name and a price zero or greater.');

    const finalImage = editMenuForm.image.trim() || (
      editMenuForm.menuType === 'drink'
        ? 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=400&q=80'
        : 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&auto=format&fit=crop&q=80'
    );

    const cleanDesc = editMenuForm.description.replace(/<!--portions:.*?-->/g, '').replace(/\[Portions:\s*.*?\]/g, '').trim();
    const finalDesc = editMenuPortions.length > 0
      ? `${cleanDesc}<!--portions:${JSON.stringify(editMenuPortions)}-->`
      : cleanDesc;

    const result = await updateMenuItem(editingMenuItem.id, {
      name: editMenuForm.name.trim(),
      description: finalDesc,
      categoryName: editMenuForm.categoryName,
      categoryId: MENU_CATEGORIES.find(c => c.name === editMenuForm.categoryName)?.id || editingMenuItem.categoryId,
      price: parseMenuPrice(editMenuForm.price),
      portionOptions: editMenuPortions.length > 0 ? editMenuPortions : undefined,
      isVeg: editMenuForm.isVeg,
      isSpicy: editMenuForm.isSpicy,
      isAvailable: editMenuForm.isAvailable,
      preparationTimeMinutes: parseInt(editMenuForm.preparationTimeMinutes) || editingMenuItem.preparationTimeMinutes,
      image: finalImage,
      menuType: editMenuForm.menuType
    });

    setMenuNotice(result.pendingRevisionId ? 'Shared catalog changes submitted for approval. Outlet price and availability saved.' : 'Menu changes saved.');
    setShowEditMenuModal(false);
    setEditingMenuItem(null);
    setEditMenuPortions([]);
    } catch (error: any) { setMenuError(error.detail || error.message || 'Menu save failed. Please retry.'); }
    finally { setIsMenuSaving(false); }
  };

  const handleConfirmRemoveItem = async () => {
    if (!itemToRemove || isRemovingItem) return;
    setIsRemovingItem(true);
    setMenuError(null);
    try {
      if (itemToRemove.isAvailable) {
        await toggleMenuItemAvailability(itemToRemove.id);
      }
      setMenuNotice(`"${itemToRemove.name}" has been removed from active ordering. Historical orders, tickets, and revenue records remain strictly preserved.`);
      setItemToRemove(null);
    } catch (error: any) {
      setMenuError(error.detail || error.message || 'Failed to remove menu item.');
    } finally {
      setIsRemovingItem(false);
    }
  };

  const handleOpenAddTable = () => {
    const nextNum = `T-${String(tables.length + 1).padStart(2, '0')}`;
    setNewTableNumber(nextNum);
    setNewTableSection(diningZones[0]?.id || '');
    setFloorError('');
    setNewTableCapacity('4');
    setNewTableStatus('available');
    setShowAddTableModal(true);
  };

  const handleSaveNewTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableNumber.trim()) return;
    if (floorSaving) return;
    setFloorSaving(true); setFloorError('');
    try {

    await addTable({
      restaurantId: activeRestaurant.id,
      number: newTableNumber.trim().toUpperCase(),
      zoneId: newTableSection,
      section: diningZones.find(zone=>zone.id===newTableSection)?.name || '',
      capacity: parseInt(newTableCapacity) || 4,
      status: newTableStatus
    });

    setShowAddTableModal(false);
    } catch(error:any) { setFloorError(error.detail || error.message || 'Unable to save the table.'); }
    finally { setFloorSaving(false); }
  };

  const handleDeactivateTable = async (id:string) => {
    if(floorSaving) return;
    setFloorSaving(true);setFloorError('');
    try {await deactivateTable(id);} catch(error:any) {setFloorError(error.detail || error.message);} finally {setFloorSaving(false);}
  };

  const handleOpenEditTable = (table: RestaurantTable) => {
    setEditingTable(table);
    setEditTableNumber(table.number);
    setEditTableSection(table.zoneId || '');
    setFloorError('');
    setEditTableCapacity(table.capacity.toString());
    setEditTableStatus(table.status);
    setShowEditTableModal(true);
  };

  const handleSaveEditTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTable || !editTableNumber.trim()) return;
    if (floorSaving) return;
    setFloorSaving(true); setFloorError('');
    try {

    await updateTable(editingTable.id, {
      number: editTableNumber.trim().toUpperCase(),
      zoneId: editTableSection,
      section: diningZones.find(zone=>zone.id===editTableSection)?.name || '',
      capacity: parseInt(editTableCapacity) || 4,
      status: editTableStatus === editingTable.status ? undefined : editTableStatus
    });

    setShowEditTableModal(false);
    setEditingTable(null);
    } catch(error:any) { setFloorError(error.detail || error.message || 'Unable to save the table.'); }
    finally { setFloorSaving(false); }
  };

  // Filtered Tables for Dedicated Tables Management view
  const filteredManagementTables = useMemo(() => {
    return tables.filter(t => {
      const q = tableSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.number.toLowerCase().includes(q) ||
        (t.waiterName && t.waiterName.toLowerCase().includes(q)) ||
        t.section.toLowerCase().includes(q);
      const matchesSection = tableSectionFilter === 'all' || t.section === tableSectionFilter;
      const matchesStatus = tableStatusFilter === 'all' || t.status === tableStatusFilter;
      return matchesSearch && matchesSection && matchesStatus;
    });
  }, [tables, tableSearch, tableSectionFilter, tableStatusFilter]);

  // Dynamic Categories set
  const dynamicCategories = useMemo(() => {
    const names = new Set<string>();
    MENU_CATEGORIES.forEach(c => names.add(c.name));
    menuItems.forEach(m => {
      if (m.categoryName) names.add(m.categoryName);
    });
    return Array.from(names);
  }, [menuItems]);

  // Filtered Menu Items
  const filteredMenuItems = menuItems.filter(item => {
    const matchesSearch =
      item.name.toLowerCase().includes(menuSearch.toLowerCase()) ||
      item.description.toLowerCase().includes(menuSearch.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.categoryName === selectedCategory;
    const matchesVeg = !vegOnlyFilter || item.isVeg;
    const matchesCatalog =
      menuCatalogTab === 'all' ||
      (menuCatalogTab === 'food' && item.menuType !== 'drink') ||
      (menuCatalogTab === 'drink' && item.menuType === 'drink');
    return matchesSearch && matchesCategory && matchesVeg && matchesCatalog;
  });

  // Filtered Orders
  const filteredOrders = orders.filter(o => {
    if (orderStatusFilter === 'all') return true;
    return o.status === orderStatusFilter;
  });

  return (
    <div className="space-y-6 pb-12">
      {floorError && <p role="alert" className="text-rose-800">{floorError}</p>}
      {menuNotice && <p role="status" className="text-sm text-emerald-800">{menuNotice}</p>}
      {menuError && <p role="alert" className="text-sm text-rose-800">{menuError}</p>}
      {/* Module Navigation Tabs with Pali Brand Colors */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-[#DDD8C9]">
        {[
          { label: 'Overview', path: '/restaurant/dashboard' },
          { label: 'Live Orders', path: '/restaurant/orders', badge: orders.filter(o => o.status !== 'completed').length },
          { label: 'Table Floor Plan', path: '/restaurant/tables' },
          ...(FEATURES.DINING_RESERVATIONS ? [{ label: 'Reservations Book', path: '/restaurant/reservations' }] : []),
          { label: 'Food & Bar Menu', path: '/restaurant/menu' },
          { label: 'Menu Approvals', path: '/restaurant/approvals' },
          { label: 'QR Digital Menu', path: '/restaurant/qr-ordering' },
          { label: 'Kitchen Hub', path: '/kitchen/kds' },
          { label: 'Waiters Station', path: '/waiter/dashboard' }
        ].map(tab => {
          const isActive = currentRoute === tab.path || (tab.path === '/restaurant/dashboard' && currentRoute === '/restaurant');
          return (
            <button
              key={tab.path}
              onClick={() => pushRoute(tab.path)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                isActive
                  ? 'bg-[#163024] text-[#C5A86A] shadow-sm'
                  : 'bg-white text-[#687067] hover:bg-[#F7F4EC] hover:text-[#163024] border border-[#DDD8C9]'
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-[#C5A86A] text-[#163024]' : 'bg-[#F7F4EC] text-[#526B4A]'}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {subpath === 'areas' && <DiningAreaView />}
      {subpath === 'approvals' && <MenuApprovalsView />}
      {/* 1. RESTAURANT OWNER DASHBOARD */}
      {(subpath === 'dashboard' || currentRoute === '/restaurant') && (
        <RestaurantOwnerDashboard onOpenOrderModal={handleOpenOrderModal} />
      )}

      {/* 2. LIVE ORDERS VIEW */}
      {subpath === 'orders' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#DDD8C9]">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-[#687067] uppercase">Filter Status:</span>
              <div className="flex flex-wrap gap-1">
                {['all', 'placed', 'preparing', 'ready', 'served', 'completed'].map(status => (
                  <button
                    key={status}
                    onClick={() => setOrderStatusFilter(status)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-colors cursor-pointer ${
                      orderStatusFilter === status
                        ? 'bg-[#163024] text-[#C5A86A] shadow-sm'
                        : 'bg-[#F7F4EC] hover:bg-[#ece7db] text-[#163024] border border-[#DDD8C9]'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => handleOpenOrderModal()}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#163024] hover:bg-[#204333] text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[#C5A86A]" />
              <span>New Order</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-[#DDD8C9] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7F4EC] border-b border-[#DDD8C9] text-[#163024] font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5">Order Number</th>
                    <th className="p-3.5">Table</th>
                    <th className="p-3.5">Customer</th>
                    <th className="p-3.5">Food Items</th>
                    <th className="p-3.5">Bar Items</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Payment</th>
                    <th className="p-3.5">Amount</th>
                    <th className="p-3.5">Time</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDD8C9]/60">
                  {filteredOrders.map(order => {
                    const foodItems = order.items.filter(
                      i => i.menuType !== 'drink' && !i.categoryName?.toLowerCase().includes('beverage')
                    );
                    const barItems = order.items.filter(
                      i => i.menuType === 'drink' || i.categoryName?.toLowerCase().includes('beverage')
                    );

                    return (
                      <tr key={order.id} className="hover:bg-[#F7F4EC]/40 transition-colors">
                        <td className="p-3.5 font-bold font-mono text-[#163024]">#{order.orderNumber}</td>
                        <td className="p-3.5 font-semibold text-[#163024]">
                          {order.tableNumber ? `Table ${order.tableNumber}` : order.roomNumber || 'Takeaway'}
                        </td>
                        <td className="p-3.5">
                          <div className="font-bold text-[#1D241F]">{order.guestName || 'Rahul Sharma'}</div>
                          <div className="text-[10px] font-mono text-[#526B4A]">{maskPhone(order.guestPhone)}</div>
                        </td>
                        <td className="p-3.5 max-w-[180px]">
                          {foodItems.length > 0 ? (
                            <span className="text-[#163024] truncate block" title={foodItems.map(f => `${f.name} (x${f.quantity})`).join(', ')}>
                              {foodItems.map(f => `${f.name} (x${f.quantity})`).join(', ')}
                            </span>
                          ) : (
                            <span className="text-[#687067] italic">-</span>
                          )}
                        </td>
                        <td className="p-3.5 max-w-[140px]">
                          {barItems.length > 0 ? (
                            <span className="text-[#526B4A] font-semibold truncate block" title={barItems.map(b => `${b.name} (x${b.quantity})`).join(', ')}>
                              {barItems.map(b => `${b.name} (x${b.quantity})`).join(', ')}
                            </span>
                          ) : (
                            <span className="text-[#687067] italic">-</span>
                          )}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              order.status === 'completed'
                                ? 'bg-[#526B4A]/20 text-[#526B4A]'
                                : order.status === 'ready'
                                ? 'bg-emerald-100 text-emerald-800'
                                : order.status === 'preparing'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-[#F7F4EC] text-[#163024] border border-[#DDD8C9]'
                            }`}
                          >
                            {order.status}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              order.paymentStatus === 'paid'
                                ? 'bg-[#526B4A]/20 text-[#526B4A]'
                                : 'bg-rose-100 text-rose-800 border border-rose-200'
                            }`}
                          >
                            {order.paymentStatus}
                          </span>
                        </td>
                        <td className="p-3.5 font-bold font-mono text-[#163024]">
                          ₹{order.grandTotal.toFixed(2)}
                        </td>
                        <td className="p-3.5 text-[#687067] font-mono">{order.createdAt}</td>
                        <td className="p-3.5 text-right">
                          {order.status !== 'completed' && (
                            <button
                              onClick={() => updateOrderStatus(order.id, 'completed')}
                              className="px-2.5 py-1 bg-[#F7F4EC] hover:bg-[#526B4A] hover:text-white rounded-lg text-xs font-semibold text-[#163024] border border-[#DDD8C9] transition-colors cursor-pointer"
                            >
                              Mark Completed
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. TABLE FLOOR PLAN & TABLES MANAGEMENT */}
      {subpath === 'tables' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#DDD8C9]">
            <div>
              <h2 className="text-lg font-bold text-[#163024]">Floor Layout & Tables Master</h2>
              <p className="text-xs text-[#687067]">Manage dining tables, floor zones, seating capacity, and QR codes.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleOpenAddTable}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#163024] hover:bg-[#204333] text-[#C5A86A] rounded-xl text-xs font-bold shadow-sm cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4 text-[#C5A86A]" />
                <span>Add Table</span>
              </button>
              <button
                type="button"
                onClick={() => pushRoute('/restaurant/qr-ordering')}
                className="flex items-center gap-2 px-3.5 py-2.5 bg-[#F7F4EC] hover:bg-[#ece7db] border border-[#DDD8C9] text-[#163024] rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-colors"
              >
                <QrCode className="w-4 h-4 text-[#526B4A]" />
                <span>Generate QR Codes</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenOrderModal()}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#163024] hover:bg-[#204333] text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[#C5A86A]" />
                <span>New Table Order</span>
              </button>
            </div>
          </div>

          {/* View Mode Switcher: Floor Layout Plan vs Tables Management */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F7F4EC] p-2 rounded-2xl border border-[#DDD8C9]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFloorViewMode('layout')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  floorViewMode === 'layout'
                    ? 'bg-[#163024] text-[#C5A86A] shadow-sm'
                    : 'text-[#687067] hover:text-[#163024]'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span>Floor Layout Plan</span>
              </button>
              <button
                type="button"
                onClick={() => setFloorViewMode('tables')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  floorViewMode === 'tables'
                    ? 'bg-[#163024] text-[#C5A86A] shadow-sm'
                    : 'text-[#687067] hover:text-[#163024]'
                }`}
              >
                <Store className="w-4 h-4" />
                <span>Tables Management</span>
                <span className="px-2 py-0.5 rounded-full bg-[#163024] text-[#C5A86A] text-[10px] font-mono font-bold">
                  {tables.length}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-3 text-xs text-[#687067] px-2 flex-wrap">
              <span className="flex items-center gap-1 font-semibold text-[#163024]">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Available: {tables.filter(t => t.status === 'available').length}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-semibold text-[#163024]">
                <span className="w-2 h-2 rounded-full bg-[#163024]"></span>
                Occupied: {tables.filter(t => t.status === 'occupied').length}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-semibold text-[#163024]">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Billed / Reserved: {tables.filter(t => t.status === 'billed' || t.status === 'reserved').length}
              </span>
            </div>
          </div>

          {/* MODE 1: VISUAL FLOOR LAYOUT PLAN */}
          {floorViewMode === 'layout' && (
            <div className="space-y-6">
              {diningZones.map(zone => zone.name).map(section => {
                const sectionTables = tables.filter(t => t.section === section);
                return (
                  <div key={section} className="bg-white p-5 rounded-2xl border border-[#DDD8C9] space-y-4">
                    <div className="flex items-center justify-between border-b border-[#DDD8C9]/60 pb-3">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-[#163024] text-sm">{section}</h3>
                        <span className="text-[11px] px-2 py-0.5 bg-[#F7F4EC] text-[#526B4A] rounded-md font-bold">
                          {sectionTables.length} Tables
                        </span>
                      </div>
                      <span className="text-xs text-[#687067] font-medium">
                        {sectionTables.filter(t => t.status === 'occupied').length} / {sectionTables.length} Occupied
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {sectionTables.map(t => {
                        const activeOrd = orders.find(
                          o => (o.tableId === t.id || o.tableNumber === t.number) && o.status !== 'completed' && o.status !== 'cancelled'
                        );

                        return (
                          <div
                            key={t.id}
                            className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                              t.status === 'occupied'
                                ? 'border-[#163024] bg-[#163024]/5 shadow-sm'
                                : t.status === 'billed'
                                ? 'border-amber-300 bg-amber-50/50'
                                : t.status === 'reserved'
                                ? 'border-[#C5A86A] bg-[#C5A86A]/10'
                                : 'border-[#DDD8C9] bg-white hover:border-[#526B4A]'
                            }`}
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-black text-lg text-[#163024]">Table {t.number}</span>
                                <span
                                  className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${
                                    t.status === 'occupied'
                                      ? 'bg-[#163024] text-[#C5A86A]'
                                      : t.status === 'billed'
                                      ? 'bg-rose-100 text-rose-800'
                                      : t.status === 'reserved'
                                      ? 'bg-[#C5A86A]/20 text-[#163024]'
                                      : 'bg-[#526B4A]/20 text-[#526B4A]'
                                  }`}
                                >
                                  {t.status}
                                </span>
                              </div>
                              <div className="text-xs text-[#687067] flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                  <Users className="w-3.5 h-3.5 text-[#526B4A]" />
                                  <span>Capacity: {t.capacity} Guests</span>
                                </span>
                                {t.waiterName && (
                                  <span className="text-[10px] text-[#526B4A] font-semibold">
                                    {t.waiterName}
                                  </span>
                                )}
                              </div>
                              {activeOrd && (
                                <div className="text-xs text-[#163024] font-medium pt-1 border-t border-[#DDD8C9]/40">
                                  <div>Guest: <strong className="font-bold">{activeOrd.guestName || 'Rahul Sharma'}</strong></div>
                                  <div className="text-[10px] font-mono text-[#526B4A]">{maskPhone(activeOrd.guestPhone)}</div>
                                  <div className="text-[10px] font-mono font-bold text-[#163024] mt-0.5">Order #{activeOrd.orderNumber} • ₹{activeOrd.grandTotal}</div>
                                </div>
                              )}
                            </div>

                            <div className="pt-4 mt-3 border-t border-[#DDD8C9]/60 flex items-center gap-2">
                              {/* QR Code Action */}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedTableForQr(t);
                                  setShowTableQrModal(true);
                                }}
                                className="p-1.5 rounded-lg border border-[#DDD8C9] hover:bg-[#F7F4EC] text-[#163024] transition-colors cursor-pointer shrink-0"
                                title={`Generate QR Code & Standee for Table ${t.number}`}
                              >
                                <QrCode className="w-4 h-4 text-[#526B4A]" />
                              </button>

                              {/* Edit Table Action */}
                              <button
                                type="button"
                                aria-label={`Edit table ${t.number}`} onClick={() => handleOpenEditTable(t)}
                                className="p-1.5 rounded-lg border border-[#DDD8C9] hover:bg-[#F7F4EC] text-[#163024] transition-colors cursor-pointer shrink-0"
                                title={`Edit Table ${t.number}`}
                              >
                                <Pencil className="w-4 h-4 text-[#C5A86A]" />
                              </button>

                              <button aria-label={`Deactivate table ${t.number}`} disabled={floorSaving} onClick={()=>void handleDeactivateTable(t.id)} className="px-2 py-1 text-xs">Deactivate</button>
                              {t.status === 'available' ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenOrderModal(t)}
                                  className="w-full py-1.5 bg-[#163024] hover:bg-[#204333] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                                >
                                  Assign & Order
                                </button>
                              ) : (
                                <div className="w-full flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => pushRoute('/restaurant/dashboard')}
                                    className="flex-1 py-1.5 bg-[#163024] hover:bg-[#204333] text-white text-xs font-bold rounded-lg cursor-pointer"
                                  >
                                    View Bill
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {const result=await updateTableStatus(t.id,'available'); if(!result.success) setFloorError(result.error || 'Unable to change occupancy.');}}
                                    className="px-3 py-1.5 bg-[#F7F4EC] hover:bg-[#ece7db] text-[#163024] border border-[#DDD8C9] text-xs font-bold rounded-lg cursor-pointer"
                                  >
                                    Clear
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* MODE 2: DEDICATED TABLES MANAGEMENT */}
          {floorViewMode === 'tables' && (
            <div className="space-y-4">
              {/* Tables Search & Filter Bar */}
              <div className="bg-white p-4 rounded-2xl border border-[#DDD8C9] flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2 flex-1 max-w-md bg-[#F7F4EC] px-3.5 py-2 rounded-xl border border-[#DDD8C9]">
                  <Search className="w-4 h-4 text-[#687067]" />
                  <input
                    type="text"
                    placeholder="Search table number (e.g. T-01), zone, server..."
                    value={tableSearch}
                    onChange={e => setTableSearch(e.target.value)}
                    className="w-full text-xs outline-none bg-transparent text-[#163024] font-medium"
                  />
                  {tableSearch && (
                    <button
                      type="button"
                      onClick={() => setTableSearch('')}
                      className="text-[#687067] hover:text-[#163024] text-xs font-bold"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={tableSectionFilter}
                    onChange={e => setTableSectionFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold bg-[#F7F4EC] border border-[#DDD8C9] text-[#163024] outline-none cursor-pointer"
                  >
                    <option value="all">All Dining Zones</option>
                    {diningZones.map(zone=><option key={zone.id} value={zone.name}>{zone.name}</option>)}
                  </select>

                  <select
                    value={tableStatusFilter}
                    onChange={e => setTableStatusFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold bg-[#F7F4EC] border border-[#DDD8C9] text-[#163024] outline-none cursor-pointer"
                  >
                    <option value="all">All Statuses</option>
                    <option value="available">Available</option>
                    <option value="occupied">Occupied</option>
                    <option value="reserved">Reserved</option>
                    <option value="billed">Billed</option>
                    <option value="cleaning">Cleaning</option>
                    <option value="out_of_service">Out of service</option>
                  </select>

                  <button
                    type="button"
                    onClick={handleOpenAddTable}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-[#163024] hover:bg-[#204333] text-[#C5A86A] rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Table</span>
                  </button>
                </div>
              </div>

              {/* Tables Management Listing */}
              <div className="bg-white rounded-2xl border border-[#DDD8C9] shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#DDD8C9] bg-[#F7F4EC] text-[#163024] font-bold uppercase text-[10px]">
                        <th className="py-3.5 px-4">Table #</th>
                        <th className="py-3.5 px-4">Zone / Section</th>
                        <th className="py-3.5 px-4">Capacity</th>
                        <th className="py-3.5 px-4">Live Status</th>
                        <th className="py-3.5 px-4">Assigned Waiter</th>
                        <th className="py-3.5 px-4">QR Relationship</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DDD8C9]/60">
                      {filteredManagementTables.map(t => {
                        return (
                          <tr key={t.id} className="hover:bg-[#F7F4EC]/40 transition-colors">
                            {/* Table # */}
                            <td className="py-3.5 px-4 font-mono font-black text-[#163024] text-sm">
                              Table {t.number}
                            </td>

                            {/* Section */}
                            <td className="py-3.5 px-4 font-semibold text-[#163024]">
                              <span className="px-2 py-0.5 rounded-md bg-[#F7F4EC] border border-[#DDD8C9] text-[11px]">
                                {t.section}
                              </span>
                            </td>

                            {/* Capacity */}
                            <td className="py-3.5 px-4">
                              <span className="flex items-center gap-1.5 text-[#163024] font-medium">
                                <Users className="w-3.5 h-3.5 text-[#526B4A]" />
                                <span>{t.capacity} Guests</span>
                              </span>
                            </td>

                            {/* Status with Quick Toggle */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-full ${
                                    t.status === 'occupied'
                                      ? 'bg-[#163024] text-[#C5A86A]'
                                      : t.status === 'billed'
                                      ? 'bg-rose-100 text-rose-800'
                                      : t.status === 'reserved'
                                      ? 'bg-[#C5A86A]/20 text-[#163024]'
                                      : 'bg-[#526B4A]/20 text-[#526B4A]'
                                  }`}
                                >
                                  {t.status}
                                </span>
                              </div>
                            </td>

                            {/* Assigned Server */}
                            <td className="py-3.5 px-4 text-[#163024]">
                              {t.waiterName ? (
                                <span className="font-semibold text-[#526B4A]">{t.waiterName}</span>
                              ) : (
                                <span className="text-[#687067] italic">Unassigned</span>
                              )}
                            </td>

                            {/* QR Relationship */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedTableForQr(t);
                                    setShowTableQrModal(true);
                                  }}
                                  className="flex items-center gap-1 px-2.5 py-1 bg-[#F7F4EC] hover:bg-[#DDD8C9]/60 text-[#163024] border border-[#DDD8C9] rounded-lg text-[11px] font-bold cursor-pointer transition-colors"
                                  title="View QR Code & Physical Tent Card Standee"
                                >
                                  <QrCode className="w-3.5 h-3.5 text-[#526B4A]" />
                                  <span>View QR</span>
                                </button>
                                <span className="text-[10px] font-mono text-[#687067] hidden lg:inline">
                                  /table={t.number}
                                </span>
                              </div>
                            </td>

                            {/* Actions */}
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  aria-label={`Edit table ${t.number}`} onClick={() => handleOpenEditTable(t)}
                                  className="px-2.5 py-1 bg-[#163024] hover:bg-[#204333] text-[#C5A86A] rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                                >
                                  <Pencil className="w-3 h-3" />
                                  <span>Edit</span>
                                </button>
                                <button aria-label={`Deactivate table ${t.number}`} disabled={floorSaving} onClick={()=>void handleDeactivateTable(t.id)} className="px-2 py-1 text-xs">Deactivate</button>
                                {t.status === 'available' ? (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenOrderModal(t)}
                                    className="px-2.5 py-1 bg-[#F7F4EC] hover:bg-[#DDD8C9]/60 text-[#163024] border border-[#DDD8C9] rounded-lg text-xs font-semibold cursor-pointer"
                                  >
                                    Order
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={async () => {const result=await updateTableStatus(t.id,'available'); if(!result.success) setFloorError(result.error || 'Unable to change occupancy.');}}
                                    className="px-2.5 py-1 bg-[#F7F4EC] hover:bg-[#ece7db] text-[#163024] border border-[#DDD8C9] rounded-lg text-xs font-semibold cursor-pointer"
                                  >
                                    Reset
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredManagementTables.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-[#687067]">
                            No tables found matching your filter criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. DINING RESERVATIONS MANAGEMENT */}
      {subpath === 'reservations' && (
        !FEATURES.DINING_RESERVATIONS ? (
          <FeatureDisabledView
            featureName="Dining Reservations"
            description="Table reservations booking is disabled in this release."
          />
        ) : (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#DDD8C9]">
            <div>
              <h2 className="text-lg font-bold text-[#163024]">Dining Table Reservations Book</h2>
              <p className="text-xs text-[#687067]">Upcoming guest bookings, party sizes, and floor allocations.</p>
            </div>
            <button
              onClick={() => pushRoute('/restaurant/dashboard')}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#163024] hover:bg-[#204333] text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
            >
              <CalendarCheck className="w-4 h-4 text-[#C5A86A]" />
              <span>Book Table on Dashboard</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-[#DDD8C9] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#DDD8C9] bg-[#F7F4EC] text-[#163024] font-bold uppercase text-[10px]">
                    <th className="py-3 px-4">Booking #</th>
                    <th className="py-3 px-4">Guest Name & Contact</th>
                    <th className="py-3 px-4">Party Size</th>
                    <th className="py-3 px-4">Table & Zone</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Special Notes</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDD8C9]/60">
                  {diningReservations.map(res => (
                    <tr key={res.id} className="hover:bg-[#F7F4EC]/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#163024]">
                        {res.reservationNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#1D241F]">{res.guestName}</div>
                        <div className="text-[11px] text-[#526B4A] font-mono">{maskPhone(res.guestPhone)}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-[#F7F4EC] text-[#163024] border border-[#DDD8C9] font-bold text-[11px]">
                          {res.partySize} Guests
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#163024]">
                        Table {res.tableNumber} <span className="text-[#687067] font-normal">({res.section})</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-[#163024]">{res.date}</div>
                        <div className="text-[11px] text-[#687067] font-mono">{res.time}</div>
                      </td>
                      <td className="py-3 px-4 text-[#687067] max-w-xs truncate">
                        {res.specialRequests || 'Standard guest arrangement'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            res.status === 'seated'
                              ? 'bg-[#526B4A]/20 text-[#526B4A]'
                              : 'bg-[#C5A86A]/20 text-[#163024]'
                          }`}
                        >
                          {res.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {res.status === 'confirmed' ? (
                          <button
                            onClick={() => seatDiningReservation(res.id)}
                            className="px-3 py-1.5 bg-[#526B4A] hover:bg-[#43573c] text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            Seat at Table
                          </button>
                        ) : (
                          <span className="text-[#687067] text-xs font-medium">Seated</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        )
      )}

      {/* 5. FOOD & BEVERAGE MENU */}
      {(subpath === 'menu' || subpath === 'categories' || subpath === 'food') && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-[#DDD8C9]">
            <div>
              <h2 className="text-lg font-bold text-[#163024]">Food & Beverage Catalog Master</h2>
              <p className="text-xs text-[#687067]">Manage Food & Bar dishes, pricing, dietary tags, and live availability.</p>
            </div>
            <button
              onClick={() => setShowAddMenuModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#163024] hover:bg-[#204333] text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#C5A86A]" />
              <span>Add Menu Item</span>
            </button>
          </div>

          {/* Dual Catalog Tabs: All, Food Menu, Bar Menu */}
          <div className="flex items-center gap-2 bg-[#F7F4EC] p-1.5 rounded-2xl border border-[#DDD8C9] w-fit">
            <button
              onClick={() => setMenuCatalogTab('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                menuCatalogTab === 'all'
                  ? 'bg-[#163024] text-[#C5A86A] shadow-sm'
                  : 'text-[#687067] hover:text-[#163024]'
              }`}
            >
              All Items ({menuItems.length})
            </button>
            <button
              onClick={() => setMenuCatalogTab('food')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                menuCatalogTab === 'food'
                  ? 'bg-[#163024] text-[#C5A86A] shadow-sm'
                  : 'text-[#687067] hover:text-[#163024]'
              }`}
            >
              <Coffee className="w-3.5 h-3.5" />
              <span>Food Menu ({menuItems.filter(m => m.menuType !== 'drink').length})</span>
            </button>
            <button
              onClick={() => setMenuCatalogTab('drink')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                menuCatalogTab === 'drink'
                  ? 'bg-[#163024] text-[#C5A86A] shadow-sm'
                  : 'text-[#687067] hover:text-[#163024]'
              }`}
            >
              <Wine className="w-3.5 h-3.5" />
              <span>Bar & Beverages ({menuItems.filter(m => m.menuType === 'drink').length})</span>
            </button>
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-[#DDD8C9] flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 max-w-md bg-[#F7F4EC] px-3 py-1.5 rounded-xl border border-[#DDD8C9]">
              <Search className="w-4 h-4 text-[#687067]" />
              <input
                type="text"
                placeholder="Search dish name, spices, ingredients..."
                value={menuSearch}
                onChange={e => setMenuSearch(e.target.value)}
                className="w-full text-xs outline-none bg-transparent text-[#163024] font-medium"
              />
            </div>

            <div className="flex items-center gap-3 overflow-x-auto">
              <button
                onClick={() => setVegOnlyFilter(!vegOnlyFilter)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  vegOnlyFilter
                    ? 'bg-[#526B4A] text-white border-[#526B4A]'
                    : 'bg-white text-[#687067] border-[#DDD8C9] hover:bg-[#F7F4EC]'
                }`}
              >
                <Leaf className="w-3.5 h-3.5 text-emerald-600" />
                <span>Pure Veg Only</span>
              </button>

              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="px-3 py-1.5 rounded-xl text-xs font-medium bg-[#F7F4EC] border border-[#DDD8C9] text-[#163024] outline-none"
              >
                <option value="all">All Categories</option>
                {MENU_CATEGORIES.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Menu Items Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredMenuItems.map(item => (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border overflow-hidden shadow-sm flex flex-col justify-between transition-all ${
                  item.isAvailable ? 'border-[#DDD8C9] hover:shadow-md' : 'border-[#DDD8C9] opacity-60'
                }`}
              >
                <div>
                  <div className="h-44 overflow-hidden relative">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 left-3 flex items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase flex items-center gap-1 ${
                          item.isVeg ? 'bg-[#526B4A] text-white' : 'bg-rose-700 text-white'
                        }`}
                      >
                        {item.isVeg ? 'VEG' : 'NON-VEG'}
                      </span>
                      {item.isSpicy && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-600 text-white flex items-center gap-0.5">
                          <Flame className="w-3 h-3" /> Spicy
                        </span>
                      )}
                    </div>
                    <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg bg-[#163024]/90 backdrop-blur-sm text-[#C5A86A] font-mono font-bold text-xs">
                      ₹{item.price}
                    </div>
                  </div>

                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-[#163024] text-sm">{item.name}</h3>
                      <span className="text-[10px] px-2 py-0.5 bg-[#F7F4EC] border border-[#DDD8C9] rounded text-[#687067] font-semibold whitespace-nowrap">
                        {item.categoryName}
                      </span>
                    </div>
                    <p className="text-xs text-[#687067] line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                    {item.portionOptions && item.portionOptions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {item.portionOptions.map((opt, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] px-2 py-0.5 bg-[#163024]/5 border border-[#DDD8C9] rounded font-mono text-[#163024]"
                          >
                            {opt.label}: <strong className="text-[#C5A86A]">₹{opt.price}</strong>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-[11px] text-[#687067] pt-1">
                      <span>Prep: ~{item.preparationTimeMinutes}m</span>
                      <span>•</span>
                      <span>GST: {item.taxRate}%</span>
                      <span>•</span>
                      <span className="capitalize">{item.menuType || 'food'}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 pt-0 flex items-center justify-between border-t border-[#DDD8C9]/50 mt-2 gap-2">
                  <span className={`text-xs font-semibold ${item.isAvailable ? 'text-[#526B4A]' : 'text-[#687067]'}`}>
                    {item.isAvailable ? 'In Kitchen Stock' : 'Unavailable'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label={`Edit ${item.name}`} onClick={() => handleOpenEditMenu(item)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#163024] hover:bg-[#204333] text-[#C5A86A] transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${item.name}`}
                      onClick={() => setItemToRemove(item)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMenuError(null); toggleMenuItemAvailability(item.id).catch(error => setMenuError(error.detail || error.message)); }}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#F7F4EC] hover:bg-[#ece7db] text-[#163024] border border-[#DDD8C9] transition-colors cursor-pointer"
                    >
                      {item.isAvailable ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. QR ORDERING & STANDEE STUDIO */}
      {subpath === 'qr-ordering' && (
        <TableQRStudio />
      )}

      {/* MODAL: PUNCH NEW ORDER */}
      {restaurantSyncError && <p role="alert" className="text-red-700">{restaurantSyncError}</p>}
      {orderSaveError && <p role="alert" className="text-red-700">{orderSaveError}</p>}
      {showAddOrderModal && (
        <div className="fixed inset-0 z-50 bg-[#163024]/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-2xl w-full rounded-2xl shadow-2xl border border-[#DDD8C9] overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-[#DDD8C9] flex items-center justify-between bg-[#F7F4EC]">
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="w-5 h-5 text-[#526B4A]" />
                <h3 className="font-serif font-bold text-[#163024]">Punch Dining Order</h3>
              </div>
              <button onClick={() => setShowAddOrderModal(false)} className="p-1 rounded-lg hover:bg-slate-200 text-[#687067] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Table Selection & Guest Name */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-[#163024] mb-1">
                    Select Table
                  </label>
                  <select
                    aria-label="Order table" value={selectedTableForOrder?.id || ''}
                    onChange={e => setSelectedTableForOrder(tables.find(t => t.id === e.target.value) || null)}
                    className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-xs font-semibold text-[#163024]"
                  >
                    {tables.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.number} ({t.section})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-[#163024] mb-1">
                    Guest Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rahul Sharma"
                    value={orderGuestName}
                    onChange={e => setOrderGuestName(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-xs font-semibold text-[#163024]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-[#163024] mb-1">
                    Guest Mobile
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 98200 45210"
                    value={orderGuestPhone}
                    onChange={e => setOrderGuestPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-xs font-semibold text-[#163024]"
                  />
                </div>
              </div>

              {/* Quick Item Picker */}
              <div>
                <label className="block text-xs font-bold uppercase text-[#163024] mb-2">
                  Select Food & Beverage Items
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1 border border-[#DDD8C9] rounded-xl">
                  {menuItems.filter(m => m.isAvailable).map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleAddToCart(item)}
                      className="p-2 bg-[#F7F4EC] hover:bg-[#ece7db] border border-[#DDD8C9] rounded-lg text-left text-xs transition-colors flex flex-col justify-between cursor-pointer"
                    >
                      <span className="font-bold text-[#163024] truncate">{item.name}</span>
                      <span className="font-mono text-[#526B4A] font-semibold mt-1">₹{item.price}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Chosen Items */}
              {cartItems.length > 0 && (
                <div className="space-y-2 border-t border-[#DDD8C9] pt-3">
                  <span className="text-xs font-bold text-[#163024]">Order Items Queued ({cartItems.length}):</span>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {cartItems.map(({ item, quantity }) => (
                      <div key={item.id} className="flex items-center justify-between bg-[#F7F4EC] p-2 rounded-lg text-xs">
                        <span className="font-medium text-[#163024]">{item.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-[#687067]">x{quantity}</span>
                          <span className="font-mono font-bold text-[#163024]">₹{item.price * quantity}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveFromCart(item.id)}
                            className="text-rose-600 hover:text-rose-800 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center pt-2 font-bold text-sm">
                    <span>Subtotal + 5% GST:</span>
                    <span className="font-mono text-[#163024]">₹{(modalSubtotal * 1.05).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[#DDD8C9] bg-[#F7F4EC] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAddOrderModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#687067] bg-white border border-[#DDD8C9] hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateOrder}
                disabled={orderSaving || cartItems.length === 0}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#163024] hover:bg-[#204333] disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
              >
                Send Order to Kitchen (KOT)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD MENU ITEM (WITH IMAGE UPLOAD, PREVIEW, REPLACE, REMOVE) */}
      {showAddMenuModal && (
        <div className="fixed inset-0 z-50 bg-[#163024]/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-2xl shadow-2xl border border-[#DDD8C9] p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#DDD8C9] pb-3">
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="w-5 h-5 text-[#526B4A]" />
                <h3 className="font-serif font-bold text-[#163024] text-base">Add New Menu Item</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddMenuModal(false)}
                className="p-1 rounded-lg hover:bg-[#F7F4EC] text-[#687067] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateMenuItem} className="space-y-3.5 text-xs">
              {menuError && <p role="alert" className="text-rose-800">{menuError}</p>}
              {/* Menu Type Selector */}
              <div className="flex items-center gap-2 bg-[#F7F4EC] p-1 rounded-xl border border-[#DDD8C9]">
                <button
                  type="button"
                  onClick={() => setNewMenuType('food')}
                  className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                    newMenuType === 'food'
                      ? 'bg-[#163024] text-[#C5A86A] shadow-sm'
                      : 'text-[#687067]'
                  }`}
                >
                  <Coffee className="w-3.5 h-3.5" />
                  <span>Food Dish</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewMenuType('drink')}
                  className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                    newMenuType === 'drink'
                      ? 'bg-[#163024] text-[#C5A86A] shadow-sm'
                      : 'text-[#687067]'
                  }`}
                >
                  <Wine className="w-3.5 h-3.5" />
                  <span>Bar & Beverage</span>
                </button>
              </div>

              {/* Name */}
              <div>
                <label className="block font-bold text-[#163024] mb-1">Item / Dish Name *</label>
                <input
                  type="text"
                  required
                  placeholder={newMenuType === 'food' ? 'e.g. Kashmiri Dum Aloo' : 'e.g. Kokum Coastal Cooler'}
                  aria-label="Menu item name" value={newMenuName}
                  onChange={e => setNewMenuName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl focus:outline-none focus:border-[#526B4A]"
                />
              </div>

              {/* Category & Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#163024] mb-1">Category *</label>
                  <select
                    aria-label="Menu category" value={MENU_CATEGORIES.some(category=>category.name===newMenuCategory) ? newMenuCategory : MENU_CATEGORIES[0]?.name || ''}
                    onChange={e => setNewMenuCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl focus:outline-none"
                  >
                    {dynamicCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#163024] mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    placeholder="340"
                    aria-label="Menu price" value={newMenuPrice}
                    onChange={e => setNewMenuPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-mono focus:outline-none"
                  />
                </div>
              </div>

              {/* Prep Time & Spicy */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#163024] mb-1">Preparation Time (Mins)</label>
                  <input
                    type="number"
                    min={2}
                    value={newMenuPrepTime}
                    onChange={e => setNewMenuPrepTime(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-mono focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newMenuIsSpicy}
                      onChange={e => setNewMenuIsSpicy(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-0"
                    />
                    <span className="font-bold text-[#163024] flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 text-amber-600" /> Spicy Specialty
                    </span>
                  </label>
                </div>
              </div>

              {/* Dietary Tag */}
              <div>
                <label className="block font-bold text-[#163024] mb-1">Dietary Type *</label>
                <div className="flex gap-4 pt-1 bg-[#F7F4EC] p-2.5 rounded-xl border border-[#DDD8C9]">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="newMenuDietary"
                      checked={newMenuIsVeg}
                      onChange={() => setNewMenuIsVeg(true)}
                    />
                    <span className="text-[#526B4A] font-bold flex items-center gap-1">
                      <Leaf className="w-3.5 h-3.5 text-emerald-600" /> Vegetarian
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="newMenuDietary"
                      checked={!newMenuIsVeg}
                      onChange={() => setNewMenuIsVeg(false)}
                    />
                    <span className="text-rose-700 font-bold">Non-Vegetarian</span>
                  </label>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block font-bold text-[#163024] mb-1">Dish Description</label>
                <textarea
                  rows={2}
                  placeholder="Ingredients, secret spices, chef notes, texture..."
                  value={newMenuDesc}
                  onChange={e => setNewMenuDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl focus:outline-none"
                />
              </div>

              {/* Portion Pricing Options */}
              <div className="space-y-2 pt-1 border-t border-[#DDD8C9]/60">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-[#163024]">Portion Pricing Options</label>
                  <span className="text-[10px] text-[#687067]">e.g. 30ml Peg, 60ml Peg, Glass, Bottle</span>
                </div>
                {newMenuPortions.length > 0 && (
                  <div className="space-y-1 bg-[#F7F4EC] p-2 rounded-xl border border-[#DDD8C9]">
                    {newMenuPortions.map((opt, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-[#DDD8C9] text-xs">
                        <span className="font-semibold text-[#163024]">{opt.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#526B4A]">₹{opt.price}</span>
                          <button
                            type="button"
                            aria-label={`Remove portion ${opt.label}`}
                            onClick={() => setNewMenuPortions(prev => prev.filter((_, i) => i !== idx))}
                            className="p-1 text-rose-600 hover:text-rose-800 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Portion name (e.g. 30ml Peg)"
                    value={newPortionLabel}
                    onChange={e => setNewPortionLabel(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-xs outline-none"
                  />
                  <input
                    type="number"
                    min={0}
                    placeholder="Price (₹)"
                    value={newPortionPrice}
                    onChange={e => setNewPortionPrice(e.target.value)}
                    className="w-24 px-3 py-1.5 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-xs font-mono outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newPortionLabel.trim() && newPortionPrice.trim() && Number(newPortionPrice) >= 0) {
                        setNewMenuPortions(prev => [...prev, { label: newPortionLabel.trim(), price: Number(newPortionPrice) }]);
                        setNewPortionLabel('');
                        setNewPortionPrice('');
                      }
                    }}
                    className="px-3 py-1.5 bg-[#163024] text-[#C5A86A] rounded-xl text-xs font-bold cursor-pointer hover:bg-[#204333]"
                  >
                    + Add
                  </button>
                </div>
              </div>

              {/* Image Upload, Preview, Replace, Remove */}
              <div className="space-y-2 pt-1 border-t border-[#DDD8C9]/60">
                <label className="block font-bold text-[#163024]">Dish Image</label>
                {newMenuImage ? (
                  <div className="relative rounded-xl border border-[#DDD8C9] overflow-hidden bg-[#F7F4EC] group">
                    <img
                      src={newMenuImage}
                      alt="Dish preview"
                      className="w-full h-36 object-cover"
                    />
                    <div className="p-2.5 bg-white border-t border-[#DDD8C9] flex items-center justify-between">
                      <span className="flex items-center gap-1 text-[#526B4A] font-bold text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Image attached
                      </span>
                      <div className="flex items-center gap-2">
                        <label className="px-2.5 py-1 bg-[#F7F4EC] hover:bg-[#DDD8C9]/60 text-[#163024] rounded-lg text-xs font-bold border border-[#DDD8C9] cursor-pointer flex items-center gap-1 transition-colors">
                          <RefreshCw className="w-3 h-3" />
                          <span>Replace</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => handleImageFileUpload(e, setNewMenuImage)}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setNewMenuImage('');
                            setNewMenuImageUrlInput('');
                          }}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold border border-rose-200 cursor-pointer flex items-center gap-1 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="border-2 border-dashed border-[#DDD8C9] hover:border-[#526B4A] rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer bg-[#F7F4EC]/50 hover:bg-[#F7F4EC] transition-all">
                      <Upload className="w-6 h-6 text-[#526B4A] mb-1" />
                      <span className="text-xs font-bold text-[#163024]">Click to upload dish photo</span>
                      <span className="text-[10px] text-[#687067]">PNG, JPG, WEBP from your device</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => handleImageFileUpload(e, setNewMenuImage)}
                      />
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        placeholder="Or paste image URL (https://...)"
                        value={newMenuImageUrlInput}
                        onChange={e => setNewMenuImageUrlInput(e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-xs outline-none"
                      />
                      {newMenuImageUrlInput.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            setNewMenuImage(newMenuImageUrlInput.trim());
                            setNewMenuImageUrlInput('');
                          }}
                          className="px-3 py-1.5 bg-[#163024] text-[#C5A86A] rounded-xl text-xs font-bold cursor-pointer"
                        >
                          Set
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end gap-2 pt-3 border-t border-[#DDD8C9]">
                <button
                  type="button"
                  onClick={() => setShowAddMenuModal(false)}
                  className="px-4 py-2 bg-[#F7F4EC] text-[#687067] font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit" disabled={isMenuSaving || menuCategories.length===0}
                  className="px-4 py-2 bg-[#163024] hover:bg-[#204333] text-white font-bold rounded-xl shadow-sm cursor-pointer"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT MENU ITEM (SUPPORTING ALL 8 FIELDS + IMAGE UPLOAD, PREVIEW, REPLACE, REMOVE) */}
      {showEditMenuModal && editingMenuItem && (
        <div className="fixed inset-0 z-50 bg-[#163024]/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-2xl shadow-2xl border border-[#DDD8C9] p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#DDD8C9] pb-3">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-[#C5A86A]" />
                <h3 className="font-serif font-bold text-[#163024] text-base">Edit Menu Item</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowEditMenuModal(false);
                  setEditingMenuItem(null);
                }}
                className="p-1 rounded-lg hover:bg-[#F7F4EC] text-[#687067] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditMenuItem} className="space-y-3.5 text-xs">
              {menuError && <p role="alert" className="text-rose-800">{menuError}</p>}
              {/* Menu Type Selector */}
              <div className="flex items-center gap-2 bg-[#F7F4EC] p-1 rounded-xl border border-[#DDD8C9]">
                <button
                  type="button"
                  onClick={() => setEditMenuForm({ ...editMenuForm, menuType: 'food' })}
                  className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                    editMenuForm.menuType === 'food'
                      ? 'bg-[#163024] text-[#C5A86A] shadow-sm'
                      : 'text-[#687067]'
                  }`}
                >
                  <Coffee className="w-3.5 h-3.5" />
                  <span>Food Dish</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditMenuForm({ ...editMenuForm, menuType: 'drink' })}
                  className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                    editMenuForm.menuType === 'drink'
                      ? 'bg-[#163024] text-[#C5A86A] shadow-sm'
                      : 'text-[#687067]'
                  }`}
                >
                  <Wine className="w-3.5 h-3.5" />
                  <span>Bar & Beverage</span>
                </button>
              </div>

              {/* 1. Name */}
              <div>
                <label className="block font-bold text-[#163024] mb-1">Item / Dish Name *</label>
                <input
                  type="text"
                  required
                  aria-label="Menu item name" value={editMenuForm.name}
                  onChange={e => setEditMenuForm({ ...editMenuForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl focus:outline-none focus:border-[#526B4A]"
                />
              </div>

              {/* 2. Category & Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#163024] mb-1">Category *</label>
                  <select
                    value={editMenuForm.categoryName}
                    onChange={e => setEditMenuForm({ ...editMenuForm, categoryName: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl focus:outline-none"
                  >
                    {dynamicCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#163024] mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    aria-label="Menu price" value={editMenuForm.price}
                    onChange={e => setEditMenuForm({ ...editMenuForm, price: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-mono focus:outline-none"
                  />
                </div>
              </div>

              {/* 3. Availability & Prep Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#163024] mb-1">Prep Time (Mins) *</label>
                  <input
                    type="number"
                    min={2}
                    value={editMenuForm.preparationTimeMinutes}
                    onChange={e => setEditMenuForm({ ...editMenuForm, preparationTimeMinutes: e.target.value })}
                    className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-mono focus:outline-none"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 p-2 bg-[#F7F4EC] rounded-xl border border-[#DDD8C9] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editMenuForm.isAvailable}
                      onChange={e => setEditMenuForm({ ...editMenuForm, isAvailable: e.target.checked })}
                      className="rounded text-[#526B4A]"
                    />
                    <span className="font-bold text-[#163024]">
                      {editMenuForm.isAvailable ? 'In Kitchen Stock' : 'Unavailable'}
                    </span>
                  </label>
                </div>
              </div>

              {/* 4. Dietary Type */}
              <div>
                <label className="block font-bold text-[#163024] mb-1">Dietary Type *</label>
                <div className="flex items-center justify-between gap-4 bg-[#F7F4EC] p-2.5 rounded-xl border border-[#DDD8C9]">
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="editDietary"
                        checked={editMenuForm.isVeg}
                        onChange={() => setEditMenuForm({ ...editMenuForm, isVeg: true })}
                      />
                      <span className="text-[#526B4A] font-bold flex items-center gap-1">
                        <Leaf className="w-3.5 h-3.5 text-emerald-600" /> Vegetarian
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="editDietary"
                        checked={!editMenuForm.isVeg}
                        onChange={() => setEditMenuForm({ ...editMenuForm, isVeg: false })}
                      />
                      <span className="text-rose-700 font-bold">Non-Vegetarian</span>
                    </label>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editMenuForm.isSpicy}
                      onChange={e => setEditMenuForm({ ...editMenuForm, isSpicy: e.target.checked })}
                      className="rounded text-amber-600"
                    />
                    <span className="font-bold text-[#163024] flex items-center gap-0.5">
                      <Flame className="w-3 h-3 text-amber-600" /> Spicy
                    </span>
                  </label>
                </div>
              </div>

              {/* 5. Description */}
              <div>
                <label className="block font-bold text-[#163024] mb-1">Description *</label>
                <textarea
                  rows={2}
                  value={editMenuForm.description}
                  onChange={e => setEditMenuForm({ ...editMenuForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl focus:outline-none"
                />
              </div>

              {/* Portion Pricing Options */}
              <div className="space-y-2 pt-1 border-t border-[#DDD8C9]/60">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-[#163024]">Portion Pricing Options</label>
                  <span className="text-[10px] text-[#687067]">e.g. 30ml Peg, 60ml Peg, Glass, Bottle</span>
                </div>
                {editMenuPortions.length > 0 && (
                  <div className="space-y-1 bg-[#F7F4EC] p-2 rounded-xl border border-[#DDD8C9]">
                    {editMenuPortions.map((opt, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-[#DDD8C9] text-xs">
                        <span className="font-semibold text-[#163024]">{opt.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#526B4A]">₹{opt.price}</span>
                          <button
                            type="button"
                            aria-label={`Remove portion ${opt.label}`}
                            onClick={() => setEditMenuPortions(prev => prev.filter((_, i) => i !== idx))}
                            className="p-1 text-rose-600 hover:text-rose-800 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Portion name (e.g. 30ml Peg)"
                    value={editPortionLabel}
                    onChange={e => setEditPortionLabel(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-xs outline-none"
                  />
                  <input
                    type="number"
                    min={0}
                    placeholder="Price (₹)"
                    value={editPortionPrice}
                    onChange={e => setEditPortionPrice(e.target.value)}
                    className="w-24 px-3 py-1.5 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-xs font-mono outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (editPortionLabel.trim() && editPortionPrice.trim() && Number(editPortionPrice) >= 0) {
                        setEditMenuPortions(prev => [...prev, { label: editPortionLabel.trim(), price: Number(editPortionPrice) }]);
                        setEditPortionLabel('');
                        setEditPortionPrice('');
                      }
                    }}
                    className="px-3 py-1.5 bg-[#163024] text-[#C5A86A] rounded-xl text-xs font-bold cursor-pointer hover:bg-[#204333]"
                  >
                    + Add
                  </button>
                </div>
              </div>

              {/* 6. Image (Upload, Preview, Replace, Remove) */}
              <div className="space-y-2 pt-1 border-t border-[#DDD8C9]/60">
                <label className="block font-bold text-[#163024]">Dish Image</label>
                {editMenuForm.image ? (
                  <div className="relative rounded-xl border border-[#DDD8C9] overflow-hidden bg-[#F7F4EC] group">
                    <img
                      src={editMenuForm.image}
                      alt="Dish preview"
                      className="w-full h-36 object-cover"
                    />
                    <div className="p-2.5 bg-white border-t border-[#DDD8C9] flex items-center justify-between">
                      <span className="flex items-center gap-1 text-[#526B4A] font-bold text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Image attached
                      </span>
                      <div className="flex items-center gap-2">
                        <label className="px-2.5 py-1 bg-[#F7F4EC] hover:bg-[#DDD8C9]/60 text-[#163024] rounded-lg text-xs font-bold border border-[#DDD8C9] cursor-pointer flex items-center gap-1 transition-colors">
                          <RefreshCw className="w-3 h-3" />
                          <span>Replace</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e =>
                              handleImageFileUpload(e, url => setEditMenuForm(prev => ({ ...prev, image: url })))
                            }
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setEditMenuForm(prev => ({ ...prev, image: '' }));
                            setEditMenuImageUrlInput('');
                          }}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold border border-rose-200 cursor-pointer flex items-center gap-1 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="border-2 border-dashed border-[#DDD8C9] hover:border-[#526B4A] rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer bg-[#F7F4EC]/50 hover:bg-[#F7F4EC] transition-all">
                      <Upload className="w-6 h-6 text-[#526B4A] mb-1" />
                      <span className="text-xs font-bold text-[#163024]">Click to upload dish photo</span>
                      <span className="text-[10px] text-[#687067]">PNG, JPG, WEBP from your device</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e =>
                          handleImageFileUpload(e, url => setEditMenuForm(prev => ({ ...prev, image: url })))
                        }
                      />
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        placeholder="Or paste image URL (https://...)"
                        value={editMenuImageUrlInput}
                        onChange={e => setEditMenuImageUrlInput(e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-xs outline-none"
                      />
                      {editMenuImageUrlInput.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditMenuForm(prev => ({ ...prev, image: editMenuImageUrlInput.trim() }));
                            setEditMenuImageUrlInput('');
                          }}
                          className="px-3 py-1.5 bg-[#163024] text-[#C5A86A] rounded-xl text-xs font-bold cursor-pointer"
                        >
                          Set
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end gap-2 pt-3 border-t border-[#DDD8C9]">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditMenuModal(false);
                    setEditingMenuItem(null);
                  }}
                  className="px-4 py-2 bg-[#F7F4EC] text-[#687067] font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit" disabled={isMenuSaving || menuCategories.length===0}
                  className="px-4 py-2 bg-[#163024] hover:bg-[#204333] text-white font-bold rounded-xl shadow-sm cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REMOVE MENU ITEM CONFIRMATION */}
      {itemToRemove && (
        <div className="fixed inset-0 z-50 bg-[#163024]/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-2xl border border-[#DDD8C9] p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#DDD8C9] pb-3">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-600" />
                <h3 className="font-serif font-bold text-[#163024] text-base">Archive Menu Item</h3>
              </div>
              <button
                type="button"
                onClick={() => setItemToRemove(null)}
                className="p-1 rounded-lg hover:bg-[#F7F4EC] text-[#687067] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#687067]">
              <p>
                Are you sure you want to remove <strong className="text-[#163024] font-bold">{itemToRemove.name}</strong> from the active restaurant menu?
              </p>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 text-[11px] leading-relaxed">
                <strong>Historical Orders Preserved:</strong> This action safely removes the item from the customer and waiter menu catalog. All existing orders, kitchen tickets, billing history, and accounting statements are strictly retained and unaffected.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#DDD8C9]">
              <button
                type="button"
                onClick={() => setItemToRemove(null)}
                className="px-4 py-2 bg-[#F7F4EC] text-[#687067] font-semibold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isRemovingItem}
                onClick={handleConfirmRemoveItem}
                className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isRemovingItem ? 'Archiving...' : 'Confirm Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD TABLE */}
      {showAddTableModal && (
        <div className="fixed inset-0 z-50 bg-[#163024]/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-2xl border border-[#DDD8C9] p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#DDD8C9] pb-3">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-[#526B4A]" />
                <h3 className="font-serif font-bold text-[#163024] text-base">Add New Dining Table</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddTableModal(false)}
                className="p-1 rounded-lg hover:bg-[#F7F4EC] text-[#687067] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewTable} className="space-y-3.5 text-xs">
              {/* Table Number */}
              <div>
                <label className="block font-bold text-[#163024] mb-1">Table Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. T-13, T-14, OB-07"
                  aria-label="Table number" value={newTableNumber}
                  onChange={e => setNewTableNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-mono font-bold text-sm focus:outline-none focus:border-[#526B4A]"
                />
              </div>

              {/* Zone / Section */}
              <div>
                <label className="block font-bold text-[#163024] mb-1">Dining Zone / Section *</label>
                <select
                  aria-label="Dining zone" required value={newTableSection}
                  onChange={e => setNewTableSection(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-semibold text-[#163024] focus:outline-none"
                >
                  <option value="">Choose a dining zone</option>
                  {diningZones.map(zone=><option key={zone.id} value={zone.id}>{zone.name}</option>)}
                </select>
              </div>

              {/* Capacity & Initial Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#163024] mb-1">Guest Capacity *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={30}
                    aria-label="Guest capacity" value={newTableCapacity}
                    onChange={e => setNewTableCapacity(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#163024] mb-1">Initial Status *</label>
                  <select
                    value={newTableStatus}
                    onChange={e => setNewTableStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-semibold text-[#163024] focus:outline-none"
                  >
                    <option value="available">Available</option>
                  </select>
                </div>
              </div>

              {/* Existing QR Relationship Notice & Preview */}
              <div className="p-3 bg-[#F7F4EC] rounded-xl border border-[#DDD8C9] space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-[#163024]">
                  <QrCode className="w-4 h-4 text-[#526B4A]" />
                  <span>Automatic QR Code Relationship</span>
                </div>
                <p className="text-[11px] text-[#687067] leading-relaxed">
                  Upon creating Table {newTableNumber || '...'}, its dedicated dining QR code and standee are instantly linked. Guests can immediately scan to browse the digital menu and place table orders.
                </p>
                <div className="text-[10px] font-mono text-[#526B4A] bg-white p-1.5 rounded-lg border border-[#DDD8C9] truncate">
                  Secure ordering QR will be available in QR Studio after creating the table.
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end gap-2 pt-3 border-t border-[#DDD8C9]">
                <button
                  type="button"
                  onClick={() => setShowAddTableModal(false)}
                  className="px-4 py-2 bg-[#F7F4EC] text-[#687067] font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit" disabled={floorSaving}
                  className="px-4 py-2 bg-[#163024] hover:bg-[#204333] text-white font-bold rounded-xl shadow-sm cursor-pointer"
                >
                  Save Table
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: EDIT TABLE (SUPPORTING NUMBER, ZONE, CAPACITY, STATUS, AND EXISTING QR RELATIONSHIP) */}
      {showEditTableModal && editingTable && (
        <div className="fixed inset-0 z-50 bg-[#163024]/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-2xl border border-[#DDD8C9] p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#DDD8C9] pb-3">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-[#C5A86A]" />
                <h3 className="font-serif font-bold text-[#163024] text-base">
                  Edit Table {editingTable.number}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowEditTableModal(false);
                  setEditingTable(null);
                }}
                className="p-1 rounded-lg hover:bg-[#F7F4EC] text-[#687067] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditTable} className="space-y-3.5 text-xs">
              {/* 1. Table Number */}
              <div>
                <label className="block font-bold text-[#163024] mb-1">Table Number *</label>
                <input
                  type="text"
                  required
                  aria-label="Table number" value={editTableNumber}
                  onChange={e => setEditTableNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-mono font-bold text-sm focus:outline-none focus:border-[#526B4A]"
                />
              </div>

              {/* 2. Zone / Section */}
              <div>
                <label className="block font-bold text-[#163024] mb-1">Dining Zone / Section *</label>
                <select
                  aria-label="Dining zone" required value={editTableSection}
                  onChange={e => setEditTableSection(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-semibold text-[#163024] focus:outline-none"
                >
                  <option value="">Choose a dining zone</option>
                  {diningZones.map(zone=><option key={zone.id} value={zone.id}>{zone.name}</option>)}
                </select>
              </div>

              {/* 3. Capacity & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#163024] mb-1">Guest Capacity *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={30}
                    aria-label="Guest capacity" value={editTableCapacity}
                    onChange={e => setEditTableCapacity(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#163024] mb-1">Table Status *</label>
                  <select
                    value={editTableStatus}
                    onChange={e => setEditTableStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-semibold text-[#163024] focus:outline-none"
                  >
                    <option value="available">Available</option>
                    <option value="occupied">Occupied</option>
                    <option value="reserved">Reserved</option>
                    <option value="billed">Billed</option>
                    <option value="cleaning">Cleaning</option>
                    <option value="out_of_service">Out of service</option>
                  </select>
                </div>
              </div>

              {/* 4. Existing QR Relationship */}
              <div className="p-3 bg-[#F7F4EC] rounded-xl border border-[#DDD8C9] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-bold text-[#163024]">
                    <QrCode className="w-4 h-4 text-[#526B4A]" />
                    <span>Existing QR Relationship</span>
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#526B4A]/15 text-[#526B4A] font-bold">
                    Active & Linked
                  </span>
                </div>
                <div className="text-[10px] font-mono text-[#526B4A] bg-white p-2 rounded-lg border border-[#DDD8C9] truncate">
                  Open QR Studio to view or reprint the existing secure QR.
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTableForQr(editingTable);
                    setShowTableQrModal(true);
                  }}
                  className="w-full py-1.5 bg-white hover:bg-[#F7F4EC] text-[#163024] border border-[#DDD8C9] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                >
                  <QrCode className="w-3.5 h-3.5 text-[#526B4A]" />
                  <span>Launch QR Standee & Physical Card Studio</span>
                </button>
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end gap-2 pt-3 border-t border-[#DDD8C9]">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditTableModal(false);
                    setEditingTable(null);
                  }}
                  className="px-4 py-2 bg-[#F7F4EC] text-[#687067] font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit" disabled={floorSaving}
                  className="px-4 py-2 bg-[#163024] hover:bg-[#204333] text-white font-bold rounded-xl shadow-sm cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table QR Code Generator Modal */}
      <GenerateQRCodeModal
        isOpen={showTableQrModal}
        onClose={() => setShowTableQrModal(false)}
        table={selectedTableForQr}
        allTables={tables}
        onSelectTable={t => setSelectedTableForQr(t)}
        restaurantId={activeRestaurant.id}
        restaurantName={activeRestaurant.name}
      />
    </div>
  );
};
