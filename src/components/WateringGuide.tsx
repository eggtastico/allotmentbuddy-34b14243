import { useState, useEffect, useCallback } from 'react';
import { PlacedPlant, PlacedStructure } from '@/types/garden';
import { getPlantById } from '@/data/plants';
import { getStructureById } from '@/data/structures';
import { supabase } from '@/integrations/supabase/client';
import { X, Droplets, CloudRain, Sun, Wind, Loader2, Search, ToggleLeft, ToggleRight, RefreshCw, Thermometer, Umbrella } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface WateringGuideProps {
  plants: PlacedPlant[];
  structures: PlacedStructure[];
  onClose: () => void;
}

interface WateringRec {
  name: string;
  emoji: string;
  location: 'indoor' | 'outdoor';
  selfWatering: boolean;
  recommendation: 'skip' | 'light' | 'normal' | 'heavy';
  reason: string;
  nextWaterDays: number;
}

interface WateringData {
  summary: string;
  overallStatus: 'water' | 'skip' | 'reduce' | 'extra';
  plants: WateringRec[];
  tips: string[];
  forecast: string;
}

const STATUS_CONFIG = {
  water: { label: 'Water Today', color: 'bg-blue-500', icon: '💧', textColor: 'text-blue-400' },
  skip: { label: 'Skip Watering', color: 'bg-emerald-500', icon: '✅', textColor: 'text-emerald-400' },
  reduce: { label: 'Reduce Watering', color: 'bg-amber-500', icon: '⚠️', textColor: 'text-amber-400' },
  extra: { label: 'Extra Water Needed', color: 'bg-red-500', icon: '🔴', textColor: 'text-red-400' },
};

