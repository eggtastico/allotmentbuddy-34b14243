export interface FeedingInfo {
  feedType: string;
  when: string;
  frequency: string;
  /** Interval in days between feeds (used to decide whether to show a daily reminder) */
  intervalDays: number;
  products?: string;
}

/** Per-plant feeding info. Keyed by plant ID. */
export const PLANT_FEEDING: Record<string, FeedingInfo> = {
  tomato:              { feedType: 'Tomato feed (high potash)', when: 'Once first flowers appear', frequency: 'Weekly', intervalDays: 7, products: 'Tomorite, Miracle-Gro Tomato, Chempak' },
  'tomato-cherry':     { feedType: 'Tomato feed (high potash)', when: 'Once first flowers appear', frequency: 'Weekly', intervalDays: 7, products: 'Tomorite, Miracle-Gro Tomato' },
  'tomato-beefsteak':  { feedType: 'Tomato feed (high potash)', when: 'Once first flowers appear', frequency: 'Weekly', intervalDays: 7, products: 'Tomorite, Miracle-Gro Tomato' },
  'tomato-plum':       { feedType: 'Tomato feed (high potash)', when: 'Once first flowers appear', frequency: 'Weekly', intervalDays: 7, products: 'Tomorite, Miracle-Gro Tomato' },
  pepper:              { feedType: 'Tomato feed or liquid seaweed', when: 'From June, once established outdoors', frequency: 'Fortnightly', intervalDays: 14, products: 'Tomorite, Maxicrop, Seasol' },
  'pepper-bell':       { feedType: 'Tomato feed or liquid seaweed', when: 'From June, once established outdoors', frequency: 'Fortnightly', intervalDays: 14, products: 'Tomorite, Maxicrop' },
  'pepper-banana':     { feedType: 'Tomato feed or liquid seaweed', when: 'From June, once established outdoors', frequency: 'Fortnightly', intervalDays: 14 },
  chilli:              { feedType: 'Tomato feed or liquid seaweed', when: 'From June, once established outdoors', frequency: 'Fortnightly', intervalDays: 14, products: 'Tomorite, Maxicrop' },
  aubergine:           { feedType: 'Tomato feed (high potash)', when: 'Once first flowers appear', frequency: 'Weekly', intervalDays: 7, products: 'Tomorite' },
  courgette:           { feedType: 'Balanced liquid feed → switch to tomato feed when flowers appear', when: 'Once plants are established', frequency: 'Fortnightly', intervalDays: 14, products: 'Miracle-Gro All Purpose → Tomorite' },
  cucumber:            { feedType: 'Balanced liquid feed → switch to tomato feed when flowers appear', when: 'Once plants are established', frequency: 'Fortnightly', intervalDays: 14 },
  pumpkin:             { feedType: 'Balanced liquid feed → switch to tomato feed once fruits set', when: 'Once established', frequency: 'Fortnightly', intervalDays: 14 },
  squash:              { feedType: 'Balanced liquid feed → switch to tomato feed once fruits set', when: 'Once established', frequency: 'Fortnightly', intervalDays: 14 },
  marrow:              { feedType: 'Balanced liquid feed → switch to tomato feed when flowers appear', when: 'Once established', frequency: 'Fortnightly', intervalDays: 14 },
  melon:               { feedType: 'Tomato feed (high potash)', when: 'Once first flowers appear', frequency: 'Weekly', intervalDays: 7, products: 'Tomorite' },
  strawberry:          { feedType: 'Tomato feed (high potash)', when: 'As flowers open in spring', frequency: 'Weekly until fruiting ends', intervalDays: 7, products: 'Tomorite, Chempak Strawberry' },
  raspberry:           { feedType: 'Balanced granular fertiliser', when: 'Early spring (Feb–Mar)', frequency: 'Once annually', intervalDays: 365, products: 'Growmore, blood fish & bone' },
  blueberry:           { feedType: 'Ericaceous liquid feed', when: 'From April through August', frequency: 'Monthly', intervalDays: 30, products: 'Miracle-Gro Ericaceous, Chempak Azalea & Rhododendron' },
  blackcurrant:        { feedType: 'High-nitrogen feed', when: 'Early spring', frequency: 'Once annually', intervalDays: 365, products: 'Sulphate of ammonia, blood fish & bone' },
  redcurrant:          { feedType: 'Balanced granular fertiliser', when: 'Early spring', frequency: 'Once annually', intervalDays: 365, products: 'Growmore' },
  whitecurrant:        { feedType: 'Balanced granular fertiliser', when: 'Early spring', frequency: 'Once annually', intervalDays: 365, products: 'Growmore' },
  gooseberry:          { feedType: 'Balanced granular + sulphate of potash', when: 'Early spring', frequency: 'Once annually', intervalDays: 365, products: 'Growmore' },
  blackberry:          { feedType: 'Balanced granular fertiliser', when: 'Early spring', frequency: 'Once annually', intervalDays: 365, products: 'Growmore, blood fish & bone' },
  sweetcorn:           { feedType: 'High-nitrogen liquid feed', when: 'June when plants are knee-high', frequency: 'Monthly (June–Aug)', intervalDays: 30, products: 'Blood fish & bone, Miracle-Gro' },
  celery:              { feedType: 'High-nitrogen liquid feed', when: 'Once established', frequency: 'Every 2–3 weeks', intervalDays: 14, products: 'Liquid seaweed, Growmore liquid' },
  leek:                { feedType: 'High-nitrogen feed', when: 'After planting out', frequency: 'Monthly', intervalDays: 30, products: 'Growmore, blood fish & bone' },
  kale:                { feedType: 'High-nitrogen feed', when: 'After planting out', frequency: 'Monthly', intervalDays: 30, products: 'Growmore' },
  cabbage:             { feedType: 'High-nitrogen feed', when: 'After planting out', frequency: 'Monthly', intervalDays: 30, products: 'Growmore, blood fish & bone' },
  broccoli:            { feedType: 'High-nitrogen feed', when: 'After planting out', frequency: 'Monthly', intervalDays: 30, products: 'Growmore' },
  cauliflower:         { feedType: 'High-nitrogen feed', when: 'After planting out', frequency: 'Monthly', intervalDays: 30, products: 'Growmore, blood fish & bone' },
  'brussels-sprout':   { feedType: 'High-nitrogen feed', when: 'After planting out', frequency: 'Monthly', intervalDays: 30, products: 'Growmore' },
  spinach:             { feedType: 'Liquid nitrogen feed', when: 'Once established', frequency: 'Every 3–4 weeks', intervalDays: 21, products: 'Liquid seaweed, nettle tea' },
  chard:               { feedType: 'Liquid nitrogen feed', when: 'Once established', frequency: 'Monthly', intervalDays: 30, products: 'Liquid seaweed' },
  lettuce:             { feedType: 'Liquid nitrogen feed', when: 'Once established', frequency: 'Every 3 weeks', intervalDays: 21, products: 'Liquid seaweed, Miracle-Gro' },
  'lettuce-butterhead':{ feedType: 'Liquid nitrogen feed', when: 'Once established', frequency: 'Every 3 weeks', intervalDays: 21, products: 'Liquid seaweed' },
  'lettuce-romaine':   { feedType: 'Liquid nitrogen feed', when: 'Once established', frequency: 'Every 3 weeks', intervalDays: 21, products: 'Liquid seaweed' },
  'lettuce-lollo':     { feedType: 'Liquid nitrogen feed', when: 'Once established', frequency: 'Every 3 weeks', intervalDays: 21, products: 'Liquid seaweed' },
  rhubarb:             { feedType: 'Balanced granular fertiliser or compost mulch', when: 'After last harvest (June/July)', frequency: 'Once annually', intervalDays: 365, products: 'Growmore, blood fish & bone' },
  asparagus:           { feedType: 'Balanced granular fertiliser', when: 'After last harvest in June', frequency: 'Once annually', intervalDays: 365, products: 'Growmore, blood fish & bone' },
  apple:               { feedType: 'Balanced granular fertiliser', when: 'Early spring (Feb–Mar)', frequency: 'Once annually', intervalDays: 365, products: 'Growmore, blood fish & bone' },
  pear:                { feedType: 'Balanced granular fertiliser', when: 'Early spring', frequency: 'Once annually', intervalDays: 365, products: 'Growmore' },
  cherry:              { feedType: 'Balanced granular fertiliser', when: 'Early spring', frequency: 'Once annually', intervalDays: 365, products: 'Growmore' },
  plum:                { feedType: 'Balanced granular fertiliser', when: 'Early spring (Feb–Mar)', frequency: 'Once annually', intervalDays: 365, products: 'Growmore' },
  grape:               { feedType: 'Tomato feed (high potash)', when: 'From flowering onwards', frequency: 'Fortnightly', intervalDays: 14, products: 'Tomorite' },
  fig:                 { feedType: 'Tomato feed or balanced liquid feed', when: 'From May', frequency: 'Monthly', intervalDays: 30, products: 'Tomorite, Miracle-Gro' },
  'sweet-potato':      { feedType: 'High-potash liquid feed', when: 'From July', frequency: 'Fortnightly', intervalDays: 14, products: 'Tomorite' },
  'globe-artichoke':   { feedType: 'General balanced fertiliser', when: 'Early spring, then after harvesting', frequency: 'Twice yearly', intervalDays: 180, products: 'Growmore, blood fish & bone' },
  'jerusalem-artichoke': { feedType: 'Balanced granular fertiliser', when: 'Early spring', frequency: 'Once annually', intervalDays: 365, products: 'Growmore' },
};

/** Plants that fix their own nitrogen — no feeding needed. */
export const NO_FEED = new Set([
  'pea', 'bean', 'bean-dwarf', 'bean-climbing', 'runner-bean', 'broad-bean', 'mangetout',
]);

/**
 * Returns true if today is a feeding day for this plant, based on its interval
 * and planting date. Uses the day-of-year offset from planting so feeding days
 * are spread out rather than all landing on the same day.
 */
export function isFeedingDay(plantedAt: string, intervalDays: number): boolean {
  const daysElapsed = Math.floor(
    (Date.now() - new Date(plantedAt).getTime()) / 86400000
  );
  if (daysElapsed < 21) return false; // don't prompt until 3 weeks in
  return daysElapsed % intervalDays === 0;
}
