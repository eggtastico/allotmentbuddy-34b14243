import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { ConflictInfo, ConflictChoice } from '@/hooks/useConflictResolution';
import { Cloud, Smartphone } from 'lucide-react';

interface ConflictDialogProps {
  conflict: ConflictInfo | null;
  onResolve: (choice: ConflictChoice) => void;
}

function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export function ConflictDialog({ conflict, onResolve }: ConflictDialogProps) {
  if (!conflict) return null;

  return (
    <AlertDialog open={!!conflict} onOpenChange={(open) => { if (!open) onResolve(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sync conflict detected</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                The garden plan <strong>"{conflict.planName}"</strong> has been
                edited on another device. Which version would you like to keep?
              </p>
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex items-center gap-2 p-2 rounded-md bg-muted">
                  <Smartphone className="h-4 w-4 shrink-0 text-blue-500" />
                  <span>
                    <strong>This device:</strong>{' '}
                    {formatTimestamp(conflict.localUpdatedAt)}
                  </span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-md bg-muted">
                  <Cloud className="h-4 w-4 shrink-0 text-green-500" />
                  <span>
                    <strong>Cloud version:</strong>{' '}
                    {formatTimestamp(conflict.remoteUpdatedAt)}
                  </span>
                </div>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onResolve(null)}
            className="sm:mr-auto"
          >
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={() => onResolve('local')}
          >
            <Smartphone className="h-4 w-4 mr-1" />
            Keep this device
          </Button>
          <Button onClick={() => onResolve('remote')}>
            <Cloud className="h-4 w-4 mr-1" />
            Keep cloud version
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
