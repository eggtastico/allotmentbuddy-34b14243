import { useState, useEffect } from 'react';
import { CloudRain, Sun, CloudDrizzle } from 'lucide-react';

interface LocationData {
  name: string;
  lat: number;
  lon: number;
}

interface Props {
  location: LocationData | null;
}

export function RainWidget({ location }: Props) {
  const [rainPct, setRainPct] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!location) return;
    setLoading(true);
    const fetchRain = async () => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&hourly=precipitation_probability&forecast_days=1&timezone=auto`
        );
        const data = await res.json();
        const probs: number[] = data?.hourly?.precipitation_probability || [];
        // Average of next 24 hours
        const avg = probs.length > 0 ? Math.round(probs.reduce((a, b) => a + b, 0) / probs.length) : 0;
        setRainPct(avg);
      } catch {
        setRainPct(null);
      }
      setLoading(false);
    };
    fetchRain();
  }, [location]);

  if (!location) return null;

  const icon = rainPct === null || loading ? (
    <CloudDrizzle className="h-3.5 w-3.5 text-muted-foreground" />
  ) : rainPct > 50 ? (
    <CloudRain className="h-3.5 w-3.5 text-blue-500" />
  ) : (
    <Sun className="h-3.5 w-3.5 text-amber-500" />
  );

  const label = loading ? '...' : rainPct !== null ? `${rainPct}%` : '—';

  return (
    <div className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-secondary/50" title="Rain probability next 24h">
      {icon}
      <span className="font-medium text-foreground">{label}</span>
      <span className="text-muted-foreground hidden sm:inline">rain</span>
    </div>
  );
}
