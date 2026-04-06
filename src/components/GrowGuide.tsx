import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { plants } from '@/data/plants';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Sparkles, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

interface GrowGuideProps {
  onClose: () => void;
}

export function GrowGuide({ onClose }: GrowGuideProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const vegetables = plants.filter(
    (p) => p.category === 'vegetable' || p.category === 'fruit' || p.category === 'herb',
  );
  const filtered = search
    ? vegetables.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : vegetables;

  const togglePlant = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const getGuidance = async () => {
    if (selected.length === 0) return;
    setLoading(true);
    setResult(null);

    const selectedPlants = selected.map((id) => plants.find((p) => p.id === id)).filter(Boolean);
    const plantList = selectedPlants
      .map(
        (p) =>
          `${p!.emoji} ${p!.name} (spacing: ${p!.spacingCm}cm, sow indoors: ${p!.sowIndoors || 'N/A'}, sow outdoors: ${p!.sowOutdoors || 'N/A'}, harvest: ${p!.harvest || 'N/A'}, companions: ${p!.companions.join(', ')}, enemies: ${p!.enemies.join(', ')}, rotation: ${p!.rotationGroup})`,
      )
      .join('\n');

    try {
      const { data, error } = await supabase.functions.invoke('grow-guide', {
        body: { plants: plantList },
      });
      if (error) throw error;
      setResult(data.reply || 'No guidance generated.');
    } catch (e) {
      console.error(e);
      toast.error('Failed to get guidance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl h-[85vh] overflow-hidden p-0">
        <div className="flex h-full min-h-0 flex-col">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> I Want to Grow...
            </DialogTitle>
            <DialogDescription className="sr-only">
              Select plants and read a personalised growing plan with planting times, care tips, and layout advice.
            </DialogDescription>
          </DialogHeader>

          {!result ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3 px-6 pb-6">
              <p className="text-xs text-muted-foreground">
                Select the plants you want to grow and AI will give you a personalised planting plan with timings, companions, and plot tips.
              </p>

              <div className="relative shrink-0">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search plants..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 pl-8 text-sm"
                />
              </div>

              {selected.length > 0 && (
                <div className="flex shrink-0 flex-wrap gap-1">
                  {selected.map((id) => {
                    const p = plants.find((pl) => pl.id === id);
                    if (!p) return null;
                    return (
                      <Badge key={id} className="cursor-pointer text-xs" onClick={() => togglePlant(id)}>
                        {p.emoji} {p.name} <X className="ml-1 h-3 w-3" />
                      </Badge>
                    );
                  })}
                </div>
              )}

              <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border">
                <div className="grid grid-cols-2 gap-1 p-2 sm:grid-cols-3">
                  {filtered.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => togglePlant(p.id)}
                      className={`flex items-center gap-1.5 rounded-md p-2 text-left text-xs transition-colors ${
                        selected.includes(p.id)
                          ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                          : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      <span className="text-base">{p.emoji}</span>
                      <span className="truncate">{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Button onClick={getGuidance} disabled={selected.length === 0 || loading} className="w-full shrink-0">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating plan...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" /> Get Growing Guide ({selected.length} selected)
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col px-6 pb-6">
              <div className="min-h-0 flex-1 overflow-y-auto pr-3">
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown>{result}</ReactMarkdown>
                </div>
              </div>
              <div className="mt-3 flex shrink-0 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setResult(null);
                    setSelected([]);
                  }}
                >
                  Start Over
                </Button>
                <Button variant="outline" size="sm" onClick={() => setResult(null)}>
                  Change Selection
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
