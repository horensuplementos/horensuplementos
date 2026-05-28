// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é um redator SEO sênior especializado em fitness, suplementação, hipertrofia e nutrição esportiva.
Escreva em português do Brasil, com linguagem natural, escaneável, com headings (H2/H3), parágrafos curtos, e tom profissional acessível.
Nunca faça alegações médicas, não invente estudos, não cite fontes inexistentes. Evite jargão de IA.
SEO natural, sem keyword stuffing. O artigo deve ser único, útil e fluido.
Devolva SOMENTE JSON válido, sem markdown ao redor, sem comentários.`;

function buildUserPrompt(cfg: any) {
  return `Gere um artigo completo para o blog da Horen Suplementos.

Categoria: ${cfg.category}
Tema sugerido (se houver): ${cfg.topic || "escolha um tema relevante e atual da categoria"}
Tom: ${cfg.tone || "profissional"}
Quantidade aproximada de palavras: ${cfg.word_count || 800}

Devolva exatamente este JSON:
{
  "title": "título SEO atrativo (máx 65 caracteres)",
  "slug": "url-amigavel-em-kebab-case",
  "meta_description": "máx 155 caracteres",
  "excerpt": "2 frases de chamada",
  "category": "${cfg.category}",
  "read_time": "X min",
  "content": "ARTIGO COMPLETO EM MARKDOWN com ## Subtítulos, ### subseções, listas, parágrafos curtos, e FAQ no final em ## Perguntas frequentes",
  "tags": ["tag1","tag2","tag3","tag4"],
  "keywords": ["kw1","kw2","kw3","kw4","kw5"]
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
    const cfg = {
      category: body.category || "Hipertrofia",
      topic: body.topic || "",
      tone: body.tone || "profissional",
      word_count: Number(body.word_count) || 800,
    };

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
          { role: "user", content: buildUserPrompt(cfg) },
        ],
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de requisições atingido." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      throw new Error(`Erro IA: ${aiResp.status} ${t}`);
    }

    const data = await aiResp.json();
    const text = data?.choices?.[0]?.message?.content || "";
    const parsed = extractJson(text);

    await supabase.from("ai_usage_log").insert({
      user_id: userData.user.id,
      kind: "blog_article",
      success: true,
    });

    return new Response(JSON.stringify({ ok: true, content: parsed, generated_at: new Date().toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-generate-blog error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});