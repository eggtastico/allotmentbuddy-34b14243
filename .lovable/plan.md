
## Plan

### 1. Documentation Guide (overlay)
- Create a `DocsGuide` component as a full-screen overlay triggered from header
- Cover all features: filters, plot map, journal, calendar, themes, AI chat, weather, etc.
- Add "📖 Guide" button to the header bar

### 2. Expand Vegetable Library + Varieties
- Add more vegetables to `plants.ts` (e.g., multiple tomato varieties, bean types, lettuce types)
- Add a `variety` field to the Plant type so users can filter by variety
- Update PlantSidebar filters to include variety selection

### 3. Seed Pack AI Scanning
- Add a camera/upload button in the plant sidebar or a dedicated "Scan Seed Pack" feature
- Upload photo to Supabase Storage, send to Lovable AI (Gemini with vision) via edge function
- AI extracts: plant name, variety, sowing instructions, spacing, harvest time, etc.
- Return structured data to populate plant info

### 4. Seed Inventory System (DB migration required)
- Create `seed_inventory` table: user_id, plant_name, variety, quantity, purchased_date, expiry_date, seed_pack_photo, notes, ai_extracted_data
- RLS policies for user-only access
- UI panel to view/add/edit seed inventory
- Link inventory items to plants in the library

### 5. Planting Suggestions from Inventory
- Based on current month/week, cross-reference inventory with planting calendar data
- Show "Plant this week" / "Plant this month" suggestions using seeds the user actually has
- Display in a widget or within the seasonal tasks component

### 6. Plot Selection Enhancement
- When user selects a plant on their plot, show seed pack details (if scanned) alongside existing plant info

### Order of implementation:
1. DB migration for seed_inventory table
2. Expand Plant type with variety field + add more vegetables
3. Documentation guide overlay
4. Seed inventory UI
5. Seed pack AI scanning (edge function + UI)
6. Planting suggestions from inventory
7. Enhanced plot selection info
