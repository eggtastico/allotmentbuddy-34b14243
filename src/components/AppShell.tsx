import React from 'react';
import { BottomNavBar, NavSection } from '@/components/BottomNavBar';
import { Menu, Settings, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AppShellProps {
  children: React.ReactNode;
  activeNav: NavSection;
  onNavigate: (section: NavSection) => void;
  title?: string;
  onMenuClick?: () => void;
  onSettings?: () => void;
  onLogout?: () => void;
  isMobile?: boolean;
}

export function AppShell({
  children,
  activeNav,
  onNavigate,
  title = 'Allotment Buddy',
  onMenuClick,
  onSettings,
  onLogout,
  isMobile = false,
}: AppShellProps) {
  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-card safe-area-inset-top">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌱</span>
            <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          </div>

          {/* Header actions */}
          <div className="flex items-center gap-2">
            {isMobile && onMenuClick && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onMenuClick}
                className="h-10 w-10 p-0"
              >
                <Menu className="w-5 h-5" />
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-10 w-10 p-0">
                  <Settings className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {onSettings && (
                  <>
                    <DropdownMenuItem onClick={onSettings}>
                      ⚙️ Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {onLogout && (
                  <DropdownMenuItem onClick={onLogout} className="text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main content area with safe area padding */}
      <main className="flex-1 overflow-y-auto pb-24 safe-area-inset-bottom lg:pb-0">
        <div className="h-full">
          {children}
        </div>
      </main>

      {/* Bottom navigation (mobile only) */}
      {isMobile && (
        <BottomNavBar active={activeNav} onNavigate={onNavigate} />
      )}
    </div>
  );
}
