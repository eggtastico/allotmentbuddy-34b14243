import React, { useCallback } from 'react';
import { Sprout, Calendar, Bot, Download, FolderOpen, User, LogOut, Shuffle, CloudSun, Droplets, Menu, X, BookOpen, Map, HelpCircle, Package, Lightbulb, ListTodo, CalendarRange, Sparkles, ChevronDown, LayoutTemplate } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { LocationPicker } from '@/components/LocationPicker';
import { RainWidget } from '@/components/RainWidget';
import { DarkModeToggle } from '@/components/DarkModeToggle';
import { SocialShare } from '@/components/SocialShare';

export interface LocationData {
  name: string;
  lat: number;
  lon: number;
  region?: string;
}

export interface GardenHeaderProps {
  user: { id: string } | null;
  location: LocationData | null;
  mobileMenuOpen: boolean;
  mobileMenuLoading?: boolean;

  // Setters
  onLocationChange: (location: LocationData) => void;
  onMobileMenuToggle: () => void;
  onMobileSidebarToggle: () => void;
  onSignOut: () => void;

  // Modal show setters
  onShowCalendar: () => void;
  onShowMonthlyPlanner: () => void;
  onShowRotation: () => void;
  onShowPlotMap: () => void;
  onShowGrowGuide: () => void;
  onShowAI: () => void;
  onShowPlantingSuggestions: () => void;
  onShowWeather: () => void;
  onShowWatering: () => void;
  onShowTasks: () => void;
  onShowSeedInventory: () => void;
  onShowJournal: () => void;
  onShowDocs: () => void;
  onShowSaveLoad: () => void;
  onShowAuth: () => void;
  onExportPDF: () => void;
  onShowTemplatePicker: () => void;
}

