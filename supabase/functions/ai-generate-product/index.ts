// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é um especialista em copywriting para e-commerce fitness e suplementos da marca Horen Suplementos.
Escreva em português do Brasil, com tom profissional, persuasivo, humanizado e moderno, focado em hipertrofia, desempenho e saúde.
Nunca faça promessas médicas, não invente informações, não cite estudos sem fonte e evite linguagem que pareça gerada por IA.
Use SEO de forma natural (sem keyword stuffing).
Devolva SOMENTE um JSON válido, sem markdown, sem comentários.`;

function buildUserPrompt(p: any) {
  return `Gere o conteúdo de loja para este produto:

Nome: ${p.name || ""}
Marca: ${p.brand || "Horen Suplementos"}
Peso/Tamanho: ${p.weight || ""}
Sabor: ${p.flavor || ""}
Categoria: ${p.category || ""}
Benefícios (entrada do admin): ${p.benefits_input || ""}
Ingredientes: ${p.ingredients || ""}

Devolva exatamente este JSON:
{
  "description_short": "1-2 frases (máx 220 caracteres)",
  "description_long": "3-5 parágrafos, escaneável",
  "benefits": ["bullet 1", "bullet 2", "bullet 3", "bullet 4", "bullet 5"],
  "faq": [{"q":"...","a":"..."}, {"q":"...","a":"..."}, {"q":"...","a":"..."}],
  "meta_description": "máx 155 caracteres, SEO",
  "keywords": ["kw1","kw2","kw3","kw4","kw5","kw6"]
}`;
}

function extractJson(text: string): any {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Resposta sem JSON");
  return JSON.parse(cleaned.slice(start, end + 1));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { product_id, product } = body;
    if (!product?.name) {
      return new Response(JSON.stringify({ error: "Nome do produto obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(product) },
        ],
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      throw new Error(`Erro IA: ${aiResp.status} ${t}`);
    }

    const data = await aiResp.json();
    const text = data?.choices?.[0]?.message?.content || "";
    const parsed = extractJson(text);

    // Log
    await supabase.from("ai_usage_log").insert({
      user_id: userData.user.id,
      kind: "product_description",
      target_id: product_id || null,
      success: true,
    });

    return new Response(JSON.stringify({ ok: true, content: parsed, generated_at: new Date().toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-generate-product error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});