## Plan: Dashboard Enhancements & New Features

### 1. Seasonal Tasks Widget
- Add a compact widget in the header/toolbar area showing 3 seeds to sow and 3 crops to harvest for the current month
- Uses existing plant data (`sowingSeason`, `harvest` fields)

### 2. Plot Map Panel (modal)
- New `PlotMapPanel` component opening as a modal/panel
- Responsive 3×4 grid of garden beds
- Click a bed to label it and assign a plant family with color coding
- State stored locally (expandable to DB later)

### 3. Garden Journal with Photo Uploads
- **Database**: New `journal_entries` table (user_id, title, notes, photos array, created_at) with RLS
- **Storage**: New `journal-photos` bucket with user-scoped upload policies
- New `GardenJournal` component with dated entries, text notes, and photo upload (1-2 photos per entry)

### 4. Weather Rain Widget
- Small header widget using Open-Meteo API (already partially integrated)
- Shows rain probability for next 24 hours using the location from the header

### 5. Security Audit
- Verify all tables have RLS enabled (garden_plans already does)
- New journal_entries table will have proper RLS

### 6. Earthy Theme Option
- Add "Earthy" theme toggle alongside existing dark mode
- Forest Green primary, Sand backgrounds, Terracotta accents
- CSS variables in index.css with `.theme-earthy` class

### 7. Mobile Bottom Navigation Bar
- Fixed bottom nav bar on mobile with key actions (Plants, Calendar, Journal, AI, Weather)
- Replaces the hamburger menu on small screens

### Technical Notes
- Database migration needed for journal_entries table + storage bucket
- No changes to existing Supabase types file (auto-generated)
- All new components are self-contained panels/modals