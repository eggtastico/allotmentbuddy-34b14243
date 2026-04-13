import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64 } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    console.log('[scan-seed-pack] API Key loaded:', OPENROUTER_API_KEY ? 'YES' : 'NO');
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not configured in Supabase secrets");

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "X-Title": "Allotment Buddy",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro-exp:free",
        messages: [
          {
            role: "system",
            content: `You are a seed packet scanner. Extract structured information from seed packet images and respond with ONLY a valid JSON object (no markdown, no extra text). The JSON must have these fields:
{
  "plant_name": "string (required)",
  "variety": "string or null",
  "sow_indoors": "string like 'Feb-Mar' or null",
  "sow_outdoors": "string like 'Apr-Jun' or null",
  "harvest": "string like 'Jul-Oct' or null",
  "spacing_cm": "number or null",
  "days_to_harvest": "number or null",
  "depth_cm": "number or null",
  "tips": "string or null",
  "sun_preference": "full-sun|partial-shade|full-shade|any or null",
  "difficulty": "easy|moderate|challenging or null"
}`
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract all growing information from this seed packet image. Respond with ONLY valid JSON, no markdown or extra text." },
              { type: "image_url", image_url: { url: imageBase64 } }
            ]
          }
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
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI processing failed");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    let extracted = {};

    try {
      // Try to parse the content as JSON
      extracted = JSON.parse(content);
    } catch {
      // If it fails, try to extract JSON from the content
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          extracted = JSON.parse(jsonMatch[0]);
        } catch {
          extracted = { plant_name: "Unknown", error: "Could not parse response" };
        }
      } else {
        extracted = { plant_name: "Unknown", error: "No JSON found in response" };
      }
    }

    return new Response(JSON.stringify({ extracted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("scan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
