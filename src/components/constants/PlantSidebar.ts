// PlantSidebar constants - extracted to prevent fast refresh issues

export const categoryOrder = ['vegetable', 'fruit', 'herb', 'flower'] as const;

export const categoryLabels = {
  vegetable: '🥦 Vegetables',
  fruit: '🍓 Fruits',
  herb: '🌿 Herbs',
  flower: '🌼 Flowers',
} as const;

export const difficultyColors = {
  easy: 'bg-primary/15 text-primary',
  moderate: 'bg-warning/15 text-warning',
  challenging: 'bg-accent/15 text-accent',
} as const;

export const hardinessLabels = {
  hardy: '❄️ Hardy',
  'half-hardy': '🌤️ Half-hardy',
  tender: '☀️ Tender',
} as const;

export const sunLabels = {
  'full-sun': '☀️ Full sun',
  'partial-shade': '⛅ Partial shade',
  'full-shade': '🌑 Full shade',
  any: '🌤️ Any',
} as const;

export const familyEmojis: Record<string, string> = {
  Solanaceae: '🍅',
  Apiaceae: '🥕',
  Fabaceae: '🫘',
  Cucurbitaceae: '🥒',
  Brassicaceae: '🥦',
  Amaryllidaceae: '🧅',
  Asteraceae: '🌻',
  Lamiaceae: '🌿',
  Rosaceae: '🍓',
  Amaranthaceae: '🍃',
  Grossulariaceae: '🫐',
  Ericaceae: '🫐',
  Poaceae: '🌽',
  Asparagaceae: '🌿',
  Polygonaceae: '🍃',
  Boraginaceae: '💙',
  Tropaeolaceae: '🌸',
  Convolvulaceae: '🍠',
  Limnanthaceae: '🌼',
  Plantaginaceae: '🌺',
  Moraceae: '🫐',
  Vitaceae: '🍇',
  Lauraceae: '🌿',
};
