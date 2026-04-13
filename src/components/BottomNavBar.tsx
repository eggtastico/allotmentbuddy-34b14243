import { Sprout, Image, ListTodo, BookOpen, MoreHorizontal } from 'lucide-react';

export type NavSection = 'garden' | 'photos' | 'tasks' | 'guides' | 'more';

interface BottomNavBarProps {
  active: NavSection;
  onNavigate: (section: NavSection) => void;
}

export function BottomNavBar({ active, onNavigate }: BottomNavBarProps) {
  const navItems: Array<{ id: NavSection; label: string; icon: React.ReactNode }> = [
    { id: 'garden', label: 'Garden', icon: <Sprout className="w-6 h-6" /> },
    { id: 'photos', label: 'Photos', icon: <Image className="w-6 h-6" /> },
    { id: 'tasks', label: 'Tasks', icon: <ListTodo className="w-6 h-6" /> },
    { id: 'guides', label: 'Guides', icon: <BookOpen className="w-6 h-6" /> },
    { id: 'more', label: 'More', icon: <MoreHorizontal className="w-6 h-6" /> },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border safe-area-inset-bottom z-30">
      <div className="flex justify-around items-stretch">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex-1 flex flex-col items-center justify-center py-3 px-2 transition-colors relative min-h-20 ${
              active === item.id
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title={item.label}
          >
            {item.icon}
            <span className="text-xs mt-1 truncate">{item.label}</span>
            {active === item.id && (
              <div className="absolute top-0 left-0 right-0 h-1 bg-primary rounded-b-full" />
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}
