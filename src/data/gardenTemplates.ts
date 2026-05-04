import { PlotSettings, PlacedPlant, PlacedStructure } from '@/types/garden';

export interface GardenTemplate {
  id: string;
  name: string;
  description: string;
  emoji: string;
  settings: PlotSettings;
  plants: PlacedPlant[];
  structures: PlacedStructure[];
}

/** Helper to create a PlacedPlant with sensible defaults. */
function plant(plantId: string, x: number, y: number): PlacedPlant {
  return {
    id: `tpl-${plantId}-${x}-${y}`,
    plantId,
    x,
    y,
    plantedAt: new Date().toISOString(),
    stage: 'seedling',
  };
}

/** Helper to create a PlacedStructure. */
function structure(
  structureId: string,
  x: number,
  y: number,
  widthCells: number,
  heightCells: number,
): PlacedStructure {
  return {
    id: `tpl-${structureId}-${x}-${y}`,
    structureId,
    x,
    y,
    widthCells,
    heightCells,
  };
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const fourBedRotation: GardenTemplate = {
  id: 'four-bed-rotation',
  name: '4-Bed Rotation',
  description: 'Classic allotment layout with 4 raised beds arranged for annual crop rotation. Each bed is assigned a rotation group.',
  emoji: '🔄',
  settings: {
    widthM: 8,
    heightM: 6,
    unit: 'meters',
    cellSizePx: 32,
    cellSizeCm: 20,
    southDirection: 180,
    snapToGrid: true,
  },
  structures: [
    // 4 raised beds in a 2x2 grid with paths between
    structure('raised-bed', 1, 1, 4, 3),   // top-left  — legumes
    structure('raised-bed', 6, 1, 4, 3),   // top-right — brassicas
    structure('raised-bed', 1, 5, 4, 3),   // bottom-left — roots
    structure('raised-bed', 6, 5, 4, 3),   // bottom-right — alliums / solanaceae
    // Paths between beds
    structure('path', 5, 1, 1, 7),
    structure('path', 1, 4, 9, 1),
    // Compost bin in corner
    structure('compost-bin', 11, 7, 2, 2),
  ],
  plants: [
    // Bed 1 — legumes (top-left)
    plant('pea', 1, 1),
    plant('pea', 2, 1),
    plant('bean', 3, 1),
    plant('bean', 4, 1),
    plant('broad-bean', 1, 2),
    plant('broad-bean', 2, 2),
    plant('runner-bean', 3, 2),
    plant('runner-bean', 4, 2),
    // Bed 2 — brassicas (top-right)
    plant('cabbage', 6, 1),
    plant('cabbage', 7, 1),
    plant('broccoli', 8, 1),
    plant('broccoli', 9, 1),
    plant('kale', 6, 2),
    plant('kale', 7, 2),
    plant('cauliflower', 8, 2),
    plant('cauliflower', 9, 2),
    // Bed 3 — roots (bottom-left)
    plant('carrot', 1, 5),
    plant('carrot', 2, 5),
    plant('beetroot', 3, 5),
    plant('beetroot', 4, 5),
    plant('parsnip', 1, 6),
    plant('parsnip', 2, 6),
    plant('radish', 3, 6),
    plant('radish', 4, 6),
    // Bed 4 — solanaceae / alliums (bottom-right)
    plant('tomato', 6, 5),
    plant('tomato', 7, 5),
    plant('pepper', 8, 5),
    plant('pepper', 9, 5),
    plant('onion', 6, 6),
    plant('onion', 7, 6),
    plant('garlic', 8, 6),
    plant('garlic', 9, 6),
  ],
};

const smallRaisedBed: GardenTemplate = {
  id: 'small-raised-bed',
  name: 'Small Raised Bed Garden',
  description: 'Compact layout with 3 raised beds ideal for a small back garden or half-plot allotment.',
  emoji: '🌿',
  settings: {
    widthM: 5,
    heightM: 4,
    unit: 'meters',
    cellSizePx: 32,
    cellSizeCm: 20,
    southDirection: 180,
    snapToGrid: true,
  },
  structures: [
    structure('raised-bed', 1, 1, 4, 2),   // top bed
    structure('raised-bed', 1, 4, 4, 2),   // middle bed
    structure('raised-bed', 1, 7, 4, 2),   // bottom bed
    structure('path', 1, 3, 4, 1),
    structure('path', 1, 6, 4, 1),
    structure('water-butt', 6, 1, 1, 1),
  ],
  plants: [
    // Bed 1 — salad & leafy greens
    plant('lettuce', 1, 1),
    plant('lettuce', 2, 1),
    plant('rocket', 3, 1),
    plant('spinach', 4, 1),
    plant('radish', 1, 2),
    plant('radish', 2, 2),
    plant('spring-onion', 3, 2),
    plant('spring-onion', 4, 2),
    // Bed 2 — roots & alliums
    plant('carrot', 1, 4),
    plant('carrot', 2, 4),
    plant('beetroot', 3, 4),
    plant('beetroot', 4, 4),
    plant('onion', 1, 5),
    plant('onion', 2, 5),
    plant('garlic', 3, 5),
    plant('garlic', 4, 5),
    // Bed 3 — herbs & companions
    plant('basil', 1, 7),
    plant('parsley', 2, 7),
    plant('chive', 3, 7),
    plant('thyme', 4, 7),
    plant('tomato-cherry', 1, 8),
    plant('tomato-cherry', 2, 8),
    plant('marigold', 3, 8),
    plant('nasturtium', 4, 8),
  ],
};

const greenhouseAndBeds: GardenTemplate = {
  id: 'greenhouse-and-beds',
  name: 'Greenhouse & Beds',
  description: 'A greenhouse for tender crops with surrounding raised beds for hardier vegetables and a herb bed.',
  emoji: '🏠',
  settings: {
    widthM: 10,
    heightM: 6,
    unit: 'meters',
    cellSizePx: 32,
    cellSizeCm: 20,
    southDirection: 180,
    snapToGrid: true,
  },
  structures: [
    // Greenhouse at top-centre
    structure('greenhouse', 2, 1, 6, 4),
    // Growing beds either side
    structure('raised-bed', 9, 1, 4, 3),  // right bed
    structure('raised-bed', 9, 5, 4, 3),  // right-bottom bed
    // Herb bed below greenhouse
    structure('herb-bed', 2, 6, 3, 2),
    // Cold frame
    structure('cold-frame', 6, 6, 3, 2),
    // Water butt and compost
    structure('water-butt', 0, 1, 1, 1),
    structure('compost-bin', 0, 3, 2, 2),
    // Path from greenhouse to beds
    structure('path', 8, 1, 1, 7),
  ],
  plants: [
    // Inside greenhouse — tender crops
    plant('tomato', 2, 1),
    plant('tomato', 3, 1),
    plant('tomato-cherry', 4, 1),
    plant('cucumber', 5, 1),
    plant('pepper', 6, 1),
    plant('pepper-bell', 7, 1),
    plant('aubergine', 2, 3),
    plant('chilli', 3, 3),
    plant('basil', 4, 3),
    plant('basil', 5, 3),
    // Right bed — outdoor crops
    plant('courgette', 9, 1),
    plant('runner-bean', 10, 1),
    plant('runner-bean', 11, 1),
    plant('pea', 12, 1),
    // Right-bottom bed
    plant('potato', 9, 5),
    plant('potato', 10, 5),
    plant('cabbage', 11, 5),
    plant('broccoli', 12, 5),
    // Herb bed
    plant('rosemary', 2, 6),
    plant('thyme', 3, 6),
    plant('sage', 4, 6),
    // Cold frame
    plant('lettuce', 6, 6),
    plant('spinach', 7, 6),
    plant('pak-choi', 8, 6),
  ],
};

const containerGarden: GardenTemplate = {
  id: 'container-garden',
  name: 'Container Garden',
  description: 'Pots, grow bags, and window boxes for balcony or patio growing. No digging required!',
  emoji: '🪴',
  settings: {
    widthM: 4,
    heightM: 3,
    unit: 'meters',
    cellSizePx: 32,
    cellSizeCm: 20,
    southDirection: 180,
    snapToGrid: true,
  },
  structures: [
    // Large pots along the back
    structure('pot-round', 1, 1, 2, 2),
    structure('pot-round', 4, 1, 2, 2),
    structure('pot-round', 7, 1, 2, 2),
    // Rectangular planters in the middle
    structure('pot-rect', 1, 4, 3, 2),
    structure('pot-rect', 5, 4, 3, 2),
    // Grow bags at front
    structure('grow-bag', 1, 7, 3, 1),
    structure('grow-bag', 5, 7, 3, 1),
    // Window boxes
    structure('basket-rect', 1, 9, 4, 1),
    structure('basket-rect', 6, 9, 4, 1),
    // Hanging basket
    structure('basket-round', 10, 1, 2, 2),
  ],
  plants: [
    // Round pots — tomatoes and peppers
    plant('tomato-cherry', 1, 1),
    plant('pepper', 4, 1),
    plant('chilli', 7, 1),
    // Rectangular planters — herbs
    plant('basil', 1, 4),
    plant('parsley', 2, 4),
    plant('coriander', 3, 4),
    plant('mint', 5, 4),
    plant('chive', 6, 4),
    plant('thyme', 7, 4),
    // Grow bags — courgette and tomatoes
    plant('tomato', 1, 7),
    plant('tomato', 2, 7),
    plant('courgette', 5, 7),
    // Window boxes — salad
    plant('lettuce', 1, 9),
    plant('rocket', 2, 9),
    plant('radish', 3, 9),
    plant('spring-onion', 4, 9),
    plant('lettuce', 6, 9),
    plant('spinach', 7, 9),
    plant('chervil', 8, 9),
    // Hanging basket — strawberry
    plant('strawberry', 10, 1),
  ],
};

const beginnersPlot: GardenTemplate = {
  id: 'beginners-plot',
  name: "Beginner's Plot",
  description: 'Simple layout with 2 growing beds and a central path. Easy-to-grow crops only — perfect for first-time gardeners.',
  emoji: '🌱',
  settings: {
    widthM: 6,
    heightM: 4,
    unit: 'meters',
    cellSizePx: 32,
    cellSizeCm: 20,
    southDirection: 180,
    snapToGrid: true,
  },
  structures: [
    // Two growing beds with a path between
    structure('growing-bed', 1, 1, 6, 3),
    structure('path', 1, 4, 6, 1),
    structure('growing-bed', 1, 5, 6, 3),
    // Water butt in corner
    structure('water-butt', 8, 1, 1, 1),
  ],
  plants: [
    // Top bed — easy vegetables
    plant('lettuce', 1, 1),
    plant('lettuce', 2, 1),
    plant('radish', 3, 1),
    plant('radish', 4, 1),
    plant('spring-onion', 5, 1),
    plant('spring-onion', 6, 1),
    plant('pea', 1, 2),
    plant('pea', 2, 2),
    plant('bean-dwarf', 3, 2),
    plant('bean-dwarf', 4, 2),
    plant('courgette', 5, 2),
    plant('marigold', 6, 2),
    // Bottom bed — roots and herbs
    plant('carrot', 1, 5),
    plant('carrot', 2, 5),
    plant('beetroot', 3, 5),
    plant('beetroot', 4, 5),
    plant('potato', 5, 5),
    plant('potato', 6, 5),
    plant('basil', 1, 6),
    plant('parsley', 2, 6),
    plant('chive', 3, 6),
    plant('tomato-cherry', 4, 6),
    plant('nasturtium', 5, 6),
    plant('calendula', 6, 6),
  ],
};

export const gardenTemplates: GardenTemplate[] = [
  fourBedRotation,
  smallRaisedBed,
  greenhouseAndBeds,
  containerGarden,
  beginnersPlot,
];

export function getTemplateById(id: string): GardenTemplate | undefined {
  return gardenTemplates.find(t => t.id === id);
}
