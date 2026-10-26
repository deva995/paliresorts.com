import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { InventoryItem, Recipe } from '../../types';
import { api } from '../../api/client';
import {
  Package,
  AlertTriangle,
  Plus,
  ArrowDownUp,
  Trash2,
  CheckCircle2,
  DollarSign,
  Search,
  Truck,
  FileSpreadsheet,
  Layers,
  ArrowRightLeft,
  ChefHat,
  Boxes,
  RefreshCw,
  X,
  Building2,
  Check,
  Filter
} from 'lucide-react';

export const InventoryView: React.FC = () => {
  const {
    inventory,
    inventoryLocations,
    inventoryBalances,
    recipes,
    menuItems,
    refreshInventoryData,
    adjustInventoryStock,
    logWaste,
    createStockTransfer,
    createRecipe,
    addRecipeIngredient,
    removeRecipeIngredient,
    createPurchaseOrder,
    currentRoute,
    pushRoute
  } = useApp();

  const [activeTab, setActiveTab] = useState<'catalog' | 'locations' | 'movements' | 'transfers' | 'recipes'>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Modals
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showNewRecipeModal, setShowNewRecipeModal] = useState(false);
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [showPOModal, setShowPOModal] = useState(false);
  const [showAddIngredientModal, setShowAddIngredientModal] = useState(false);
  const [selectedRecipeForIngredient, setSelectedRecipeForIngredient] = useState<Recipe | null>(null);

  // Movement Form
  const [movItemId, setMovItemId] = useState<string>('');
  const [movLocationId, setMovLocationId] = useState<string>('');
  const [movType, setMovType] = useState<'PURCHASE' | 'CONSUMPTION' | 'ADJUSTMENT' | 'WASTAGE' | 'RETURN'>('PURCHASE');
  const [movQuantity, setMovQuantity] = useState<string>('10');
  const [movNotes, setMovNotes] = useState<string>('');
  const [movLoading, setMovLoading] = useState(false);
  const [movError, setMovError] = useState<string | null>(null);

  // Transfer Form
  const [trfItemId, setTrfItemId] = useState<string>('');
  const [trfSourceLocId, setTrfSourceLocId] = useState<string>('');
  const [trfDestLocId, setTrfDestLocId] = useState<string>('');
  const [trfQuantity, setTrfQuantity] = useState<string>('5');
  const [trfNotes, setTrfNotes] = useState<string>('');
  const [trfLoading, setTrfLoading] = useState(false);
  const [trfError, setTrfError] = useState<string | null>(null);

  // Recipe Form
  const [recMenuItemId, setRecMenuItemId] = useState<string>('');
  const [recName, setRecName] = useState<string>('');
  const [recYield, setRecYield] = useState<string>('1');
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);

  // Add Ingredient Form
  const [ingItemId, setIngItemId] = useState<string>('');
  const [ingQuantity, setIngQuantity] = useState<string>('0.25');
  const [ingUom, setIngUom] = useState<string>('kg');
  const [ingLoading, setIngLoading] = useState(false);
  const [ingError, setIngError] = useState<string | null>(null);

  // New Item Form
  const [newItemCode, setNewItemCode] = useState<string>('');
  const [newItemName, setNewItemName] = useState<string>('');
  const [newItemCategory, setNewItemCategory] = useState<'FOOD_GRAINS' | 'DAIRY' | 'MEAT' | 'LIQUOR' | 'BEVERAGES' | 'CLEANING' | 'LINEN' | 'OTHER'>('FOOD_GRAINS');
  const [newItemUom, setNewItemUom] = useState<string>('kg');
  const [newItemReorder, setNewItemReorder] = useState<string>('10');
  const [newItemCostPaise, setNewItemCostPaise] = useState<string>('15000');
  const [newItemLoading, setNewItemLoading] = useState(false);
  const [newItemError, setNewItemError] = useState<string | null>(null);

  // PO Form
  const [poSupplier, setPoSupplier] = useState('Amul Dairy Cooperative Ltd');
  const [poItem, setPoItem] = useState<InventoryItem | null>(inventory[0] || null);
  const [poQty, setPoQty] = useState('25');

  // KPI Calculations
  const lowStockItems = inventory.filter(i => i.status === 'low-stock');
  const outOfStockItems = inventory.filter(i => i.status === 'out-of-stock');
  const totalValuation = inventory.reduce((acc, i) => acc + (i.currentStock * i.unitCost), 0);

  const filteredInventory = inventory.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.itemCode && i.itemCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
      i.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = categoryFilter === 'ALL' || i.category === categoryFilter;
    return matchSearch && matchCat;
  });

  // Handlers
  const handleCreateMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    setMovLoading(true);
    setMovError(null);
    try {
      const targetItemId = movItemId;
      const targetLocId = movLocationId;
      if (!inventory.some(item => item.id === targetItemId) || !inventoryLocations.some(location => location.id === targetLocId)) {
        setMovError('Item and Storage Location are required');
        setMovLoading(false);
        return;
      }
      const qtyNum = parseFloat(movQuantity) || 0;
      if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
        setMovError('Quantity must be greater than zero');
        setMovLoading(false);
        return;
      }

      await api.createStockMovement({
        itemId: targetItemId,
        locationId: targetLocId,
        movementType: movType,
        quantity: qtyNum,
        notes: movNotes || undefined
      });
      await refreshInventoryData();
      setShowMovementModal(false);
      setMovNotes('');
    } catch (err: any) {
      setMovError(err?.message || 'Failed to record stock movement');
    } finally {
      setMovLoading(false);
    }
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrfLoading(true);
    setTrfError(null);
    try {
      const targetItemId = trfItemId;
      const srcLoc = trfSourceLocId;
      const dstLoc = trfDestLocId;

      if (!inventory.some(item => item.id === targetItemId) || !inventoryLocations.some(location => location.id === srcLoc) || !inventoryLocations.some(location => location.id === dstLoc)) {
        setTrfError('Item, Source, and Destination Locations are required');
        setTrfLoading(false);
        return;
      }
      if (srcLoc === dstLoc) {
        setTrfError('Source and Destination locations must be different');
        setTrfLoading(false);
        return;
      }
      const qty = parseFloat(trfQuantity) || 0;
      if (!Number.isFinite(qty) || qty <= 0) {
        setTrfError('Transfer quantity must be greater than zero');
        setTrfLoading(false);
        return;
      }

      const res = await createStockTransfer(targetItemId, srcLoc, dstLoc, qty, trfNotes || undefined);
      if (!res.success) {
        setTrfError(res.error || 'Transfer failed');
      } else {
        setShowTransferModal(false);
        setTrfNotes('');
      }
    } catch (err: any) {
      setTrfError(err?.message || 'Transfer failed');
    } finally {
      setTrfLoading(false);
    }
  };

  const handleCreateRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecLoading(true);
    setRecError(null);
    try {
      const targetMenuItemId = recMenuItemId || menuItems[0]?.id;
      if (!targetMenuItemId || !recName.trim()) {
        setRecError('Menu item and Recipe name are required');
        setRecLoading(false);
        return;
      }
      const res = await createRecipe(targetMenuItemId, recName.trim(), parseInt(recYield, 10) || 1);
      if (!res.success) {
        setRecError(res.error || 'Failed to create recipe');
      } else {
        setShowNewRecipeModal(false);
        setRecName('');
      }
    } catch (err: any) {
      setRecError(err?.message || 'Failed to create recipe');
    } finally {
      setRecLoading(false);
    }
  };

  const handleAddIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecipeForIngredient) return;
    setIngLoading(true);
    setIngError(null);
    try {
      const targetItemId = ingItemId || inventory[0]?.id;
      if (!targetItemId) {
        setIngError('Inventory item required');
        setIngLoading(false);
        return;
      }
      const res = await addRecipeIngredient(
        selectedRecipeForIngredient.id,
        targetItemId,
        parseFloat(ingQuantity) || 0.1,
        ingUom
      );
      if (!res.success) {
        setIngError(res.error || 'Failed to add ingredient');
      } else {
        setShowAddIngredientModal(false);
      }
    } catch (err: any) {
      setIngError(err?.message || 'Failed to add ingredient');
    } finally {
      setIngLoading(false);
    }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewItemLoading(true);
    setNewItemError(null);
    try {
      if (!newItemCode.trim() || !newItemName.trim()) {
        setNewItemError('Item code and name are required');
        setNewItemLoading(false);
        return;
      }
      await api.createInventoryItem({
        itemCode: newItemCode.trim(),
        name: newItemName.trim(),
        category: newItemCategory,
        unitOfMeasure: newItemUom.trim(),
        reorderLevel: parseFloat(newItemReorder) || 10,
        unitCostPaise: parseInt(newItemCostPaise, 10) || 0,
        isActive: true
      });
      await refreshInventoryData();
      setShowNewItemModal(false);
      setNewItemCode('');
      setNewItemName('');
    } catch (err: any) {
      setNewItemError(err?.message || 'Failed to create inventory item');
    } finally {
      setNewItemLoading(false);
    }
  };

  const handleConfirmPO = (e: React.FormEvent) => {
    e.preventDefault();
    const item = poItem || inventory[0];
    if (!item) return;
    createPurchaseOrder(poSupplier, [
      {
        itemId: item.id,
        itemName: item.name,
        quantity: parseFloat(poQty) || 1,
        unitCost: item.unitCost,
        total: (parseFloat(poQty) || 1) * item.unitCost
      }
    ]);
    setShowPOModal(false);
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-[#DDD8C9] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-[#163024]" />
            <h1 className="text-xl font-bold text-[#163024] tracking-tight font-serif">
              Supply Chain, Warehousing & Recipe BOM
            </h1>
          </div>
          <p className="text-xs text-[#687067] mt-0.5">
            Real-time stock ledger, inter-location transfers, multi-warehouse balances, and culinary Bill of Materials.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => refreshInventoryData()}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#F7F4EC] hover:bg-[#DDD8C9]/50 text-[#163024] rounded-xl text-xs font-bold transition-all border border-[#DDD8C9] cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#526B4A]" />
            <span>Sync</span>
          </button>
          <button
            onClick={() => setShowNewItemModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-[#F7F4EC] text-[#163024] border border-[#DDD8C9] rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4 text-[#526B4A]" />
            <span>New SKU</span>
          </button>
          <button
            onClick={() => {
              setMovItemId(inventory[0]?.id || '');
              setMovLocationId(inventoryLocations[0]?.id || '');
              setShowMovementModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#163024] hover:bg-[#0f2219] text-[#F7F4EC] rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            <ArrowDownUp className="w-4 h-4 text-[#C5A86A]" />
            <span>Stock Movement</span>
          </button>
          <button
            onClick={() => {
              setTrfItemId(inventory[0]?.id || '');
              setTrfSourceLocId(inventoryLocations[0]?.id || '');
              setTrfDestLocId(inventoryLocations[1]?.id || '');
              setShowTransferModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#526B4A] hover:bg-[#43573d] text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            <ArrowRightLeft className="w-4 h-4 text-[#C5A86A]" />
            <span>Inter-Store Transfer</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4.5 rounded-2xl border border-[#DDD8C9] shadow-xs">
          <span className="text-[10px] text-[#687067] font-bold uppercase tracking-wider">Total Stock Valuation</span>
          <div className="text-2xl font-bold text-[#163024] font-mono mt-1">
            ₹{(totalValuation ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <span className="text-[11px] text-[#687067]">{inventory.length} active SKUs tracked</span>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-[#DDD8C9] shadow-xs">
          <span className="text-[10px] text-[#687067] font-bold uppercase tracking-wider">Storage Locations</span>
          <div className="text-2xl font-bold text-[#526B4A] font-mono mt-1">
            {inventoryLocations.length} Outlets/Stores
          </div>
          <span className="text-[11px] text-[#526B4A] font-semibold">Central + Kitchen + Bar + Pantry</span>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-[#DDD8C9] shadow-xs">
          <span className="text-[10px] text-[#687067] font-bold uppercase tracking-wider">Low Stock Safety Alerts</span>
          <div className="text-2xl font-bold text-[#C5A86A] font-mono mt-1">
            {lowStockItems.length} Items
          </div>
          <span className="text-[11px] text-[#C5A86A] font-semibold">Below reorder threshold</span>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-[#DDD8C9] shadow-xs">
          <span className="text-[10px] text-[#687067] font-bold uppercase tracking-wider">Culinary BOM Recipes</span>
          <div className="text-2xl font-bold text-[#163024] font-mono mt-1">
            {recipes.length} Standard Recipes
          </div>
          <span className="text-[11px] text-[#526B4A] font-semibold">Linked to live POS menu</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-[#DDD8C9]">
        {[
          { id: 'catalog', label: 'Master Catalog & Balances', icon: Boxes },
          { id: 'locations', label: 'Multi-Location Stock Matrix', icon: Building2 },
          { id: 'movements', label: 'Stock Movements (Inward/Loss)', icon: ArrowDownUp },
          { id: 'transfers', label: 'Inter-Store Transfers', icon: ArrowRightLeft },
          { id: 'recipes', label: 'Recipes & Culinary BOM', icon: ChefHat }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#163024] text-[#F7F4EC] shadow-xs'
                  : 'bg-white text-[#687067] hover:text-[#163024] hover:bg-[#F7F4EC] border border-[#DDD8C9]'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-[#C5A86A]' : 'text-[#526B4A]'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: MASTER CATALOG */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-[#DDD8C9] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2 flex-1 w-full max-w-md px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-xs">
              <Search className="w-4 h-4 text-[#687067]" />
              <input
                type="text"
                placeholder="Search by SKU code, ingredient, raw material..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-transparent outline-none text-[#163024]"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-[#687067]" />
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-xs font-semibold text-[#163024] outline-none cursor-pointer"
              >
                <option value="ALL">All Categories</option>
                <option value="FOOD_GRAINS">Food Grains & Staples</option>
                <option value="DAIRY">Dairy & Cheese</option>
                <option value="MEAT">Poultry, Meat & Seafood</option>
                <option value="LIQUOR">Spirits & Cellar</option>
                <option value="BEVERAGES">Beverages & Mocktails</option>
                <option value="CLEANING">Cleaning & Sanitization</option>
                <option value="LINEN">Housekeeping & Linen</option>
                <option value="OTHER">Other Goods</option>
              </select>
            </div>
          </div>

          {/* Master Catalog Table */}
          <div className="bg-white rounded-2xl border border-[#DDD8C9] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7F4EC] border-b border-[#DDD8C9] text-[#163024] font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3.5">SKU / Code</th>
                    <th className="p-3.5">Item Name</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5">Current Balance</th>
                    <th className="p-3.5">Reorder Level</th>
                    <th className="p-3.5">Unit Cost (₹)</th>
                    <th className="p-3.5">Stock Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDD8C9]/40">
                  {filteredInventory.map(item => (
                    <tr key={item.id} className="hover:bg-[#F7F4EC]/50 transition-colors">
                      <td className="p-3.5 font-mono text-[#526B4A] font-bold">
                        {item.itemCode || `SKU-${item.id.slice(0, 6)}`}
                      </td>
                      <td className="p-3.5 font-bold text-[#163024]">{item.name}</td>
                      <td className="p-3.5 text-[#687067]">{item.category}</td>
                      <td className="p-3.5 font-bold font-mono text-[#163024]">
                        {item.currentStock} {item.unit}
                      </td>
                      <td className="p-3.5 font-mono text-[#687067]">
                        {item.minStockLevel} {item.unit}
                      </td>
                      <td className="p-3.5 font-mono text-[#163024] font-semibold">
                        ₹{item.unitCost.toFixed(2)}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            item.status === 'in-stock'
                              ? 'bg-[#526B4A]/10 text-[#526B4A] border border-[#526B4A]/30'
                              : item.status === 'low-stock'
                              ? 'bg-[#C5A86A]/20 text-[#8c6b2d] border border-[#C5A86A]/40'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {item.status.replace('-', ' ')}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setMovItemId(item.id);
                              setShowMovementModal(true);
                            }}
                            className="px-2.5 py-1 bg-[#F7F4EC] hover:bg-[#DDD8C9]/60 text-[#163024] rounded-lg font-bold text-xs border border-[#DDD8C9] cursor-pointer"
                          >
                            + Move
                          </button>
                          <button
                            onClick={() => {
                              setTrfItemId(item.id);
                              setShowTransferModal(true);
                            }}
                            className="px-2.5 py-1 bg-[#163024] hover:bg-[#0f2219] text-[#F7F4EC] rounded-lg font-bold text-xs cursor-pointer shadow-xs"
                          >
                            Transfer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredInventory.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        No inventory items matching query.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MULTI-LOCATION MATRIX */}
      {activeTab === 'locations' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-[#DDD8C9] space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#DDD8C9] pb-3">
              <div>
                <h3 className="font-bold text-[#163024] text-base font-serif">
                  Multi-Location Inventory Balances
                </h3>
                <p className="text-xs text-[#687067]">
                  Authoritative live stock distribution across central warehouses, restaurant kitchen lines, and hotel pantries.
                </p>
              </div>
              <span className="text-xs font-bold text-[#526B4A] bg-[#526B4A]/10 px-3 py-1 rounded-full border border-[#526B4A]/30">
                {inventoryBalances.length} Live Balances Loaded
              </span>
            </div>

            <div className="overflow-x-auto border border-[#DDD8C9] rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7F4EC] border-b border-[#DDD8C9] text-[#163024] font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-3.5">Storage Location</th>
                    <th className="p-3.5">Item Name / Code</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5 font-mono">Current Quantity</th>
                    <th className="p-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDD8C9]/40 font-mono text-[11px]">
                  {inventoryBalances.map((bal, idx) => (
                    <tr key={bal.id || idx} className="hover:bg-[#F7F4EC]/50">
                      <td className="p-3.5 font-sans font-bold text-[#163024]">
                        {bal.locationName || 'Central Resort Store'}
                      </td>
                      <td className="p-3.5 font-sans text-[#1D241F]">
                        {bal.itemName || 'Inventory Item'}
                      </td>
                      <td className="p-3.5 font-sans text-[#687067]">
                        {bal.category || 'General'}
                      </td>
                      <td className="p-3.5 font-bold text-[#163024]">
                        {bal.currentQuantity} {bal.unitOfMeasure || 'units'}
                      </td>
                      <td className="p-3.5 font-sans">
                        <span className="px-2 py-0.5 bg-[#526B4A]/10 text-[#526B4A] rounded text-[10px] font-bold">
                          Live On-Hand
                        </span>
                      </td>
                    </tr>
                  ))}
                  {inventoryBalances.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400 font-sans">
                        No location balance records found. Click Sync to reconcile from server.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: STOCK MOVEMENTS */}
      {activeTab === 'movements' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-[#DDD8C9] space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#DDD8C9] pb-3">
              <div>
                <h3 className="font-bold text-[#163024] text-base font-serif">
                  Stock Ledger & Authorized Movements
                </h3>
                <p className="text-xs text-[#687067]">
                  Supported movement types: PURCHASE (inward restock), CONSUMPTION (kitchen issue), ADJUSTMENT, WASTAGE (spoilage/breakage), and RETURN.
                </p>
              </div>
              <button
                onClick={() => setShowMovementModal(true)}
                className="px-4 py-2 bg-[#163024] hover:bg-[#0f2219] text-[#F7F4EC] rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                + Record New Movement
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#526B4A]">Inward Procurement (PURCHASE)</span>
                <p className="text-xs text-[#687067]">
                  Receiving supplier shipments, invoice quantities, and unit price reconciliation into warehouse balances.
                </p>
                <button
                  onClick={() => {
                    setMovType('PURCHASE');
                    setShowMovementModal(true);
                  }}
                  className="px-3 py-1.5 bg-[#163024] text-[#F7F4EC] text-xs font-bold rounded-lg cursor-pointer"
                >
                  Log Purchase Inward
                </button>
              </div>

              <div className="p-4 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#9C413D]">Wastage & Spoilage (WASTAGE)</span>
                <p className="text-xs text-[#687067]">
                  Recording food expiry, preparation over-cuts, broken beverage bottles, or quality rejections.
                </p>
                <button
                  onClick={() => {
                    setMovType('WASTAGE');
                    setShowMovementModal(true);
                  }}
                  className="px-3 py-1.5 bg-[#9C413D] text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  Log Spoilage Loss
                </button>
              </div>

              <div className="p-4 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#C5A86A]">Cycle Count (ADJUSTMENT)</span>
                <p className="text-xs text-[#687067]">
                  Physical audit count reconciliations, ledger variance corrections, and stock true-ups.
                </p>
                <button
                  onClick={() => {
                    setMovType('ADJUSTMENT');
                    setShowMovementModal(true);
                  }}
                  className="px-3 py-1.5 bg-[#C5A86A] text-[#163024] text-xs font-bold rounded-lg cursor-pointer"
                >
                  Log Count Adjustment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: INTER-STORE TRANSFERS */}
      {activeTab === 'transfers' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-[#DDD8C9] space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#DDD8C9] pb-3">
              <div>
                <h3 className="font-bold text-[#163024] text-base font-serif">
                  Inter-Location Stock Transfers
                </h3>
                <p className="text-xs text-[#687067]">
                  Atomic stock transfers between storage locations (e.g. Central Store → Main Kitchen Line, or Cellar → Bar).
                </p>
              </div>
              <button
                onClick={() => setShowTransferModal(true)}
                className="px-4 py-2 bg-[#526B4A] hover:bg-[#43573d] text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                + New Inter-Store Transfer
              </button>
            </div>

            <div className="p-4 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-xs text-[#163024] space-y-2">
              <p className="font-bold">Transaction Atomicity Guarantee:</p>
              <p className="text-[#687067]">
                Every transfer executes as a single atomic database transaction generating paired <code className="font-mono text-[#163024]">TRANSFER_OUT</code> and <code className="font-mono text-[#163024]">TRANSFER_IN</code> audit records with balance row locks.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: RECIPES & BOM */}
      {activeTab === 'recipes' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-[#DDD8C9] space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#DDD8C9] pb-3">
              <div>
                <h3 className="font-bold text-[#163024] text-base font-serif">
                  Standard Culinary Recipes & Bill of Materials (BOM)
                </h3>
                <p className="text-xs text-[#687067]">
                  Culinary recipes mapping menu items to raw inventory ingredients, portion yields, and required quantities.
                </p>
              </div>
              <button
                onClick={() => setShowNewRecipeModal(true)}
                className="px-4 py-2 bg-[#163024] hover:bg-[#0f2219] text-[#F7F4EC] rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                + Create Recipe / BOM
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recipes.map(rec => (
                <div key={rec.id} className="p-4.5 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-[#163024] text-sm">{rec.name}</h4>
                      <p className="text-xs text-[#687067] font-mono">
                        Yield: {rec.yieldServings} Serving(s)
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedRecipeForIngredient(rec);
                        setShowAddIngredientModal(true);
                      }}
                      className="px-2.5 py-1 bg-white hover:bg-[#DDD8C9]/40 text-[#163024] rounded-lg text-xs font-bold border border-[#DDD8C9] cursor-pointer"
                    >
                      + Add Ingredient
                    </button>
                  </div>

                  {rec.ingredients && rec.ingredients.length > 0 ? (
                    <div className="space-y-1 pt-2 border-t border-[#DDD8C9]/60">
                      <span className="text-[10px] font-bold uppercase text-[#526B4A]">Required Raw Materials:</span>
                      <ul className="space-y-1 text-xs text-[#163024]">
                        {rec.ingredients.map(ing => (
                          <li key={ing.id} className="flex items-center justify-between py-1 border-b border-[#DDD8C9]/30 font-mono text-[11px]">
                            <span>{ing.inventoryItemName || `Ingredient SKU`}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[#526B4A]">{ing.quantityRequired} {ing.unitOfMeasure}</span>
                              <button
                                onClick={() => removeRecipeIngredient(rec.id, ing.id)}
                                className="text-rose-600 hover:text-rose-800 p-0.5 cursor-pointer"
                                title="Remove ingredient"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic pt-2">No ingredients mapped yet. Click Add Ingredient above.</p>
                  )}
                </div>
              ))}
              {recipes.length === 0 && (
                <div className="col-span-2 p-8 text-center text-slate-400">
                  No recipes configured. Click Create Recipe to link menu items with raw materials.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: RECORD STOCK MOVEMENT */}
      {showMovementModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-2xl border border-[#DDD8C9] p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-[#DDD8C9] pb-3">
              <h3 className="font-bold text-[#163024] text-base font-serif">Record Stock Movement</h3>
              <button onClick={() => setShowMovementModal(false)} className="text-[#687067] hover:text-[#163024]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {movError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs">
                {movError}
              </div>
            )}

            <form onSubmit={handleCreateMovement} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#163024] mb-1">Inventory Item / SKU</label>
                <select
                  value={movItemId}
                  onChange={e => setMovItemId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl outline-none"
                >
                  {inventory.map(i => (
                    <option key={i.id} value={i.id}>{i.name} (Code: {i.itemCode || i.id.slice(0, 6)})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#163024] mb-1">Storage Location</label>
                <select
                  value={movLocationId}
                  onChange={e => setMovLocationId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl outline-none"
                >
                  {inventoryLocations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#163024] mb-1">Movement Type</label>
                  <select
                    value={movType}
                    onChange={e => setMovType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl outline-none font-bold"
                  >
                    <option value="PURCHASE">PURCHASE (Inward)</option>
                    <option value="CONSUMPTION">CONSUMPTION (Issue)</option>
                    <option value="ADJUSTMENT">ADJUSTMENT (Audit)</option>
                    <option value="WASTAGE">WASTAGE (Spoilage)</option>
                    <option value="RETURN">RETURN (Vendor)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#163024] mb-1">Quantity</label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={movQuantity}
                    onChange={e => setMovQuantity(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#163024] mb-1">Audit Notes / Reference</label>
                <input
                  type="text"
                  placeholder="e.g. Invoice #9981 or Chef issue slip"
                  value={movNotes}
                  onChange={e => setMovNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#DDD8C9]">
                <button
                  type="button"
                  onClick={() => setShowMovementModal(false)}
                  className="px-4 py-2 bg-[#F7F4EC] text-[#163024] font-semibold rounded-xl border border-[#DDD8C9]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={movLoading}
                  className="px-4 py-2 bg-[#163024] hover:bg-[#0f2219] text-[#F7F4EC] font-bold rounded-xl shadow-xs disabled:opacity-50"
                >
                  {movLoading ? 'Recording...' : 'Commit Movement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: INTER-LOCATION TRANSFER */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-2xl border border-[#DDD8C9] p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-[#DDD8C9] pb-3">
              <h3 className="font-bold text-[#163024] text-base font-serif">Inter-Store Stock Transfer</h3>
              <button onClick={() => setShowTransferModal(false)} className="text-[#687067] hover:text-[#163024]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {trfError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs">
                {trfError}
              </div>
            )}

            <form onSubmit={handleCreateTransfer} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#163024] mb-1">Select Item to Transfer</label>
                <select
                  value={trfItemId}
                  onChange={e => setTrfItemId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl outline-none"
                >
                  {inventory.map(i => (
                    <option key={i.id} value={i.id}>{i.name} (Code: {i.itemCode || i.id.slice(0, 6)})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#163024] mb-1">Source Location</label>
                  <select
                    value={trfSourceLocId}
                    onChange={e => setTrfSourceLocId(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl outline-none"
                  >
                    {inventoryLocations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#163024] mb-1">Destination Location</label>
                  <select
                    value={trfDestLocId}
                    onChange={e => setTrfDestLocId(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl outline-none"
                  >
                    {inventoryLocations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#163024] mb-1">Transfer Quantity</label>
                <input
                  type="number"
                  step="0.001"
                  required
                  value={trfQuantity}
                  onChange={e => setTrfQuantity(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-[#163024] mb-1">Transfer Reference Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Daily kitchen line replenishment"
                  value={trfNotes}
                  onChange={e => setTrfNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#DDD8C9]">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 bg-[#F7F4EC] text-[#163024] font-semibold rounded-xl border border-[#DDD8C9]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={trfLoading}
                  className="px-4 py-2 bg-[#526B4A] hover:bg-[#43573d] text-white font-bold rounded-xl shadow-xs disabled:opacity-50"
                >
                  {trfLoading ? 'Transferring...' : 'Execute Atomic Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CREATE RECIPE */}
      {showNewRecipeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-2xl border border-[#DDD8C9] p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-[#DDD8C9] pb-3">
              <h3 className="font-bold text-[#163024] text-base font-serif">Create Culinary Recipe (BOM)</h3>
              <button onClick={() => setShowNewRecipeModal(false)} className="text-[#687067] hover:text-[#163024]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {recError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs">
                {recError}
              </div>
            )}

            <form onSubmit={handleCreateRecipe} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#163024] mb-1">Target POS Menu Item</label>
                <select
                  value={recMenuItemId}
                  onChange={e => {
                    setRecMenuItemId(e.target.value);
                    const found = menuItems.find(m => m.id === e.target.value);
                    if (found && !recName) setRecName(`${found.name} Standard Recipe`);
                  }}
                  className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl outline-none"
                >
                  {menuItems.map(m => (
                    <option key={m.id} value={m.id}>{m.name} (₹{m.price})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#163024] mb-1">Recipe Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pali Truffle Risotto BOM"
                  value={recName}
                  onChange={e => setRecName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-[#163024] mb-1">Yield (Servings)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={recYield}
                  onChange={e => setRecYield(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-mono font-bold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#DDD8C9]">
                <button
                  type="button"
                  onClick={() => setShowNewRecipeModal(false)}
                  className="px-4 py-2 bg-[#F7F4EC] text-[#163024] font-semibold rounded-xl border border-[#DDD8C9]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recLoading}
                  className="px-4 py-2 bg-[#163024] hover:bg-[#0f2219] text-[#F7F4EC] font-bold rounded-xl shadow-xs disabled:opacity-50"
                >
                  {recLoading ? 'Creating...' : 'Save Recipe'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: ADD INGREDIENT TO RECIPE */}
      {showAddIngredientModal && selectedRecipeForIngredient && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-2xl border border-[#DDD8C9] p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-[#DDD8C9] pb-3">
              <h3 className="font-bold text-[#163024] text-base font-serif">Add Ingredient to Recipe</h3>
              <button onClick={() => setShowAddIngredientModal(false)} className="text-[#687067] hover:text-[#163024]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {ingError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs">
                {ingError}
              </div>
            )}

            <form onSubmit={handleAddIngredient} className="space-y-3 text-xs">
              <p className="text-xs text-[#526B4A] font-bold">
                Recipe: {selectedRecipeForIngredient.name}
              </p>

              <div>
                <label className="block font-bold text-[#163024] mb-1">Select Raw Material / Ingredient</label>
                <select
                  value={ingItemId}
                  onChange={e => {
                    setIngItemId(e.target.value);
                    const it = inventory.find(i => i.id === e.target.value);
                    if (it) setIngUom(it.unit);
                  }}
                  className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl outline-none"
                >
                  {inventory.map(i => (
                    <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#163024] mb-1">Quantity Required</label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={ingQuantity}
                    onChange={e => setIngQuantity(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#163024] mb-1">Unit of Measure (UOM)</label>
                  <input
                    type="text"
                    required
                    value={ingUom}
                    onChange={e => setIngUom(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#DDD8C9]">
                <button
                  type="button"
                  onClick={() => setShowAddIngredientModal(false)}
                  className="px-4 py-2 bg-[#F7F4EC] text-[#163024] font-semibold rounded-xl border border-[#DDD8C9]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={ingLoading}
                  className="px-4 py-2 bg-[#526B4A] hover:bg-[#43573d] text-white font-bold rounded-xl shadow-xs disabled:opacity-50"
                >
                  {ingLoading ? 'Adding...' : 'Attach Ingredient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: NEW SKU / ITEM */}
      {showNewItemModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-2xl border border-[#DDD8C9] p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-[#DDD8C9] pb-3">
              <h3 className="font-bold text-[#163024] text-base font-serif">Create New SKU / Inventory Item</h3>
              <button onClick={() => setShowNewItemModal(false)} className="text-[#687067] hover:text-[#163024]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {newItemError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs">
                {newItemError}
              </div>
            )}

            <form onSubmit={handleCreateItem} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#163024] mb-1">Item SKU Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. RAW-BASMATI-50"
                    value={newItemCode}
                    onChange={e => setNewItemCode(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#163024] mb-1">Category</label>
                  <select
                    value={newItemCategory}
                    onChange={e => setNewItemCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl outline-none"
                  >
                    <option value="FOOD_GRAINS">Food Grains & Staples</option>
                    <option value="DAIRY">Dairy & Cheese</option>
                    <option value="MEAT">Meat & Seafood</option>
                    <option value="LIQUOR">Spirits & Wine</option>
                    <option value="BEVERAGES">Beverages</option>
                    <option value="CLEANING">Cleaning Supplies</option>
                    <option value="LINEN">Linen & Room Goods</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#163024] mb-1">Item Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Himalayan Aged Basmati Rice 50kg"
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-[#163024] mb-1">UOM</label>
                  <input
                    type="text"
                    required
                    placeholder="kg, ltr, pcs"
                    value={newItemUom}
                    onChange={e => setNewItemUom(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#163024] mb-1">Reorder Level</label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={newItemReorder}
                    onChange={e => setNewItemReorder(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#163024] mb-1">Cost (Paise)</label>
                  <input
                    type="number"
                    required
                    placeholder="15000 = ₹150"
                    value={newItemCostPaise}
                    onChange={e => setNewItemCostPaise(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#DDD8C9]">
                <button
                  type="button"
                  onClick={() => setShowNewItemModal(false)}
                  className="px-4 py-2 bg-[#F7F4EC] text-[#163024] font-semibold rounded-xl border border-[#DDD8C9]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newItemLoading}
                  className="px-4 py-2 bg-[#163024] hover:bg-[#0f2219] text-[#F7F4EC] font-bold rounded-xl shadow-xs disabled:opacity-50"
                >
                  {newItemLoading ? 'Saving...' : 'Register Master SKU'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
