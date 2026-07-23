// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BLING_API = 'https://api.bling.com.br/Api/v3'

async function refreshTokenIfNeeded(supabase: any, cred: any) {
  const expiresAt = cred.expires_at ? new Date(cred.expires_at).getTime() : 0
  // Refresh 5 min antes de expirar
  if (expiresAt - Date.now() > 5 * 60 * 1000 && cred.access_token) return cred.access_token

  if (!cred.refresh_token) throw new Error('Refresh token ausente. Reconecte o Bling.')

  const basic = btoa(`${cred.client_id}:${cred.client_secret}`)
  const res = await fetch(`${BLING_API}/oauth/token`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': '1.0' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: cred.refresh_token }),
  })
  const data = await res.json()
  if (!res.ok || !data.access_token) throw new Error('Falha ao renovar token: ' + JSON.stringify(data))

  const expISO = new Date(Date.now() + (data.expires_in || 21600) * 1000).toISOString()
  await supabase.from('bling_credentials').update({
    access_token: data.access_token,
    refresh_token: data.refresh_token || cred.refresh_token,
    expires_at: expISO,
  }).eq('id', cred.id)
  return data.access_token
}

async function blingFetch(path: string, token: string, opts: RequestInit = {}) {
  let lastResponse = { ok: false, status: 0, data: null as any }
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${BLING_API}${path}`, {
      ...opts,
      headers: {
        ...(opts.headers || {}),
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    })
    const text = await res.text()
    let json: any = null
    try { json = text ? JSON.parse(text) : null } catch { json = { raw: text } }
    lastResponse = { ok: res.ok, status: res.status, data: json }
    if (res.status !== 429) return lastResponse
    await new Promise(resolve => setTimeout(resolve, 1200 * (attempt + 1)))
  }
  return lastResponse
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (data: any, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userErr } = await supabase.auth.getUser(token)
    const userId = userData?.user?.id
    if (userErr || !userId) return json({ error: 'Unauthorized' }, 401)

    // Verifica se é admin/operator
    const { data: isAllowed } = await supabase.rpc('has_admin_permission_level', {
      _user_id: userId,
      _levels: ['admin', 'operator'],
    })
    if (!isAllowed) return json({ error: 'Sem permissão' }, 403)

    const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const body = await req.json().catch(() => ({}))
    const { action, order_id } = body

    const { data: cred } = await adminClient.from('bling_credentials').select('*').limit(1).maybeSingle()
    if (!cred?.access_token) return json({ error: 'Bling não conectado. Acesse /admin/bling.' }, 400)

    const accessToken = await refreshTokenIfNeeded(adminClient, cred)

    if (action === 'status') {
      return json({ connected: true, expires_at: cred.expires_at })
    }

    if (!order_id) return json({ error: 'order_id obrigatório' }, 400)

    const { data: order } = await adminClient.from('orders').select('*').eq('id', order_id).single()
    if (!order) return json({ error: 'Pedido não encontrado' }, 404)

    if (action === 'issue') {
      if (order.status !== 'pago' && order.status !== 'enviado' && order.status !== 'entregue') {
        return json({ error: 'Pedido precisa estar pago para emitir NF-e.' }, 400)
      }

      const automationRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/order-automation`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ order_id }),
      })
      const automationData = await automationRes.json().catch(() => ({}))
      if (!automationRes.ok) return json({ error: 'Falha ao emitir NF-e', details: automationData }, automationRes.status)
      if (automationData?.steps?.invoice?.error) {
        return json({ error: automationData.steps.invoice.error, details: automationData.steps.invoice }, 400)
      }

      const { data: updatedOrder } = await adminClient.from('orders').select('*').eq('id', order_id).single()
      return json({
        success: true,
        nfe_id: updatedOrder?.bling_order_id,
        numero: updatedOrder?.invoice_number,
        chave: updatedOrder?.invoice_key,
        pdf_url: updatedOrder?.invoice_pdf_url,
        automation: automationData,
      })
    }

    if (action === 'print') {
      const nfeId = order.bling_order_id
      if (!nfeId) return json({ error: 'NF-e ainda não emitida para este pedido.' }, 400)

      const r = await blingFetch(`/nfe/${nfeId}/pdf`, accessToken)
      if (!r.ok) return json({ error: 'Falha ao obter PDF', details: r.data }, r.status)

      // Bling normalmente retorna { data: { pdf: "url ou base64" } }
      const pdf = r.data?.data?.pdf || r.data?.data?.link || r.data?.data?.url
      if (!pdf) return json({ error: 'PDF indisponível. Verifique se a NF-e foi autorizada pela SEFAZ.', details: r.data }, 400)

      const pdfUrl = pdf.startsWith('http') ? pdf : `data:application/pdf;base64,${pdf}`

      await adminClient.from('orders').update({ invoice_pdf_url: pdfUrl }).eq('id', order_id)

      return json({ success: true, pdf_url: pdfUrl, numero: order.invoice_number })
    }

    return json({ error: 'Ação inválida' }, 400)
  } catch (e: any) {
    return json({ error: e.message || 'Erro interno' }, 500)
  }
})