const REC_CONFIG = {
  skip: { label: 'Skip', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  light: { label: 'Light', color: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
  normal: { label: 'Normal', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  heavy: { label: 'Heavy', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
};

export function WateringGuide({ plants, structures, onClose }: WateringGuideProps) {
  const [loading, setLoading] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [data, setData] = useState<WateringData | null>(null);
  const [selfWateringPlants, setSelfWateringPlants] = useState<Set<string>>(new Set());
  const [location, setLocation] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [weatherInfo, setWeatherInfo] = useState<any>(null);

  // Determine which plants are inside structures
  const getPlantLocation = useCallback((plant: PlacedPlant): 'indoor' | 'outdoor' => {
    for (const struct of structures) {
      const structData = getStructureById(struct.structureId);
      if (!structData?.canGrowInside) continue;
      if (
        plant.x >= struct.x &&
        plant.x < struct.x + struct.widthCells &&
        plant.y >= struct.y &&
        plant.y < struct.y + struct.heightCells
      ) {
        return 'indoor';
      }
    }
    return 'outdoor';
  }, [structures]);

  // Fetch weather
  const fetchWeather = useCallback(async (lat: number, lon: number) => {
    setWeatherLoading(true);
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&forecast_days=4`
      );
      const json = await res.json();
      const weatherCode = json.current?.weather_code ?? 0;
      const conditions = weatherCode >= 61 ? 'Rainy' : weatherCode >= 45 ? 'Foggy' : weatherCode >= 3 ? 'Overcast' : weatherCode >= 1 ? 'Partly cloudy' : 'Clear';

      const info = {
        temperature: json.current?.temperature_2m ?? 0,
        humidity: json.current?.relative_humidity_2m ?? 0,
        windSpeed: json.current?.wind_speed_10m ?? 0,
        conditions,
        locationName: location || 'Your location',
        forecast: json.daily?.time?.slice(1, 4).map((d: string, i: number) => ({
          date: d,
          tempMax: json.daily.temperature_2m_max[i + 1],
          tempMin: json.daily.temperature_2m_min[i + 1],
          precip: json.daily.precipitation_sum[i + 1],
        })) || [],
      };
      setWeatherInfo(info);
    } catch {
      toast.error('Failed to fetch weather data');
    } finally {
      setWeatherLoading(false);
    }
  }, [location]);

  // Get location
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLocation('Your location');
      },
      () => {
        // Default to London
        setCoords({ lat: 51.5074, lon: -0.1278 });
        setLocation('London');
      }
    );
  }, []);

  useEffect(() => {
    if (coords) fetchWeather(coords.lat, coords.lon);
  }, [coords, fetchWeather]);

  const handleSearch = async () => {
    if (!searchInput.trim()) return;
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchInput)}&count=1`);
      const json = await res.json();
      if (json.results?.[0]) {
        const r = json.results[0];
        setCoords({ lat: r.latitude, lon: r.longitude });
        setLocation(`${r.name}, ${r.country}`);
      } else {
        toast.error('Location not found');
      }
    } catch {
      toast.error('Search failed');
    }
  };

  const toggleSelfWatering = (plantId: string) => {
    setSelfWateringPlants(prev => {
      const next = new Set(prev);
      if (next.has(plantId)) next.delete(plantId);
      else next.add(plantId);
      return next;
    });
  };

  const getAIRecommendation = async () => {
    if (!weatherInfo || plants.length === 0) {
      toast.error('Place some plants and wait for weather data first');
      return;
    }
    setLoading(true);
    try {
      const plantData = plants.map(p => {
        const plantInfo = getPlantById(p.plantId);
        if (!plantInfo) return null;
        return {
          name: plantInfo.name,
          emoji: plantInfo.emoji,
          category: plantInfo.category,
          location: getPlantLocation(p),
          selfWatering: selfWateringPlants.has(p.plantId),
        };
      }).filter(Boolean);

      const structData = structures.map(s => {
        const info = getStructureById(s.structureId);
        if (!info) return null;
        return {
          name: info.name,
          x: s.x, y: s.y,
          width: s.widthCells, height: s.heightCells,
          canGrowInside: info.canGrowInside,
        };
      }).filter(Boolean);

      const { data: result, error } = await supabase.functions.invoke('watering-guide', {
        body: { weatherData: weatherInfo, plants: plantData, structures: structData },
      });

      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      setData(result);
    } catch (err: any) {
      toast.error(err.message || 'Failed to get watering advice');
    } finally {
      setLoading(false);
    }
  };

  const uniquePlants = Array.from(new Map(plants.map(p => [p.plantId, p])).values());

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-blue-400" />
            <h2 className="font-bold text-foreground">AI Watering Guide</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Location search */}
          <div className="flex gap-2">
            <Input
              placeholder="Enter postcode or city..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="text-sm"
            />
            <Button size="sm" onClick={handleSearch} variant="outline">
              <Search className="h-4 w-4" />
            </Button>
          </div>

          {location && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>📍 {location}</span>
            </div>
          )}

          {/* Current weather summary */}
          {weatherLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading weather...</span>
            </div>
          ) : weatherInfo && (
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-muted/50 rounded-lg p-2 text-center">
                <Thermometer className="h-4 w-4 mx-auto text-orange-400" />
                <p className="text-sm font-bold text-foreground">{weatherInfo.temperature}°C</p>
                <p className="text-[10px] text-muted-foreground">Temp</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-2 text-center">
                <Droplets className="h-4 w-4 mx-auto text-blue-400" />
                <p className="text-sm font-bold text-foreground">{weatherInfo.humidity}%</p>
                <p className="text-[10px] text-muted-foreground">Humidity</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-2 text-center">
                <Wind className="h-4 w-4 mx-auto text-teal-400" />
                <p className="text-sm font-bold text-foreground">{weatherInfo.windSpeed}</p>
                <p className="text-[10px] text-muted-foreground">km/h</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-2 text-center">
                <Umbrella className="h-4 w-4 mx-auto text-indigo-400" />
                <p className="text-sm font-bold text-foreground">{weatherInfo.conditions}</p>
                <p className="text-[10px] text-muted-foreground">Now</p>
              </div>
            </div>
          )}

          {/* Self-watering system toggles */}
          {uniquePlants.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Self-Watering Systems</h3>
              <p className="text-[11px] text-muted-foreground">Toggle on for plants connected to a self-watering system</p>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {uniquePlants.map(p => {
                  const info = getPlantById(p.plantId);
                  if (!info) return null;
                  const loc = getPlantLocation(p);
                  return (
                    <div key={p.plantId} className="flex items-center justify-between py-1 px-2 rounded-md bg-muted/30">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{info.emoji}</span>
                        <span className="text-xs text-foreground">{info.name}</span>
                        <Badge variant="outline" className={`text-[9px] ${loc === 'indoor' ? 'border-primary/50 text-primary' : 'border-muted-foreground/30 text-muted-foreground'}`}>
                          {loc === 'indoor' ? '🏠 Indoor' : '🌧️ Outdoor'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-muted-foreground">💧 Auto</span>
                        <Switch
                          checked={selfWateringPlants.has(p.plantId)}
                          onCheckedChange={() => toggleSelfWatering(p.plantId)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Get recommendation button */}
          <Button
            onClick={getAIRecommendation}
            disabled={loading || weatherLoading || plants.length === 0}
            className="w-full"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing...</>
            ) : (
              <><Droplets className="h-4 w-4 mr-2" /> Get AI Watering Advice</>
            )}
          </Button>

          {plants.length === 0 && (
            <p className="text-xs text-muted-foreground text-center">Place some plants on the grid first to get watering advice.</p>
          )}

          {/* AI Results */}
          {data && (
            <div className="space-y-3">
              {/* Overall status */}
              <div className={`rounded-lg p-3 border ${data.overallStatus === 'skip' ? 'border-emerald-500/30 bg-emerald-500/10' : data.overallStatus === 'extra' ? 'border-red-500/30 bg-red-500/10' : data.overallStatus === 'reduce' ? 'border-amber-500/30 bg-amber-500/10' : 'border-blue-500/30 bg-blue-500/10'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{STATUS_CONFIG[data.overallStatus]?.icon}</span>
                  <span className={`font-bold text-sm ${STATUS_CONFIG[data.overallStatus]?.textColor}`}>
                    {STATUS_CONFIG[data.overallStatus]?.label}
                  </span>
                </div>
                <p className="text-xs text-foreground/80">{data.summary}</p>
              </div>

              {/* Per-plant recommendations */}
              {data.plants?.length > 0 && (
                <div className="space-y-1.5">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Plant-by-Plant</h3>
                  {data.plants.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded-md bg-muted/30">
                      <span className="text-sm">{p.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-foreground">{p.name}</span>
                          <Badge variant="outline" className={`text-[9px] ${REC_CONFIG[p.recommendation]?.color || ''}`}>
                            {REC_CONFIG[p.recommendation]?.label || p.recommendation}
                          </Badge>
                          {p.selfWatering && <Badge variant="outline" className="text-[9px] border-blue-500/30 text-blue-300">💧 Auto</Badge>}
                          <Badge variant="outline" className={`text-[9px] ${p.location === 'indoor' ? 'border-primary/50 text-primary' : 'border-muted-foreground/30'}`}>
                            {p.location === 'indoor' ? '🏠' : '🌧️'}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">{p.reason}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        Next: {p.nextWaterDays}d
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Forecast outlook */}
              {data.forecast && (
                <div className="bg-muted/30 rounded-lg p-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">3-Day Outlook</h3>
                  <p className="text-xs text-foreground/80">{data.forecast}</p>
                </div>
              )}

              {/* Tips */}
              {data.tips?.length > 0 && (
                <div className="space-y-1">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tips</h3>
                  {data.tips.map((tip, i) => (
                    <p key={i} className="text-xs text-foreground/80 flex items-start gap-1.5">
                      <span className="text-primary">💡</span> {tip}
                    </p>
                  ))}
                </div>
              )}

              {/* Refresh */}
              <Button variant="outline" size="sm" onClick={getAIRecommendation} className="w-full text-xs" disabled={loading}>
                <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh Advice
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
