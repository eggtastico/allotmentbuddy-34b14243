import { useState } from 'react';
import { X, Sprout, Leaf, Calendar, Bot, Map, BookOpen, Droplets, CloudSun, Shuffle, Download, Filter, Search, Camera, Package, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DocsGuideProps {
  onClose: () => void;
}

const sections = [
  {
    id: 'getting-started',
    icon: <Sprout className="h-4 w-4" />,
    title: 'Getting Started',
    content: `Welcome to Allotment Buddy — your complete garden planning companion!

**Quick Start:**
1. Set your plot dimensions using the toolbar at the top
2. Drag plants from the Plant Library sidebar onto your garden grid
3. Choose whether you're planting as seed (🌰) or seedling (🌱)
4. Click any placed plant to see detailed info, companions, and warnings

**Your Plot:**
- Resize your garden using the width/height controls in the toolbar
- Switch between meters and feet
- Set your south-facing direction for accurate sun calculations
- Clear the entire plot with the reset button`
  },
  {
    id: 'plant-library',
    icon: <Leaf className="h-4 w-4" />,
    title: 'Plant Library & Filters',
    content: `The Plant Library sidebar contains 100+ plants organized by category.

**Categories:** 🥦 Vegetables, 🍓 Fruits, 🌿 Herbs, 🌼 Flowers

**Search & Filter:**
- Use the search bar to find plants by name
- Click category badges to filter (e.g., show only vegetables)
- Click the Filter icon for advanced filters:
  - **Difficulty**: Easy, Moderate, Challenging
  - **Sowing season**: Spring, Summer, Autumn, Winter
  - **Sun preference**: Full sun, Partial shade, Any

**Varieties:**
Many vegetables now include variety options (e.g., Cherry Tomato, Beefsteak Tomato, Romaine Lettuce). Filter by variety in the sidebar to find specific types.

**Structures Tab:**
Switch to the Structures tab to add raised beds, greenhouses, paths, and other structures. Drag them onto your plot and resize by dragging edges.

**Hover for Details:**
Hover over any plant in the sidebar to see a popup with full growing info including sowing times, harvest periods, spacing, companions, and tips.`
  },
  {
    id: 'seed-scanning',
    icon: <Camera className="h-4 w-4" />,
    title: 'Seed Pack Scanning',
    content: `Scan your seed packets using AI to automatically extract plant information!

**How to Scan:**
1. Open the Seed Inventory panel
2. Click "📷 Scan Seed Pack" 
3. Take a photo or upload an image of your seed packet
4. AI will extract: plant name, variety, sowing instructions, spacing, and more
5. The extracted data is saved to your seed inventory

**What gets extracted:**
- Plant name and variety
- Sowing dates (indoor/outdoor)
- Spacing requirements
- Harvest period
- Growing tips from the packet
- Days to maturity

**Seed pack data on plots:**
When you select a plant on your plot that has matching seed pack data from your inventory, the extra details from the packet are displayed in the info panel.`
  },
  {
    id: 'seed-inventory',
    icon: <Package className="h-4 w-4" />,
    title: 'Seed Inventory',
    content: `Track all your seeds in one place!

**Adding Seeds:**
- Manually add seeds with name, variety, quantity, purchase date, and expiry
- Or scan a seed packet to auto-populate details
- Upload photos of seed packs for reference

**Managing Inventory:**
- View all your seeds at a glance
- Edit quantities as you use seeds
- Track expiry dates to use seeds before they lose viability
- Add notes about germination rates or growing results

**Smart Suggestions:**
The inventory system cross-references your seeds with the current planting calendar to suggest which packets to use this week or month. Look for the "🌱 Plant Now" suggestions!`
  },
  {
    id: 'planting-suggestions',
    icon: <Lightbulb className="h-4 w-4" />,
    title: 'Planting Suggestions',
    content: `Get personalized planting suggestions based on your seed inventory!

**Weekly/Monthly Tips:**
- The Seasonal Tasks widget at the top shows what to sow and harvest this month
- If you have seeds in your inventory, it highlights which ones are ready to plant now
- Suggestions are based on UK growing conditions and sowing calendars

**How It Works:**
1. Add seeds to your inventory
2. Check the Seasonal Tasks or Planting Suggestions panel
3. See which of YOUR seeds should be sown this week/month
4. Plan ahead with next month's suggestions too`
  },
  {
    id: 'calendar',
    icon: <Calendar className="h-4 w-4" />,
    title: 'Planting Calendar',
    content: `View a month-by-month planting calendar for all plants in your garden.

**Features:**
- See sowing and harvest windows for each planted crop
- Color-coded bars show indoor sowing, outdoor sowing, and harvest periods
- Filtered to show only plants you've actually placed in your garden
- Great for planning your growing year at a glance`
  },
  {
    id: 'companion-planting',
    icon: <Shuffle className="h-4 w-4" />,
    title: 'Companion Planting & Rotation',
    content: `Allotment Buddy helps you plan companion planting and crop rotation.

**Companion Planting:**
- When you select a plant, green badges show "Good Companions" nearby
- Red badges warn about enemy plants that shouldn't be planted together
- The system checks your actual garden layout for real-time warnings

**Crop Rotation:**
- Each plant belongs to a rotation group (Legumes, Brassicas, Roots, etc.)
- Use the Rotation panel to optimize your garden layout
- Color-coded groups help visualize rotation planning
- The optimizer can suggest improved layouts automatically`
  },
  {
    id: 'weather',
    icon: <CloudSun className="h-4 w-4" />,
    title: 'Weather & Rain',
    content: `Stay on top of the weather for your garden location.

**Rain Widget:**
- Shows 24-hour rain probability in the header
- Helps you decide whether to water today
- Updates based on your set location

**Weather Panel:**
- Detailed weather forecast for your area
- Temperature and precipitation data
- Yield estimates based on current conditions

**Location:**
Set your garden location using the Location Picker in the header bar for accurate local weather data.`
  },
  {
    id: 'watering',
    icon: <Droplets className="h-4 w-4" />,
    title: 'Watering Guide',
    content: `Get plant-specific watering recommendations.

**Features:**
- Watering needs for each plant in your garden
- Adjusts based on weather conditions and season
- Groups plants by water needs for efficient watering
- Tips on mulching and water conservation`
  },
  {
    id: 'journal',
    icon: <BookOpen className="h-4 w-4" />,
    title: 'Garden Journal',
    content: `Keep a visual log of your garden's progress.

**Features:**
- Create dated journal entries with titles and notes
- Upload photos to track plant growth visually
- Link entries to specific garden plans
- Review your growing season over time

**Tips:**
- Take regular photos from the same angle to see growth progress
- Note weather conditions, pest sightings, and harvest weights
- Record what worked and what didn't for next year's planning`
  },
  {
    id: 'plot-map',
    icon: <Map className="h-4 w-4" />,
    title: 'Plot Map',
    content: `Plan your allotment beds with the Plot Map panel.

**Features:**
- 3×4 grid representing garden beds
- Click any bed to label it and assign a plant family
- Color-coded by crop rotation group (Brassicas, Alliums, etc.)
- Helps plan year-to-year rotation

**Usage:**
1. Open the Plot Map from the header
2. Click a bed to edit its label and plant family
3. Use colors to ensure good rotation between years`
  },
  {
    id: 'ai-help',
    icon: <Bot className="h-4 w-4" />,
    title: 'AI Garden Assistant',
    content: `Chat with an AI assistant that knows about your garden!

**What it can help with:**
- Answering growing questions
- Pest and disease identification
- Planting advice for your specific layout
- Seasonal growing tips
- Troubleshooting plant problems

**Context-aware:**
The AI knows about your current garden layout, planted crops, and location, so it can give personalized advice.`
  },
  {
    id: 'export',
    icon: <Download className="h-4 w-4" />,
    title: 'Save, Load & Export',
    content: `**Saving Plans (requires sign in):**
- Sign in to save multiple garden plans
- Load previous plans to continue working
- Create new plans for different seasons or plots

**PDF Export:**
- Export your current garden layout as a PDF
- Includes plant positions, spacing, and companion info
- Great for printing and taking to the allotment

**Themes:**
Cycle through Light, Dark, and Earthy themes using the theme toggle in the header.`
  },
];

export function DocsGuide({ onClose }: DocsGuideProps) {
  const [activeSection, setActiveSection] = useState('getting-started');

  const current = sections.find(s => s.id === activeSection) || sections[0];

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm animate-fade-in flex flex-col">
      {/* Header */}
      <div className="h-14 border-b border-border bg-card px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-foreground text-sm">Documentation Guide</h1>
            <p className="text-[10px] text-muted-foreground">Everything you need to know</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar nav */}
        <ScrollArea className="w-56 border-r border-border bg-card shrink-0 hidden sm:block">
          <div className="p-2 space-y-0.5">
            {sections.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-left transition-colors ${
                  activeSection === section.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-muted'
                }`}
              >
                {section.icon}
                <span className="truncate">{section.title}</span>
              </button>
            ))}
          </div>
        </ScrollArea>

        {/* Mobile section select */}
        <div className="sm:hidden border-b border-border bg-card p-2 shrink-0 overflow-x-auto flex gap-1">
          {sections.map(section => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`whitespace-nowrap flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] transition-colors ${
                activeSection === section.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {section.icon}
              {section.title}
            </button>
          ))}
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="max-w-2xl mx-auto p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                {current.icon}
              </div>
              <h2 className="text-xl font-bold text-foreground">{current.title}</h2>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
              {current.content.split('\n\n').map((paragraph, i) => (
                <div key={i} className="mb-4">
                  {paragraph.split('\n').map((line, j) => {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
                      return <h3 key={j} className="font-semibold text-foreground mt-4 mb-2">{trimmed.replace(/\*\*/g, '')}</h3>;
                    }
                    if (trimmed.startsWith('**') && trimmed.includes(':**')) {
                      const [bold, rest] = trimmed.split(':**');
                      return <p key={j} className="mb-1"><strong className="text-foreground">{bold.replace(/\*\*/g, '')}:</strong>{rest}</p>;
                    }
                    if (trimmed.startsWith('- ')) {
                      return <li key={j} className="ml-4 text-muted-foreground list-disc">{trimmed.slice(2).replace(/\*\*(.*?)\*\*/g, '$1')}</li>;
                    }
                    if (/^\d+\./.test(trimmed)) {
                      return <li key={j} className="ml-4 text-muted-foreground list-decimal">{trimmed.replace(/^\d+\.\s*/, '').replace(/\*\*(.*?)\*\*/g, '$1')}</li>;
                    }
                    if (trimmed === '') return null;
                    return <p key={j} className="text-muted-foreground">{trimmed}</p>;
                  })}
                </div>
              ))}
            </div>

            {/* Navigation */}
            <div className="flex justify-between mt-8 pt-4 border-t border-border">
              {(() => {
                const idx = sections.findIndex(s => s.id === activeSection);
                const prev = idx > 0 ? sections[idx - 1] : null;
                const next = idx < sections.length - 1 ? sections[idx + 1] : null;
                return (
                  <>
                    {prev ? (
                      <Button variant="ghost" size="sm" onClick={() => setActiveSection(prev.id)}>
                        ← {prev.title}
                      </Button>
                    ) : <div />}
                    {next ? (
                      <Button variant="ghost" size="sm" onClick={() => setActiveSection(next.id)}>
                        {next.title} →
                      </Button>
                    ) : <div />}
                  </>
                );
              })()}
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
