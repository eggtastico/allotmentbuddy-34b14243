import { useState, useEffect } from 'react';
import { Moon, Sun, Leaf } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Theme = 'light' | 'dark' | 'earthy';

export function DarkModeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = localStorage.getItem('ab-theme') as Theme | null;
    if (saved && ['light', 'dark', 'earthy'].includes(saved)) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'theme-earthy');
    if (theme === 'dark') root.classList.add('dark');
    if (theme === 'earthy') root.classList.add('theme-earthy');
    localStorage.setItem('ab-theme', theme);
  }, [theme]);

  const cycle = () => {
    setTheme(prev => prev === 'light' ? 'dark' : prev === 'dark' ? 'earthy' : 'light');
  };

  const icon = theme === 'dark' ? <Moon className="h-4 w-4" /> : theme === 'earthy' ? <Leaf className="h-4 w-4" /> : <Sun className="h-4 w-4" />;
  const title = theme === 'light' ? 'Light mode' : theme === 'dark' ? 'Dark mode' : 'Earthy mode';

  return (
    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={cycle} title={title}>
      {icon}
    </Button>
  );
}
