import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Send, Bot, Loader2 } from 'lucide-react';
import { PlacedPlant, PlotSettings } from '@/types/garden';
import { getPlantById } from '@/data/plants';

interface LocationData {
  name: string;
  lat: number;
  lon: number;
  region?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AIChatProps {
  settings: PlotSettings;
  plants: PlacedPlant[];
  location: LocationData | null;
  onClose: () => void;
}

export function AIChat({ settings, plants, location, onClose }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const plantSummary = [...new Set(plants.map(p => p.plantId))]
    .map(id => { const plant = getPlantById(id); return plant ? `${plant.emoji} ${plant.name} (x${plants.filter(pp => pp.plantId === id).length})` : ''; })
    .filter(Boolean).join(', ');

  const locationStr = location ? `Location: ${location.name} (lat ${location.lat.toFixed(2)}, lon ${location.lon.toFixed(2)})${location.region ? `, region: ${location.region}` : ''}.` : '';

  const systemContext = `User has a ${settings.widthM}x${settings.heightM} ${settings.unit} garden plot. ${locationStr} Plants: ${plantSummary || 'none yet'}.`;

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const resp = await supabase.functions.invoke('garden-ai', {
        body: { messages: newMessages, context: systemContext },
      });

      if (resp.error) throw resp.error;

      const text = resp.data?.reply || 'Sorry, I had trouble responding.';
      setMessages(prev => [...prev, { role: 'assistant', content: text }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message || 'Something went wrong'}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-foreground/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-xl w-full max-w-lg h-[70vh] flex flex-col animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <h2 className="font-bold text-foreground">Garden AI Assistant</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <Bot className="h-10 w-10 text-primary mx-auto mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground">Ask me anything about your garden!</p>
              {location && (
                <p className="text-[10px] text-muted-foreground mt-1">📍 Using your location: {location.name}</p>
              )}
              <div className="flex flex-wrap gap-2 justify-center mt-3">
                {['Suggest best layout for my plot', 'What should I plant this month?', 'Which plants grow well together?'].map(q => (
                  <button key={q} onClick={() => { setInput(q); }} className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="p-3 border-t border-border shrink-0">
          <form onSubmit={e => { e.preventDefault(); send(); }} className="flex gap-2">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about your garden..."
              className="flex-1"
              disabled={loading}
            />
            <Button type="submit" size="icon" disabled={loading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
