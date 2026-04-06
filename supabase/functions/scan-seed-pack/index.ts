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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a seed packet scanner. Extract structured information from seed packet images. Always respond with a JSON object using the extract_seed_info tool.`
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract all growing information from this seed packet image. Include plant name, variety, sowing dates, spacing, harvest period, and any tips." },
              { type: "image_url", image_url: { url: imageBase64 } }
            ]
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_seed_info",
              description: "Extract structured seed packet information",
              parameters: {
                type: "object",
                properties: {
                  plant_name: { type: "string", description: "Name of the plant" },
                  variety: { type: "string", description: "Variety or cultivar name" },
                  sow_indoors: { type: "string", description: "Indoor sowing period e.g. Feb-Mar" },
                  sow_outdoors: { type: "string", description: "Outdoor sowing period e.g. Apr-Jun" },
                  harvest: { type: "string", description: "Harvest period e.g. Jul-Oct" },
                  spacing_cm: { type: "number", description: "Plant spacing in cm" },
                  days_to_harvest: { type: "number", description: "Days from sowing to harvest" },
                  depth_cm: { type: "number", description: "Sowing depth in cm" },
                  tips: { type: "string", description: "Growing tips from the packet" },
                  sun_preference: { type: "string", enum: ["full-sun", "partial-shade", "full-shade", "any"] },
                  difficulty: { type: "string", enum: ["easy", "moderate", "challenging"] },
                },
                required: ["plant_name"],
                additionalProperties: false,
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_seed_info" } },
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
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let extracted = {};
    if (toolCall?.function?.arguments) {
      try {
        extracted = JSON.parse(toolCall.function.arguments);
      } catch {
        extracted = { plant_name: "Unknown" };
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