export function GardenHeader(props: GardenHeaderProps) {
  const {
    user,
    location,
    mobileMenuOpen,
    onLocationChange,
    onMobileMenuToggle,
    onMobileSidebarToggle,
    onSignOut,
    onShowCalendar,
    onShowMonthlyPlanner,
    onShowRotation,
    onShowPlotMap,
    onShowGrowGuide,
    onShowAI,
    onShowPlantingSuggestions,
    onShowWeather,
    onShowWatering,
    onShowTasks,
    onShowSeedInventory,
    onShowJournal,
    onShowDocs,
    onShowSaveLoad,
    onShowAuth,
    onExportPDF,
    onShowTemplatePicker,
  } = props;

  const closeMenu = useCallback(() => {
    // Menu will be closed by parent component
  }, []);

  const NavDropdown = ({ label, icon: Icon, children }: { label: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; children: React.ReactNode }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 px-2">
          <Icon className="h-3 w-3" />
          {label}
          <ChevronDown className="h-2.5 w-2.5 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[160px]">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const desktopNav = (
    <>
      <NavDropdown label="Plan" icon={Calendar}>
        <DropdownMenuItem onClick={onShowCalendar}>
          <Calendar className="h-4 w-4 mr-2" /> Planting Calendar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onShowPlotMap}>
          <Map className="h-4 w-4 mr-2" /> Plot Map
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onShowRotation}>
          <Shuffle className="h-4 w-4 mr-2" /> Crop Rotation
        </DropdownMenuItem>
      </NavDropdown>

      <NavDropdown label="Grow" icon={Sparkles}>
        <DropdownMenuItem onClick={onShowAI}>
          <Bot className="h-4 w-4 mr-2" /> AI Assistant
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onShowWeather}>
          <CloudSun className="h-4 w-4 mr-2" /> Weather & Yield
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onShowDocs}>
          <BookOpen className="h-4 w-4 mr-2" /> Growing Guide
        </DropdownMenuItem>
      </NavDropdown>

      <NavDropdown label="Track" icon={ListTodo}>
        <DropdownMenuItem onClick={onShowTasks}>
          <ListTodo className="h-4 w-4 mr-2" /> Tasks
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onShowSeedInventory}>
          <Package className="h-4 w-4 mr-2" /> Seed Inventory
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onShowJournal}>
          <BookOpen className="h-4 w-4 mr-2" /> Journal
        </DropdownMenuItem>
      </NavDropdown>

      <NavDropdown label="More" icon={HelpCircle}>
        <DropdownMenuItem onClick={onShowTemplatePicker}>
          <LayoutTemplate className="h-4 w-4 mr-2" /> Templates
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExportPDF}>
          <Download className="h-4 w-4 mr-2" /> Export PDF
        </DropdownMenuItem>
        {user && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onShowSaveLoad}>
              <FolderOpen className="h-4 w-4 mr-2" /> My Gardens
            </DropdownMenuItem>
          </>
        )}
      </NavDropdown>
    </>
  );

  const mobileNavItems = (
    <div className="grid grid-cols-2 gap-1 p-2">
      <DropdownMenuLabel className="col-span-2 text-[10px] text-muted-foreground uppercase tracking-wider">Plan</DropdownMenuLabel>
      <Button variant="ghost" size="sm" className="h-8 text-xs justify-start" onClick={() => { onShowCalendar(); closeMenu(); }}>
        <Calendar className="h-3.5 w-3.5 mr-1.5" /> Calendar
      </Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs justify-start" onClick={() => { onShowPlotMap(); closeMenu(); }}>
        <Map className="h-3.5 w-3.5 mr-1.5" /> Plot Map
      </Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs justify-start" onClick={() => { onShowRotation(); closeMenu(); }}>
        <Shuffle className="h-3.5 w-3.5 mr-1.5" /> Rotation
      </Button>

      <DropdownMenuLabel className="col-span-2 text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Grow</DropdownMenuLabel>
      <Button variant="ghost" size="sm" className="h-8 text-xs justify-start" onClick={() => { onShowAI(); closeMenu(); }}>
        <Bot className="h-3.5 w-3.5 mr-1.5" /> AI Help
      </Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs justify-start" onClick={() => { onShowWeather(); closeMenu(); }}>
        <CloudSun className="h-3.5 w-3.5 mr-1.5" /> Weather
      </Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs justify-start" onClick={() => { onShowDocs(); closeMenu(); }}>
        <BookOpen className="h-3.5 w-3.5 mr-1.5" /> Guide
      </Button>

      <DropdownMenuLabel className="col-span-2 text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Track</DropdownMenuLabel>
      <Button variant="ghost" size="sm" className="h-8 text-xs justify-start" onClick={() => { onShowTasks(); closeMenu(); }}>
        <ListTodo className="h-3.5 w-3.5 mr-1.5" /> Tasks
      </Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs justify-start" onClick={() => { onShowSeedInventory(); closeMenu(); }}>
        <Package className="h-3.5 w-3.5 mr-1.5" /> Seeds
      </Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs justify-start" onClick={() => { onShowJournal(); closeMenu(); }}>
        <BookOpen className="h-3.5 w-3.5 mr-1.5" /> Journal
      </Button>

      <DropdownMenuLabel className="col-span-2 text-[10px] text-muted-foreground uppercase tracking-wider mt-1">More</DropdownMenuLabel>
      <Button variant="ghost" size="sm" className="h-8 text-xs justify-start" onClick={() => { onShowTemplatePicker(); closeMenu(); }}>
        <LayoutTemplate className="h-3.5 w-3.5 mr-1.5" /> Templates
      </Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs justify-start" onClick={() => { onExportPDF(); closeMenu(); }}>
        <Download className="h-3.5 w-3.5 mr-1.5" /> Export PDF
      </Button>
      {user ? (
        <>
          <Button variant="ghost" size="sm" className="h-8 text-xs justify-start" onClick={() => { onShowSaveLoad(); closeMenu(); }}>
            <FolderOpen className="h-3.5 w-3.5 mr-1.5" /> My Gardens
          </Button>
          <Button variant="ghost" size="sm" className="h-8 text-xs justify-start" onClick={() => { onSignOut(); closeMenu(); }}>
            <LogOut className="h-3.5 w-3.5 mr-1.5" /> Sign Out
          </Button>
        </>
      ) : (
        <Button variant="outline" size="sm" className="h-8 text-xs justify-start" onClick={() => { onShowAuth(); closeMenu(); }}>
          <User className="h-3.5 w-3.5 mr-1.5" /> Sign In
        </Button>
      )}
    </div>
  );

  return (
    <>
      {/* Header */}
      <header className="h-10 bg-gradient-to-r from-primary/10 via-card to-secondary/10 px-3 flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="h-7 w-7 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-sm">
            <Sprout className="h-4 w-4 text-primary-foreground" />
          </div>
          <h1 className="hidden sm:block font-bold text-primary text-sm leading-none">🌱 Allotment Buddy</h1>
        </div>

        <LocationPicker location={location} onLocationChange={onLocationChange} />
        <RainWidget location={location} />

        {/* Desktop nav — grouped dropdowns */}
        <div className="hidden lg:flex items-center gap-0.5 ml-auto">
          {desktopNav}
          <div className="h-4 w-px bg-border mx-1" />
          <SocialShare />
          {user ? (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onSignOut}>
              <LogOut className="h-3.5 w-3.5 mr-1" /> Sign Out
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onShowAuth}>
              <User className="h-3.5 w-3.5 mr-1" /> Sign In
            </Button>
          )}
          <DarkModeToggle />
        </div>

        {/* Mobile nav */}
        <div className="lg:hidden flex items-center gap-1 ml-auto">
          <SocialShare />
          <DarkModeToggle />
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl sm:hidden" onClick={onMobileSidebarToggle}>
            <Sprout className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={onMobileMenuToggle}>
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-b border-border bg-card animate-fade-in">
          {mobileNavItems}
        </div>
      )}
    </>
  );
}
