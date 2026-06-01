import { Sprout, LayoutGrid, Building2, CheckSquare, Calendar, MoreHorizontal } from 'lucide-react';

export type NavSection = 'garden' | 'beds' | 'structures' | 'tasks' | 'plan' | 'more' | 'plants' | 'photos';

interface BottomNavBarProps {
  active: NavSection;
  onNavigate: (section: NavSection) => void;
}

export function BottomNavBar({ active, onNavigate }: BottomNavBarProps) {
  const navItems: Array<{ id: NavSection; label: string; shortLabel: string; icon: React.ReactNode }> = [
    { id: 'garden', label: 'Garden', shortLabel: 'Garden', icon: <Sprout className="w-6 h-6" /> },
    { id: 'beds', label: 'Beds & Pots', shortLabel: 'Beds', icon: <LayoutGrid className="w-6 h-6" /> },
    { id: 'structures', label: 'Structures', shortLabel: 'Build', icon: <Building2 className="w-6 h-6" /> },
    { id: 'tasks', label: 'Tasks', shortLabel: 'Tasks', icon: <CheckSquare className="w-6 h-6" /> },
    { id: 'plan', label: 'Plan', shortLabel: 'Plan', icon: <Calendar className="w-6 h-6" /> },
    { id: 'more', label: 'More', shortLabel: 'More', icon: <MoreHorizontal className="w-6 h-6" /> },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border safe-area-inset-bottom z-30">
      <div className="flex justify-around items-stretch">
        {navItems.map((item) => (
          <button
            key={item.id}
            data-testid={`nav-${item.id}`}
            onClick={() => {
              navigator.vibrate?.(5);
              onNavigate(item.id);
            }}
            className={`flex-1 flex flex-col items-center justify-center py-2 px-1 transition-colors relative min-h-[60px] ${
              active === item.id
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title={item.label}
          >
            {item.icon}
            <span className="text-[10px] mt-0.5 truncate max-w-full leading-tight">
              {item.shortLabel}
            </span>
            {active === item.id && (
              <div className="absolute top-0 left-1 right-1 h-0.5 bg-primary rounded-b-full" />
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}
