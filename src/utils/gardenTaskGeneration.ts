/**
 * Enhanced garden task generation with feeding schedules and weather integration
 */

import { PlacedPlant } from '@/types/garden';
import { plants as plantDB } from '@/data/plants';
import { PLANT_FEEDING, NO_FEED } from '@/utils/feedingGuide';
import { getWeatherData, getFrostData } from '@/lib/weatherByLocation';
import { Location } from '@/types/garden';

export interface GeneratedTask {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'watering' | 'feeding' | 'harvest' | 'pest' | 'weather' | 'general';
  icon: string;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Generate weather-triggered tasks based on current conditions and forecast
 */
export async function generateWeatherTasks(
  location: Location | null,
  placedPlants: PlacedPlant[],
): Promise<GeneratedTask[]> {
  const tasks: GeneratedTask[] = [];

  if (!location || placedPlants.length === 0) return tasks;

  try {
    const weather = await getWeatherData(location);
    const frost = getFrostData(location);

    if (!weather) return tasks;

    // High temperature → extra watering needed
    if (weather.temperature > 25) {
      tasks.push({
        id: 'weather-heat',
        title: '🌡️ Hot weather — increase watering',
        description: `${Math.round(weather.temperature)}°C today. Check soil moisture frequently — plants will dry out faster.`,
        priority: 'high',
        category: 'weather',
        icon: '🌞',
      });
    }

    // Low humidity + heat → stress risk
    if (weather.temperature > 20 && weather.humidity < 40) {
      tasks.push({
        id: 'weather-drought-stress',
        title: '💨 Low humidity — mist plants if needed',
        description: `${weather.humidity}% humidity + warm air. Sensitive plants (lettuce, spinach) may wilt. Provide shade or mist.`,
        priority: 'medium',
        category: 'weather',
        icon: '💧',
      });
    }

    // High wind → stake support
    if (weather.windSpeed > 20) {
      tasks.push({
        id: 'weather-wind',
        title: '💨 Strong winds — check stakes and supports',
        description: `Wind gusts ${Math.round(weather.windSpeed)} km/h. Ensure tall plants (tomatoes, beans) are staked securely.`,
        priority: 'medium',
        category: 'weather',
        icon: '🌪️',
      });
    }

    // High UV → sun protection for tender plants
    if (weather.uvIndex > 7) {
      tasks.push({
        id: 'weather-uv',
        title: '☀️ High UV index — provide shade if needed',
        description: `UV index ${weather.uvIndex}. Tender seedlings may need shade cloth or temporary shade.`,
        priority: 'low',
        category: 'weather',
        icon: '🛡️',
      });
    }

    // Frost warning → protect tender plants
    if (frost.daysUntilLastFrost !== undefined && frost.daysUntilLastFrost <= 7 && frost.daysUntilLastFrost > 0) {
      const tenderPlants = placedPlants
        .filter(pp => {
          const p = plantDB.find(x => x.id === pp.plantId);
          return p && p.hardiness === 'tender';
        })
        .map(pp => plantDB.find(p => p.id === pp.plantId)?.emoji || '🌱')
        .join(' ');

      if (tenderPlants) {
        tasks.push({
          id: 'weather-frost',
          title: '❄️ Frost warning — protect tender plants',
          description: `Last frost expected in ${frost.daysUntilLastFrost} days. Cover tender plants (${tenderPlants}) with fleece or move indoors.`,
          priority: 'high',
          category: 'weather',
          icon: '🛡️',
        });
      }
    }

    // Post-frost safe planting
    if (frost.daysSinceFrostRisk !== undefined && frost.daysSinceFrostRisk <= 3 && frost.daysSinceFrostRisk >= 0) {
      tasks.push({
        id: 'weather-safe-to-plant',
        title: '✅ Safe to plant tender plants now',
        description: `Last frost has passed! Safe to plant tender plants (tomatoes, peppers, tender beans) outdoors.`,
        priority: 'medium',
        category: 'general',
        icon: '🌱',
      });
    }
  } catch (error) {
    console.error('Failed to generate weather tasks:', error);
  }

  return tasks;
}

/**
 * Generate feeding schedule tasks for plants in their feeding season
 */
export function generateFeedingTasks(
  placedPlants: PlacedPlant[],
  now: Date = new Date(),
): GeneratedTask[] {
  const tasks: GeneratedTask[] = [];
  const currentMonth = MONTH_NAMES[now.getMonth()];
  const seen = new Set<string>();

  for (const pp of placedPlants) {
    if (seen.has(pp.plantId)) continue;
    if (NO_FEED.has(pp.plantId)) continue;

    const plant = plantDB.find(p => p.id === pp.plantId);
    const feeding = PLANT_FEEDING[pp.plantId];

    if (!plant || !feeding) continue;

    // Check if feeding should happen this month based on "when" field
    const feedThisMonth = isPlantInFeedingPeriod(feeding.when, currentMonth);
    if (!feedThisMonth) continue;

    seen.add(pp.plantId);

    // Calculate days elapsed to see if enough time has passed
    const daysElapsed = Math.floor((now.getTime() - new Date(pp.plantedAt).getTime()) / 86400000);

    // Don't feed before 3 weeks (unless established)
    if (daysElapsed < 21 && pp.stage !== 'established') continue;

    // Check if it's a feeding day (based on interval)
    const daysSincePlanting = daysElapsed % feeding.intervalDays;
    const shouldFeed = daysSincePlanting < 2; // Feed if within 2 days of schedule

    if (shouldFeed || pp.stage === 'established') {
      const frequency = feeding.frequency.toLowerCase();
      let priority: 'high' | 'medium' | 'low' = 'medium';

      // High priority for weekly feeding
      if (frequency.includes('weekly')) priority = 'high';
      // Low priority for annual/one-time
      if (frequency.includes('annual') || frequency.includes('once')) priority = 'low';

      tasks.push({
        id: `feed-${pp.plantId}`,
        title: `🌿 Feed ${plant.name}`,
        description: `${feeding.feedType}. ${feeding.when}. ${feeding.frequency}${feeding.products ? ` — try: ${feeding.products}` : ''}.`,
        priority,
        category: 'feeding',
        icon: plant.emoji,
      });
    }
  }

  return tasks;
}

/**
 * Generate pest/disease prevention tasks based on season and conditions
 */
export function generatePestTasks(
  placedPlants: PlacedPlant[],
  now: Date = new Date(),
): GeneratedTask[] {
  const tasks: GeneratedTask[] = [];
  const currentMonth = MONTH_NAMES[now.getMonth()];

  // Slug/snail risk: spring and autumn when soil is moist
  if (['Apr', 'May', 'Oct', 'Nov'].includes(currentMonth) && placedPlants.length > 0) {
    tasks.push({
      id: 'pest-slugs',
      title: '🐌 Check for slugs and snails',
      description: 'Peak season for slug damage. Check undersides of leaves, use slug pellets or beer traps if needed.',
      priority: 'high',
      category: 'pest',
      icon: '🐌',
    });
  }

  // Aphids: warm weather
  if (['May', 'Jun', 'Jul', 'Aug', 'Sep'].includes(currentMonth) && placedPlants.length > 0) {
    tasks.push({
      id: 'pest-aphids',
      title: '🪲 Check for aphids',
      description: 'Warm season aphid risk. Check new growth and leaf undersides. Spray with neem or insecticidal soap if found.',
      priority: 'medium',
      category: 'pest',
      icon: '🪲',
    });
  }

  // Powdery mildew: warm, dry conditions
  if (['Jul', 'Aug', 'Sep'].includes(currentMonth) && placedPlants.length > 0) {
    tasks.push({
      id: 'pest-mildew',
      title: '🍂 Prevent powdery mildew',
      description: 'Warm, dry weather encourages powdery mildew. Improve air circulation, avoid overhead watering.',
      priority: 'medium',
      category: 'pest',
      icon: '🍂',
    });
  }

  return tasks;
}

/**
 * Check if a plant's feeding period includes the given month
 * Examples: "Once first flowers appear", "From June", "Apr-Jun", "After planting out"
 */
function isPlantInFeedingPeriod(whenStr: string, currentMonth: string): boolean {
  const lower = whenStr.toLowerCase();

  // "From [month]" patterns
  const fromMatch = lower.match(/from\s+(\w+)/i);
  if (fromMatch) {
    const targetMonth = fromMatch[1].substring(0, 3).toLowerCase();
    const targetIdx = MONTH_NAMES.findIndex(m => m.toLowerCase() === targetMonth);
    const currentIdx = MONTH_NAMES.indexOf(currentMonth);
    if (targetIdx >= 0 && currentIdx >= targetIdx) return true;
  }

  // "[Month]-[Month]" ranges
  if (whenStr.includes('-')) {
    const parts = whenStr.split('-');
    if (parts.length === 2) {
      const startMonth = parts[0].trim().substring(0, 3);
      const endMonth = parts[1].trim().substring(0, 3);
      const startIdx = MONTH_NAMES.indexOf(startMonth);
      const endIdx = MONTH_NAMES.indexOf(endMonth);
      const currentIdx = MONTH_NAMES.indexOf(currentMonth);
      if (startIdx >= 0 && endIdx >= 0) {
        if (startIdx <= endIdx) {
          return currentIdx >= startIdx && currentIdx <= endIdx;
        } else {
          // Wrapping (e.g., Nov-Feb)
          return currentIdx >= startIdx || currentIdx <= endIdx;
        }
      }
    }
  }

  // "Once [condition]" or "After [condition]" — assume ready if plant is 3+ weeks old
  if (lower.includes('once') || lower.includes('after')) {
    return true;
  }

  // "Early spring" = Feb-Mar
  if (lower.includes('early spring')) {
    return ['Feb', 'Mar'].includes(currentMonth);
  }

  // "Spring" = Mar-May
  if (lower.includes('spring') && !lower.includes('early')) {
    return ['Mar', 'Apr', 'May'].includes(currentMonth);
  }

  // "Summer" = Jun-Aug
  if (lower.includes('summer')) {
    return ['Jun', 'Jul', 'Aug'].includes(currentMonth);
  }

  // "Autumn" = Sep-Nov
  if (lower.includes('autumn')) {
    return ['Sep', 'Oct', 'Nov'].includes(currentMonth);
  }

  return false;
}

/**
 * Generate feeding schedule for this week (next 7 days)
 */
export function generateWeeklyFeedingSchedule(
  placedPlants: PlacedPlant[],
  now: Date = new Date(),
): GeneratedTask[] {
  const tasks: GeneratedTask[] = [];
  const seen = new Set<string>();
  const currentMonth = MONTH_NAMES[now.getMonth()];
  const weekFromNow = new Date(now);
  weekFromNow.setDate(weekFromNow.getDate() + 7);

  for (const pp of placedPlants) {
    if (seen.has(pp.plantId)) continue;
    if (NO_FEED.has(pp.plantId)) continue;

    const plant = plantDB.find(p => p.id === pp.plantId);
    const feeding = PLANT_FEEDING[pp.plantId];

    if (!plant || !feeding) continue;

    // Check if in feeding season
    const feedThisMonth = isPlantInFeedingPeriod(feeding.when, currentMonth);
    if (!feedThisMonth) continue;

    seen.add(pp.plantId);

    // Calculate when next feeding is due
    const daysElapsed = Math.floor((now.getTime() - new Date(pp.plantedAt).getTime()) / 86400000);
    if (daysElapsed < 21 && pp.stage !== 'established') continue;

    const daysSincePlanting = daysElapsed % feeding.intervalDays;
    const daysUntilNextFeeding = feeding.intervalDays - daysSincePlanting;

    // Show if feeding due within 7 days
    if (daysUntilNextFeeding <= 7) {
      tasks.push({
        id: `feed-week-${pp.plantId}`,
        title: `🌿 ${plant.emoji} Feed ${plant.name}`,
        description: `Due in ${daysUntilNextFeeding} day${daysUntilNextFeeding !== 1 ? 's' : ''}. ${feeding.frequency}. ${feeding.feedType}${feeding.products ? ` — ${feeding.products}` : ''}.`,
        priority: daysUntilNextFeeding <= 2 ? 'high' : 'medium',
        category: 'feeding',
        icon: plant.emoji,
      });
    }
  }

  return tasks;
}

/**
 * Generate monthly feeding schedule for all plants in season
 */
export function generateMonthlyFeedingSchedule(
  placedPlants: PlacedPlant[],
  now: Date = new Date(),
): GeneratedTask[] {
  const tasks: GeneratedTask[] = [];
  const seen = new Set<string>();
  const currentMonth = MONTH_NAMES[now.getMonth()];

  for (const pp of placedPlants) {
    if (seen.has(pp.plantId)) continue;
    if (NO_FEED.has(pp.plantId)) continue;

    const plant = plantDB.find(p => p.id === pp.plantId);
    const feeding = PLANT_FEEDING[pp.plantId];

    if (!plant || !feeding) continue;

    // Check if in feeding season
    const feedThisMonth = isPlantInFeedingPeriod(feeding.when, currentMonth);
    if (!feedThisMonth) continue;

    seen.add(pp.plantId);

    // Calculate days elapsed
    const daysElapsed = Math.floor((now.getTime() - new Date(pp.plantedAt).getTime()) / 86400000);
    if (daysElapsed < 21 && pp.stage !== 'established') continue;

    tasks.push({
      id: `feed-month-${pp.plantId}`,
      title: `🌿 ${plant.emoji} ${plant.name}`,
      description: `${feeding.frequency}. ${feeding.feedType}${feeding.products ? ` — ${feeding.products}` : ''}.`,
      priority: feeding.frequency.toLowerCase().includes('weekly') ? 'high' : 'medium',
      category: 'feeding',
      icon: plant.emoji,
    });
  }

  return tasks;
}

/**
 * Combine all generated tasks and deduplicate
 */
export async function generateAllTasks(
  placedPlants: PlacedPlant[],
  location: Location | null,
  now: Date = new Date(),
): Promise<GeneratedTask[]> {
  const [weatherTasks, feedingTasks, pestTasks] = await Promise.all([
    generateWeatherTasks(location, placedPlants),
    Promise.resolve(generateFeedingTasks(placedPlants, now)),
    Promise.resolve(generatePestTasks(placedPlants, now)),
  ]);

  // Deduplicate by ID
  const seen = new Set<string>();
  const allTasks = [...weatherTasks, ...feedingTasks, ...pestTasks];

  return allTasks.filter(task => {
    if (seen.has(task.id)) return false;
    seen.add(task.id);
    return true;
  });
}

