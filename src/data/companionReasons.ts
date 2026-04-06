/**
 * Reasons why certain plants are good or bad companions.
 * Key format: "plantA:plantB" (alphabetical order)
 */

export const companionReasons: Record<string, string> = {
  // Good companions
  'basil:tomato': 'Basil repels aphids and whitefly, and may improve tomato flavour',
  'carrot:tomato': 'Carrots loosen soil for tomato roots; tomatoes provide shade',
  'marigold:tomato': 'Marigolds deter whitefly and nematodes near tomatoes',
  'parsley:tomato': 'Parsley attracts hoverflies that eat tomato pests',
  'carrot:onion': 'Onion scent deters carrot fly; carrot scent deters onion fly',
  'carrot:leek': 'Leek scent repels carrot fly; carrots repel leek moth',
  'carrot:rosemary': 'Rosemary\'s strong scent confuses and deters carrot fly',
  'carrot:sage': 'Sage deters carrot fly with its aromatic oils',
  'bean:carrot': 'Beans fix nitrogen in soil, benefiting carrots',
  'bean:sweetcorn': 'Beans fix nitrogen; corn provides support (Three Sisters)',
  'bean:courgette': 'Three Sisters: beans fix nitrogen, courgette shades soil',
  'cabbage:celery': 'Celery\'s strong scent deters cabbage white butterflies',
  'cabbage:dill': 'Dill attracts beneficial wasps that prey on cabbage caterpillars',
  'cabbage:onion': 'Onion scent helps mask cabbages from pests',
  'lettuce:radish': 'Radishes mark rows and break soil crust for lettuce seedlings',
  'lettuce:strawberry': 'Lettuce provides ground cover, keeping strawberry roots cool',
  'nasturtium:cabbage': 'Nasturtiums act as a trap crop, luring aphids away from brassicas',
  'cucumber:sunflower': 'Sunflowers attract pollinators and provide wind shelter',
  'borage:strawberry': 'Borage attracts pollinators to strawberry flowers',
  'borage:tomato': 'Borage deters tomato hornworm and attracts pollinators',
  'chive:tomato': 'Chives deter aphids from tomatoes',
  'garlic:tomato': 'Garlic deters red spider mite on tomatoes',
  'basil:pepper': 'Basil repels aphids, spider mites, and mosquitoes near peppers',
  'onion:beetroot': 'Onion scent deters pests that target beetroot',
  'pea:carrot': 'Peas fix nitrogen in the soil, benefiting carrot growth',
  'potato:horseradish': 'Horseradish repels potato beetles',

  // Bad companions (enemies)
  'cabbage:tomato': 'Both are heavy feeders and compete for the same nutrients',
  'fennel:tomato': 'Fennel exudes substances that inhibit tomato growth',
  'potato:tomato': 'Same family — blight spreads easily between them',
  'bean:onion': 'Onions inhibit nitrogen fixation in beans',
  'bean:garlic': 'Garlic releases compounds that stunt bean growth',
  'pea:onion': 'Onions inhibit nitrogen fixation in peas',
  'pea:garlic': 'Garlic releases compounds that stunt pea growth',
  'potato:cucumber': 'Cucumbers and potatoes share disease vulnerabilities',
  'potato:sunflower': 'Sunflowers release allelopathic chemicals affecting potatoes',
  'dill:carrot': 'Cross-pollination — dill can cause bitter carrots',
  'strawberry:cabbage': 'Both attract similar pests, worsening infestations',
  'strawberry:broccoli': 'Brassicas compete for nutrients and attract shared pests',
  'sage:cucumber': 'Sage inhibits cucumber growth',
  'fennel:bean': 'Fennel releases growth inhibitors affecting beans',
  'fennel:coriander': 'Cross-pollination reduces seed quality in both',
};

/**
 * Get the reason for a companion/enemy relationship.
 * Returns undefined if no specific reason is known.
 */
export function getCompanionReason(plantIdA: string, plantIdB: string): string | undefined {
  const key1 = `${plantIdA}:${plantIdB}`;
  const key2 = `${plantIdB}:${plantIdA}`;
  return companionReasons[key1] || companionReasons[key2];
}

/**
 * Category color for plant type in grid visualization
 */
export const categoryColors: Record<string, string> = {
  vegetable: 'hsl(142 40% 90%)',
  fruit: 'hsl(340 50% 92%)',
  herb: 'hsl(170 40% 90%)',
  flower: 'hsl(45 70% 90%)',
};

export const categoryColorsDark: Record<string, string> = {
  vegetable: 'hsl(142 30% 18%)',
  fruit: 'hsl(340 30% 18%)',
  herb: 'hsl(170 30% 18%)',
  flower: 'hsl(45 30% 18%)',
};
