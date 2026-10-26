import { MenuItem } from '../types';

export interface ResortCategory {
  id: string;
  name: string;
  menuType: 'all' | 'food' | 'drink';
  icon: string;
}

export const RESORT_CATEGORIES: ResortCategory[] = [
  {
    "id": "all",
    "name": "All Items",
    "menuType": "all",
    "icon": "Sparkles"
  },
  {
    "id": "soups",
    "name": "Soups & Shurba",
    "menuType": "food",
    "icon": "Soup"
  },
  {
    "id": "salads-chaats",
    "name": "Salads & Quick Bites",
    "menuType": "food",
    "icon": "Salad"
  },
  {
    "id": "veg-starters",
    "name": "Veg Starters",
    "menuType": "food",
    "icon": "Leaf"
  },
  {
    "id": "non-veg-starters",
    "name": "Non-Veg Starters",
    "menuType": "food",
    "icon": "Flame"
  },
  {
    "id": "seafood",
    "name": "Seafood & Coastal Grills",
    "menuType": "food",
    "icon": "Fish"
  },
  {
    "id": "veg-mains",
    "name": "Royal Veg Main Course",
    "menuType": "food",
    "icon": "CookingPot"
  },
  {
    "id": "non-veg-mains",
    "name": "Royal Non-Veg Main Course",
    "menuType": "food",
    "icon": "ChefHat"
  },
  {
    "id": "breads",
    "name": "Tandoori Breads & Roti",
    "menuType": "food",
    "icon": "Wheat"
  },
  {
    "id": "biryani-rice",
    "name": "Biryani, Rice & Noodles",
    "menuType": "food",
    "icon": "UtensilsCrossed"
  },
  {
    "id": "sweets",
    "name": "Desserts & Sweets",
    "menuType": "food",
    "icon": "IceCream"
  },
  {
    "id": "scotch-whisky",
    "name": "Scotch & Whiskies",
    "menuType": "drink",
    "icon": "GlassWater"
  },
  {
    "id": "beers",
    "name": "Beers & Draft Brews",
    "menuType": "drink",
    "icon": "Beer"
  },
  {
    "id": "wines",
    "name": "Fine Wines & Sparkles",
    "menuType": "drink",
    "icon": "Wine"
  },
  {
    "id": "cocktails",
    "name": "Handcrafted Cocktails",
    "menuType": "drink",
    "icon": "Martini"
  },
  {
    "id": "mocktails",
    "name": "Signature Mocktails",
    "menuType": "drink",
    "icon": "Sparkles"
  },
  {
    "id": "refreshers",
    "name": "Traditional Beverages",
    "menuType": "drink",
    "icon": "CupSoda"
  }
];

