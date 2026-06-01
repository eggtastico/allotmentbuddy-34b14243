import { useState, useRef, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Send, Bot, Loader2 } from 'lucide-react';
import { PlacedPlant, PlotSettings } from '@/types/garden';
import { getPlantById } from '@/data/plants';
import { analyzeRotation } from '@/utils/rotationOptimizer';
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

  // Memoised context: these computations can be expensive (analyzeRotation does graph
  // traversal; relation summary is O(n²) without a Set). Recompute only when inputs change.
  const { systemContext, quickPrompts, rotationConflictCount, rotationScore } = useMemo(() => {
    const uniquePlantIds = [...new Set(plants.map(p => p.plantId))];
    const uniqueSet = new Set(uniquePlantIds);

    // Count occurrences in a single pass for O(n) plant summary
    const countMap = new Map<string, number>();
    for (const p of plants) countMap.set(p.plantId, (countMap.get(p.plantId) ?? 0) + 1);

    const plantSummary = uniquePlantIds
      .map(id => { const plant = getPlantById(id); return plant ? `${plant.emoji} ${plant.name} (x${countMap.get(id) ?? 1})` : ''; })
      .filter(Boolean).join(', ');

    // JSON.stringify the user-influenced location values so they cannot break out of
    // the prompt string (prevents prompt injection via crafted location names).
    const locationStr = location
      ? `Location: ${JSON.stringify(location.name)} (lat ${location.lat.toFixed(2)}, lon ${location.lon.toFixed(2)})${location.region ? `, region: ${JSON.stringify(location.region)}` : ''}.`
      : '';

    const rotationAnalysis = analyzeRotation(plants);
    const conflictSummary = rotationAnalysis.conflicts.length > 0
      ? `Rotation conflicts: ${rotationAnalysis.conflicts.map(c => c.reason).join('; ')}.`
      : 'No rotation conflicts.';

    // Companion/enemy summary — use Set for O(1) membership checks
    const relationSummary = uniquePlantIds.map(id => {
      const p = getPlantById(id);
      if (!p) return '';
      const enemies = p.enemies.filter(e => uniqueSet.has(e)).map(e => getPlantById(e)?.name).filter(Boolean);
      const companions = p.companions.filter(c => uniqueSet.has(c)).map(c => getPlantById(c)?.name).filter(Boolean);
      const parts: string[] = [];
      if (enemies.length) parts.push(`enemies nearby: ${enemies.join(', ')}`);
      if (companions.length) parts.push(`companions: ${companions.join(', ')}`);
      return parts.length ? `${p.name}: ${parts.join('; ')}` : '';
    }).filter(Boolean).join('. ');

    const ctx = `User has a ${settings.widthM}×${settings.heightM} ${settings.unit} garden plot (grid ${Math.round(settings.widthM * 100 / settings.cellSizeCm)}×${Math.round(settings.heightM * 100 / settings.cellSizeCm)} cells, ${settings.cellSizeCm}cm each). ${locationStr} Plants: ${plantSummary || 'none yet'}. ${conflictSummary} ${relationSummary} Rotation score: ${rotationAnalysis.score}/100.`;

    const prompts: string[] = [];
    if (plants.length > 0) {
      prompts.push('Analyze my layout and suggest improvements');
      if (rotationAnalysis.conflicts.length > 0) prompts.push('Fix my spacing & companion issues');
      prompts.push('Create a 3-year rotation plan for my plot');
      prompts.push('Maximize yield with my current layout');
      prompts.push('Suggest pest-resistant companion planting');
    } else {
      prompts.push('Suggest a beginner-friendly layout');
      prompts.push('What should I plant this month?');
      prompts.push('Design a low-maintenance herb garden');
    }
    if (location) prompts.push(`Best crops for ${location.name} climate`);

    return { systemContext: ctx, quickPrompts: prompts, rotationConflictCount: rotationAnalysis.conflicts.length, rotationScore: rotationAnalysis.score };
  }, [plants, location, settings]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch('/api/garden-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ messages: newMessages, context: systemContext }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || 'Request failed');
      }
      const data = await resp.json();
      const text = data.reply || 'Sorry, I had trouble responding.';
      setMessages(prev => [...prev, { role: 'assistant', content: text }]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Something went wrong';
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${errorMessage}` }]);
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
                  📊 {plants.length} plants · Rotation score: {rotationScore}/100 · {rotationConflictCount} issues
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
