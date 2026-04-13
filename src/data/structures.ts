export interface Structure {
  id: string;
  name: string;
  emoji: string;
  widthCells: number;
  heightCells: number;
  canGrowInside: boolean;
  color: string; // tailwind bg class token
  description: string;
  shape?: 'rectangle' | 'circle';
  isContainer?: boolean; // pots, baskets etc — user can edit size
}

export const structures: Structure[] = [
  { id: 'polytunnel', name: 'Polytunnel', emoji: '🏕️', widthCells: 8, heightCells: 4, canGrowInside: true, color: 'hsl(142 55% 75% / 0.45)', description: 'Extends growing season. Great for tomatoes, peppers & cucumbers.' },
  { id: 'greenhouse', name: 'Greenhouse', emoji: '🏠', widthCells: 6, heightCells: 4, canGrowInside: true, color: 'hsl(200 70% 75% / 0.45)', description: 'Year-round growing. Ideal for tender crops and seedlings.' },
  { id: 'cold-frame', name: 'Cold Frame', emoji: '🪟', widthCells: 3, heightCells: 2, canGrowInside: true, color: 'hsl(50 70% 75% / 0.4)', description: 'Harden off seedlings and grow hardy salads over winter.' },
  { id: 'raised-bed', name: 'Raised Bed', emoji: '🟫', widthCells: 4, heightCells: 2, canGrowInside: true, color: 'hsl(30 60% 50% / 0.4)', description: 'Better drainage and soil control. Great for root veg.' },
  { id: 'shed', name: 'Shed', emoji: '🏚️', widthCells: 4, heightCells: 3, canGrowInside: false, color: 'hsl(25 40% 45% / 0.45)', description: 'Tool storage. Cannot grow plants inside.' },
  { id: 'compost-bin', name: 'Compost Bin', emoji: '♻️', widthCells: 2, heightCells: 2, canGrowInside: false, color: 'hsl(80 50% 45% / 0.45)', description: 'Composting area for garden waste.' },
  { id: 'water-butt', name: 'Water Butt', emoji: '🪣', widthCells: 1, heightCells: 1, canGrowInside: false, color: 'hsl(210 65% 55% / 0.4)', description: 'Rainwater collection.' },
  { id: 'path', name: 'Path', emoji: '🧱', widthCells: 1, heightCells: 4, canGrowInside: false, color: 'hsl(30 25% 60% / 0.5)', description: 'Walking path between beds.' },
  { id: 'fence', name: 'Fence', emoji: '🪵', widthCells: 8, heightCells: 1, canGrowInside: false, color: 'hsl(30 40% 38% / 0.4)', description: 'Garden boundary or windbreak.' },
  { id: 'growing-bed', name: 'Growing Bed', emoji: '🌱', widthCells: 6, heightCells: 3, canGrowInside: true, color: 'hsl(30 50% 45% / 0.35)', description: 'Outdoor growing bed for vegetables and crops.' },
  { id: 'flower-bed', name: 'Flower Bed', emoji: '🌸', widthCells: 4, heightCells: 2, canGrowInside: true, color: 'hsl(330 65% 65% / 0.35)', description: 'Decorative flower bed for companion flowers.' },
  { id: 'herb-bed', name: 'Herb Bed', emoji: '🌿', widthCells: 3, heightCells: 2, canGrowInside: true, color: 'hsl(120 55% 50% / 0.35)', description: 'Dedicated herb growing area.' },
  { id: 'fruit-cage', name: 'Fruit Cage', emoji: '🫐', widthCells: 4, heightCells: 4, canGrowInside: true, color: 'hsl(280 55% 60% / 0.35)', description: 'Netted cage to protect soft fruit from birds.' },
  { id: 'border', name: 'Border', emoji: '🌺', widthCells: 8, heightCells: 1, canGrowInside: true, color: 'hsl(45 65% 55% / 0.35)', description: 'Garden border for mixed planting.' },
  { id: 'pot-round', name: 'Round Pot', emoji: '🪴', widthCells: 2, heightCells: 2, canGrowInside: true, color: 'hsl(15 65% 50% / 0.45)', description: 'Round container pot for herbs & small plants.', shape: 'circle', isContainer: true },
  { id: 'pot-rect', name: 'Rectangular Pot', emoji: '🪴', widthCells: 3, heightCells: 2, canGrowInside: true, color: 'hsl(15 60% 48% / 0.45)', description: 'Rectangular planter for patios and balconies.', shape: 'rectangle', isContainer: true },
  { id: 'basket-round', name: 'Hanging Basket', emoji: '🧺', widthCells: 2, heightCells: 2, canGrowInside: true, color: 'hsl(40 60% 50% / 0.45)', description: 'Round hanging basket for trailing plants & strawberries.', shape: 'circle', isContainer: true },
  { id: 'basket-rect', name: 'Window Box', emoji: '🌻', widthCells: 4, heightCells: 1, canGrowInside: true, color: 'hsl(40 55% 48% / 0.45)', description: 'Rectangular window box for herbs and flowers.', shape: 'rectangle', isContainer: true },
  { id: 'grow-bag', name: 'Grow Bag', emoji: '🛍️', widthCells: 3, heightCells: 1, canGrowInside: true, color: 'hsl(0 0% 35% / 0.4)', description: 'Grow bag for tomatoes, potatoes and courgettes.', shape: 'rectangle', isContainer: true },
];

export function getStructureById(id: string): Structure | undefined {
  return structures.find(s => s.id === id);
}
