import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { weatherData, plants, structures } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are Allotment Buddy's AI watering advisor. Analyze weather data and garden plants to give specific, actionable watering recommendations.

You MUST respond with valid JSON matching this exact structure:
{
  "summary": "Brief overall watering advice for today (1-2 sentences)",
  "overallStatus": "water" | "skip" | "reduce" | "extra",
  "plants": [
    {
      "name": "Plant name",
      "emoji": "🌱",
      "location": "indoor" | "outdoor",
      "selfWatering": true/false,
      "recommendation": "skip" | "light" | "normal" | "heavy",
      "reason": "Short reason why",
      "nextWaterDays": 1
    }
  ],
  "tips": ["Tip 1", "Tip 2"],
  "forecast": "Brief 3-day watering outlook based on forecast"
}

Guidelines:
- Plants inside structures (greenhouse, polytunnel, cold frame, raised bed) are INDOOR — they don't get rain
- Outdoor plants get natural rainfall
- If it's raining or rain is forecast, outdoor plants may not need watering
- Hot weather (>25°C) = more water needed, especially for containers
- Plants on self-watering systems need less manual watering but still need monitoring
- Vegetables generally need more water than herbs
- Wind increases water evaporation
- Consider the next 3 days of forecast for planning
- Be specific: mention each plant by name`;

    const userPrompt = `Current weather & garden data:

WEATHER:
- Temperature: ${weatherData.temperature}°C
- Humidity: ${weatherData.humidity}%
- Wind: ${weatherData.windSpeed} km/h
- Conditions: ${weatherData.conditions}
- Location: ${weatherData.locationName}

3-DAY FORECAST:
${weatherData.forecast?.map((d: any) => `- ${d.date}: High ${d.tempMax}°C, Low ${d.tempMin}°C, Rain ${d.precip}mm`).join('\n') || 'No forecast available'}

PLANTS IN GARDEN:
${plants.map((p: any) => `- ${p.emoji} ${p.name} (${p.location}) ${p.selfWatering ? '[SELF-WATERING SYSTEM]' : ''}`).join('\n') || 'No plants placed'}

STRUCTURES:
${structures.map((s: any) => `- ${s.name} at position (${s.x},${s.y}), size ${s.width}x${s.height} cells ${s.canGrowInside ? '(plants can grow inside)' : ''}`).join('\n') || 'No structures'}

Analyze this data and provide watering recommendations for each plant. Consider which plants are sheltered inside structures (won't get rain) vs exposed outdoors.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
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
    const content = data.choices?.[0]?.message?.content || "{}";
    
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { summary: content, overallStatus: "water", plants: [], tips: [], forecast: "" };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("watering-guide error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
