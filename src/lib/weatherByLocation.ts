import { Location } from '@/types/garden';
import { calculateFrostDates, calculateSunTimes } from '@/hooks/useLocation';

export interface WeatherData {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDirection: string;
  condition: string;
  icon: string;
  uvIndex: number;
  rainfall: number;
  cloudCover: number;
  pressure: number;
  visibility: number;
}

export interface FrostData {
  lastSpringFrost: string;
  firstFallFrost: string;
  daysUntilLastFrost: number;
  daysSinceFrostRisk: number;
}

export interface SunData {
  sunrise: string;
  sunset: string;
  dayLength: number;
}

/**
 * Fetch current weather data for a location
 * Uses Open-Meteo API (free, no auth required)
 */
export async function getWeatherData(location: Location): Promise<WeatherData | null> {
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,weather_code,uv_index,cloud_cover,pressure_msl,visibility&timezone=auto`
    );

    if (!response.ok) {
      throw new Error('Weather API failed');
    }

    const data = await response.json();
    const current = data.current;

    return {
      temperature: current.temperature_2m,
      feelsLike: current.apparent_temperature,
      humidity: current.relative_humidity_2m,
      windSpeed: current.wind_speed_10m,
      windDirection: getWindDirection(current.wind_direction_10m),
      condition: getWeatherCondition(current.weather_code),
      icon: getWeatherIcon(current.weather_code),
      uvIndex: current.uv_index,
      rainfall: 0, // Would need forecast data
      cloudCover: current.cloud_cover,
      pressure: current.pressure_msl,
      visibility: current.visibility / 1000, // Convert to km
    };
  } catch (error) {
    console.error('Failed to fetch weather:', error);
    return null;
  }
}

/**
 * Get frost dates for a location
 */
export function getFrostData(location: Location): FrostData {
  const { lastSpringFrost, firstFallFrost } = calculateFrostDates(location.lat);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastFrostDate = new Date(lastSpringFrost);
  const firstFrostDate = new Date(firstFallFrost);

  const daysUntilLastFrost = Math.ceil((lastFrostDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const daysSinceFrostRisk = Math.ceil((today.getTime() - lastFrostDate.getTime()) / (1000 * 60 * 60 * 24));

  return {
    lastSpringFrost,
    firstFallFrost,
    daysUntilLastFrost: Math.max(0, daysUntilLastFrost),
    daysSinceFrostRisk: Math.max(0, daysSinceFrostRisk),
  };
}

/**
 * Get sunrise/sunset times for a location
 */
export function getSunData(location: Location): SunData {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
  const { sunrise, sunset } = calculateSunTimes(location.lat, dayOfYear);

  // Calculate day length in minutes
  const sunriseMinutes = timeToMinutes(sunrise);
  const sunsetMinutes = timeToMinutes(sunset);
  const dayLength = Math.max(0, sunsetMinutes - sunriseMinutes);

  return {
    sunrise,
    sunset,
    dayLength,
  };
}

/**
 * Get gardening recommendations based on location and current conditions
 */
export function getSeasonalRecommendations(location: Location): string[] {
  const frost = getFrostData(location);
  const sun = getSunData(location);
  const recommendations: string[] = [];

  const month = new Date().getMonth();

  if (frost.daysUntilLastFrost > 0 && frost.daysUntilLastFrost <= 14) {
    recommendations.push(`⚠️ Last frost date is ${frost.daysUntilLastFrost} days away - protect tender plants`);
  }

  if (frost.daysSinceFrostRisk < 7) {
    recommendations.push('✅ Frost risk has passed - safe to plant tender varieties');
  }

  if (sun.dayLength < 600) {
    // Less than 10 hours of daylight
    recommendations.push('🌅 Short day length - focus on fast-growing crops');
  } else if (sun.dayLength > 900) {
    // More than 15 hours of daylight
    recommendations.push('☀️ Long day length - good time for growth-intensive crops');
  }

  // Seasonal recommendations
  if (month === 2 || month === 3) {
    recommendations.push('🌱 Spring planting season - prepare beds and start seeds');
  } else if (month === 5 || month === 6) {
    recommendations.push('🌻 Early summer - monitor for pests and ensure adequate watering');
  } else if (month === 8 || month === 9) {
    recommendations.push('🍂 Late summer - prepare for fall crops and harvest');
  } else if (month === 10 || month === 11) {
    recommendations.push('🍁 Fall/Winter - plan for next year and plant garlic');
  } else if (month === 0 || month === 1) {
    recommendations.push('❄️ Winter - order seeds and plan spring garden');
  }

  return recommendations;
}

// Helper functions
function getWindDirection(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

function getWeatherCondition(code: number): string {
  // WMO Weather interpretation codes
  if (code === 0) return 'Clear sky';
  if (code === 1 || code === 2) return 'Mostly clear';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Foggy';
  if (code >= 51 && code <= 67) return 'Drizzle';
  if (code >= 80 && code <= 82) return 'Rain showers';
  if (code >= 85 && code <= 86) return 'Snow showers';
  if (code === 71 || code === 73 || code === 75 || code === 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain showers';
  if (code === 95 || code === 96 || code === 99) return 'Thunderstorm';
  return 'Unknown';
}

function getWeatherIcon(code: number): string {
  // Returns emoji for the weather condition
  if (code === 0) return '☀️';
  if (code === 1 || code === 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code === 45 || code === 48) return '🌫️';
  if (code >= 51 && code <= 67) return '🌦️';
  if (code >= 71 && code <= 77 || code >= 85 && code <= 86) return '🌨️';
  if (code >= 80 && code <= 82) return '🌧️';
  if (code === 95 || code === 96 || code === 99) return '⛈️';
  return '🌡️';
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}
