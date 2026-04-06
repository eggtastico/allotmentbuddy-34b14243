
## Plan

### 1. Garden Task List (DB + UI)
- Create `garden_tasks` table: user_id, title, due_date, period (weekly/monthly), completed, plant_name
- RLS policies for user-only access
- `GardenTasks.tsx` component with tabs for "This Week" / "This Month" / "Completed"
- Allow adding custom tasks + auto-suggest seasonal tasks

### 2. Monthly Planner Guide
- `MonthlyPlanner.tsx` — a 12-month overview showing what to sow, transplant, harvest, and general garden jobs for each month
- Uses data from `plants.ts` (sowIndoors, sowOutdoors, harvest fields)
- Highlights current month, shows upcoming tasks

### 3. "I Want to Grow..." AI Feature
- `GrowGuide.tsx` — user selects plants they want to grow from the plant library
- Sends selection to a new `grow-guide` edge function (Lovable AI)
- AI returns personalised timeline: when to start seeds, transplant, expected harvest, spacing, companions, and plot placement tips
- Results displayed in a clean timeline/card layout

### Order of implementation:
1. DB migration for `garden_tasks` table
2. Build GardenTasks component
3. Build MonthlyPlanner component  
4. Create grow-guide edge function
5. Build GrowGuide component
6. Wire everything into Index.tsx header/nav
