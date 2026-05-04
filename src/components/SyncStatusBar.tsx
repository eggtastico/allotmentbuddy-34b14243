import React, { useEffect, useState } from 'react';
import { WifiOff, Loader2, CloudOff, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { useOfflineSync, SyncProgress } from '@/hooks/useOfflineSync';

type VisibleState = 'offline' | 'syncing' | 'error' | 'pending' | 'synced' | 'hidden';

function deriveState(progress: SyncProgress): VisibleState {
  if (!progress.isOnline) return 'offline';
  if (progress.isSyncing) return 'syncing';
  if (progress.pendingChanges > 0 && progress.lastError) return 'error';
  if (progress.pendingChanges > 0) return 'pending';
  return 'synced';
}

export const SyncStatusBar: React.FC = () => {
  const sync = useOfflineSync();
  const progress: SyncProgress = {
    isOnline: sync.isOnline,
    isSyncing: sync.isSyncing,
    pendingChanges: sync.pendingChanges,
    lastSyncTime: sync.lastSyncTime,
    lastError: sync.lastError,
  };

  const state = deriveState(progress);
  const [visible, setVisible] = useState(state !== 'synced');
  const [dismissed, setDismissed] = useState(false);
  const isInteractive = state === 'error' || state === 'pending';

  // Show the bar whenever state is not "synced", and auto-dismiss "synced" after 3 seconds
  useEffect(() => {
    if (state === 'synced') {
      // Briefly show the "synced" confirmation, then hide
      setVisible(true);
      setDismissed(false);
      const timer = setTimeout(() => {
        setVisible(false);
        setDismissed(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
    // For all other states, always show
    setVisible(true);
    setDismissed(false);
  }, [state]);

  // If we are in the initial mount and already synced with no history, stay hidden
  if (!visible && dismissed) {
    return null;
  }

  // If hidden and synced on first render (no pending, no offline), don't render
  if (state === 'synced' && !visible) {
    return null;
  }

  const config: Record<
    Exclude<VisibleState, 'hidden'>,
    { icon: React.ReactNode; text: string; bgClass: string; textClass: string }
  > = {
    offline: {
      icon: <WifiOff className="h-3.5 w-3.5" />,
      text: 'Offline',
      bgClass: 'bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700',
      textClass: 'text-amber-800 dark:text-amber-200',
    },
    syncing: {
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
      text: 'Syncing...',
      bgClass: 'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700',
      textClass: 'text-blue-800 dark:text-blue-200',
    },
    error: {
      icon: <AlertCircle className="h-3.5 w-3.5" />,
      text: `${progress.pendingChanges} change${progress.pendingChanges !== 1 ? 's' : ''} not saved`,
      bgClass: 'bg-red-100 dark:bg-red-900/40 border-red-300 dark:border-red-700',
      textClass: 'text-red-800 dark:text-red-200',
    },
    pending: {
      icon: <CloudOff className="h-3.5 w-3.5" />,
      text: `${progress.pendingChanges} change${progress.pendingChanges !== 1 ? 's' : ''} pending`,
      bgClass: 'bg-orange-100 dark:bg-orange-900/40 border-orange-300 dark:border-orange-700',
      textClass: 'text-orange-800 dark:text-orange-200',
    },
    synced: {
      icon: <Check className="h-3.5 w-3.5" />,
      text: 'All changes synced',
      bgClass: 'bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700',
      textClass: 'text-green-800 dark:text-green-200',
    },
  };

  const { icon, text, bgClass, textClass } = config[state];

  return (
    <div
      className={`
        fixed bottom-4 right-4 z-50
        flex items-center gap-2
        px-3 py-1.5
        rounded-full border shadow-sm
        text-xs font-medium
        transition-opacity duration-300
        ${bgClass} ${textClass}
        ${state === 'synced' ? 'opacity-80' : 'opacity-100'}
        ${isInteractive ? 'cursor-pointer hover:opacity-90' : 'pointer-events-none'}
        select-none
        sm:bottom-4 sm:right-4
        max-sm:bottom-16 max-sm:right-3
      `}
      role="status"
      aria-live="polite"
      onClick={isInteractive ? sync.triggerSync : undefined}
      title={isInteractive ? 'Click to retry sync' : undefined}
    >
      {icon}
      <span>{text}</span>
      {isInteractive && <RefreshCw className="h-3 w-3 opacity-70" />}
    </div>
  );
};
