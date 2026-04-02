import { Plant } from '@/types/garden';

export const plants: Plant[] = [
  // VEGETABLES
  { id: 'tomato', name: 'Tomato', emoji: '🍅', category: 'vegetable', spacingCm: 60, companions: ['basil', 'carrot', 'parsley', 'marigold'], enemies: ['cabbage', 'fennel', 'potato'], rotationGroup: 'solanaceae', sowIndoors: 'Feb-Mar', harvest: 'Jul-Oct', daysToHarvest: 80, yieldPerPlant: '4-5 kg' },
  { id: 'carrot', name: 'Carrot', emoji: '🥕', category: 'vegetable', spacingCm: 10, companions: ['onion', 'leek', 'rosemary', 'sage'], enemies: ['dill'], rotationGroup: 'roots', sowOutdoors: 'Mar-Jul', harvest: 'Jun-Oct', daysToHarvest: 75, yieldPerPlant: '0.1 kg' },
  { id: 'potato', name: 'Potato', emoji: '🥔', category: 'vegetable', spacingCm: 40, companions: ['bean', 'pea', 'horseradish'], enemies: ['tomato', 'cucumber', 'sunflower'], rotationGroup: 'solanaceae', sowOutdoors: 'Mar-Apr', harvest: 'Jun-Sep', daysToHarvest: 90, yieldPerPlant: '1-2 kg' },
  { id: 'onion', name: 'Onion', emoji: '🧅', category: 'vegetable', spacingCm: 15, companions: ['carrot', 'beetroot', 'lettuce'], enemies: ['bean', 'pea'], rotationGroup: 'alliums', sowOutdoors: 'Mar-Apr', harvest: 'Jul-Sep', daysToHarvest: 100, yieldPerPlant: '0.15 kg' },
  { id: 'lettuce', name: 'Lettuce', emoji: '🥬', category: 'vegetable', spacingCm: 25, companions: ['carrot', 'radish', 'strawberry', 'chive'], enemies: [], rotationGroup: 'leafy', sowOutdoors: 'Mar-Aug', harvest: 'May-Oct', daysToHarvest: 50, yieldPerPlant: '0.3 kg' },
  { id: 'pea', name: 'Pea', emoji: '🟢', category: 'vegetable', spacingCm: 8, companions: ['carrot', 'turnip', 'radish', 'cucumber'], enemies: ['onion', 'garlic'], rotationGroup: 'legumes', sowOutdoors: 'Mar-Jun', harvest: 'Jun-Aug', daysToHarvest: 65, yieldPerPlant: '0.2 kg' },
  { id: 'bean', name: 'Bean', emoji: '🫘', category: 'vegetable', spacingCm: 15, companions: ['carrot', 'cucumber', 'cabbage', 'lettuce'], enemies: ['onion', 'garlic', 'fennel'], rotationGroup: 'legumes', sowOutdoors: 'May-Jul', harvest: 'Jul-Oct', daysToHarvest: 60, yieldPerPlant: '0.5 kg' },
  { id: 'courgette', name: 'Courgette', emoji: '🥒', category: 'vegetable', spacingCm: 90, companions: ['bean', 'sweetcorn', 'nasturtium'], enemies: ['potato'], rotationGroup: 'cucurbits', sowIndoors: 'Apr', harvest: 'Jul-Oct', daysToHarvest: 50, yieldPerPlant: '3-4 kg' },
  { id: 'cucumber', name: 'Cucumber', emoji: '🥒', category: 'vegetable', spacingCm: 45, companions: ['bean', 'pea', 'sunflower', 'lettuce'], enemies: ['potato', 'sage'], rotationGroup: 'cucurbits', sowIndoors: 'Apr', harvest: 'Jul-Sep', daysToHarvest: 55, yieldPerPlant: '2-3 kg' },
  { id: 'pepper', name: 'Pepper', emoji: '🌶️', category: 'vegetable', spacingCm: 45, companions: ['basil', 'carrot', 'onion'], enemies: ['fennel'], rotationGroup: 'solanaceae', sowIndoors: 'Feb-Mar', harvest: 'Jul-Oct', daysToHarvest: 75, yieldPerPlant: '1-2 kg' },
  { id: 'cabbage', name: 'Cabbage', emoji: '🥬', category: 'vegetable', spacingCm: 45, companions: ['bean', 'celery', 'onion', 'dill'], enemies: ['strawberry', 'tomato'], rotationGroup: 'brassicas', sowIndoors: 'Feb-Mar', harvest: 'Jun-Nov', daysToHarvest: 80, yieldPerPlant: '1-2 kg' },
  { id: 'broccoli', name: 'Broccoli', emoji: '🥦', category: 'vegetable', spacingCm: 45, companions: ['celery', 'onion', 'potato', 'dill'], enemies: ['strawberry', 'tomato'], rotationGroup: 'brassicas', sowIndoors: 'Feb-Apr', harvest: 'Jun-Nov', daysToHarvest: 85, yieldPerPlant: '0.5 kg' },
  { id: 'cauliflower', name: 'Cauliflower', emoji: '🤍', category: 'vegetable', spacingCm: 60, companions: ['bean', 'celery', 'onion'], enemies: ['strawberry', 'tomato'], rotationGroup: 'brassicas', sowIndoors: 'Jan-Apr', harvest: 'Jun-Nov', daysToHarvest: 90, yieldPerPlant: '0.6 kg' },
  { id: 'spinach', name: 'Spinach', emoji: '🍃', category: 'vegetable', spacingCm: 15, companions: ['strawberry', 'pea', 'bean'], enemies: [], rotationGroup: 'leafy', sowOutdoors: 'Mar-Sep', harvest: 'May-Nov', daysToHarvest: 40, yieldPerPlant: '0.2 kg' },
  { id: 'kale', name: 'Kale', emoji: '🥗', category: 'vegetable', spacingCm: 45, companions: ['beetroot', 'celery', 'onion'], enemies: ['strawberry'], rotationGroup: 'brassicas', sowOutdoors: 'Apr-Jun', harvest: 'Sep-Mar', daysToHarvest: 65, yieldPerPlant: '0.5 kg' },
  { id: 'radish', name: 'Radish', emoji: '🔴', category: 'vegetable', spacingCm: 5, companions: ['lettuce', 'pea', 'nasturtium', 'chervil'], enemies: ['hyssop'], rotationGroup: 'roots', sowOutdoors: 'Mar-Sep', harvest: 'Apr-Oct', daysToHarvest: 25, yieldPerPlant: '0.03 kg' },
  { id: 'beetroot', name: 'Beetroot', emoji: '🟣', category: 'vegetable', spacingCm: 10, companions: ['onion', 'lettuce', 'cabbage'], enemies: ['bean'], rotationGroup: 'roots', sowOutdoors: 'Mar-Jul', harvest: 'Jun-Nov', daysToHarvest: 60, yieldPerPlant: '0.15 kg' },
  { id: 'sweetcorn', name: 'Sweet Corn', emoji: '🌽', category: 'vegetable', spacingCm: 35, companions: ['bean', 'courgette', 'cucumber', 'pea'], enemies: ['tomato'], rotationGroup: 'other', sowOutdoors: 'May', harvest: 'Aug-Sep', daysToHarvest: 80, yieldPerPlant: '1-2 cobs' },
  { id: 'garlic', name: 'Garlic', emoji: '🧄', category: 'vegetable', spacingCm: 15, companions: ['carrot', 'tomato', 'beetroot'], enemies: ['bean', 'pea'], rotationGroup: 'alliums', sowOutdoors: 'Oct-Nov', harvest: 'Jun-Jul', daysToHarvest: 240, yieldPerPlant: '0.05 kg' },
  { id: 'leek', name: 'Leek', emoji: '🟢', category: 'vegetable', spacingCm: 15, companions: ['carrot', 'celery', 'onion'], enemies: ['bean', 'pea'], rotationGroup: 'alliums', sowIndoors: 'Jan-Mar', harvest: 'Sep-Mar', daysToHarvest: 120, yieldPerPlant: '0.3 kg' },
  { id: 'celery', name: 'Celery', emoji: '🥬', category: 'vegetable', spacingCm: 25, companions: ['bean', 'cabbage', 'leek', 'tomato'], enemies: [], rotationGroup: 'other', sowIndoors: 'Mar-Apr', harvest: 'Aug-Dec', daysToHarvest: 120, yieldPerPlant: '0.5 kg' },
  { id: 'turnip', name: 'Turnip', emoji: '🤍', category: 'vegetable', spacingCm: 15, companions: ['pea'], enemies: [], rotationGroup: 'brassicas', sowOutdoors: 'Mar-Aug', harvest: 'May-Nov', daysToHarvest: 50, yieldPerPlant: '0.2 kg' },
  { id: 'parsnip', name: 'Parsnip', emoji: '🤎', category: 'vegetable', spacingCm: 15, companions: ['pea', 'potato', 'radish'], enemies: ['carrot', 'celery'], rotationGroup: 'roots', sowOutdoors: 'Feb-May', harvest: 'Oct-Mar', daysToHarvest: 120, yieldPerPlant: '0.3 kg' },
  { id: 'swede', name: 'Swede', emoji: '🟤', category: 'vegetable', spacingCm: 25, companions: ['pea'], enemies: [], rotationGroup: 'brassicas', sowOutdoors: 'May-Jun', harvest: 'Oct-Feb', daysToHarvest: 90, yieldPerPlant: '0.5 kg' },
  { id: 'asparagus', name: 'Asparagus', emoji: '🌿', category: 'vegetable', spacingCm: 45, companions: ['tomato', 'parsley', 'basil'], enemies: ['onion', 'garlic'], rotationGroup: 'other', sowOutdoors: 'Apr', harvest: 'Apr-Jun', daysToHarvest: 730, yieldPerPlant: '0.25 kg' },
  { id: 'pumpkin', name: 'Pumpkin', emoji: '🎃', category: 'vegetable', spacingCm: 120, companions: ['sweetcorn', 'bean'], enemies: ['potato'], rotationGroup: 'cucurbits', sowIndoors: 'Apr', harvest: 'Sep-Oct', daysToHarvest: 100, yieldPerPlant: '5-10 kg' },
  { id: 'aubergine', name: 'Aubergine', emoji: '🍆', category: 'vegetable', spacingCm: 60, companions: ['bean', 'pepper', 'spinach'], enemies: [], rotationGroup: 'solanaceae', sowIndoors: 'Feb-Mar', harvest: 'Jul-Oct', daysToHarvest: 85, yieldPerPlant: '2-3 kg' },
  { id: 'brussels-sprout', name: 'Brussels Sprout', emoji: '🟢', category: 'vegetable', spacingCm: 60, companions: ['bean', 'celery', 'onion'], enemies: ['strawberry'], rotationGroup: 'brassicas', sowIndoors: 'Mar-Apr', harvest: 'Oct-Feb', daysToHarvest: 120, yieldPerPlant: '0.5 kg' },
  { id: 'spring-onion', name: 'Spring Onion', emoji: '🧅', category: 'vegetable', spacingCm: 5, companions: ['carrot', 'lettuce'], enemies: ['bean', 'pea'], rotationGroup: 'alliums', sowOutdoors: 'Mar-Sep', harvest: 'May-Nov', daysToHarvest: 40, yieldPerPlant: '0.03 kg' },
  { id: 'chard', name: 'Swiss Chard', emoji: '🌈', category: 'vegetable', spacingCm: 30, companions: ['bean', 'cabbage', 'onion'], enemies: [], rotationGroup: 'leafy', sowOutdoors: 'Apr-Jul', harvest: 'Jun-Nov', daysToHarvest: 55, yieldPerPlant: '0.5 kg' },

  // FRUITS
  { id: 'strawberry', name: 'Strawberry', emoji: '🍓', category: 'fruit', spacingCm: 35, companions: ['lettuce', 'spinach', 'bean', 'borage'], enemies: ['cabbage', 'broccoli'], rotationGroup: 'other', sowOutdoors: 'Apr-May', harvest: 'Jun-Sep', daysToHarvest: 60, yieldPerPlant: '0.4 kg' },
  { id: 'raspberry', name: 'Raspberry', emoji: '🫐', category: 'fruit', spacingCm: 50, companions: ['garlic', 'marigold'], enemies: ['potato'], rotationGroup: 'other', sowOutdoors: 'Nov-Mar', harvest: 'Jun-Oct', daysToHarvest: 365, yieldPerPlant: '1 kg' },
  { id: 'blueberry', name: 'Blueberry', emoji: '🫐', category: 'fruit', spacingCm: 120, companions: ['strawberry'], enemies: [], rotationGroup: 'other', sowOutdoors: 'Nov-Mar', harvest: 'Jul-Sep', daysToHarvest: 730, yieldPerPlant: '2-4 kg' },
  { id: 'gooseberry', name: 'Gooseberry', emoji: '🟢', category: 'fruit', spacingCm: 120, companions: ['tomato'], enemies: [], rotationGroup: 'other', sowOutdoors: 'Nov-Mar', harvest: 'Jun-Aug', daysToHarvest: 365, yieldPerPlant: '2-4 kg' },
  { id: 'blackcurrant', name: 'Blackcurrant', emoji: '⚫', category: 'fruit', spacingCm: 150, companions: [], enemies: [], rotationGroup: 'other', sowOutdoors: 'Nov-Mar', harvest: 'Jul-Aug', daysToHarvest: 365, yieldPerPlant: '3-5 kg' },
  { id: 'rhubarb', name: 'Rhubarb', emoji: '🔴', category: 'fruit', spacingCm: 90, companions: ['garlic'], enemies: [], rotationGroup: 'other', sowOutdoors: 'Nov-Mar', harvest: 'Apr-Jun', daysToHarvest: 365, yieldPerPlant: '2-3 kg' },
  { id: 'apple', name: 'Apple (dwarf)', emoji: '🍎', category: 'fruit', spacingCm: 200, companions: ['chive', 'nasturtium'], enemies: ['potato'], rotationGroup: 'other', harvest: 'Aug-Oct', daysToHarvest: 1095, yieldPerPlant: '10-20 kg' },
  { id: 'melon', name: 'Melon', emoji: '🍈', category: 'fruit', spacingCm: 90, companions: ['sweetcorn', 'sunflower'], enemies: [], rotationGroup: 'cucurbits', sowIndoors: 'Apr', harvest: 'Aug-Sep', daysToHarvest: 85, yieldPerPlant: '2-4 fruits' },
  { id: 'grape', name: 'Grape', emoji: '🍇', category: 'fruit', spacingCm: 180, companions: ['basil', 'bean'], enemies: [], rotationGroup: 'other', harvest: 'Sep-Oct', daysToHarvest: 730, yieldPerPlant: '3-5 kg' },
  { id: 'fig', name: 'Fig', emoji: '🟤', category: 'fruit', spacingCm: 300, companions: [], enemies: [], rotationGroup: 'other', harvest: 'Aug-Oct', daysToHarvest: 1095, yieldPerPlant: '5-15 kg' },

  // HERBS
  { id: 'basil', name: 'Basil', emoji: '🌿', category: 'herb', spacingCm: 20, companions: ['tomato', 'pepper', 'oregano'], enemies: ['sage'], rotationGroup: 'other', sowIndoors: 'Mar-May', harvest: 'Jun-Oct', daysToHarvest: 30, yieldPerPlant: '0.1 kg' },
  { id: 'parsley', name: 'Parsley', emoji: '🌿', category: 'herb', spacingCm: 20, companions: ['tomato', 'asparagus', 'carrot'], enemies: [], rotationGroup: 'other', sowOutdoors: 'Mar-Jul', harvest: 'Jun-Nov', daysToHarvest: 70, yieldPerPlant: '0.1 kg' },
  { id: 'rosemary', name: 'Rosemary', emoji: '🌿', category: 'herb', spacingCm: 60, companions: ['carrot', 'bean', 'cabbage', 'sage'], enemies: [], rotationGroup: 'other', sowOutdoors: 'Apr-May', harvest: 'Year-round', daysToHarvest: 90, yieldPerPlant: '0.2 kg' },
  { id: 'thyme', name: 'Thyme', emoji: '🌿', category: 'herb', spacingCm: 30, companions: ['cabbage', 'strawberry', 'tomato'], enemies: [], rotationGroup: 'other', sowOutdoors: 'Apr-Jun', harvest: 'Year-round', daysToHarvest: 90, yieldPerPlant: '0.1 kg' },
  { id: 'mint', name: 'Mint', emoji: '🍃', category: 'herb', spacingCm: 45, companions: ['cabbage', 'tomato', 'pea'], enemies: [], rotationGroup: 'other', sowOutdoors: 'Mar-May', harvest: 'May-Oct', daysToHarvest: 30, yieldPerPlant: '0.2 kg', notes: 'Invasive — grow in containers!' },
  { id: 'chive', name: 'Chive', emoji: '🌱', category: 'herb', spacingCm: 15, companions: ['carrot', 'tomato', 'apple'], enemies: ['bean', 'pea'], rotationGroup: 'alliums', sowOutdoors: 'Mar-May', harvest: 'Mar-Nov', daysToHarvest: 60, yieldPerPlant: '0.1 kg' },
  { id: 'coriander', name: 'Coriander', emoji: '🌿', category: 'herb', spacingCm: 15, companions: ['spinach', 'lettuce'], enemies: ['fennel'], rotationGroup: 'other', sowOutdoors: 'Mar-Sep', harvest: 'May-Nov', daysToHarvest: 40, yieldPerPlant: '0.05 kg' },
  { id: 'dill', name: 'Dill', emoji: '🌿', category: 'herb', spacingCm: 25, companions: ['cabbage', 'lettuce', 'onion', 'cucumber'], enemies: ['carrot'], rotationGroup: 'other', sowOutdoors: 'Apr-Jul', harvest: 'Jun-Oct', daysToHarvest: 45, yieldPerPlant: '0.05 kg' },
  { id: 'sage', name: 'Sage', emoji: '🌿', category: 'herb', spacingCm: 45, companions: ['rosemary', 'carrot', 'cabbage'], enemies: ['cucumber', 'basil'], rotationGroup: 'other', sowOutdoors: 'Apr-May', harvest: 'Year-round', daysToHarvest: 75, yieldPerPlant: '0.1 kg' },
  { id: 'oregano', name: 'Oregano', emoji: '🌿', category: 'herb', spacingCm: 30, companions: ['tomato', 'pepper', 'basil'], enemies: [], rotationGroup: 'other', sowOutdoors: 'Apr-Jun', harvest: 'Jun-Oct', daysToHarvest: 60, yieldPerPlant: '0.1 kg' },
  { id: 'lavender', name: 'Lavender', emoji: '💜', category: 'herb', spacingCm: 45, companions: ['rosemary', 'thyme'], enemies: [], rotationGroup: 'other', sowOutdoors: 'Apr-May', harvest: 'Jun-Aug', daysToHarvest: 90, yieldPerPlant: '0.05 kg' },
  { id: 'fennel', name: 'Fennel', emoji: '🌿', category: 'herb', spacingCm: 30, companions: [], enemies: ['tomato', 'bean', 'coriander', 'dill'], rotationGroup: 'other', sowOutdoors: 'Apr-Jul', harvest: 'Aug-Oct', daysToHarvest: 65, yieldPerPlant: '0.3 kg', notes: 'Antagonistic to many plants — isolate!' },
  { id: 'borage', name: 'Borage', emoji: '💙', category: 'herb', spacingCm: 45, companions: ['strawberry', 'tomato', 'courgette'], enemies: [], rotationGroup: 'other', sowOutdoors: 'Apr-Jun', harvest: 'Jun-Sep', daysToHarvest: 55, yieldPerPlant: 'Flowers' },

  // FLOWERS (companion planting)
  { id: 'marigold', name: 'Marigold', emoji: '🌼', category: 'flower', spacingCm: 20, companions: ['tomato', 'pepper', 'potato', 'bean'], enemies: [], rotationGroup: 'other', sowOutdoors: 'Apr-May', harvest: 'Jun-Oct', daysToHarvest: 50, notes: 'Repels aphids & whitefly' },
  { id: 'nasturtium', name: 'Nasturtium', emoji: '🧡', category: 'flower', spacingCm: 30, companions: ['cabbage', 'cucumber', 'radish', 'apple'], enemies: [], rotationGroup: 'other', sowOutdoors: 'Apr-May', harvest: 'Jun-Oct', daysToHarvest: 50, notes: 'Trap crop for aphids' },
  { id: 'sunflower', name: 'Sunflower', emoji: '🌻', category: 'flower', spacingCm: 60, companions: ['cucumber', 'sweetcorn', 'melon'], enemies: ['potato'], rotationGroup: 'other', sowOutdoors: 'Apr-May', harvest: 'Aug-Sep', daysToHarvest: 80, yieldPerPlant: 'Seeds' },
  { id: 'calendula', name: 'Calendula', emoji: '🌼', category: 'flower', spacingCm: 25, companions: ['tomato', 'asparagus'], enemies: [], rotationGroup: 'other', sowOutdoors: 'Mar-May', harvest: 'Jun-Oct', daysToHarvest: 45, notes: 'Attracts pollinators' },
];

export const getPlantById = (id: string): Plant | undefined => plants.find(p => p.id === id);

export const rotationGroupColors: Record<string, string> = {
  legumes: '#22c55e',
  brassicas: '#3b82f6',
  roots: '#f59e0b',
  alliums: '#a855f7',
  solanaceae: '#ef4444',
  cucurbits: '#06b6d4',
  leafy: '#10b981',
  other: '#6b7280',
};

export const rotationGroupLabels: Record<string, string> = {
  legumes: 'Legumes (Peas & Beans)',
  brassicas: 'Brassicas (Cabbage family)',
  roots: 'Root vegetables',
  alliums: 'Alliums (Onion family)',
  solanaceae: 'Solanaceae (Nightshades)',
  cucurbits: 'Cucurbits (Squash family)',
  leafy: 'Leafy greens',
  other: 'Other / Perennial',
};
