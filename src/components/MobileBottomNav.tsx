import { Sprout, Calendar, Bot, BookOpen, Map, CloudSun } from 'lucide-react';

interface Props {
  onToggleSidebar: () => void;
  onShowCalendar: () => void;
  onShowAI: () => void;
  onShowJournal: () => void;
  onShowPlotMap: () => void;
  onShowWeather: () => void;
}

export function MobileBottomNav({ onToggleSidebar, onShowCalendar, onShowAI, onShowJournal, onShowPlotMap, onShowWeather }: Props) {
  const items = [
    { icon: Sprout, label: 'Plants', action: onToggleSidebar },
    { icon: Calendar, label: 'Calendar', action: onShowCalendar },
    { icon: Map, label: 'Plot Map', action: onShowPlotMap },
    { icon: BookOpen, label: 'Journal', action: onShowJournal },
    { icon: Bot, label: 'AI Help', action: onShowAI },
    { icon: CloudSun, label: 'Weather', action: onShowWeather },
  ];

  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border flex items-center justify-around py-1.5 px-1 safe-bottom">
      {items.map(item => (
        <button
          key={item.label}
          onClick={item.action}
          className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg hover:bg-muted transition-colors min-w-[48px]"
        >
          <item.icon className="h-5 w-5 text-foreground/70" />
          <span className="text-[9px] font-medium text-muted-foreground leading-tight">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
