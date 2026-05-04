import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Camera, Package, Trash2, Edit2, Check, Loader2, Sprout, PoundSterling } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SignedImage } from '@/components/SignedImage';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface SeedItem {
  id: string;
  plant_name: string;
  variety: string;
  quantity: number;
  purchased_date: string | null;
  expiry_date: string | null;
  seed_pack_photo_url: string | null;
  ai_extracted_data: Record<string, unknown>;
  notes: string;
}

// Extended user-editable metadata stored inside ai_extracted_data under '_meta' key
interface SeedMeta {
  cost_per_packet?: number;
  germination_rate?: number;   // 0-100
  last_germination_test?: string; // ISO date
  variety_notes?: string;
}

function getMeta(seed: SeedItem): SeedMeta {
  const raw = seed.ai_extracted_data?._meta;
  if (raw && typeof raw === 'object') return raw as SeedMeta;
  return {};
}

function germinationBadgeClass(rate: number): string {
  if (rate >= 80) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
  if (rate >= 50) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
  return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
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
  const [form, setForm] = useState({
    plant_name: '', variety: '', quantity: 1,
    purchased_date: '', expiry_date: '', notes: '',
    cost_per_packet: '', germination_rate: '',
    last_germination_test: '', variety_notes: '',
  });
  const [showBarcodeInput, setShowBarcodeInput] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const barcodePhotoInputRef = useRef<HTMLInputElement>(null);
  const qrCodePhotoInputRef = useRef<HTMLInputElement>(null);

  const loadSeeds = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('seed_inventory')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setSeeds(data as SeedItem[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadSeeds();
  }, [loadSeeds]);

  const handleSave = async () => {
    if (!user || !form.plant_name.trim()) return;

    // Build _meta object for extended fields; merge with existing ai_extracted_data
    const existingData = editId
      ? (seeds.find(s => s.id === editId)?.ai_extracted_data ?? {})
      : {};
    const meta: SeedMeta = {};
    if (form.cost_per_packet) meta.cost_per_packet = parseFloat(form.cost_per_packet);
    if (form.germination_rate) meta.germination_rate = Math.min(100, Math.max(0, parseInt(form.germination_rate)));
    if (form.last_germination_test) meta.last_germination_test = form.last_germination_test;
    if (form.variety_notes.trim()) meta.variety_notes = form.variety_notes.trim();

    const payload = {
      user_id: user.id,
      plant_name: form.plant_name.trim(),
      variety: form.variety.trim(),
      quantity: form.quantity,
      purchased_date: form.purchased_date || null,
      expiry_date: form.expiry_date || null,
      notes: form.notes.trim(),
      ai_extracted_data: { ...existingData, _meta: meta },
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
    setForm({
      plant_name: '', variety: '', quantity: 1,
      purchased_date: '', expiry_date: '', notes: '',
      cost_per_packet: '', germination_rate: '',
      last_germination_test: '', variety_notes: '',
    });
    setShowAdd(false);
    setEditId(null);
    await loadSeeds();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('seed_inventory').delete().eq('id', id);
    if (!error) { toast.success('Seed removed'); loadSeeds(); }
  };

  const handleEdit = (seed: SeedItem) => {
    const meta = getMeta(seed);
    setForm({
      plant_name: seed.plant_name,
      variety: seed.variety || '',
      quantity: seed.quantity,
      purchased_date: seed.purchased_date || '',
      expiry_date: seed.expiry_date || '',
      notes: seed.notes || '',
      cost_per_packet: meta.cost_per_packet != null ? String(meta.cost_per_packet) : '',
      germination_rate: meta.germination_rate != null ? String(meta.germination_rate) : '',
      last_germination_test: meta.last_germination_test || '',
      variety_notes: meta.variety_notes || '',
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

      const { data: signedData } = await supabase.storage.from('seed-pack-photos').createSignedUrl(filePath, 3600);
      const photoUrl = signedData?.signedUrl || filePath;

      // Convert to base64 for AI
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      // Call AI endpoint (auth-gated, Gemini-powered)
      const { data: { session } } = await supabase.auth.getSession();
      const aiResp = await fetch('/api/scan-seed-pack', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ imageBase64: base64 }),
      });
      if (!aiResp.ok) {
        const err = await aiResp.json().catch(() => ({ error: 'Scan failed' }));
        throw new Error(err.error || 'Scan failed');
      }
      const data = await aiResp.json();
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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast.error('Scan failed: ' + errorMessage);
    } finally {
      setScanning(false);
    }
  };

  const handleScanBarcode = async (barcode: string) => {
    if (!barcode.trim()) {
      toast.error('Please enter a barcode');
      return;
    }
    await lookupBarcode(barcode.trim());
  };

  const lookupBarcode = async (barcode: string) => {
    setScanning(true);
    try {
      const response = await fetch('/api/lookup-barcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode }),
      });

      const data = await response.json();

      if (!data.found) {
        toast.info(data.message || 'Barcode not found. Please enter details manually.');
        setShowBarcodeInput(false);
        setBarcodeInput('');
        return;
      }

      const extracted = data.extracted;
      setForm({
        ...form,
        plant_name: extracted.plant_name || '',
        variety: extracted.variety || '',
      });

      toast.success(`Found: ${extracted.plant_name}`);
      setShowBarcodeInput(false);
      setBarcodeInput('');
      setShowAdd(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast.error('Lookup failed: ' + errorMessage);
    } finally {
      setScanning(false);
    }
  };

  const handleBarcodePhoto = async (file: File) => {
    setScanning(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const imgSrc = e.target?.result as string;
          const barcode = await Html5QrcodeScanner.scanImage(imgSrc, {
            qrbox: { width: 250, height: 250 },
            fps: 10,
            rememberLastUsedCamera: true,
            disableFlip: false,
          });
          await lookupBarcode(barcode);
        } catch (err) {
          console.error('Barcode scan error:', err);
          toast.error('Could not detect barcode. Try again or enter manually.');
          setScanning(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast.error('Photo scan failed: ' + errorMessage);
      setScanning(false);
    }
  };

  const handleQRCodePhoto = async (file: File) => {
    setScanning(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const imgSrc = e.target?.result as string;
          const qrData = await Html5QrcodeScanner.scanImage(imgSrc, {
            qrbox: { width: 250, height: 250 },
            fps: 10,
            rememberLastUsedCamera: true,
            disableFlip: false,
          });

          // Check if QR contains a number (barcode) or URL
          if (/^\d+$/.test(qrData)) {
            // It's a number - treat as barcode
            await lookupBarcode(qrData);
          } else if (qrData.startsWith('http')) {
            // It's a URL - show to user
            toast.info(`QR links to: ${qrData}`);
            setShowBarcodeInput(false);
            setScanning(false);
          } else {
            // Generic QR data - use as plant name hint
            toast.success(`QR code scanned: ${qrData}`);
            setForm({ ...form, plant_name: qrData });
            setShowBarcodeInput(false);
            setShowAdd(true);
            setScanning(false);
          }
        } catch (err) {
          console.error('QR code scan error:', err);
          toast.error('Could not detect QR code. Try again or enter manually.');
          setScanning(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast.error('QR scan failed: ' + errorMessage);
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
        <div className="space-y-2 mb-2">
          <div className="flex gap-2">
            <Button size="sm" onClick={() => {
              setEditId(null);
              setForm({ plant_name: '', variety: '', quantity: 1, purchased_date: '', expiry_date: '', notes: '', cost_per_packet: '', germination_rate: '', last_germination_test: '', variety_notes: '' });
              setShowAdd(true);
            }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Seed
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowBarcodeInput(!showBarcodeInput)} disabled={scanning}>
              📦 Barcode
            </Button>
            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={scanning}>
              {scanning ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Camera className="h-3.5 w-3.5 mr-1" />}
              {scanning ? 'Scanning...' : 'Photo'}
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

          {showBarcodeInput && (
            <div className="space-y-2 bg-muted/30 p-2 rounded-lg border border-border">
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="outline" onClick={() => barcodePhotoInputRef.current?.click()} disabled={scanning}>
                  <Camera className="h-3.5 w-3.5 mr-1" />
                  {scanning ? 'Scanning...' : 'Barcode'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => qrCodePhotoInputRef.current?.click()} disabled={scanning}>
                  <Camera className="h-3.5 w-3.5 mr-1" />
                  {scanning ? 'Scanning...' : 'QR Code'}
                </Button>
                <input
                  ref={barcodePhotoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleBarcodePhoto(f); e.target.value = ''; }}
                />
                <input
                  ref={qrCodePhotoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleQRCodePhoto(f); e.target.value = ''; }}
                />
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Or type barcode/QR number"
                  value={barcodeInput}
                  onChange={e => setBarcodeInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleScanBarcode(barcodeInput); }}
                  className="h-8 text-sm flex-1"
                  disabled={scanning}
                />
                <Button size="sm" onClick={() => handleScanBarcode(barcodeInput)} disabled={scanning || !barcodeInput.trim()}>
                  {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Lookup'}
                </Button>
              </div>
            </div>
          )}
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
              <Input type="date" title="Purchased date" value={form.purchased_date} onChange={e => setForm({ ...form, purchased_date: e.target.value })} className="h-8 text-sm" />
              <Input type="date" title="Expiry date" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} className="h-8 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number" min={0} step="0.01" placeholder="Cost per packet (£)"
                value={form.cost_per_packet}
                onChange={e => setForm({ ...form, cost_per_packet: e.target.value })}
                className="h-8 text-sm"
              />
              <div className="flex gap-1 items-center">
                <Input
                  type="number" min={0} max={100} placeholder="Germination % (0-100)"
                  value={form.germination_rate}
                  onChange={e => setForm({ ...form, germination_rate: e.target.value })}
                  className="h-8 text-sm flex-1"
                />
                <Sprout className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" title="Last germination test" value={form.last_germination_test} onChange={e => setForm({ ...form, last_germination_test: e.target.value })} className="h-8 text-sm" />
              <Input placeholder="Variety notes (performance)" value={form.variety_notes} onChange={e => setForm({ ...form, variety_notes: e.target.value })} className="h-8 text-sm" />
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

        {/* Tabbed view: Inventory + Season Summary */}
        <Tabs defaultValue="inventory" className="flex-1 flex flex-col min-h-0">
          <TabsList className="self-start mb-1">
            <TabsTrigger value="inventory">Inventory ({seeds.length})</TabsTrigger>
            <TabsTrigger value="summary" className="flex items-center gap-1">
              <PoundSterling className="h-3 w-3" />
              Season Summary
            </TabsTrigger>
          </TabsList>

          {/* ── Inventory tab ── */}
          <TabsContent value="inventory" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : seeds.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No seeds yet. Add some or scan a seed packet!</p>
              ) : (
                <div className="space-y-1">
                  {seeds.map(seed => {
                    const meta = getMeta(seed);
                    return (
                      <div key={seed.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 group">
                        {seed.seed_pack_photo_url && (
                          <SignedImage bucket="seed-pack-photos" path={seed.seed_pack_photo_url} alt="" className="h-10 w-10 rounded object-cover border border-border" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-sm text-foreground">{seed.plant_name}</span>
                            {seed.variety && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{seed.variety}</span>}
                            <span className="text-xs text-muted-foreground">×{seed.quantity}</span>
                            {meta.germination_rate != null && (
                              <Badge className={`text-[10px] h-4 px-1.5 border-0 ${germinationBadgeClass(meta.germination_rate)}`}>
                                <Sprout className="h-2.5 w-2.5 mr-0.5" />{meta.germination_rate}%
                              </Badge>
                            )}
                            {meta.cost_per_packet != null && (
                              <span className="text-[10px] text-muted-foreground">£{meta.cost_per_packet.toFixed(2)}</span>
                            )}
                          </div>
                          <div className="flex gap-2 text-[10px] text-muted-foreground">
                            {seed.purchased_date && <span>Bought: {new Date(seed.purchased_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span>}
                            {seed.expiry_date && (
                              <span className={new Date(seed.expiry_date) < new Date() ? 'text-destructive' : ''}>
                                Expires: {new Date(seed.expiry_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                              </span>
                            )}
                          </div>
                          {meta.variety_notes && (
                            <p className="text-[10px] text-muted-foreground italic mt-0.5 truncate">{meta.variety_notes}</p>
                          )}
                          {seed.ai_extracted_data && Object.keys(seed.ai_extracted_data).filter(k => k !== '_meta').length > 0 && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {seed.ai_extracted_data.sow_indoors && <span>Sow indoors: {seed.ai_extracted_data.sow_indoors as string} </span>}
                              {seed.ai_extracted_data.sow_outdoors && <span>Sow outdoors: {seed.ai_extracted_data.sow_outdoors as string} </span>}
                              {seed.ai_extracted_data.harvest && <span>Harvest: {seed.ai_extracted_data.harvest as string}</span>}
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
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* ── Season Summary tab ── */}
          <TabsContent value="summary" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full">
              {(() => {
                const totalPackets = seeds.length;
                const totalSpent = seeds.reduce((sum, s) => {
                  const cost = getMeta(s).cost_per_packet;
                  return sum + (cost ?? 0);
                }, 0);
                const expiredSeeds = seeds.filter(s => s.expiry_date && new Date(s.expiry_date) < new Date());
                const lowGermination = seeds.filter(s => {
                  const r = getMeta(s).germination_rate;
                  return r != null && r < 50;
                });
                const withCost = seeds.filter(s => getMeta(s).cost_per_packet != null);

                return (
                  <div className="px-1 py-2 space-y-4">
                    {/* Key stats */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-muted/50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold">{totalPackets}</div>
                        <div className="text-[10px] text-muted-foreground">seed packets</div>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold">
                          {withCost.length > 0 ? `£${totalSpent.toFixed(2)}` : '—'}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {withCost.length > 0 ? `total spent (${withCost.length} packets)` : 'add costs to track spending'}
                        </div>
                      </div>
                    </div>

                    {/* Alerts */}
                    {expiredSeeds.length > 0 && (
                      <div className="space-y-1">
                        <h3 className="text-xs font-semibold text-destructive uppercase tracking-wide">
                          Expired Seeds ({expiredSeeds.length})
                        </h3>
                        {expiredSeeds.map(s => (
                          <div key={s.id} className="flex items-center gap-2 text-xs text-destructive/80 bg-destructive/5 rounded px-2.5 py-1.5">
                            <span className="font-medium">{s.plant_name}</span>
                            {s.variety && <span className="opacity-70">{s.variety}</span>}
                            <span className="ml-auto opacity-70">expired {new Date(s.expiry_date!).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {lowGermination.length > 0 && (
                      <div className="space-y-1">
                        <h3 className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                          Poor Germination (&lt;50%)
                        </h3>
                        {lowGermination.map(s => (
                          <div key={s.id} className="flex items-center gap-2 text-xs bg-amber-50 dark:bg-amber-950/20 rounded px-2.5 py-1.5">
                            <span className="font-medium">{s.plant_name}</span>
                            {s.variety && <span className="text-muted-foreground">{s.variety}</span>}
                            <Badge className={`ml-auto text-[10px] h-4 px-1.5 border-0 ${germinationBadgeClass(getMeta(s).germination_rate!)}`}>
                              {getMeta(s).germination_rate}%
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Cost breakdown */}
                    {withCost.length > 0 && (
                      <div className="space-y-1">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Cost Breakdown
                        </h3>
                        <div className="space-y-1">
                          {[...withCost]
                            .sort((a, b) => (getMeta(b).cost_per_packet ?? 0) - (getMeta(a).cost_per_packet ?? 0))
                            .map(s => (
                              <div key={s.id} className="flex items-center gap-2 text-xs px-0.5">
                                <span className="flex-1 text-foreground">{s.plant_name}{s.variety ? ` (${s.variety})` : ''}</span>
                                <span className="font-medium">£{getMeta(s).cost_per_packet!.toFixed(2)}</span>
                              </div>
                            ))}
                          <div className="flex items-center gap-2 text-xs px-0.5 pt-1 border-t font-semibold">
                            <span className="flex-1">Total</span>
                            <span>£{totalSpent.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {withCost.length === 0 && expiredSeeds.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        Add cost and germination data to your seeds to see your season summary here.
                      </p>
                    )}
                  </div>
                );
              })()}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