export const RESORT_FOOD_MENU: MenuItem[] = [
  {
    "id": "pali-f-1",
    "name": "Cream of Tomato Soup",
    "categoryId": "soups",
    "categoryName": "Soups & Shurba",
    "subCategory": "Vegetarian",
    "description": "Slow-simmered ripe plum tomatoes finished with fresh clotted cream and herb croutons.",
    "price": 250,
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 12,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food",
    "isChefSpecial": false
  },
  {
    "id": "pali-f-2",
    "name": "Cream of Palak Soup",
    "categoryId": "soups",
    "categoryName": "Soups & Shurba",
    "subCategory": "Vegetarian",
    "description": "Velvety farm-fresh spinach puree infused with roasted garlic and light cream.",
    "price": 250,
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 12,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1603105037880-880cd4edfb0d?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food"
  },
  {
    "id": "pali-f-3",
    "name": "Manchow Soup",
    "categoryId": "soups",
    "categoryName": "Soups & Shurba",
    "subCategory": "Indo-Chinese",
    "description": "Dark spicy broth with minced vegetables, ginger, coriander and crispy fried noodles.",
    "price": 220,
    "portionOptions": [
      {
        "label": "Veg",
        "price": 220
      },
      {
        "label": "Chicken",
        "price": 250
      }
    ],
    "isVeg": true,
    "isSpicy": true,
    "preparationTimeMinutes": 15,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1541832676-9b763b0239ab?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food"
  },
  {
    "id": "pali-f-4",
    "name": "Lemon Coriander Soup",
    "categoryId": "soups",
    "categoryName": "Soups & Shurba",
    "subCategory": "Healthy & Clear",
    "description": "Aromatic zesty vegetable broth infused with crushed fresh coriander stems and lemon juice.",
    "price": 220,
    "portionOptions": [
      {
        "label": "Veg",
        "price": 220
      },
      {
        "label": "Chicken",
        "price": 250
      }
    ],
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 12,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food"
  },
  {
    "id": "pali-f-5",
    "name": "Burnt Garlic Soup",
    "categoryId": "soups",
    "categoryName": "Soups & Shurba",
    "subCategory": "Oriental",
    "description": "Hearty broth perfumed with toasted golden garlic, scallions and garden vegetables.",
    "price": 220,
    "portionOptions": [
      {
        "label": "Veg",
        "price": 220
      },
      {
        "label": "Chicken",
        "price": 250
      }
    ],
    "isVeg": true,
    "isSpicy": true,
    "preparationTimeMinutes": 14,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1616501268209-edfa99066605?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food"
  },
  {
    "id": "pali-f-6",
    "name": "Hot & Sour Soup",
    "categoryId": "soups",
    "categoryName": "Soups & Shurba",
    "subCategory": "Oriental",
    "description": "Piquant broth with bamboo shoots, mushrooms, tofu/chicken and cracked pepper.",
    "price": 220,
    "portionOptions": [
      {
        "label": "Veg",
        "price": 220
      },
      {
        "label": "Chicken",
        "price": 250
      }
    ],
    "isVeg": true,
    "isSpicy": true,
    "preparationTimeMinutes": 14,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1547592180-85f173990554?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food"
  },
  {
    "id": "pali-f-7",
    "name": "Paya Soup",
    "categoryId": "soups",
    "categoryName": "Soups & Shurba",
    "subCategory": "Resort Specialty",
    "description": "Rich, slow-cooked mutton trotters stew simmered overnight with authentic Awadhi spices.",
    "price": 340,
    "isVeg": false,
    "isSpicy": true,
    "preparationTimeMinutes": 18,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food",
    "isChefSpecial": true
  },
  {
    "id": "pali-f-8",
    "name": "Green Salad",
    "categoryId": "salads-chaats",
    "categoryName": "Salads & Quick Bites",
    "subCategory": "Garden Fresh",
    "description": "Crisp sliced garden cucumber, juicy tomatoes, carrot, onion rings and green chillies with fresh lemon.",
    "price": 190,
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 8,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food"
  },
  {
    "id": "pali-f-9",
    "name": "Peanut / Peanut Chaat",
    "categoryId": "salads-chaats",
    "categoryName": "Salads & Quick Bites",
    "subCategory": "Bar Snack",
    "description": "Crunchy roasted peanuts tossed with finely chopped onions, tomatoes, coriander and chaat masala.",
    "price": 90,
    "portionOptions": [
      {
        "label": "Roasted Peanut",
        "price": 90
      },
      {
        "label": "Peanut Chaat",
        "price": 210
      }
    ],
    "isVeg": true,
    "isSpicy": true,
    "preparationTimeMinutes": 8,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food"
  },
  {
    "id": "pali-f-10",
    "name": "Chana Garlic Fry",
    "categoryId": "salads-chaats",
    "categoryName": "Salads & Quick Bites",
    "subCategory": "Crispy Snack",
    "description": "Crispy fried chickpeas tossed with crushed burnt garlic cloves, curry leaves and roasted chili salt.",
    "price": 230,
    "isVeg": true,
    "isSpicy": true,
    "preparationTimeMinutes": 10,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food"
  },
  {
    "id": "pali-f-11",
    "name": "Masala Papad",
    "categoryId": "salads-chaats",
    "categoryName": "Salads & Quick Bites",
    "subCategory": "Traditional",
    "description": "Crispy roasted papad topped with diced tomatoes, onions, green chili and spicy tangy seasoning.",
    "price": 70,
    "portionOptions": [
      {
        "label": "Roasted Papad",
        "price": 50
      },
      {
        "label": "Masala Papad",
        "price": 70
      }
    ],
    "isVeg": true,
    "isSpicy": true,
    "preparationTimeMinutes": 6,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food"
  },
  {
    "id": "pali-f-12",
    "name": "Khicha Masala Papad",
    "categoryId": "salads-chaats",
    "categoryName": "Salads & Quick Bites",
    "subCategory": "Village Specialty",
    "description": "Thick Gujarati rice papad fried golden and seasoned with onion, tomato, and pungent sev.",
    "price": 110,
    "portionOptions": [
      {
        "label": "Plain Khicha",
        "price": 90
      },
      {
        "label": "Khicha Masala",
        "price": 110
      }
    ],
    "isVeg": true,
    "isSpicy": true,
    "preparationTimeMinutes": 8,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food"
  },
  {
    "id": "pali-f-13",
    "name": "Finger Chips",
    "categoryId": "salads-chaats",
    "categoryName": "Salads & Quick Bites",
    "subCategory": "Continental",
    "description": "Golden crisp potato fries lightly salted, served with herb mayonnaise and tomato salsa.",
    "price": 240,
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 10,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1576107232684-1279f3908594?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food"
  },
  {
    "id": "pali-f-14",
    "name": "Chana Chaat",
    "categoryId": "salads-chaats",
    "categoryName": "Salads & Quick Bites",
    "subCategory": "Chaat Bazaar",
    "description": "Boiled kabuli chana spiced with green chutney, imli pulp, diced potatoes, and pomegranate pearls.",
    "price": 230,
    "isVeg": true,
    "isSpicy": true,
    "preparationTimeMinutes": 8,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food"
  },
  {
    "id": "pali-f-15",
    "name": "Margherita Pizza",
    "categoryId": "pizza-pasta",
    "categoryName": "Artisan Pizza & Pasta",
    "subCategory": "Wood-Fired Style",
    "description": "Classic stone-baked hand-stretched crust with San Marzano tomato puree and shredded mozzarella.",
    "price": 410,
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 18,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food"
  },
  {
    "id": "pali-f-16",
    "name": "Paneer Tikka Pizza",
    "categoryId": "pizza-pasta",
    "categoryName": "Artisan Pizza & Pasta",
    "subCategory": "Fusion Italian",
    "description": "Tandoori grilled spiced cottage cheese, crunchy bell peppers, red onions and molten mozzarella.",
    "price": 450,
    "isVeg": true,
    "isSpicy": true,
    "preparationTimeMinutes": 20,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food",
    "isChefSpecial": true
  },
  {
    "id": "pali-f-17",
    "name": "Chicken Tikka Pizza",
    "categoryId": "pizza-pasta",
    "categoryName": "Artisan Pizza & Pasta",
    "subCategory": "Fusion Italian",
    "description": "Clay oven roasted chicken tikka cubes, capsicum, pickled jalapenos and melted mozzarella.",
    "price": 470,
    "isVeg": false,
    "isSpicy": true,
    "preparationTimeMinutes": 20,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food",
    "isChefSpecial": true
  },
  {
    "id": "pali-f-18",
    "name": "Classic Pasta (Red / White Sauce)",
    "categoryId": "pizza-pasta",
    "categoryName": "Artisan Pizza & Pasta",
    "subCategory": "Italian",
    "description": "Penne rigate tossed in your choice of rich Arrabiata spiced tomato or creamy Alfredo sauce with olives.",
    "price": 460,
    "portionOptions": [
      {
        "label": "White Sauce (Alfredo)",
        "price": 460
      },
      {
        "label": "Red Sauce (Arrabiata)",
        "price": 460
      }
    ],
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 16,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1621996346565-e3d5d628169e?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food"
  },
  {
    "id": "pali-f-19",
    "name": "Cheese Corn Balls",
    "categoryId": "veg-starters",
    "categoryName": "Vegetarian Starters",
    "subCategory": "Crispy Appetizer",
    "description": "Golden breaded dumplings stuffed with molten cheddar, mozzarella and sweet American corn kernels.",
    "price": 340,
    "portionOptions": [
      {
        "label": "Cheese Balls",
        "price": 320
      },
      {
        "label": "Cheese Corn Balls",
        "price": 340
      }
    ],
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 14,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food"
  },
  {
    "id": "pali-f-20",
    "name": "Veg. Hara Bhara Kebab",
    "categoryId": "veg-starters",
    "categoryName": "Vegetarian Starters",
    "subCategory": "Tandoor",
    "description": "Delicate patties of minced spinach, green peas and mashed potatoes shallow fried with cashew nut crown.",
    "price": 310,
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 14,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food"
  },
  {
    "id": "pali-f-21",
    "name": "Veg. Bruschetta",
    "categoryId": "veg-starters",
    "categoryName": "Vegetarian Starters",
    "subCategory": "Continental",
    "description": "Toasted sourdough baguette rounds topped with garlic-infused diced tomatoes, basil chiffonade and olive oil.",
    "price": 410,
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 12,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food"
  },
  {
    "id": "pali-f-22",
    "name": "Cheese Garlic / Chilli Toast",
    "categoryId": "veg-starters",
    "categoryName": "Vegetarian Starters",
    "subCategory": "Grill",
    "description": "Oven baked crusty bread layered with garlic butter, green chillies and bubbling melted cheese.",
    "price": 330,
    "portionOptions": [
      {
        "label": "Cheese Garlic Toast",
        "price": 320
      },
      {
        "label": "Cheese Chilli Toast",
        "price": 330
      }
    ],
    "isVeg": true,
    "isSpicy": true,
    "preparationTimeMinutes": 10,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food"
  },
  {
    "id": "pali-f-23",
    "name": "Veg. Manchurian Dry",
    "categoryId": "veg-starters",
    "categoryName": "Vegetarian Starters",
    "subCategory": "Indo-Chinese",
    "description": "Crispy vegetable florets wok-tossed in dark soya, garlic, ginger and spring onions.",
    "price": 390,
    "isVeg": true,
    "isSpicy": true,
    "preparationTimeMinutes": 15,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1541832676-9b763b0239ab?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food"
  },
  {
    "id": "pali-f-24",
    "name": "Veg. Crispy",
    "categoryId": "veg-starters",
    "categoryName": "Vegetarian Starters",
    "subCategory": "Indo-Chinese",
    "description": "Battered assorted seasonal vegetables fried crackling crisp and tossed in sweet and tangy chilli glaze.",
    "price": 410,
    "isVeg": true,
    "isSpicy": true,
    "preparationTimeMinutes": 14,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food"
  },
  {
    "id": "pali-f-25",
    "name": "Paneer in Choice of Sauce",
    "categoryId": "veg-starters",
    "categoryName": "Vegetarian Starters",
    "subCategory": "Indo-Chinese",
    "description": "Succulent cottage cheese cubes tossed in your choice of Schezwan, Hot Garlic, or Black Bean reduction.",
    "price": 450,
    "isVeg": true,
    "isSpicy": true,
    "preparationTimeMinutes": 15,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food"
  },
  {
    "id": "pali-f-26",
    "name": "Paneer Banjara Tikka",
    "categoryId": "veg-starters",
    "categoryName": "Vegetarian Starters",
    "subCategory": "Tandoor",
    "description": "Fresh paneer blocks marinated in pungent mustard oil, crushed yellow spices and char-grilled in tandoor.",
    "price": 470,
    "isVeg": true,
    "isSpicy": true,
    "preparationTimeMinutes": 18,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food",
    "isChefSpecial": true
  },
  {
    "id": "pali-f-27",
    "name": "Paneer Pali Top",
    "categoryId": "veg-starters",
    "categoryName": "Vegetarian Starters",
    "subCategory": "Resort Signature",
    "description": "Chef's signature stuffed paneer medallions layered with dry fruits, mint chutney and cheese glaze.",
    "price": 470,
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 20,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food",
    "isChefSpecial": true
  },
  {
    "id": "pali-f-28",
    "name": "Paneer Malai Tikka",
    "categoryId": "veg-starters",
    "categoryName": "Vegetarian Starters",
    "subCategory": "Tandoor",
    "description": "Velvety cottage cheese soaked in malai cream, cashew paste, cardamom and white pepper, broiled softly.",
    "price": 470,
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 18,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food"
  },
  {
    "id": "pali-f-29",
    "name": "Mix Veg. Platter",
    "categoryId": "veg-starters",
    "categoryName": "Vegetarian Starters",
    "subCategory": "Grand Banquet",
    "description": "Grand feast of Paneer Malai, Banjara Tikka, Hara Bhara Kebab, Tandoori Aloo and Gobi served on sizzling platter.",
    "price": 1350,
    "isVeg": true,
    "isSpicy": true,
    "preparationTimeMinutes": 25,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food",
    "isChefSpecial": true
  },
  {
    "id": "pali-f-30",
    "name": "Chicken Koliwada",
    "categoryId": "non-veg-starters",
    "categoryName": "Non-Veg Starters",
    "subCategory": "Mumbai Fishermen Style",
    "description": "Crispy spiced chicken bites coated in carom seed and red chili batter, flash fried to perfection.",
    "price": 410,
    "isVeg": false,
    "isSpicy": true,
    "preparationTimeMinutes": 15,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1562967914-608f82629710?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food",
    "isChefSpecial": true
  },
  {
    "id": "pali-f-31",
    "name": "Chicken Junglee Tikka",
    "categoryId": "non-veg-starters",
    "categoryName": "Non-Veg Starters",
    "subCategory": "Tandoor",
    "description": "Rustic whole-spice marinated boneless chicken thigh pieces smoked over hot charcoal embers.",
    "price": 470,
    "isVeg": false,
    "isSpicy": true,
    "preparationTimeMinutes": 18,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food"
  },
  {
    "id": "pali-f-32",
    "name": "Chicken Malai Tikka",
    "categoryId": "non-veg-starters",
    "categoryName": "Non-Veg Starters",
    "subCategory": "Tandoor",
    "description": "Tender chicken breasts steeped in clotted cream, cardamom, roasted garlic and aromatic cheese.",
    "price": 470,
    "isVeg": false,
    "isSpicy": false,
    "preparationTimeMinutes": 18,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food"
  },
  {
    "id": "pali-f-33",
    "name": "Chicken Pahadi Kebab",
    "categoryId": "non-veg-starters",
    "categoryName": "Non-Veg Starters",
    "subCategory": "Himalayan Herbs",
    "description": "Chicken pieces infused with crushed mint, fresh coriander, green chilies and mountain herbs.",
    "price": 470,
    "isVeg": false,
    "isSpicy": true,
    "preparationTimeMinutes": 18,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food"
  },
  {
    "id": "pali-f-34",
    "name": "Tandoori Chicken",
    "categoryId": "non-veg-starters",
    "categoryName": "Non-Veg Starters",
    "subCategory": "Royal Tandoor",
    "description": "Classic whole chicken on the bone marinated in spiced hung yogurt, roasted red chili and roasted cumin.",
    "price": 360,
    "portionOptions": [
      {
        "label": "Half Tandoori",
        "price": 360
      },
      {
        "label": "Full Tandoori",
        "price": 610
      }
    ],
    "isVeg": false,
    "isSpicy": true,
    "preparationTimeMinutes": 22,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food",
    "isChefSpecial": true
  },
  {
    "id": "pali-f-35",
    "name": "Chicken Lollipop",
    "categoryId": "non-veg-starters",
    "categoryName": "Non-Veg Starters",
    "subCategory": "Indo-Chinese",
    "description": "Crispy fried winglets shaped as lollipops tossed with spicy garlic Schezwan dip.",
    "price": 470,
    "isVeg": false,
    "isSpicy": true,
    "preparationTimeMinutes": 16,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1562967914-608f82629710?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food"
  },
  {
    "id": "pali-f-36",
    "name": "Mutton Seekh Kebab",
    "categoryId": "non-veg-starters",
    "categoryName": "Non-Veg Starters",
    "subCategory": "Mughlai Heritage",
    "description": "Minced goat meat delicately seasoned with brown onions, mint, ginger and skewered over embers.",
    "price": 570,
    "isVeg": false,
    "isSpicy": true,
    "preparationTimeMinutes": 20,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food",
    "isChefSpecial": true
  },
  {
    "id": "pali-f-37",
    "name": "Mutton Chaap Dry",
    "categoryId": "non-veg-starters",
    "categoryName": "Non-Veg Starters",
    "subCategory": "Royal Specialty",
    "description": "Tender mutton ribs roasted dry with crushed black pepper, cloves, ghee and fresh curry leaves.",
    "price": 560,
    "isVeg": false,
    "isSpicy": true,
    "preparationTimeMinutes": 22,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food"
  },
  {
    "id": "pali-f-38",
    "name": "Prawns Tawa / Koliwada",
    "categoryId": "seafood",
    "categoryName": "Seafood & Coastal Grills",
    "subCategory": "Fresh Catch",
    "description": "Fresh sea prawns pan-seared with coastal crushed spices, curry leaves and kokum extract.",
    "price": 710,
    "portionOptions": [
      {
        "label": "Tawa Fry",
        "price": 710
      },
      {
        "label": "Tandoori Prawns",
        "price": 710
      },
      {
        "label": "Koliwada Fry",
        "price": 710
      }
    ],
    "isVeg": false,
    "isSpicy": true,
    "preparationTimeMinutes": 18,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1559742811-822873691df8?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food",
    "isChefSpecial": true
  },
  {
    "id": "pali-f-39",
    "name": "Surmai Tawa Fry",
    "categoryId": "seafood",
    "categoryName": "Seafood & Coastal Grills",
    "subCategory": "Kingfish",
    "description": "Kingfish darne marinated with Malvani masala, semolina crusted and crisp fried on iron griddle.",
    "price": 710,
    "isVeg": false,
    "isSpicy": true,
    "preparationTimeMinutes": 18,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food",
    "isChefSpecial": true
  },
  {
    "id": "pali-f-40",
    "name": "Bombil Fry",
    "categoryId": "seafood",
    "categoryName": "Seafood & Coastal Grills",
    "subCategory": "Bombay Duck",
    "description": "Fresh tender Bombay duck fish rawa coated and crisp fried golden with lime and mint.",
    "price": 410,
    "isVeg": false,
    "isSpicy": true,
    "preparationTimeMinutes": 15,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1534939561126-855b8675edd7?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food"
  },
  {
    "id": "pali-f-41",
    "name": "Pomfret (Tawa / Tandoor)",
    "categoryId": "seafood",
    "categoryName": "Seafood & Coastal Grills",
    "subCategory": "Silver Pomfret",
    "description": "Whole silver pomfret slit and coated with red chili-garlic paste, roasted in tandoor or tawa.",
    "price": 750,
    "isVeg": false,
    "isSpicy": true,
    "preparationTimeMinutes": 22,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food",
    "isChefSpecial": true
  },
  {
    "id": "pali-f-42",
    "name": "Seafood Platter",
    "categoryId": "seafood",
    "categoryName": "Seafood & Coastal Grills",
    "subCategory": "Grand Banquet",
    "description": "Magnificent coastal platter: Surmai fry, Bombil fry, Tawa prawns and stuffed crab with signature dips.",
    "price": 2550,
    "isVeg": false,
    "isSpicy": true,
    "preparationTimeMinutes": 28,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1559742811-822873691df8?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food",
    "isChefSpecial": true
  },
  {
    "id": "pali-f-43",
    "name": "Non-Veg Platter",
    "categoryId": "seafood",
    "categoryName": "Seafood & Coastal Grills",
    "subCategory": "Grand Banquet",
    "description": "Chef's curated spread of Tandoori Chicken, Chicken Malai, Mutton Seekh and Chicken Koliwada.",
    "price": 1650,
    "isVeg": false,
    "isSpicy": true,
    "preparationTimeMinutes": 25,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food",
    "isChefSpecial": true
  },
  {
    "id": "pali-f-44",
    "name": "Paneer Butter Masala",
    "categoryId": "veg-mains",
    "categoryName": "Royal Veg Main Course",
    "subCategory": "Rich Gravy",
    "description": "Fresh cottage cheese simmered in a velvety ripe tomato reduction, finished with churned butter and kasoori methi.",
    "price": 470,
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 16,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food",
    "isChefSpecial": true
  },
  {
    "id": "pali-f-45",
    "name": "Veg. Kolhapuri",
    "categoryId": "veg-mains",
    "categoryName": "Royal Veg Main Course",
    "subCategory": "Spicy Regional",
    "description": "Assorted garden veggies cooked in a fiery roasted coconut, sesame and dried red chili Kolhapuri gravy.",
    "price": 390,
    "isVeg": true,
    "isSpicy": true,
    "preparationTimeMinutes": 16,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food"
  },
  {
    "id": "pali-f-46",
    "name": "Veg. Handi",
    "categoryId": "veg-mains",
    "categoryName": "Royal Veg Main Course",
    "subCategory": "Earthen Pot",
    "description": "Seasonal vegetables, paneer and baby corn cooked slowly in an aromatic brown onion and cashew gravy.",
    "price": 370,
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 18,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food"
  },
  {
    "id": "pali-f-47",
    "name": "Paneer Tikka Masala",
    "categoryId": "veg-mains",
    "categoryName": "Royal Veg Main Course",
    "subCategory": "Tandoor Gravy",
    "description": "Charbroiled paneer tikka tossed in a spicy, chunky onion-tomato gravy with roasted coriander seeds.",
    "price": 460,
    "isVeg": true,
    "isSpicy": true,
    "preparationTimeMinutes": 18,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food"
  },
  {
    "id": "pali-f-48",
    "name": "Dal Makhani / Dal Tadka",
    "categoryId": "veg-mains",
    "categoryName": "Royal Veg Main Course",
    "subCategory": "Lentils",
    "description": "Slow-simmered black urad dal cooked overnight with butter or yellow toor dal tempered with cumin, garlic and ghee.",
    "price": 250,
    "portionOptions": [
      {
        "label": "Dal Fry",
        "price": 240
      },
      {
        "label": "Dal Tadka",
        "price": 250
      },
      {
        "label": "Dal Makhani",
        "price": 310
      }
    ],
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 14,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food",
    "isChefSpecial": true
  },
  {
    "id": "pali-f-49",
    "name": "Butter Chicken",
    "categoryId": "non-veg-mains",
    "categoryName": "Royal Non-Veg Main Course",
    "subCategory": "Mughlai Royalty",
    "description": "Tandoori shredded chicken steeped in silky smoked tomato butter gravy with honey and fenugreek leaves.",
    "price": 470,
    "portionOptions": [
      {
        "label": "One Portion",
        "price": 470
      },
      {
        "label": "Half Handi",
        "price": 780
      },
      {
        "label": "Full Handi",
        "price": 1350
      }
    ],
    "isVeg": false,
    "isSpicy": false,
    "preparationTimeMinutes": 18,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food",
    "isChefSpecial": true
  },
  {
    "id": "pali-f-50",
    "name": "Chicken Tikka Masala",
    "categoryId": "non-veg-mains",
    "categoryName": "Royal Non-Veg Main Course",
    "subCategory": "Tandoor Gravy",
    "description": "Tandoor roasted boneless chicken tikka cooked in rich onion, tomato and crushed coriander seed gravy.",
    "price": 470,
    "isVeg": false,
    "isSpicy": true,
    "preparationTimeMinutes": 18,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food"
  },
  {
    "id": "pali-f-51",
    "name": "Chicken Handi",
    "categoryId": "non-veg-mains",
    "categoryName": "Royal Non-Veg Main Course",
    "subCategory": "Earthen Pot",
    "description": "Farm chicken simmered on dum inside clay handi with rich yogurt, roasted cumin and brown cashew gravy.",
    "price": 830,
    "portionOptions": [
      {
        "label": "Half Handi",
        "price": 830
      },
      {
        "label": "Full Handi",
        "price": 1490
      }
    ],
    "isVeg": false,
    "isSpicy": true,
    "preparationTimeMinutes": 22,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food",
    "isChefSpecial": true
  },
  {
    "id": "pali-f-52",
    "name": "Mutton Rogan Josh",
    "categoryId": "non-veg-mains",
    "categoryName": "Royal Non-Veg Main Course",
    "subCategory": "Kashmiri Classic",
    "description": "Prime cuts of goat meat braised with aromatic Kashmiri dried chilies, fennel, ginger and saffron broth.",
    "price": 590,
    "isVeg": false,
    "isSpicy": true,
    "preparationTimeMinutes": 22,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1545247181-516773cae754?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food",
    "isChefSpecial": true
  },
  {
    "id": "pali-f-53",
    "name": "Mutton Handi",
    "categoryId": "non-veg-mains",
    "categoryName": "Royal Non-Veg Main Course",
    "subCategory": "Earthen Pot",
    "description": "Slow cooked tender mutton shank and shoulder in traditional rustic masala handi with bone marrow juices.",
    "price": 950,
    "portionOptions": [
      {
        "label": "Half Handi",
        "price": 950
      },
      {
        "label": "Full Handi",
        "price": 1650
      }
    ],
    "isVeg": false,
    "isSpicy": true,
    "preparationTimeMinutes": 25,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food",
    "isChefSpecial": true
  },
  {
    "id": "pali-f-54",
    "name": "Surmai Masala",
    "categoryId": "non-veg-mains",
    "categoryName": "Royal Non-Veg Main Course",
    "subCategory": "Coastal Curries",
    "description": "Fresh Kingfish steaks gently simmered in Konkani spiced coconut and kokum curry.",
    "price": 740,
    "isVeg": false,
    "isSpicy": true,
    "preparationTimeMinutes": 20,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food"
  },
  {
    "id": "pali-f-55",
    "name": "Prawns Masala",
    "categoryId": "non-veg-mains",
    "categoryName": "Royal Non-Veg Main Course",
    "subCategory": "Coastal Curries",
    "description": "Succulent ocean prawns simmered in fiery red coastal gravy infused with roasted spices.",
    "price": 740,
    "isVeg": false,
    "isSpicy": true,
    "preparationTimeMinutes": 18,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1559742811-822873691df8?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food",
    "isChefSpecial": true
  },
  {
    "id": "pali-f-56",
    "name": "Butter Naan / Garlic Naan",
    "categoryId": "breads",
    "categoryName": "Tandoori Breads & Roti",
    "subCategory": "Clay Oven",
    "description": "Fine flour bread baked on the hot clay oven walls, brushed with churned dairy butter or roasted garlic.",
    "price": 70,
    "portionOptions": [
      {
        "label": "Roti",
        "price": 40
      },
      {
        "label": "Butter Naan",
        "price": 70
      },
      {
        "label": "Garlic Naan",
        "price": 90
      },
      {
        "label": "Cheese Garlic Naan",
        "price": 150
      }
    ],
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 8,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food"
  },
  {
    "id": "pali-f-57",
    "name": "Tandoori Roti / Chapati",
    "categoryId": "breads",
    "categoryName": "Tandoori Breads & Roti",
    "subCategory": "Whole Wheat",
    "description": "Fresh whole wheat flatbread baked in the tandoor or roasted on home-style iron griddle.",
    "price": 40,
    "portionOptions": [
      {
        "label": "Chapati",
        "price": 40
      },
      {
        "label": "Tandoori Roti",
        "price": 40
      },
      {
        "label": "Butter Roti",
        "price": 50
      }
    ],
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 6,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food"
  },
  {
    "id": "pali-f-58",
    "name": "Chicken Dum Biryani",
    "categoryId": "biryani-rice",
    "categoryName": "Biryani, Rice & Noodles",
    "subCategory": "Royal Dum Pukht",
    "description": "Fragrant long-grain aged Basmati rice layered with spiced chicken, caramelized onions, mint and saffron milk.",
    "price": 450,
    "isVeg": false,
    "isSpicy": true,
    "preparationTimeMinutes": 22,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food",
    "isChefSpecial": true
  },
  {
    "id": "pali-f-59",
    "name": "Mutton Dum Biryani",
    "categoryId": "biryani-rice",
    "categoryName": "Biryani, Rice & Noodles",
    "subCategory": "Royal Dum Pukht",
    "description": "Tender pieces of goat meat marinated in curd and shahi spices, sealed and dum cooked under puff pastry.",
    "price": 510,
    "isVeg": false,
    "isSpicy": true,
    "preparationTimeMinutes": 25,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food",
    "isChefSpecial": true
  },
  {
    "id": "pali-f-60",
    "name": "Prawns Biryani",
    "categoryId": "biryani-rice",
    "categoryName": "Biryani, Rice & Noodles",
    "subCategory": "Seafood Dum",
    "description": "Juicy ocean prawns cooked with fragrant aromatic spices and infused basmati rice.",
    "price": 710,
    "isVeg": false,
    "isSpicy": true,
    "preparationTimeMinutes": 22,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food",
    "isChefSpecial": true
  },
  {
    "id": "pali-f-61",
    "name": "Veg. Dum Biryani",
    "categoryId": "biryani-rice",
    "categoryName": "Biryani, Rice & Noodles",
    "subCategory": "Vegetarian Dum",
    "description": "Seasonal vegetables and paneer cubes cooked on slow dum with aromatic spices and saffron rice.",
    "price": 370,
    "isVeg": true,
    "isSpicy": true,
    "preparationTimeMinutes": 20,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food"
  },
  {
    "id": "pali-f-62",
    "name": "Veg Hakka Noodles / Schezwan",
    "categoryId": "biryani-rice",
    "categoryName": "Biryani, Rice & Noodles",
    "subCategory": "Indo-Chinese",
    "description": "Wok-tossed noodles with shredded cabbage, bell peppers, carrots and scallions with spicy Schezwan sauce.",
    "price": 340,
    "portionOptions": [
      {
        "label": "Hakka Noodles",
        "price": 340
      },
      {
        "label": "Schezwan Noodles",
        "price": 350
      }
    ],
    "isVeg": true,
    "isSpicy": true,
    "preparationTimeMinutes": 14,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food"
  },
  {
    "id": "pali-f-63",
    "name": "Chicken Hakka Noodles / Schezwan",
    "categoryId": "biryani-rice",
    "categoryName": "Biryani, Rice & Noodles",
    "subCategory": "Indo-Chinese",
    "description": "Wok-tossed noodles with julienned chicken, scrambled egg and crunchy greens.",
    "price": 350,
    "portionOptions": [
      {
        "label": "Hakka Noodles",
        "price": 350
      },
      {
        "label": "Schezwan Noodles",
        "price": 370
      }
    ],
    "isVeg": false,
    "isSpicy": true,
    "preparationTimeMinutes": 15,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food"
  },
  {
    "id": "pali-f-64",
    "name": "Jalebi with Rabdi",
    "categoryId": "sweets",
    "categoryName": "Desserts & Sweets",
    "subCategory": "Royal Confection",
    "description": "Crispy golden spirals fried fresh in desi ghee and steeped in saffron syrup, served with thick chilled malai rabdi.",
    "price": 210,
    "portionOptions": [
      {
        "label": "Jalebi Only",
        "price": 190
      },
      {
        "label": "Jalebi with Rabdi",
        "price": 210
      }
    ],
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 10,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food",
    "isChefSpecial": true
  },
  {
    "id": "pali-f-65",
    "name": "Gulab Jamun",
    "categoryId": "sweets",
    "categoryName": "Desserts & Sweets",
    "subCategory": "Traditional Warm",
    "description": "Warm golden milk dumpling soaked in rose-cardamom perfumed sugar syrup.",
    "price": 150,
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 8,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food"
  },
  {
    "id": "pali-f-66",
    "name": "Caramel Custard",
    "categoryId": "sweets",
    "categoryName": "Desserts & Sweets",
    "subCategory": "Resort Signature",
    "description": "Silky baked vanilla bean egg custard draped with golden amber caramel syrup.",
    "price": 210,
    "isVeg": false,
    "isSpicy": false,
    "preparationTimeMinutes": 8,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food",
    "isChefSpecial": true
  },
  {
    "id": "pali-f-67",
    "name": "Matka Kulfi",
    "categoryId": "sweets",
    "categoryName": "Desserts & Sweets",
    "subCategory": "Frozen Delight",
    "description": "Traditional slow-churned clotted milk ice cream studded with pistachios, saffron and green cardamom.",
    "price": 190,
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 5,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "food"
  }
];

