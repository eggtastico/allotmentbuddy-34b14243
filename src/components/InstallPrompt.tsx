import { useState } from 'react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import { toast } from 'sonner';

interface InstallPromptProps {
  className?: string;
}

export function InstallPrompt({ className = '' }: InstallPromptProps) {
  const { canInstall, isInstalling, prompt } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(false);

  if (!canInstall || dismissed) {
    return null;
  }

  const handleInstall = async () => {
    try {
      await prompt();
      toast.success('App installed successfully! Look for Allotment Buddy on your home screen.');
    } catch (error) {
      toast.error('Installation cancelled');
    }
  };

  return (
    <div className={`bg-primary/10 border border-primary/20 rounded-lg p-4 flex items-center justify-between ${className}`}>
      <div>
        <p className="font-medium text-foreground flex items-center gap-2 mb-1">
          <span className="text-xl">📱</span> Install Allotment Buddy
        </p>
        <p className="text-xs text-muted-foreground">
          Install our app for quick access and offline support
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          onClick={handleInstall}
          disabled={isInstalling}
          size="sm"
          className="gap-2"
        >
          <Download className="w-4 h-4" />
          {isInstalling ? 'Installing...' : 'Install'}
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded"
          title="Dismiss"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
