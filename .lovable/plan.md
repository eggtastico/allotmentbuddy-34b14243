

## Plan: Enhance Plant Library & Companion Planting

### 1. Expand Plant Data Model
**File:** `src/types/garden.ts`
- Add new fields to `Plant` interface: `family` (string), `frostHardiness` ('hardy' | 'half-hardy' | 'tender'), `difficulty` ('easy' | 'moderate' | 'challenging'), `sowingSeason` (string[]), `tips` (string)

### 2. Expand to 100+ UK Allotment Plants
**File:** `src/data/plants.ts`
- Add ~40 new plants to reach 100+ total, covering common UK allotment varieties:
  - **Vegetables:** Runner Bean, Broad Bean, Pak Choi, Rocket, Watercress, Sweetcorn (popcorn), Celeriac, Kohlrabi, Chicory, Endive, Florence Fennel, Globe Artichoke, Jerusalem Artichoke, Squash (butternut/winter), Marrow, Chilli Pepper, Sweet Potato, Shallot, Mangetout
  - **Fruits:** Redcurrant, Whitecurrant, Blackberry, Plum (dwarf), Pear (dwarf), Cherry (dwarf), Cranberry, Loganberry, Damson
  - **Herbs:** Chervil, Tarragon, Lemon Balm, Lovage, Sorrel, Bay, Chamomile, Horseradish, Marjoram
  - **Flowers:** Sweet Pea, Dahlia, Cornflower, Poached Egg Plant, Zinnia, Cosmos, Foxglove, Echinacea
- Populate all new fields (`family`, `frostHardiness`, `difficulty`, `tips`) for all plants (existing + new)
- Use more distinct emoji where possible (avoid reusing 🌿 for every herb)

### 3. Enhanced Plant Sidebar with Filters
**File:** `src/components/PlantSidebar.tsx`
- Add filter dropdowns/badges for: **difficulty** (Easy/Moderate/Challenging), **season** (Spring/Summer/Autumn/Winter sowing), **sun preference**
- Filters stack with existing category filter and search
- Show plant count in filter badges

### 4. Plant Hover/Click Info Card
**File:** `src/components/PlantSidebar.tsx`
- Wrap each plant tile in a `HoverCard` (from existing `@/components/ui/hover-card`)
- Card shows: sowing months, harvest months, spacing, sun preference, companion plants (good/bad), frost hardiness, difficulty badge, and tips
- Compact layout using existing Badge and icon components

### 5. Companion Planting Visual Feedback on Grid
**File:** `src/components/GardenGrid.tsx`
- When placing or hovering over a plant on the grid, check all adjacent plants (within ~3 cell radius) for companion/enemy relationships
- Show green glow/border between companion pairs, red glow/border between enemy pairs
- Add small companion/enemy indicators on placed plant tiles (green dot = has nearby companion, red dot = has nearby enemy)

### Technical Notes
- All plant data remains client-side in `src/data/plants.ts` — no database changes needed
- The expanded `Plant` type fields will automatically be available to AI Chat, Rotation, and Watering features since they import from the same data source
- HoverCard is already installed in the project (`src/components/ui/hover-card.tsx`)
- No new dependencies required

