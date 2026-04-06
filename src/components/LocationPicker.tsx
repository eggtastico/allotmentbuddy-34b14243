import { useState, useEffect, useCallback } from 'react';
import { MapPin, Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface LocationData {
  name: string;
  lat: number;
  lon: number;
  region?: string;
}

interface LocationPickerProps {
  location: LocationData | null;
  onLocationChange: (loc: LocationData) => void;
}

export function LocationPicker({ location, onLocationChange }: LocationPickerProps) {
  const [input, setInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);

  // Auto-detect on first load
  useEffect(() => {
    if (location) return;
    const stored = localStorage.getItem('ab-location');
    if (stored) {
      try { onLocationChange(JSON.parse(stored)); return; } catch {}
    }
    navigator.geolocation?.getCurrentPosition(
      async (pos) => {
        const loc: LocationData = { name: 'My Location', lat: pos.coords.latitude, lon: pos.coords.longitude };
        // Reverse geocode for name
        try {
          const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${pos.coords.latitude.toFixed(1)},${pos.coords.longitude.toFixed(1)}&count=1`);
          // fallback name
        } catch {}
        onLocationChange(loc);
        localStorage.setItem('ab-location', JSON.stringify(loc));
      },
      () => {
        const defaultLoc: LocationData = { name: 'London', lat: 51.5074, lon: -0.1278 };
        onLocationChange(defaultLoc);
        localStorage.setItem('ab-location', JSON.stringify(defaultLoc));
      }
    );
  }, [location, onLocationChange]);

  const search = useCallback(async () => {
    const q = input.trim();
    if (!q) return;
    setSearching(true);
    try {
      // Try postcodes.io first for UK postcodes
      const postcodeMatch = q.match(/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i);
      if (postcodeMatch) {
        const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(q)}`);
        const data = await res.json();
        if (data.status === 200 && data.result) {
          const r = data.result;
          const loc: LocationData = {
            name: `${r.postcode}`,
            lat: r.latitude,
            lon: r.longitude,
            region: r.region,
          };
          onLocationChange(loc);
          localStorage.setItem('ab-location', JSON.stringify(loc));
          setOpen(false);
          setInput('');
          return;
        }
      }
      // Fallback to Open-Meteo geocoding
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en`);
      const data = await res.json();
      if (data.results?.[0]) {
        const r = data.results[0];
        const loc: LocationData = {
          name: r.name + (r.admin1 ? `, ${r.admin1}` : ''),
          lat: r.latitude,
          lon: r.longitude,
        };
        onLocationChange(loc);
        localStorage.setItem('ab-location', JSON.stringify(loc));
        setOpen(false);
        setInput('');
      }
    } catch {} finally {
      setSearching(false);
    }
  }, [input, onLocationChange]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted">
          <MapPin className="h-3 w-3" />
          <span className="max-w-[120px] truncate">{location?.name || 'Set location'}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="end">
        <p className="text-xs font-medium text-foreground mb-2">Set your location</p>
        <p className="text-[10px] text-muted-foreground mb-2">Enter a UK postcode (e.g. SW1A 1AA) or city name</p>
        <form onSubmit={e => { e.preventDefault(); search(); }} className="flex gap-1.5">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Postcode or city..."
            className="h-8 text-xs flex-1"
          />
          <Button type="submit" size="sm" className="h-8 px-2" disabled={searching || !input.trim()}>
            {searching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
