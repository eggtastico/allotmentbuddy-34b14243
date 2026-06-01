import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed top-16 left-0 right-0 z-50 flex justify-center pointer-events-none">
      <div className="bg-amber-600 text-white text-xs px-3 py-1.5 rounded-b-lg shadow-md flex items-center gap-1.5 pointer-events-auto">
        <WifiOff className="h-3.5 w-3.5" />
        Working offline
      </div>
    </div>
  );
}
