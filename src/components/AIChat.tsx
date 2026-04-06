import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Send, Bot, Loader2 } from 'lucide-react';
import { PlacedPlant, PlotSettings } from '@/types/garden';
import { getPlantById } from '@/data/plants';
import { analyzeRotation } from '@/utils/rotationOptimizer';
import { getCompanionReason } from '@/data/companionReasons';
import ReactMarkdown from 'react-markdown';

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

  const uniquePlants = [...new Set(plants.map(p => p.plantId))];
  const plantSummary = uniquePlants
    .map(id => { const plant = getPlantById(id); return plant ? `${plant.emoji} ${plant.name} (x${plants.filter(pp => pp.plantId === id).length})` : ''; })
    .filter(Boolean).join(', ');

  const locationStr = location ? `Location: ${location.name} (lat ${location.lat.toFixed(2)}, lon ${location.lon.toFixed(2)})${location.region ? `, region: ${location.region}` : ''}.` : '';

  // Build rich context about the current layout
  const rotationAnalysis = analyzeRotation(plants);
  const conflictSummary = rotationAnalysis.conflicts.length > 0
    ? `Rotation conflicts: ${rotationAnalysis.conflicts.map(c => c.reason).join('; ')}.`
    : 'No rotation conflicts.';

  // Companion/enemy summary
  const relationSummary = uniquePlants.map(id => {
    const p = getPlantById(id);
    if (!p) return '';
    const enemies = p.enemies.filter(e => uniquePlants.includes(e)).map(e => getPlantById(e)?.name).filter(Boolean);
    const companions = p.companions.filter(c => uniquePlants.includes(c)).map(c => getPlantById(c)?.name).filter(Boolean);
    const parts: string[] = [];
    if (enemies.length) parts.push(`enemies nearby: ${enemies.join(', ')}`);
    if (companions.length) parts.push(`companions: ${companions.join(', ')}`);
    return parts.length ? `${p.name}: ${parts.join('; ')}` : '';
  }).filter(Boolean).join('. ');

  const systemContext = `User has a ${settings.widthM}×${settings.heightM} ${settings.unit} garden plot (grid ${Math.round(settings.widthM * 100 / settings.cellSizeCm)}×${Math.round(settings.heightM * 100 / settings.cellSizeCm)} cells, ${settings.cellSizeCm}cm each). ${locationStr} Plants: ${plantSummary || 'none yet'}. ${conflictSummary} ${relationSummary} Rotation score: ${rotationAnalysis.score}/100.`;

  // Context-aware quick prompts
  const quickPrompts: string[] = [];
  if (plants.length > 0) {
    quickPrompts.push('Analyze my layout and suggest improvements');
    if (rotationAnalysis.conflicts.length > 0) quickPrompts.push('Fix my spacing & companion issues');
    quickPrompts.push('Create a 3-year rotation plan for my plot');
    quickPrompts.push('Maximize yield with my current layout');
    quickPrompts.push('Suggest pest-resistant companion planting');
  } else {
    quickPrompts.push('Suggest a beginner-friendly layout');
    quickPrompts.push('What should I plant this month?');
    quickPrompts.push('Design a low-maintenance herb garden');
  }
  if (location) quickPrompts.push(`Best crops for ${location.name} climate`);

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
              <p className="text-sm text-muted-foreground">I know your plot layout — ask me anything!</p>
              {plants.length > 0 && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  📊 {plants.length} plants · Rotation score: {rotationAnalysis.score}/100 · {rotationAnalysis.conflicts.length} issues
                </p>
              )}
              {location && (
                <p className="text-[10px] text-muted-foreground mt-1">📍 Using your location: {location.name}</p>
              )}
              <div className="flex flex-wrap gap-2 justify-center mt-3">
                {quickPrompts.slice(0, 5).map(q => (
                  <button key={q} onClick={() => { setInput(q); }} className="text-xs px-3 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-colors">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                {msg.role === 'assistant' ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:m-0 [&>ul]:mt-1 [&>ol]:mt-1">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : msg.content}
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
