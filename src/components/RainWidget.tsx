import { useState, useEffect } from 'react';
import { CloudRain, Sun, CloudDrizzle, Droplets, Wind } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface LocationData {
  name: string;
  lat: number;
  lon: number;
}

interface ForecastDay {
  date: string;
  dayLabel: string;
  tempMax: number;
  tempMin: number;
  precipSum: number;
  weatherCode: number;
}

interface WeatherSnapshot {
  temperature: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  forecast: ForecastDay[];
}

const WEATHER_ICONS: Record<number, string> = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '❄️',
  80: '🌦️', 81: '🌦️', 82: '🌧️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
};

function weatherIcon(code: number): string {
  return WEATHER_ICONS[code] ?? '🌡️';
}

interface Props {
  location: LocationData | null;
}

export function RainWidget({ location }: Props) {
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!location) return;
    setLoading(true);
    const fetchWeather = async () => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&timezone=auto&forecast_days=5`
        );
        const data = await res.json();
        const days: ForecastDay[] = (data.daily.time as string[]).map((date: string, i: number) => ({
          date,
          dayLabel: i === 0 ? 'Today' : new Date(date).toLocaleDateString('en', { weekday: 'short' }),
          tempMax: data.daily.temperature_2m_max[i],
          tempMin: data.daily.temperature_2m_min[i],
          precipSum: data.daily.precipitation_sum[i],
          weatherCode: data.daily.weather_code[i],
        }));
        setWeather({
          temperature: data.current.temperature_2m,
          humidity: data.current.relative_humidity_2m,
          windSpeed: data.current.wind_speed_10m,
          weatherCode: data.current.weather_code,
          forecast: days,
        });
      } catch {
        setWeather(null);
      }
      setLoading(false);
    };
    fetchWeather();
  }, [location]);

  if (!location) return null;

  if (loading || !weather) {
    return (
      <div className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-secondary/50" title="Loading weather…">
        <CloudDrizzle className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium text-muted-foreground">…</span>
      </div>
    );
  }

  const icon = weather.weatherCode <= 3
    ? <Sun className="h-3.5 w-3.5 text-amber-500" />
    : weather.weatherCode >= 51
      ? <CloudRain className="h-3.5 w-3.5 text-blue-500" />
      : <CloudDrizzle className="h-3.5 w-3.5 text-muted-foreground" />;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-secondary/50 hover:bg-secondary/80 transition-colors cursor-pointer"
          title="Click for 5-day forecast"
        >
          {icon}
          <span className="font-medium text-foreground">{Math.round(weather.temperature)}°C</span>
          <span className="text-[10px] text-muted-foreground hidden sm:inline">{weatherIcon(weather.weatherCode)}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="space-y-3">
          {/* Current conditions */}
          <div className="flex items-center gap-3">
            <span className="text-2xl">{weatherIcon(weather.weatherCode)}</span>
            <div>
              <p className="text-lg font-bold text-foreground">{weather.temperature}°C</p>
              <div className="flex gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-0.5"><Droplets className="h-3 w-3" /> {weather.humidity}%</span>
                <span className="flex items-center gap-0.5"><Wind className="h-3 w-3" /> {weather.windSpeed} km/h</span>
              </div>
            </div>
          </div>

          {/* 5-day forecast */}
          <div className="grid grid-cols-5 gap-1.5 text-center text-[11px]">
            {weather.forecast.map((day) => (
              <div key={day.date} className="bg-muted/40 rounded-md px-1.5 py-2 min-w-[52px]">
                <p className="text-muted-foreground font-medium">{day.dayLabel}</p>
                <p className="text-base my-0.5">{weatherIcon(day.weatherCode)}</p>
                <p className="font-bold text-foreground">{Math.round(day.tempMax)}°</p>
                <p className="text-muted-foreground">{Math.round(day.tempMin)}°</p>
                {day.precipSum > 0 && (
                  <p className="text-primary text-[9px] mt-0.5">{day.precipSum.toFixed(1)}mm</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
