import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sprout, Leaf, Sun, Droplets, Bot, MapPin } from 'lucide-react';

export function WelcomeModal() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem('ab-welcome-seen');
    if (!seen) setShow(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem('ab-welcome-seen', '1');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-foreground/50 z-50 flex items-center justify-center p-4" onClick={dismiss}>
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md animate-fade-in overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-br from-primary/20 to-accent/10 p-6 text-center">
          <div className="h-16 w-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-3">
            <Sprout className="h-9 w-9 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Welcome to Allotment Buddy! 🌱</h2>
          <p className="text-sm text-muted-foreground mt-1">Your complete UK garden planner</p>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-start gap-3">
            <Leaf className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Drag & drop plants</p>
              <p className="text-xs text-muted-foreground">Browse 100+ UK allotment plants in the sidebar and drag them onto your plot</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Sun className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Sun & shade tracking</p>
              <p className="text-xs text-muted-foreground">Set your compass direction and add structures — the grid shows sun/shade zones</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Droplets className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Weather-smart watering</p>
              <p className="text-xs text-muted-foreground">Enter your postcode for local weather, frost alerts, and AI watering advice</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Bot className="h-5 w-5 text-purple-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">AI garden assistant</p>
              <p className="text-xs text-muted-foreground">Ask the AI for layout suggestions, companion planting tips, and feeding schedules</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Set your location</p>
              <p className="text-xs text-muted-foreground">Enter your postcode in the header for localised weather and frost date info</p>
            </div>
          </div>
        </div>
        <div className="p-5 pt-0">
          <Button className="w-full" onClick={dismiss}>
            <Sprout className="h-4 w-4 mr-2" /> Start Planning!
          </Button>
        </div>
      </div>
    </div>
  );
}
