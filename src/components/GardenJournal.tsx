import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { X, Plus, Trash2, Camera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { SignedImage } from '@/components/SignedImage';

interface JournalEntry {
  id: string;
  title: string;
  notes: string;
  photos: string[];
  created_at: string;
}

interface Props {
  onClose: () => void;
}

export function GardenJournal({ onClose }: Props) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pendingPhotoPaths, setPendingPhotoPaths] = useState<string[]>([]);
  const [pendingPhotoUrls, setPendingPhotoUrls] = useState<string[]>([]);

  const fetchEntries = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('journal_entries')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setEntries(data as unknown as JournalEntry[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !user) return;
    setUploading(true);
    const file = e.target.files[0];
    const ext = file.name.split('.').pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('journal-photos').upload(path, file);
    if (error) {
      toast.error('Upload failed');
      setUploading(false);
      return;
    }
    // Store path for DB, generate signed URL for preview
    setPendingPhotoPaths(prev => [...prev, path]);
    const { data: signedData } = await supabase.storage.from('journal-photos').createSignedUrl(path, 3600);
    if (signedData?.signedUrl) {
      setPendingPhotoUrls(prev => [...prev, signedData.signedUrl]);
    }
    setUploading(false);
    toast.success('Photo uploaded! 📸');
  };

  const handleCreate = async () => {
    if (!user || !newTitle.trim()) return;
    setCreating(true);
    const { error } = await supabase.from('journal_entries').insert({
      user_id: user.id,
      title: newTitle.trim(),
      notes: newNotes.trim(),
      photos: pendingPhotoPaths,
    });
    if (error) {
      toast.error('Failed to save entry');
    } else {
      toast.success('Journal entry saved! 📝');
      setNewTitle('');
      setNewNotes('');
    setPendingPhotoPaths([]);
    setPendingPhotoUrls([]);
      fetchEntries();
    }
    setCreating(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('journal_entries').delete().eq('id', id);
    setEntries(prev => prev.filter(e => e.id !== id));
    toast.success('Entry deleted');
  };

  if (!user) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-card rounded-xl shadow-2xl max-w-md w-full p-6 text-center" onClick={e => e.stopPropagation()}>
          <p className="text-foreground font-medium mb-2">Sign in to use the Garden Journal</p>
          <p className="text-sm text-muted-foreground">Your journal entries and photos are saved to your account.</p>
          <Button variant="outline" className="mt-4" onClick={onClose}>Close</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-auto p-5 animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground">📓 Garden Journal</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        {/* New entry form */}
        <div className="bg-muted rounded-lg p-3 mb-4">
          <Input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="Entry title (e.g. First tomatoes!)"
            className="h-8 text-sm mb-2"
          />
          <textarea
            value={newNotes}
            onChange={e => setNewNotes(e.target.value)}
            placeholder="Notes about your garden today..."
            className="w-full bg-background rounded-md border border-input px-3 py-2 text-sm min-h-[60px] resize-none"
          />
          {/* Photo previews */}
          {pendingPhotoUrls.length > 0 && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {pendingPhotoUrls.map((url, i) => (
                <img key={i} src={url} alt="Upload" className="w-16 h-16 rounded-md object-cover border border-border" />
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 mt-2">
            <label className="cursor-pointer">
              <input type="file" accept="image/*" onChange={handleUploadPhoto} className="hidden" />
              <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
                {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                Add Photo
              </span>
            </label>
            <Button size="sm" className="h-7 text-xs ml-auto" onClick={handleCreate} disabled={creating || !newTitle.trim()}>
              <Plus className="h-3 w-3 mr-1" /> Save Entry
            </Button>
          </div>
        </div>

        {/* Entries list */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No journal entries yet. Start documenting your garden! 🌱</p>
        ) : (
          <div className="space-y-3">
            {entries.map(entry => (
              <div key={entry.id} className="bg-muted/50 rounded-lg p-3 group">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{entry.title}</h3>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(entry.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="p-1 rounded hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                </div>
                {entry.notes && <p className="text-xs text-foreground/80 mt-1">{entry.notes}</p>}
                {entry.photos && entry.photos.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {entry.photos.map((photoPath, i) => (
                      <SignedImage key={i} bucket="journal-photos" path={photoPath} alt="Garden photo" className="w-20 h-20 rounded-md object-cover border border-border" />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
