import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Log incoming request
  const authHeader = req.headers.get("authorization");
  console.log('[grow-guide] Incoming request - Auth header present:', !!authHeader);

  try {
    const { plants } = await req.json();
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    console.log('[grow-guide] API Key loaded:', OPENROUTER_API_KEY ? 'YES' : 'NO');
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured in Supabase secrets");

    const now = new Date();
    const monthName = now.toLocaleString('en-GB', { month: 'long' });

    const systemPrompt = `You are an expert UK allotment gardening advisor. The user has selected plants they want to grow. Create a comprehensive, personalised growing guide.

Current date: ${now.toLocaleDateString('en-GB')} (${monthName})

For each plant, provide:
1. **When to start** — exact months for sowing indoors, transplanting, and direct sowing
2. **Where to plant** — sun requirements, spacing, and plot position tips
3. **Companion planting** — what to grow nearby and what to avoid
4. **Key care tips** — watering, feeding, common pests
5. **Expected harvest** — when and how to harvest

Then provide an **Overall Plan**:
- A month-by-month timeline showing what to do when
- Crop rotation advice if relevant
- Layout suggestions for how to arrange them on a plot

Keep it practical, specific to UK climate, and encouraging. Use markdown formatting with headers and bullet points. Use emojis sparingly.`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "X-Title": "Allotment Buddy",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `I want to grow these plants on my UK allotment:\n\n${plants}\n\nPlease create a comprehensive growing guide with timings, companions, and layout suggestions.` },
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("[grow-guide] OpenRouter error:", response.status, t);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`OpenRouter error ${response.status}: ${t}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "I couldn't generate a guide.";

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("grow-guide error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
