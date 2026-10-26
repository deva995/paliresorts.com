import { MenuItem, MenuCategory } from '../types';

/**
 * Server menu types corresponding to server/src/modules/menu/menu.types.ts
 */
export interface ServerEffectiveMenuItem {
  itemId: string;
  name: string;
  description: string | null;
  effectivePricePaise: number;
  gstRatePercent: number;
  isVegetarian: boolean;
  isVegan: boolean;
  isSpicy: boolean;
  preparationTimeMinutes: number;
  imageUrl: string | null;
  isAvailable: boolean;
  kitchenStationCode: string;
  displayOrder: number;
  category: {
    id: string;
    name: string;
    code: string;
    displayOrder: number;
  };
}

export interface ServerGroupedCategoryMenu {
  id: string;
  name: string;
  code: string;
  displayOrder: number;
  items: ServerEffectiveMenuItem[];
}

export interface ServerOutletMenuResponse {
  outletId: string;
  categories: ServerGroupedCategoryMenu[];
  items: ServerEffectiveMenuItem[];
}

export interface ConvertedOutletMenu {
  categories: MenuCategory[];
  items: MenuItem[];
}

/**
 * Converts the server's outlet menu response into frontend MenuCategory and MenuItem structures.
 */
function extractPortionOptions(name: string, description: string | null): { label: string; price: number }[] | undefined {
  if (description) {
    const match = description.match(/<!--portions:(.*?)-->/);
    if (match) {
      try {
        const parsed = JSON.parse(match[1]);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    const bracketMatch = description.match(/\[Portions:\s*(.*?)\]/);
    if (bracketMatch) {
      const parts = bracketMatch[1].split('|').map(s => s.trim());
      const portions: { label: string; price: number }[] = [];
      for (const part of parts) {
        const pMatch = part.match(/^(.*?):\s*₹?(\d+(?:\.\d+)?)/);
        if (pMatch) {
          portions.push({ label: pMatch[1].trim(), price: parseFloat(pMatch[2]) });
        }
      }
      if (portions.length > 0) return portions;
    }
  }
  return undefined;
}

function cleanDescription(description: string | null): string {
  if (!description) return '';
  return description.replace(/<!--portions:.*?-->/g, '').replace(/\[Portions:\s*.*?\]/g, '').trim();
}

export function convertOutletMenuResponse(response: ServerOutletMenuResponse): ConvertedOutletMenu {
  const items: MenuItem[] = (response.items || []).map((item: ServerEffectiveMenuItem) => {
    if (typeof item.itemId !== 'string' || !item.itemId.trim()) {
      throw new Error('Menu response contains an item without an ID. Refresh the menu and retry.');
    }
    const isDrink =
      item.kitchenStationCode?.toLowerCase().includes('bar') ||
      item.kitchenStationCode?.toLowerCase().includes('bev') ||
      item.category?.name?.toLowerCase().includes('beverage') ||
      item.category?.name?.toLowerCase().includes('drink') ||
      item.category?.name?.toLowerCase().includes('bar') ||
      item.category?.name?.toLowerCase().includes('scotch') ||
      item.category?.name?.toLowerCase().includes('beer') ||
      item.category?.name?.toLowerCase().includes('wine') ||
      item.category?.name?.toLowerCase().includes('cocktail');

    const portionOptions = extractPortionOptions(item.name, item.description);

    return {
      id: item.itemId,
      restaurantId: response.outletId,
      name: item.name,
      categoryId: item.category?.id || '',
      categoryName: item.category?.name || 'General',
      description: cleanDescription(item.description),
      price: item.effectivePricePaise / 100,
      portionOptions,
      isVeg: item.isVegetarian,
      isSpicy: item.isSpicy,
      preparationTimeMinutes: item.preparationTimeMinutes || 15,
      isAvailable: item.isAvailable,
      image: item.imageUrl || '',
      taxRate: item.gstRatePercent,
      menuType: isDrink ? 'drink' : 'food'
    };
  });

  const categories: MenuCategory[] = (response.categories || []).map((cat: ServerGroupedCategoryMenu) => ({
    id: cat.id,
    name: cat.name,
    icon: 'Utensils',
    itemCount: cat.items ? cat.items.length : items.filter(i => i.categoryId === cat.id).length
  }));

  return {
    categories,
    items
  };
}

/**
 * Converts public guest-safe menu response into frontend MenuCategory and MenuItem structures.
 */
export function convertGuestMenuResponse(response: any): ConvertedOutletMenu {
  const rawItems = response?.items || [];
  const rawCats = response?.categories || [];

  const items: MenuItem[] = rawItems.map((item: any) => {
    const isDrink =
      item.category?.toLowerCase?.().includes('beverage') ||
      item.category?.toLowerCase?.().includes('drink') ||
      item.category?.toLowerCase?.().includes('bar') ||
      item.category?.toLowerCase?.().includes('scotch') ||
      item.category?.toLowerCase?.().includes('beer') ||
      item.category?.toLowerCase?.().includes('wine') ||
      item.category?.toLowerCase?.().includes('cocktail');

    const pricePaise = typeof item.price_paise === 'number' ? item.price_paise : (typeof item.pricePaise === 'number' ? item.pricePaise : 0);
    const isVeg = typeof item.is_veg === 'boolean' ? item.is_veg : Boolean(item.isVeg);
    const isAvailable = typeof item.is_available === 'boolean' ? item.is_available : (typeof item.isAvailable === 'boolean' ? item.isAvailable : true);
    const image = item.image || item.imageUrl || '';
    const categoryName = typeof item.category === 'string' ? item.category : (item.category?.name || 'General');
    const categoryId = item.categoryId || item.category_id || categoryName.toLowerCase().replace(/\s+/g, '-');
    const portionOptions = extractPortionOptions(item.name, item.description);

    return {
      id: item.id || item.itemId,
      restaurantId: response.outletId || '',
      name: item.name,
      categoryId,
      categoryName,
      subCategory: item.sectionName || item.section_name || '',
      description: cleanDescription(item.description),
      price: pricePaise / 100,
      portionOptions,
      isVeg,
      isSpicy: Boolean(item.is_spicy || item.isSpicy),
      preparationTimeMinutes: item.preparationTimeMinutes || 15,
      isAvailable,
      image,
      taxRate: 5,
      menuType: isDrink ? 'drink' : 'food'
    };
  });

  const categories: MenuCategory[] = rawCats.map((cat: any) => {
    const catId = typeof cat === 'string' ? cat : (cat.id || cat.name?.toLowerCase().replace(/\s+/g, '-'));
    const catName = typeof cat === 'string' ? cat : (cat.name || 'General');
    return {
      id: catId,
      name: catName,
      icon: 'Utensils',
      itemCount: items.filter(i => i.categoryId === catId || i.categoryName.toLowerCase() === catName.toLowerCase()).length
    };
  });

  return {
    categories,
    items
  };
}
