// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

// Public endpoint - Bling redirects user-agent here with ?code=...&state=...
Deno.serve(async (req) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')

  const html = (msg: string, ok: boolean) => `<!doctype html><html><head><meta charset="utf-8"><title>Bling OAuth</title>
    <style>body{font-family:system-ui;background:#002A3F;color:#f5e9d4;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
    .card{background:#003a55;padding:40px;border-radius:12px;max-width:480px;text-align:center}
    h1{margin:0 0 12px;font-size:22px}p{margin:0 0 20px;line-height:1.5}
    a{display:inline-block;background:#d4b88a;color:#002A3F;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600}</style>
    </head><body><div class="card"><h1>${ok ? '✅ Bling conectado!' : '❌ Falha na conexão'}</h1>
    <p>${msg}</p><a href="https://horensuplementos.com.br/admin/bling">Voltar ao painel</a></div></body></html>`

  if (error) {
    return new Response(html(`Erro retornado pelo Bling: ${error}`, false), { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }
  if (!code) {
    return new Response(html('Código de autorização ausente.', false), { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: cred } = await supabase.from('bling_credentials').select('*').limit(1).maybeSingle()
    if (!cred?.client_id || !cred?.client_secret) {
      return new Response(html('Client ID/Secret não configurados no painel admin.', false), { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    }

    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/bling-oauth-callback`
    const basic = btoa(`${cred.client_id}:${cred.client_secret}`)

    const tokenRes = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': '1.0',
      },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
    })

    const tokenData = await tokenRes.json()
    if (!tokenRes.ok || !tokenData.access_token) {
      return new Response(html(`Erro ao trocar código por token: ${JSON.stringify(tokenData)}`, false), { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    }

    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 21600) * 1000).toISOString()

    await supabase.from('bling_credentials').update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: expiresAt,
    }).eq('id', cred.id)

    return new Response(html('Sua conta Bling foi conectada com sucesso. Já pode emitir notas fiscais automaticamente.', true), { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  } catch (e: any) {
    return new Response(html(`Erro inesperado: ${e.message}`, false), { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }
})