import { useState, useEffect } from 'react';
import { PlacedPlant } from '@/types/garden';
import { getPlantById } from '@/data/plants';
import { X, CloudSun, Thermometer, Droplets, Wind, Sprout, TrendingUp, MapPin, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

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

interface Props {
  plants: PlacedPlant[];
  onClose: () => void;
}

export function WeatherYieldPanel({ plants, onClose }: Props) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => setCoords({ lat: 51.5, lon: -0.12 }) // default London
      );
    } else {
      setCoords({ lat: 51.5, lon: -0.12 });
    }
  }, []);

  useEffect(() => {
    if (!coords) return;
    const fetchWeather = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&forecast_days=7`
        );
        if (!res.ok) throw new Error('Weather API failed');
        const data = await res.json();

        // Reverse geocode for location name
        let locationName = `${coords.lat.toFixed(1)}°, ${coords.lon.toFixed(1)}°`;
        try {
          const geoRes = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=&latitude=${coords.lat}&longitude=${coords.lon}&count=1`
          );
          // fallback - use timezone as location
          locationName = data.timezone?.split('/').pop()?.replace(/_/g, ' ') || locationName;
        } catch {}

        // Estimate frost dates from daily data
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
  }, [coords]);

  const weatherInfo = weather ? WEATHER_CODES[weather.weatherCode] || { label: 'Unknown', icon: '🌡️' } : null;
  const multiplier = weather ? calcWeatherMultiplier(weather) : 1;

  // Yield estimates
  const uniquePlants = [...new Set(plants.map(p => p.plantId))];
  const yields: YieldEstimate[] = uniquePlants.map(pid => {
    const plant = getPlantById(pid);
    if (!plant) return null;
    const count = plants.filter(p => p.plantId === pid).length;
    const baseYield = parseYield(plant.yieldPerPlant);
    const total = baseYield * count;
    return {
      plantId: pid,
      name: plant.name,
      emoji: plant.emoji,
      count,
      yieldPerPlant: plant.yieldPerPlant || 'N/A',
      totalYieldKg: total,
      weatherMultiplier: multiplier,
      adjustedYieldKg: total * multiplier,
      harvestWindow: plant.harvest || 'N/A',
    };
  }).filter(Boolean) as YieldEstimate[];

  const totalBaseKg = yields.reduce((s, y) => s + y.totalYieldKg, 0);
  const totalAdjustedKg = yields.reduce((s, y) => s + y.adjustedYieldKg, 0);

  return (
    <div className="fixed inset-0 bg-foreground/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-auto animate-fade-in" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <CloudSun className="h-5 w-5 text-primary" />
            <h2 className="font-bold text-foreground">Weather & Yield Predictor</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-4 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Fetching weather data…
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive text-sm">{error}</div>
          ) : weather ? (
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

              {/* 7-day forecast mini chart */}
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

              {/* Weather growing score */}
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
                          <div className="text-right">
                            <span className="font-semibold text-foreground">{y.adjustedYieldKg.toFixed(1)} kg</span>
                            {y.weatherMultiplier !== 1 && (
                              <span className="text-[10px] text-muted-foreground ml-1 line-through">{y.totalYieldKg.toFixed(1)}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-sm">
                      <span className="font-semibold text-foreground">Total estimated harvest</span>
                      <div className="text-right">
                        <span className="text-lg font-bold text-primary">{totalAdjustedKg.toFixed(1)} kg</span>
                        {totalBaseKg !== totalAdjustedKg && (
                          <span className="text-xs text-muted-foreground ml-1">(base: {totalBaseKg.toFixed(1)} kg)</span>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