export const RESORT_DRINK_MENU: MenuItem[] = [
  {
    "id": "pali-d-1",
    "name": "Chivas Regal (12 Year)",
    "categoryId": "scotch-whisky",
    "categoryName": "Scotch & Whiskies",
    "subCategory": "Blended Scotch",
    "description": "A radiant warm amber blend of the finest malt and grain Scotch whiskies matured for at least 12 years.",
    "price": 450,
    "portionOptions": [
      {
        "label": "30ml Peg",
        "price": 450
      },
      {
        "label": "60ml Peg",
        "price": 850
      }
    ],
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 5,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=600&auto=format&fit=crop&q=80",
    "taxRate": 10,
    "menuType": "drink",
    "isChefSpecial": true
  },
  {
    "id": "pali-d-2",
    "name": "Johnnie Walker Black Label",
    "categoryId": "scotch-whisky",
    "categoryName": "Scotch & Whiskies",
    "subCategory": "Blended Scotch",
    "description": "Iconic rich, smooth blend of whiskies matured for 12 years from the four corners of Scotland with subtle peat smoke.",
    "price": 450,
    "portionOptions": [
      {
        "label": "30ml Peg",
        "price": 450
      },
      {
        "label": "60ml Peg",
        "price": 850
      }
    ],
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 5,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=600&auto=format&fit=crop&q=80",
    "taxRate": 10,
    "menuType": "drink"
  },
  {
    "id": "pali-d-3",
    "name": "Jack Daniel's Old No. 7",
    "categoryId": "scotch-whisky",
    "categoryName": "Scotch & Whiskies",
    "subCategory": "Tennessee Whiskey",
    "description": "Charcoal mellowed drop by drop through 10 feet of sugar maple charcoal, matured in handcrafted white oak barrels.",
    "price": 410,
    "portionOptions": [
      {
        "label": "30ml Peg",
        "price": 410
      },
      {
        "label": "60ml Peg",
        "price": 820
      }
    ],
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 5,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=600&auto=format&fit=crop&q=80",
    "taxRate": 10,
    "menuType": "drink"
  },
  {
    "id": "pali-d-4",
    "name": "Jameson Irish Whiskey",
    "categoryId": "scotch-whisky",
    "categoryName": "Scotch & Whiskies",
    "subCategory": "Irish Whiskey",
    "description": "Triple distilled pot still and fine grain whiskey, offering notes of vanilla, spice and roasted oak.",
    "price": 310,
    "portionOptions": [
      {
        "label": "30ml Peg",
        "price": 310
      },
      {
        "label": "60ml Peg",
        "price": 560
      }
    ],
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 5,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=600&auto=format&fit=crop&q=80",
    "taxRate": 10,
    "menuType": "drink"
  },
  {
    "id": "pali-d-5",
    "name": "Black Dog Triple Gold Reserve",
    "categoryId": "scotch-whisky",
    "categoryName": "Scotch & Whiskies",
    "subCategory": "Deluxe Scotch",
    "description": "Triple reserve blended scotch expertly crafted and rested in Oloroso sherry butts for exceptional depth.",
    "price": 310,
    "portionOptions": [
      {
        "label": "30ml Peg",
        "price": 310
      },
      {
        "label": "60ml Peg",
        "price": 590
      }
    ],
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 5,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=600&auto=format&fit=crop&q=80",
    "taxRate": 10,
    "menuType": "drink"
  },
  {
    "id": "pali-d-6",
    "name": "Blenders Pride Reserve",
    "categoryId": "scotch-whisky",
    "categoryName": "Scotch & Whiskies",
    "subCategory": "Domestic Premium",
    "description": "Rich blend of imported scotch malts and selected Indian grain spirits with smoky oak and honey undertones.",
    "price": 190,
    "portionOptions": [
      {
        "label": "30ml Peg",
        "price": 190
      },
      {
        "label": "60ml Peg",
        "price": 290
      }
    ],
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 5,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=600&auto=format&fit=crop&q=80",
    "taxRate": 10,
    "menuType": "drink"
  },
  {
    "id": "pali-d-7",
    "name": "Bira 91 White Pitcher",
    "categoryId": "beers",
    "categoryName": "Beers & Draft Brews",
    "subCategory": "Craft Wheat Beer",
    "description": "Low bitterness wheat beer with a hint of spicy citrus and coriander, served ice cold in 1500ml sharing pitcher.",
    "price": 800,
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 5,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1608270119365-c3359d99723a?w=600&auto=format&fit=crop&q=80",
    "taxRate": 10,
    "menuType": "drink",
    "isChefSpecial": true
  },
  {
    "id": "pali-d-8",
    "name": "Budweiser Magnum (650ml)",
    "categoryId": "beers",
    "categoryName": "Beers & Draft Brews",
    "subCategory": "American Lager",
    "description": "Crisp, clean and refreshing beechwood aged lager brewed for maximum smoothness.",
    "price": 360,
    "portionOptions": [
      {
        "label": "Mild (650ml)",
        "price": 360
      },
      {
        "label": "Magnum Strong (650ml)",
        "price": 370
      }
    ],
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 5,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1608270119365-c3359d99723a?w=600&auto=format&fit=crop&q=80",
    "taxRate": 10,
    "menuType": "drink"
  },
  {
    "id": "pali-d-9",
    "name": "Corona Extra (330ml)",
    "categoryId": "beers",
    "categoryName": "Beers & Draft Brews",
    "subCategory": "Imported Mexican",
    "description": "Golden Mexican lager served traditionally with a fresh slice of lime wedged in the neck.",
    "price": 380,
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 4,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1608270119365-c3359d99723a?w=600&auto=format&fit=crop&q=80",
    "taxRate": 10,
    "menuType": "drink",
    "isChefSpecial": true
  },
  {
    "id": "pali-d-10",
    "name": "Hoegaarden Belgian Wheat",
    "categoryId": "beers",
    "categoryName": "Beers & Draft Brews",
    "subCategory": "Imported Belgian",
    "description": "Authentic Belgian witbier naturally cloudy with orange peel and coriander aromatics.",
    "price": 380,
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 4,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1608270119365-c3359d99723a?w=600&auto=format&fit=crop&q=80",
    "taxRate": 10,
    "menuType": "drink"
  },
  {
    "id": "pali-d-11",
    "name": "Sula Cabernet Shiraz",
    "categoryId": "wines",
    "categoryName": "Fine Wines & Sparkles",
    "subCategory": "Red Wine",
    "description": "Medium-bodied ruby red wine boasting aromas of dark cherries, blackberry and warm peppery oak.",
    "price": 270,
    "portionOptions": [
      {
        "label": "By Glass",
        "price": 270
      },
      {
        "label": "Pint (375ml)",
        "price": 790
      },
      {
        "label": "Bottle (750ml)",
        "price": 1450
      }
    ],
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 5,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600&auto=format&fit=crop&q=80",
    "taxRate": 10,
    "menuType": "drink",
    "isChefSpecial": true
  },
  {
    "id": "pali-d-12",
    "name": "Sula Chenin Blanc",
    "categoryId": "wines",
    "categoryName": "Fine Wines & Sparkles",
    "subCategory": "White Wine",
    "description": "Delightful semi-dry white wine loaded with tropical pineapple, green apple and pear bouquets.",
    "price": 280,
    "portionOptions": [
      {
        "label": "By Glass",
        "price": 280
      },
      {
        "label": "Pint (375ml)",
        "price": 790
      },
      {
        "label": "Bottle (750ml)",
        "price": 1440
      }
    ],
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 5,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600&auto=format&fit=crop&q=80",
    "taxRate": 10,
    "menuType": "drink"
  },
  {
    "id": "pali-d-13",
    "name": "Sula Brut Tropical Champagne",
    "categoryId": "wines",
    "categoryName": "Fine Wines & Sparkles",
    "subCategory": "Sparkling Wine",
    "description": "Fine sparkling wine with persistent effervescent beads, passion fruit and white floral highlights.",
    "price": 2250,
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 5,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600&auto=format&fit=crop&q=80",
    "taxRate": 10,
    "menuType": "drink"
  },
  {
    "id": "pali-d-14",
    "name": "Long Island Iced Tea (LIIT)",
    "categoryId": "cocktails",
    "categoryName": "Handcrafted Cocktails",
    "subCategory": "High Octane",
    "description": "Potent blend of 5 white spirits (Vodka, Gin, Tequila, White Rum, Triple Sec) with fresh lime juice and a dash of cola.",
    "price": 530,
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 7,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=600&auto=format&fit=crop&q=80",
    "taxRate": 10,
    "menuType": "drink",
    "isChefSpecial": true
  },
  {
    "id": "pali-d-15",
    "name": "Blue Lagoon",
    "categoryId": "cocktails",
    "categoryName": "Handcrafted Cocktails",
    "subCategory": "Tropical",
    "description": "Premium vodka, vibrant Blue Cura\u00e7ao, freshly squeezed lime juice and crisp lemon-lime soda over crushed ice.",
    "price": 410,
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 6,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&auto=format&fit=crop&q=80",
    "taxRate": 10,
    "menuType": "drink"
  },
  {
    "id": "pali-d-16",
    "name": "Pi\u00f1a Colada",
    "categoryId": "cocktails",
    "categoryName": "Handcrafted Cocktails",
    "subCategory": "Tropical Cream",
    "description": "Smooth Caribbean white rum, farm fresh pineapple juice, rich coconut cream and vanilla bean gelato.",
    "price": 330,
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 6,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1546171753-97d7676e4602?w=600&auto=format&fit=crop&q=80",
    "taxRate": 10,
    "menuType": "drink",
    "isChefSpecial": true
  },
  {
    "id": "pali-d-17",
    "name": "Bull Frog",
    "categoryId": "cocktails",
    "categoryName": "Handcrafted Cocktails",
    "subCategory": "Party Signature",
    "description": "5 white spirits, blue cura\u00e7ao, cubed ice, fresh lime and topped with an ice cold can of Red Bull energy.",
    "price": 580,
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 8,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=600&auto=format&fit=crop&q=80",
    "taxRate": 10,
    "menuType": "drink",
    "isChefSpecial": true
  },
  {
    "id": "pali-d-18",
    "name": "Tequila Sunrise",
    "categoryId": "cocktails",
    "categoryName": "Handcrafted Cocktails",
    "subCategory": "Classics",
    "description": "Silver tequila and vodka poured over chilled Florida orange juice with a ruby layer of grenadine syrup.",
    "price": 490,
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 6,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1536935338788-846bb9981813?w=600&auto=format&fit=crop&q=80",
    "taxRate": 10,
    "menuType": "drink"
  },
  {
    "id": "pali-d-19",
    "name": "Classic Margarita",
    "categoryId": "cocktails",
    "categoryName": "Handcrafted Cocktails",
    "subCategory": "Classics",
    "description": "Mexican agave tequila, triple sec, fresh lime sour, shaken hard and served in a salted rim glass.",
    "price": 470,
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 6,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1556881286-fc6915169721?w=600&auto=format&fit=crop&q=80",
    "taxRate": 10,
    "menuType": "drink"
  },
  {
    "id": "pali-d-20",
    "name": "Delight of Pali Village",
    "categoryId": "mocktails",
    "categoryName": "Signature Mocktails & Coolers",
    "subCategory": "House Specialty",
    "description": "Alphonso mango, Valencia orange & pineapple juice blended with mango vanilla ice-cream, peach-apricot crush topped with exotic litchi.",
    "price": 280,
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 7,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1556881286-fc6915169721?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "drink",
    "isChefSpecial": true
  },
  {
    "id": "pali-d-21",
    "name": "Madhu Milan",
    "categoryId": "mocktails",
    "categoryName": "Signature Mocktails & Coolers",
    "subCategory": "Resort Specialty",
    "description": "Golden pineapple & mango nectar, pure forest honey, clotted vanilla bean cream and diced seasonal fruits.",
    "price": 230,
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 6,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1546171753-97d7676e4602?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "drink",
    "isChefSpecial": true
  },
  {
    "id": "pali-d-22",
    "name": "Fruit Punch",
    "categoryId": "mocktails",
    "categoryName": "Signature Mocktails & Coolers",
    "subCategory": "Tropical",
    "description": "Orange, pineapple and mango juice shaken with strawberry puree and topped with a scoop of vanilla ice-cream.",
    "price": 230,
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 6,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "drink"
  },
  {
    "id": "pali-d-23",
    "name": "Cupid's Mischief",
    "categoryId": "mocktails",
    "categoryName": "Signature Mocktails & Coolers",
    "subCategory": "Sweet & Silky",
    "description": "Pressed crisp apple juice infused with vanilla ice-cream and topped with whole lychee fruit.",
    "price": 230,
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 6,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1536935338788-846bb9981813?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "drink"
  },
  {
    "id": "pali-d-24",
    "name": "Spicy Guava Cooler",
    "categoryId": "mocktails",
    "categoryName": "Signature Mocktails & Coolers",
    "subCategory": "Piquant Indian",
    "description": "Ripe pink guava nectar seasoned with lime juice, black rock salt, cracked pepper and red chili spiced rim.",
    "price": 220,
    "isVeg": true,
    "isSpicy": true,
    "preparationTimeMinutes": 5,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "drink",
    "isChefSpecial": true
  },
  {
    "id": "pali-d-25",
    "name": "Cinderella",
    "categoryId": "mocktails",
    "categoryName": "Signature Mocktails & Coolers",
    "subCategory": "Sparkling",
    "description": "Sparkling combination of orange juice, ruby grenadine syrup and bubbly iced club soda with mint leaves.",
    "price": 210,
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 5,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "drink"
  },
  {
    "id": "pali-d-26",
    "name": "Matka Chaas",
    "categoryId": "refreshers",
    "categoryName": "Traditional Beverages",
    "subCategory": "Cooling Buttermilk",
    "description": "Churned probiotic curd tempered with roasted cumin seeds, ginger, rock salt and fresh coriander served in clay matka.",
    "price": 60,
    "portionOptions": [
      {
        "label": "Glass",
        "price": 60
      },
      {
        "label": "Earthen Matka",
        "price": 310
      }
    ],
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 4,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "drink"
  },
  {
    "id": "pali-d-27",
    "name": "Punjabi Malai Lassi",
    "categoryId": "refreshers",
    "categoryName": "Traditional Beverages",
    "subCategory": "Sweet Lassi",
    "description": "Thick sweet yogurt churned velvety smooth, crowned with clotted malai and crushed cardamom.",
    "price": 110,
    "portionOptions": [
      {
        "label": "Glass",
        "price": 110
      },
      {
        "label": "Earthen Matka",
        "price": 390
      }
    ],
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 5,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "drink"
  },
  {
    "id": "pali-d-28",
    "name": "Fresh Lime Soda / Water",
    "categoryId": "refreshers",
    "categoryName": "Traditional Beverages",
    "subCategory": "Citrus Cooler",
    "description": "Freshly squeezed lime juice with your choice of chilled club soda or mountain spring water, sweet or salted.",
    "price": 60,
    "portionOptions": [
      {
        "label": "Sweet",
        "price": 60
      },
      {
        "label": "Salted",
        "price": 60
      },
      {
        "label": "Mixed (Sweet & Salt)",
        "price": 60
      }
    ],
    "isVeg": true,
    "isSpicy": false,
    "preparationTimeMinutes": 4,
    "isAvailable": true,
    "image": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80",
    "taxRate": 5,
    "menuType": "drink"
  }
];

export const RESORT_ALL_MENU: MenuItem[] = [...RESORT_FOOD_MENU, ...RESORT_DRINK_MENU];
