import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, context } = await req.json();
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured in Supabase secrets");

    const now = new Date();
    const monthName = now.toLocaleString('en-GB', { month: 'long' });
    const season = now.getMonth() < 2 || now.getMonth() === 11 ? 'winter' : now.getMonth() < 5 ? 'spring' : now.getMonth() < 8 ? 'summer' : 'autumn';

    const systemPrompt = `You are Allotment Buddy's AI garden assistant — friendly, knowledgeable, and encouraging. You help UK allotment gardeners plan and maintain their gardens.

Current garden context: ${context}
Current date: ${now.toLocaleDateString('en-GB')} (${monthName}, ${season})

You are an EXPERT in:
- UK allotment gardening with knowledge of typical UK frost dates (last frost: late April south, mid-May north; first frost: mid-October north, late November south)
- Companion planting — which plants help or hinder each other
- Crop rotation — 4-year rotation groups (legumes, brassicas, roots/alliums, solanaceae/cucurbits)
- Soil health and organic matter
- Pest and disease management (slugs, carrot fly, blight, etc.)

NUTRIENT & FEEDING ADVICE — always consider:
- Tomatoes: high-potash feed (tomato feed) weekly once fruiting starts
- Brassicas: nitrogen-rich feed, lime soil if acidic
- Root veg: avoid high nitrogen (causes forking)
- Legumes: fix their own nitrogen — don't over-feed
- Fruiting plants (peppers, aubergines, courgettes): balanced feed, then high-potash when fruiting
- General: blood fish & bone for planting, comfrey tea as liquid feed, seaweed extract for micronutrients
- Timing: start feeding in late spring, increase in summer, reduce in autumn

Guidelines:
- Give practical, specific advice for UK/temperate climate gardening
- Mention companion planting benefits and things to avoid
- Suggest crop rotation when relevant
- Recommend specific feeds/nutrients when the user has planted specific crops
- Consider the current month and what should be done NOW
- Keep responses concise but helpful (2-3 paragraphs max)
- Use emojis sparingly for friendliness
- If suggesting layouts, describe positions clearly
- If the user asks about pests, suggest organic solutions first`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "X-Title": "Allotment Buddy",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.3-70b-instruct:free",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings > Workspace > Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "I couldn't generate a response.";

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("garden-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
