export interface Structure {
  id: string;
  name: string;
  emoji: string;
  sprite?: string;       // Isometric SVG sprite (used by IsometricGardenGrid)
  topSprite?: string;    // Top-down texture for the flat garden view overlay
  repeatTexture?: boolean; // true = tile-repeat the topSprite; false/undefined = cover
  widthCells: number;
  heightCells: number;
  canGrowInside: boolean;
  color: string; // tailwind bg class token
  description: string;
  shape?: 'rectangle' | 'circle';
  isContainer?: boolean; // pots, baskets etc — user can edit size
  showCells?: boolean; // show internal grow squares
}

export const structures: Structure[] = [
  // Vegetable Growing
  { id: 'raised-bed', name: 'Raised Bed', emoji: '🟫', widthCells: 4, heightCells: 2, canGrowInside: false, color: 'hsl(25 42% 44% / 0.65)', description: 'Better drainage and soil control. Great for root veg.', showCells: true },
  { id: 'growing-bed', name: 'Growing Bed', emoji: '🌱', widthCells: 6, heightCells: 3, canGrowInside: false, color: 'hsl(22 38% 42% / 0.62)', description: 'Outdoor growing bed for vegetables and crops.', showCells: true },

  // Flowers & Herbs
  { id: 'flower-bed', name: 'Flower Bed', emoji: '🌸', widthCells: 4, heightCells: 2, canGrowInside: false, color: 'hsl(345 38% 52% / 0.62)', description: 'Decorative flower bed for companion flowers.', showCells: true },
  { id: 'herb-bed', name: 'Herb Bed', emoji: '🌿', widthCells: 3, heightCells: 2, canGrowInside: false, color: 'hsl(100 35% 42% / 0.62)', description: 'Dedicated herb growing area.', showCells: true },
  { id: 'border', name: 'Border', emoji: '🌺', widthCells: 8, heightCells: 1, canGrowInside: false, color: 'hsl(32 40% 46% / 0.62)', description: 'Garden border for mixed planting.', showCells: true },
  { id: 'fruit-cage', name: 'Fruit Cage', emoji: '🫐', topSprite: 'sprites/fruit-cage-top.svg', repeatTexture: true, widthCells: 4, heightCells: 4, canGrowInside: false, color: 'hsl(25 38% 44% / 0.62)', description: 'Netted cage to protect soft fruit from birds.', showCells: true },

  // Covered Growing
  { id: 'greenhouse', name: 'Greenhouse', emoji: '🏠', sprite: 'sprites/greenhouse.svg', topSprite: 'sprites/greenhouse-top-v2.svg', repeatTexture: true, widthCells: 6, heightCells: 4, canGrowInside: true, color: 'hsl(200 70% 75% / 0.5)', description: 'Year-round growing. Ideal for tender crops and seedlings.' },
  { id: 'polytunnel', name: 'Polytunnel', emoji: '🏕️', topSprite: 'sprites/polytunnel-top-v2.svg', repeatTexture: true, widthCells: 8, heightCells: 4, canGrowInside: true, color: 'hsl(142 55% 75% / 0.5)', description: 'Extends growing season. Great for tomatoes, peppers & cucumbers.' },
  { id: 'cold-frame', name: 'Cold Frame', emoji: '🪟', sprite: 'sprites/cold-frame.svg', topSprite: 'sprites/cold-frame-top.svg', widthCells: 3, heightCells: 2, canGrowInside: true, color: 'hsl(50 70% 75% / 0.45)', description: 'Harden off seedlings and grow hardy salads over winter.' },

  // Storage & Utilities
  { id: 'shed', name: 'Shed', emoji: '🏚️', sprite: 'sprites/shed.svg', topSprite: 'sprites/shed-top.svg', widthCells: 4, heightCells: 3, canGrowInside: false, color: 'hsl(25 40% 45% / 0.5)', description: 'Tool storage. Cannot grow plants inside.' },
  { id: 'compost-bin', name: 'Compost Bin', emoji: '♻️', sprite: 'sprites/compost-bin.svg', topSprite: 'sprites/compost-bin-top.svg', widthCells: 2, heightCells: 2, canGrowInside: false, color: 'hsl(80 50% 45% / 0.5)', description: 'Composting area for garden waste.' },
  { id: 'water-butt', name: 'Water Butt', emoji: '🪣', sprite: 'sprites/water-butt.svg', topSprite: 'sprites/water-butt-top.svg', widthCells: 1, heightCells: 1, canGrowInside: false, color: 'hsl(210 65% 55% / 0.45)', description: 'Rainwater collection.', shape: 'circle' },

  // Containers
  { id: 'pot-round', name: 'Round Pot', emoji: '🪴', topSprite: 'sprites/pot-round-top.svg', widthCells: 2, heightCells: 2, canGrowInside: false, color: 'hsl(15 65% 50% / 0.5)', description: 'Round container pot for herbs & small plants.', shape: 'circle', isContainer: true },
  { id: 'pot-rect', name: 'Rectangular Pot', emoji: '🪴', topSprite: 'sprites/pot-rect-top.svg', widthCells: 3, heightCells: 2, canGrowInside: false, color: 'hsl(15 60% 48% / 0.5)', description: 'Rectangular planter for patios and balconies.', shape: 'rectangle', isContainer: true },
  { id: 'basket-round', name: 'Hanging Basket', emoji: '🧺', topSprite: 'sprites/basket-round-top.svg', widthCells: 2, heightCells: 2, canGrowInside: false, color: 'hsl(40 60% 50% / 0.5)', description: 'Round hanging basket for trailing plants & strawberries.', shape: 'circle', isContainer: true },
  { id: 'basket-rect', name: 'Window Box', emoji: '🌻', topSprite: 'sprites/basket-rect-top.svg', widthCells: 4, heightCells: 1, canGrowInside: false, color: 'hsl(40 55% 48% / 0.5)', description: 'Rectangular window box for herbs and flowers.', shape: 'rectangle', isContainer: true },
  { id: 'grow-bag', name: 'Grow Bag', emoji: '🛍️', topSprite: 'sprites/grow-bag-top.svg', widthCells: 3, heightCells: 1, canGrowInside: false, color: 'hsl(0 0% 35% / 0.45)', description: 'Grow bag for tomatoes, potatoes and courgettes.', shape: 'rectangle', isContainer: true },

  // Trees
  { id: 'fruit-tree', name: 'Fruit Tree', emoji: '🍎', sprite: 'sprites/fruit-tree.svg', topSprite: 'sprites/fruit-tree-top.svg', widthCells: 3, heightCells: 3, canGrowInside: false, color: 'hsl(120 45% 40% / 0.5)', description: 'Apple, pear, plum or cherry tree. Provides shade and fruit.', shape: 'circle' },
  { id: 'tree', name: 'Tree', emoji: '🌳', topSprite: 'sprites/tree-top.svg', widthCells: 3, heightCells: 3, canGrowInside: false, color: 'hsl(140 40% 35% / 0.5)', description: 'Existing tree. Creates shade — plan planting around it.', shape: 'circle' },

  // Access & Features
  { id: 'path', name: 'Paving Path', emoji: '🧱', sprite: 'sprites/path.svg', topSprite: 'sprites/path-top.svg', repeatTexture: true, widthCells: 1, heightCells: 4, canGrowInside: false, color: 'hsl(30 25% 60% / 0.55)', description: 'Paved slab walking path between beds.' },
  { id: 'path-woodchip', name: 'Woodchip Path', emoji: '🪵', topSprite: 'sprites/path-woodchip-top.svg', repeatTexture: true, widthCells: 1, heightCells: 4, canGrowInside: false, color: 'hsl(28 55% 28% / 0.7)', description: 'Bark mulch or woodchip path. Biodegradable and weed-suppressing.' },
  { id: 'path-gravel', name: 'Gravel Path', emoji: '⬜', topSprite: 'sprites/path-gravel-top.svg', repeatTexture: true, widthCells: 1, heightCells: 4, canGrowInside: false, color: 'hsl(40 12% 62% / 0.7)', description: 'Gravel or shingle path. Low maintenance with good drainage.' },
  { id: 'path-stepping', name: 'Stepping Stones', emoji: '🪨', topSprite: 'sprites/path-stepping-top.svg', repeatTexture: true, widthCells: 1, heightCells: 4, canGrowInside: false, color: 'hsl(60 8% 50% / 0.65)', description: 'Individual stepping stones through the garden.' },
  { id: 'decking', name: 'Decking', emoji: '🪵', topSprite: 'sprites/decking-top.svg', repeatTexture: true, widthCells: 4, heightCells: 4, canGrowInside: false, color: 'hsl(30 38% 44% / 0.65)', description: 'Wooden decking area for seating or entertaining.' },
  { id: 'patio', name: 'Patio', emoji: '⬛', topSprite: 'sprites/patio-top.svg', repeatTexture: true, widthCells: 4, heightCells: 4, canGrowInside: false, color: 'hsl(0 0% 68% / 0.65)', description: 'Concrete or stone patio area.' },
  { id: 'lawn', name: 'Lawn', emoji: '🟩', topSprite: 'sprites/lawn-top.svg', repeatTexture: true, widthCells: 6, heightCells: 4, canGrowInside: false, color: 'hsl(115 55% 38% / 0.55)', description: 'Grass or lawn area. Use to plan around existing turf.' },
  { id: 'fence', name: 'Fence', emoji: '🪵', topSprite: 'sprites/fence-top.svg', repeatTexture: true, widthCells: 8, heightCells: 1, canGrowInside: false, color: 'hsl(30 40% 38% / 0.45)', description: 'Garden boundary or windbreak.' },
];

export function getStructureById(id: string): Structure | undefined {
  return structures.find(s => s.id === id);
}
