import { useState, useEffect } from 'react';
import { PlacedPlant, Plant } from '@/types/garden';
import { plants as allPlants, getPlantById } from '@/data/plants';
import { X, CloudSun, Droplets, Wind, Sprout, TrendingUp, MapPin, Loader2, Leaf } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface LocationData {
  name: string;
  lat: number;
  lon: number;
  region?: string;
}

interface WeatherData {
  temperature: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  daily: {
    tempMax: number[];
    tempMin: number[];
    precipSum: number[];
    dates: string[];
  };
  locationName: string;
  lastFrostDate: string | null;
  firstFrostDate: string | null;
}

interface YieldEstimate {
  plantId: string;
  name: string;
  emoji: string;
  count: number;
  yieldPerPlant: string;
  totalYieldKg: number;
  weatherMultiplier: number;
  adjustedYieldKg: number;
  harvestWindow: string;
}

interface PlantRecommendation {
  plant: Plant;
  reason: string;
  action: 'sow_indoors' | 'sow_outdoors' | 'harvest';
  urgency: 'now' | 'soon' | 'upcoming';
}

const WEATHER_CODES: Record<number, { label: string; icon: string }> = {
  0: { label: 'Clear sky', icon: '☀️' },
  1: { label: 'Mainly clear', icon: '🌤️' },
  2: { label: 'Partly cloudy', icon: '⛅' },
  3: { label: 'Overcast', icon: '☁️' },
  45: { label: 'Foggy', icon: '🌫️' },
  48: { label: 'Rime fog', icon: '🌫️' },
  51: { label: 'Light drizzle', icon: '🌦️' },
  53: { label: 'Moderate drizzle', icon: '🌦️' },
  55: { label: 'Dense drizzle', icon: '🌧️' },
  61: { label: 'Slight rain', icon: '🌧️' },
  63: { label: 'Moderate rain', icon: '🌧️' },
  65: { label: 'Heavy rain', icon: '🌧️' },
  71: { label: 'Slight snow', icon: '🌨️' },
  73: { label: 'Moderate snow', icon: '🌨️' },
  75: { label: 'Heavy snow', icon: '❄️' },
  80: { label: 'Rain showers', icon: '🌦️' },
  95: { label: 'Thunderstorm', icon: '⛈️' },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseMonthRange(range?: string): number[] {
  if (!range || range === 'Year-round') return range === 'Year-round' ? Array.from({ length: 12 }, (_, i) => i) : [];
  const months: number[] = [];
  const parts = range.split(',').map(s => s.trim());
  for (const part of parts) {
    const [start, end] = part.split('-').map(m => MONTHS.indexOf(m.trim()));
    if (start === -1) continue;
    if (end === undefined || end === -1) { months.push(start); }
    else { for (let i = start; i <= (end < start ? end + 12 : end); i++) months.push(i % 12); }
  }
  return months;
}

function parseYield(yieldStr?: string): number {
  if (!yieldStr) return 0;
  const match = yieldStr.match(/([\d.]+)(?:-([\d.]+))?\s*kg/);
  if (!match) return 0;
  const low = parseFloat(match[1]);
  const high = match[2] ? parseFloat(match[2]) : low;
  return (low + high) / 2;
}

function calcWeatherMultiplier(weather: WeatherData): number {
  const temp = weather.temperature;
  const humidity = weather.humidity;
  let mult = 1.0;
  if (temp >= 15 && temp <= 25) mult += 0.1;
  else if (temp < 5 || temp > 35) mult -= 0.3;
  else if (temp < 10 || temp > 30) mult -= 0.15;
  if (humidity >= 40 && humidity <= 70) mult += 0.05;
  else if (humidity > 85) mult -= 0.1;
  const avgPrecip = weather.daily.precipSum.reduce((a, b) => a + b, 0) / weather.daily.precipSum.length;
  if (avgPrecip >= 1 && avgPrecip <= 5) mult += 0.05;
  else if (avgPrecip > 15) mult -= 0.15;
  return Math.max(0.4, Math.min(1.3, mult));
}

function getPlantingRecommendations(weather: WeatherData): PlantRecommendation[] {
  const now = new Date();
  const currentMonth = now.getMonth();
  const nextMonth = (currentMonth + 1) % 12;
  const minTemp = Math.min(...weather.daily.tempMin);
  const frostRisk = minTemp <= 2;

  const recs: PlantRecommendation[] = [];

  for (const plant of allPlants) {
    const sowIndoorMonths = parseMonthRange(plant.sowIndoors);
    const sowOutdoorMonths = parseMonthRange(plant.sowOutdoors);

    if (sowIndoorMonths.includes(currentMonth)) {
      recs.push({
        plant,
        reason: frostRisk
          ? `Start indoors now — frost risk this week (${minTemp.toFixed(0)}°C)`
          : `Perfect time to sow indoors for transplanting later`,
        action: 'sow_indoors',
        urgency: 'now',
      });
    } else if (sowOutdoorMonths.includes(currentMonth)) {
      if (frostRisk) {
        recs.push({
          plant,
          reason: `Ready to sow outdoors but watch for frost (min ${minTemp.toFixed(0)}°C) — wait for warmer nights`,
          action: 'sow_outdoors',
          urgency: 'soon',
        });
      } else {
        recs.push({
          plant,
          reason: `Great week to direct sow outdoors — no frost risk, temps ${Math.round(weather.daily.tempMin[0])}–${Math.round(weather.daily.tempMax[0])}°C`,
          action: 'sow_outdoors',
          urgency: 'now',
        });
      }
    } else if (sowIndoorMonths.includes(nextMonth) || sowOutdoorMonths.includes(nextMonth)) {
      recs.push({
        plant,
        reason: `Coming up next month — get seeds ready!`,
        action: sowIndoorMonths.includes(nextMonth) ? 'sow_indoors' : 'sow_outdoors',
        urgency: 'upcoming',
      });
    }
  }

  const order = { now: 0, soon: 1, upcoming: 2 };
  recs.sort((a, b) => order[a.urgency] - order[b.urgency]);
  return recs.slice(0, 12);
}

interface Props {
  plants: PlacedPlant[];
  location: LocationData | null;
  onClose: () => void;
}

export function WeatherYieldPanel({ plants, location: loc, onClose }: Props) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'weather' | 'recommendations'>('weather');

  // Fetch weather using shared location
  useEffect(() => {
    if (!loc) return;
    const fetchWeather = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&forecast_days=7`
        );
        if (!res.ok) throw new Error('Weather API failed');
        const data = await res.json();

        const locationName = loc.name || `${loc.lat.toFixed(1)}°, ${loc.lon.toFixed(1)}°`;
        const dailyMins = data.daily.temperature_2m_min as number[];
        const lastFrost = dailyMins.findIndex((t: number) => t <= 0);
        const firstFrost = [...dailyMins].reverse().findIndex((t: number) => t <= 0);

        setWeather({
          temperature: data.current.temperature_2m,
          humidity: data.current.relative_humidity_2m,
          windSpeed: data.current.wind_speed_10m,
          weatherCode: data.current.weather_code,
          daily: {
            tempMax: data.daily.temperature_2m_max,
            tempMin: data.daily.temperature_2m_min,
            precipSum: data.daily.precipitation_sum,
            dates: data.daily.time,
          },
          locationName,
          lastFrostDate: lastFrost >= 0 ? data.daily.time[lastFrost] : null,
          firstFrostDate: firstFrost >= 0 ? data.daily.time[dailyMins.length - 1 - firstFrost] : null,
        });
      } catch (e: any) {
        setError(e.message || 'Failed to fetch weather');
      } finally {
        setLoading(false);
      }
    };
    fetchWeather();
  }, [loc]);

  const weatherInfo = weather ? WEATHER_CODES[weather.weatherCode] || { label: 'Unknown', icon: '🌡️' } : null;
  const multiplier = weather ? calcWeatherMultiplier(weather) : 1;
  const recommendations = weather ? getPlantingRecommendations(weather) : [];

  const uniquePlants = [...new Set(plants.map(p => p.plantId))];
  const yields: YieldEstimate[] = uniquePlants.map(pid => {
    const plant = getPlantById(pid);
    if (!plant) return null;
    const count = plants.filter(p => p.plantId === pid).length;
    const baseYield = parseYield(plant.yieldPerPlant);
    const total = baseYield * count;
    return {
      plantId: pid, name: plant.name, emoji: plant.emoji, count,
      yieldPerPlant: plant.yieldPerPlant || 'N/A', totalYieldKg: total,
      weatherMultiplier: multiplier, adjustedYieldKg: total * multiplier,
      harvestWindow: plant.harvest || 'N/A',
    };
  }).filter(Boolean) as YieldEstimate[];

  const totalBaseKg = yields.reduce((s, y) => s + y.totalYieldKg, 0);
  const totalAdjustedKg = yields.reduce((s, y) => s + y.adjustedYieldKg, 0);

  const urgencyColors = {
    now: 'bg-primary/15 border-primary/30',
    soon: 'bg-accent/10 border-accent/30',
    upcoming: 'bg-muted/40 border-border',
  };
  const urgencyLabels = {
    now: { text: 'This week', variant: 'default' as const },
    soon: { text: 'Wait a bit', variant: 'secondary' as const },
    upcoming: { text: 'Next month', variant: 'outline' as const },
  };
  const actionLabels = {
    sow_indoors: '🏠 Sow indoors',
    sow_outdoors: '🌱 Sow outdoors',
    harvest: '🧺 Harvest',
  };

  return (
    <div className="fixed inset-0 bg-foreground/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-auto animate-fade-in" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border p-4 z-10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CloudSun className="h-5 w-5 text-primary" />
              <h2 className="font-bold text-foreground">Weather & Yield Predictor</h2>
            </div>
            <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
          </div>

          {loc && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" /> Using location: <span className="font-medium text-foreground">{loc.name}</span>
              <span className="text-[10px]">— change in header</span>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1">
            <Button
              variant={tab === 'weather' ? 'default' : 'ghost'}
              size="sm" className="h-7 text-xs"
              onClick={() => setTab('weather')}
            >
              <CloudSun className="h-3 w-3 mr-1" /> Weather & Yield
            </Button>
            <Button
              variant={tab === 'recommendations' ? 'default' : 'ghost'}
              size="sm" className="h-7 text-xs"
              onClick={() => setTab('recommendations')}
            >
              <Leaf className="h-3 w-3 mr-1" /> What to Plant
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-5">
          {!loc ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Set your location in the header to see weather data</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Fetching weather data…
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive text-sm">{error}</div>
          ) : weather && tab === 'weather' ? (
            <>
              {/* Current weather */}
              <div className="bg-muted/40 rounded-lg p-4">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                  <MapPin className="h-3.5 w-3.5" /> {weather.locationName}
                </div>
                <div className="flex items-center gap-6 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">{weatherInfo?.icon}</span>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{weather.temperature}°C</p>
                      <p className="text-xs text-muted-foreground">{weatherInfo?.label}</p>
                    </div>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Droplets className="h-3.5 w-3.5" /> {weather.humidity}%
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Wind className="h-3.5 w-3.5" /> {weather.windSpeed} km/h
                    </div>
                  </div>
                </div>
              </div>

              {/* Frost alert */}
              {weather.daily.tempMin.some(t => t <= 2) && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm">
                  <span className="font-semibold text-destructive">⚠️ Frost Risk!</span>
                  <span className="text-foreground/80 ml-1">
                    Min temp of {Math.min(...weather.daily.tempMin).toFixed(0)}°C forecast this week. Protect tender plants!
                  </span>
                </div>
              )}

              {/* 7-day forecast */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">7-Day Forecast</h3>
                <div className="grid grid-cols-7 gap-1.5 text-center text-xs">
                  {weather.daily.dates.map((date, i) => {
                    const day = new Date(date).toLocaleDateString('en', { weekday: 'short' });
                    const precip = weather.daily.precipSum[i];
                    return (
                      <div key={date} className="bg-muted/30 rounded-md p-2">
                        <p className="text-muted-foreground font-medium">{day}</p>
                        <p className="text-foreground font-bold">{Math.round(weather.daily.tempMax[i])}°</p>
                        <p className="text-muted-foreground">{Math.round(weather.daily.tempMin[i])}°</p>
                        {precip > 0 && (
                          <p className="text-primary text-[10px] mt-0.5">💧{precip.toFixed(1)}mm</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Growing score */}
              <div className="bg-muted/30 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-primary" /> Growing Conditions Score
                  </span>
                  <Badge variant={multiplier >= 1 ? 'default' : 'secondary'} className="text-xs">
                    {multiplier >= 1.1 ? 'Excellent' : multiplier >= 0.95 ? 'Good' : multiplier >= 0.7 ? 'Fair' : 'Poor'}
                  </Badge>
                </div>
                <Progress value={multiplier * 77} className="h-2" />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Based on temperature, humidity, and precipitation. Yield adjusted by ×{multiplier.toFixed(2)}
                </p>
              </div>

              {/* Yield estimates */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                  <Sprout className="h-4 w-4 text-primary" /> Estimated Harvest Yield
                </h3>
                {yields.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Add plants to see yield estimates</p>
                ) : (
                  <>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {yields.map(y => (
                        <div key={y.plantId} className="flex items-center justify-between bg-muted/20 rounded-md px-3 py-2 text-sm">
                          <div className="flex items-center gap-2">
                            <span>{y.emoji}</span>
                            <span className="font-medium text-foreground">{y.name}</span>
                            <Badge variant="outline" className="text-[10px] px-1 py-0">×{y.count}</Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            ~{y.adjustedYieldKg.toFixed(1)}kg
                          </span>
                        </div>
                      ))}
                    </div>
                    {totalBaseKg > 0 && (
                      <div className="mt-2 pt-2 border-t border-border flex justify-between text-sm">
                        <span className="text-muted-foreground">Total estimated yield:</span>
                        <span className="font-bold text-foreground">{totalAdjustedKg.toFixed(1)} kg</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          ) : weather && tab === 'recommendations' ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Based on current weather at {weather.locationName}</p>
              {recommendations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No specific recommendations right now.</p>
              ) : (
                recommendations.map((rec, i) => (
                  <div key={i} className={`border rounded-lg p-3 ${urgencyColors[rec.urgency]}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{rec.plant.emoji}</span>
                      <span className="font-medium text-foreground text-sm">{rec.plant.name}</span>
                      <Badge variant={urgencyLabels[rec.urgency].variant} className="text-[10px]">
                        {urgencyLabels[rec.urgency].text}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground ml-auto">{actionLabels[rec.action]}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{rec.reason}</p>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
