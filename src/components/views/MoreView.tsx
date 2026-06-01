import { User } from '@supabase/supabase-js';
import { AutomationPlan, AutomationTask } from '@/utils/automationPlannerUtils';

interface MoreViewProps {
  setShowGrowGuide: (show: boolean) => void;
  setShowAI: (show: boolean) => void;
  setShowPlantingSuggestions: (show: boolean) => void;
  setShowWeather: (show: boolean) => void;
  setShowWatering: (show: boolean) => void;
  setShowJournal: (show: boolean) => void;
  setShowSeedInventory: (show: boolean) => void;
  setShowHarvestLogger: (show: boolean) => void;
  setShowPestLog: (show: boolean) => void;
  setShowCalendar: (show: boolean) => void;
  setShowMonthlyPlanner: (show: boolean) => void;
  setShowRotation: (show: boolean) => void;
  setShowRotationPlanner: (show: boolean) => void;
  setShowPlotMap: (show: boolean) => void;
  setShowShoppingList: (show: boolean) => void;
  setShowAutomationPlanner: (show: boolean) => void;
  setShowDocs: (show: boolean) => void;
  setShowSaveLoad: (show: boolean) => void;
  setShowAuth: (show: boolean) => void;
  handleExportPDF: () => void;
  automationPlans: AutomationPlan[];
  automationTasks: AutomationTask[];
  user: User | null;
  signOut: () => Promise<void>;
}

export function MoreView({
  setShowGrowGuide,
  setShowAI,
  setShowPlantingSuggestions,
  setShowWeather,
  setShowWatering,
  setShowJournal,
  setShowSeedInventory,
  setShowHarvestLogger,
  setShowPestLog,
  setShowCalendar,
  setShowMonthlyPlanner,
  setShowRotation,
  setShowRotationPlanner,
  setShowPlotMap,
  setShowShoppingList,
  setShowAutomationPlanner,
  setShowDocs,
  setShowSaveLoad,
  setShowAuth,
  handleExportPDF,
  automationPlans,
  automationTasks,
  user,
  signOut,
}: MoreViewProps) {
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-2xl font-semibold text-foreground">⚙️ More</h2>

      {/* Grow */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Grow</h3>
        <div className="space-y-2">
          <button
            onClick={() => setShowGrowGuide(true)}
            className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm"
          >
            ✨ Grow Guide
          </button>
          <button
            onClick={() => setShowAI(true)}
            className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm"
          >
            🤖 AI Assistant
          </button>
          <button
            onClick={() => setShowPlantingSuggestions(true)}
            className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm"
          >
            💡 Suggestions
          </button>
          <button
            onClick={() => setShowWeather(true)}
            className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm"
          >
            🌤️ Weather & Yield
          </button>
          <button
            onClick={() => setShowWatering(true)}
            className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm"
          >
            💧 Watering Guide
          </button>
        </div>
      </div>

      {/* Track */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Track</h3>
        <div className="space-y-2">
          <button
            onClick={() => setShowJournal(true)}
            className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm"
          >
            📔 Garden Journal
          </button>
          <button
            onClick={() => setShowSeedInventory(true)}
            className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm"
          >
            📦 Seed Inventory
          </button>
          <button
            onClick={() => setShowHarvestLogger(true)}
            className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm"
          >
            🌾 Harvest Log
          </button>
          <button
            onClick={() => setShowPestLog(true)}
            className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm"
          >
            🐛 Pest & Disease Log
          </button>
        </div>
      </div>

      {/* Plan */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Plan</h3>
        <div className="space-y-2">
          <button
            onClick={() => setShowCalendar(true)}
            className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm"
          >
            📅 Planting Calendar
          </button>
          <button
            onClick={() => setShowMonthlyPlanner(true)}
            className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm"
          >
            📆 Monthly Planner
          </button>
          <button
            onClick={() => setShowRotation(true)}
            className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm"
          >
            🔄 Crop Rotation
          </button>
          <button
            onClick={() => setShowRotationPlanner(true)}
            className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm"
          >
            🔄 Rotation Planner
          </button>
          <button
            onClick={() => setShowPlotMap(true)}
            className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm"
          >
            🗺️ Plot Map
          </button>
          <button
            onClick={() => setShowShoppingList(true)}
            className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm"
          >
            🛒 Shopping List
          </button>
          <button
            onClick={() => setShowAutomationPlanner(true)}
            className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm flex items-center gap-2"
          >
            <span>🤖 Automation Planner</span>
            {automationPlans.length > 0 && (
              <span className="ml-auto text-[10px] bg-primary/20 text-primary rounded-full px-2 py-0.5 font-medium">
                {automationTasks.filter(t => !t.completed).length} pending
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Settings */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Settings</h3>
        <div className="space-y-2">
          <button
            onClick={() => setShowDocs(true)}
            className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm"
          >
            📚 Guide & Docs
          </button>
          <button
            onClick={() => handleExportPDF()}
            className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm"
          >
            📥 Export PDF
          </button>
          {user && (
            <button
              onClick={() => setShowSaveLoad(true)}
              className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm"
            >
              📁 My Gardens
            </button>
          )}
          {!user && (
            <button
              onClick={() => setShowAuth(true)}
              className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm"
            >
              👤 Sign In
            </button>
          )}
          {user && (
            <button
              onClick={() => signOut()}
              className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-border text-sm"
            >
              🚪 Sign Out
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
