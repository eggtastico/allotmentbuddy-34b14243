export interface Structure {
  id: string;
  name: string;
  emoji: string;
  widthCells: number;
  heightCells: number;
  canGrowInside: boolean;
  color: string; // tailwind bg class token
  description: string;
}

export const structures: Structure[] = [
  { id: 'polytunnel', name: 'Polytunnel', emoji: '🏕️', widthCells: 8, heightCells: 4, canGrowInside: true, color: 'hsl(142 40% 80% / 0.35)', description: 'Extends growing season. Great for tomatoes, peppers & cucumbers.' },
  { id: 'greenhouse', name: 'Greenhouse', emoji: '🏠', widthCells: 6, heightCells: 4, canGrowInside: true, color: 'hsl(200 60% 80% / 0.35)', description: 'Year-round growing. Ideal for tender crops and seedlings.' },
  { id: 'cold-frame', name: 'Cold Frame', emoji: '🪟', widthCells: 3, heightCells: 2, canGrowInside: true, color: 'hsl(50 50% 80% / 0.3)', description: 'Harden off seedlings and grow hardy salads over winter.' },
  { id: 'raised-bed', name: 'Raised Bed', emoji: '🟫', widthCells: 4, heightCells: 2, canGrowInside: true, color: 'hsl(30 50% 55% / 0.3)', description: 'Better drainage and soil control. Great for root veg.' },
  { id: 'shed', name: 'Shed', emoji: '🏚️', widthCells: 4, heightCells: 3, canGrowInside: false, color: 'hsl(25 30% 50% / 0.4)', description: 'Tool storage. Cannot grow plants inside.' },
  { id: 'compost-bin', name: 'Compost Bin', emoji: '♻️', widthCells: 2, heightCells: 2, canGrowInside: false, color: 'hsl(80 30% 45% / 0.35)', description: 'Composting area for garden waste.' },
  { id: 'water-butt', name: 'Water Butt', emoji: '🪣', widthCells: 1, heightCells: 1, canGrowInside: false, color: 'hsl(210 50% 60% / 0.3)', description: 'Rainwater collection.' },
  { id: 'path', name: 'Path', emoji: '🧱', widthCells: 1, heightCells: 4, canGrowInside: false, color: 'hsl(30 10% 65% / 0.4)', description: 'Walking path between beds.' },
  { id: 'fence', name: 'Fence', emoji: '🪵', widthCells: 8, heightCells: 1, canGrowInside: false, color: 'hsl(30 30% 40% / 0.3)', description: 'Garden boundary or windbreak.' },
];

export function getStructureById(id: string): Structure | undefined {
  return structures.find(s => s.id === id);
}
