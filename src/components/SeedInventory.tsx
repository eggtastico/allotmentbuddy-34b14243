import { useState, useEffect, useRef } from 'react';
import { X, Plus, Camera, Package, Trash2, Edit2, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SeedItem {
  id: string;
  plant_name: string;
  variety: string;
  quantity: number;
  purchased_date: string | null;
  expiry_date: string | null;
  seed_pack_photo_url: string | null;
  ai_extracted_data: Record<string, any>;
  notes: string;
}

interface SeedInventoryProps {
  onClose: () => void;
}

export function SeedInventory({ onClose }: SeedInventoryProps) {
  const { user } = useAuth();
  const [seeds, setSeeds] = useState<SeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [form, setForm] = useState({ plant_name: '', variety: '', quantity: 1, purchased_date: '', expiry_date: '', notes: '' });

  const loadSeeds = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('seed_inventory')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setSeeds(data as SeedItem[]);
    setLoading(false);
  };

  useEffect(() => { loadSeeds(); }, [user]);

  const handleSave = async () => {
    if (!user || !form.plant_name.trim()) return;
    const payload = {
      user_id: user.id,
      plant_name: form.plant_name.trim(),
      variety: form.variety.trim(),
      quantity: form.quantity,
      purchased_date: form.purchased_date || null,
      expiry_date: form.expiry_date || null,
      notes: form.notes.trim(),
    };

    if (editId) {
      const { error } = await supabase.from('seed_inventory').update(payload).eq('id', editId);
      if (error) { toast.error('Failed to update'); return; }
      toast.success('Seed updated');
    } else {
      const { error } = await supabase.from('seed_inventory').insert(payload);
      if (error) { toast.error('Failed to add seed'); return; }
      toast.success('Seed added to inventory');
    }
    setForm({ plant_name: '', variety: '', quantity: 1, purchased_date: '', expiry_date: '', notes: '' });
    setShowAdd(false);
    setEditId(null);
    loadSeeds();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('seed_inventory').delete().eq('id', id);
    if (!error) { toast.success('Seed removed'); loadSeeds(); }
  };

  const handleEdit = (seed: SeedItem) => {
    setForm({
      plant_name: seed.plant_name,
      variety: seed.variety || '',
      quantity: seed.quantity,
      purchased_date: seed.purchased_date || '',
      expiry_date: seed.expiry_date || '',
      notes: seed.notes || '',
    });
    setEditId(seed.id);
    setShowAdd(true);
  };

  const handleScanSeedPack = async (file: File) => {
    if (!user) return;
    setScanning(true);
    try {
      // Upload photo
      const filePath = `${user.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('seed-pack-photos').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('seed-pack-photos').getPublicUrl(filePath);
      const photoUrl = urlData.publicUrl;

      // Convert to base64 for AI
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      // Call AI edge function
      const { data, error } = await supabase.functions.invoke('scan-seed-pack', {
        body: { imageBase64: base64 },
      });

      if (error) throw error;

      const extracted = data?.extracted || {};

      // Save to inventory
      const { error: insertError } = await supabase.from('seed_inventory').insert({
        user_id: user.id,
        plant_name: extracted.plant_name || 'Unknown Plant',
        variety: extracted.variety || '',
        quantity: 1,
        seed_pack_photo_url: photoUrl,
        ai_extracted_data: extracted,
        notes: extracted.tips || '',
      });

      if (insertError) throw insertError;
      toast.success(`Scanned: ${extracted.plant_name || 'seed pack'}`);
      loadSeeds();
    } catch (err: any) {
      toast.error('Scan failed: ' + (err.message || 'Unknown error'));
    } finally {
      setScanning(false);
    }
  };

  if (!user) {
    return (
      <Dialog open onOpenChange={() => onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>🌱 Seed Inventory</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground text-center py-8">Sign in to track your seed inventory.</p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" /> Seed Inventory
            <span className="text-muted-foreground font-normal text-sm">({seeds.length} packets)</span>
          </DialogTitle>
        </DialogHeader>

        {/* Actions */}
        <div className="flex gap-2 mb-2">
          <Button size="sm" onClick={() => { setEditId(null); setForm({ plant_name: '', variety: '', quantity: 1, purchased_date: '', expiry_date: '', notes: '' }); setShowAdd(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Seed
          </Button>
          <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={scanning}>
            {scanning ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Camera className="h-3.5 w-3.5 mr-1" />}
            {scanning ? 'Scanning...' : 'Scan Seed Pack'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleScanSeedPack(f); e.target.value = ''; }}
          />
        </div>

        {/* Add/Edit form */}
        {showAdd && (
          <div className="border border-border rounded-lg p-3 space-y-2 bg-muted/30">
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Plant name *" value={form.plant_name} onChange={e => setForm({ ...form, plant_name: e.target.value })} className="h-8 text-sm" />
              <Input placeholder="Variety" value={form.variety} onChange={e => setForm({ ...form, variety: e.target.value })} className="h-8 text-sm" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Input type="number" placeholder="Qty" min={0} value={form.quantity} onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })} className="h-8 text-sm" />
              <Input type="date" placeholder="Purchased" value={form.purchased_date} onChange={e => setForm({ ...form, purchased_date: e.target.value })} className="h-8 text-sm" />
              <Input type="date" placeholder="Expiry" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} className="h-8 text-sm" />
            </div>
            <Input placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="h-8 text-sm" />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={!form.plant_name.trim()}>
                <Check className="h-3.5 w-3.5 mr-1" /> {editId ? 'Update' : 'Add'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowAdd(false); setEditId(null); }}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Seed list */}
        <ScrollArea className="flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : seeds.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No seeds yet. Add some or scan a seed packet!</p>
          ) : (
            <div className="space-y-1">
              {seeds.map(seed => (
                <div key={seed.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 group">
                  {seed.seed_pack_photo_url && (
                    <img src={seed.seed_pack_photo_url} alt="" className="h-10 w-10 rounded object-cover border border-border" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-sm text-foreground">{seed.plant_name}</span>
                      {seed.variety && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{seed.variety}</span>}
                      <span className="text-xs text-muted-foreground">×{seed.quantity}</span>
                    </div>
                    <div className="flex gap-2 text-[10px] text-muted-foreground">
                      {seed.purchased_date && <span>Bought: {new Date(seed.purchased_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span>}
                      {seed.expiry_date && (
                        <span className={new Date(seed.expiry_date) < new Date() ? 'text-destructive' : ''}>
                          Expires: {new Date(seed.expiry_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                    {seed.ai_extracted_data && Object.keys(seed.ai_extracted_data).length > 0 && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {seed.ai_extracted_data.sow_indoors && <span>Sow indoors: {seed.ai_extracted_data.sow_indoors} </span>}
                        {seed.ai_extracted_data.sow_outdoors && <span>Sow outdoors: {seed.ai_extracted_data.sow_outdoors} </span>}
                        {seed.ai_extracted_data.harvest && <span>Harvest: {seed.ai_extracted_data.harvest}</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(seed)} className="p-1 rounded hover:bg-muted">
                      <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button onClick={() => handleDelete(seed.id)} className="p-1 rounded hover:bg-destructive/10">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
