import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MELHOR_ENVIO_BASE = 'https://melhorenvio.com.br/api/v2/me'
const BLING_API = 'https://www.bling.com.br/Api/v3'
const HOREN_CNPJ = '65418995000150'
const FROM_ORIGIN = {
  name: 'Horen Suplementos',
  email: 'sitehorensuplementos@gmail.com',
  postal_code: '02613000',
  address: 'Rua Exemplo',
  number: '100',
  neighborhood: 'Centro',
  city: 'São Paulo',
  state_abbr: 'SP',
}

const BodySchema = z.object({
  order_id: z.string().uuid(),
})

function getMelhorEnvioHeaders(token: string) {
  return {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'User-Agent': 'HorenSuplementos sitehorensuplementos@gmail.com',
  }
}

async function fetchRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options)
      if (res.ok || res.status < 500) return res
      console.error(`Attempt ${i + 1}: ${res.status}`)
    } catch (err) {
      console.error(`Attempt ${i + 1} error:`, err)
      if (i === retries - 1) throw err
    }
    await new Promise(r => setTimeout(r, 1000 * (i + 1)))
  }
  throw new Error('Max retries reached')
}

function parseAddress(addr: string) {
  const parts = (addr || '').split(',').map(s => s.trim())
  const street = parts[0] || 'Rua'
  const numMatch = (parts[1] || '').match(/(\d+)/)
  const number = numMatch?.[1] || 'S/N'
  const nbParts = (parts[1] || '').split('-').map(s => s.trim())
  const neighborhood = nbParts[1] || 'Centro'
  const cityState = (parts[2] || '').split('-').map(s => s.trim())
  const city = cityState[0] || 'São Paulo'
  const state = cityState[1] || 'SP'
  const cepMatch = addr.match(/CEP:\s*([\d-]+)/)
  const postalCode = cepMatch?.[1]?.replace(/\D/g, '') || '00000000'
  return { street, number, neighborhood, city, state, postalCode }
}

async function addLog(supabase: any, orderId: string, step: string, details: any = {}) {
  const { data: order } = await supabase.from('orders').select('automation_log').eq('id', orderId).single()
  const currentLog = Array.isArray(order?.automation_log) ? order.automation_log : []
  await supabase.from('orders').update({
    automation_log: [...currentLog, { step, timestamp: new Date().toISOString(), ...details }],
  }).eq('id', orderId)
}

async function refreshBlingToken(supabase: any, cred: any) {
  const expiresAt = cred.expires_at ? new Date(cred.expires_at).getTime() : 0
  if (expiresAt - Date.now() > 5 * 60 * 1000 && cred.access_token) return cred.access_token
  if (!cred.refresh_token) throw new Error('Refresh token do Bling ausente. Reconecte em /admin/bling.')
  const basic = btoa(`${cred.client_id}:${cred.client_secret}`)
  const res = await fetch(`${BLING_API}/oauth/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: '1.0' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: cred.refresh_token }),
  })
  const data = await res.json()
  if (!res.ok || !data.access_token) throw new Error('Falha ao renovar token Bling: ' + JSON.stringify(data))
  const expISO = new Date(Date.now() + (data.expires_in || 21600) * 1000).toISOString()
  await supabase.from('bling_credentials').update({
    access_token: data.access_token,
    refresh_token: data.refresh_token || cred.refresh_token,
    expires_at: expISO,
  }).eq('id', cred.id)
  return data.access_token
}

async function blingFetch(path: string, token: string, opts: RequestInit = {}) {
  const res = await fetch(`${BLING_API}${path}`, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  })
  const text = await res.text()
  let json: any = null
  try { json = text ? JSON.parse(text) : null } catch { json = { raw: text } }
  return { ok: res.ok, status: res.status, data: json }
}

async function issueBlingInvoice(supabase: any, order: any, items: any[]) {
  // Idempotency
  if (order.invoice_number || order.invoice_key) {
    return { skipped: true, reason: 'Nota já emitida', number: order.invoice_number, key: order.invoice_key }
  }

  const { data: cred } = await supabase.from('bling_credentials').select('*').limit(1).maybeSingle()
  if (!cred?.access_token || !cred?.client_id || !cred?.client_secret) {
    return { skipped: true, reason: 'Bling não conectado. Acesse /admin/bling.' }
  }

  const token = await refreshBlingToken(supabase, cred)
  const addr = parseAddress(order.customer_address || '')
  const cpfDigits = (order.customer_cpf || '').replace(/\D/g, '')
  const isCnpj = cpfDigits.length === 14
  const subtotal = Number(order.subtotal_amount || 0)
  const shipping = Number(order.shipping_price || 0)
  const discount = Number(order.discount_amount || 0)

  const itens = (items || []).map((i: any) => ({
    codigo: String(i.product_id || i.id),
    descricao: i.product_name,
    unidade: 'UN',
    quantidade: Number(i.quantity),
    valor: Number(i.unit_price),
    tipo: 'P',
    origem: 0,
  }))

  const contato = {
    nome: order.customer_name,
    tipoPessoa: isCnpj ? 'J' : 'F',
    numeroDocumento: cpfDigits,
    email: order.customer_email,
    telefone: order.customer_phone || '',
    endereco: {
      endereco: addr.street,
      numero: addr.number,
      bairro: addr.neighborhood,
      cep: addr.postalCode,
      municipio: addr.city,
      uf: addr.state,
    },
  }

  await addLog(supabase, order.id, 'bling_pedido_iniciado', { subtotal, shipping, discount })

  // 1. Create sale order in Bling (if not created yet)
  let blingOrderId = order.bling_order_id
  if (!blingOrderId) {
    const pedidoPayload = {
      data: new Date().toISOString().slice(0, 10),
      numeroLoja: String(order.id).slice(0, 8),
      contato,
      itens,
      transporte: {
        frete: shipping,
        volumes: [{ servico: order.shipping_service_name || 'Retirada', codigoRastreamento: order.tracking_code || '' }],
      },
      desconto: discount > 0 ? { valor: discount, unidade: 'REAL' } : undefined,
      observacoes: `Pedido site #${String(order.id).slice(0, 8).toUpperCase()} - Pagamento: ${order.payment_method || 'mercado_pago'}`,
    }
    const pRes = await blingFetch('/pedidos/vendas', token, { method: 'POST', body: JSON.stringify(pedidoPayload) })
    if (!pRes.ok) {
      await addLog(supabase, order.id, 'bling_pedido_error', { endpoint: 'POST /pedidos/vendas', payload: pedidoPayload, response: pRes.data, status: pRes.status })
      await supabase.from('orders').update({ invoice_status: 'erro', invoice_error: `Pedido Bling: ${JSON.stringify(pRes.data).slice(0, 400)}` }).eq('id', order.id)
      return { error: 'Falha ao criar pedido no Bling', endpoint: '/pedidos/vendas', response: pRes.data }
    }
    blingOrderId = String(pRes.data?.data?.id || '')
    await supabase.from('orders').update({ bling_order_id: blingOrderId }).eq('id', order.id)
    await addLog(supabase, order.id, 'bling_pedido_criado', { bling_order_id: blingOrderId })
  } else {
    await addLog(supabase, order.id, 'bling_pedido_ja_existente', { bling_order_id: blingOrderId })
  }

  // 2. Emit NF-e
  const nfePayload = {
    tipo: 1, // saída
    finalidade: 1, // normal
    naturezaOperacao: { id: 0, descricao: 'Venda de mercadoria adquirida ou recebida de terceiros' },
    dataOperacao: new Date().toISOString(),
    contato,
    itens: itens.map(i => ({ ...i, cfop: isCnpj ? '5102' : '5102' })),
    transporte: {
      frete: shipping,
      modalidadeFrete: 0,
    },
    desconto: discount > 0 ? { valor: discount, unidade: 'REAL' } : undefined,
    parcelas: [{ dataVencimento: new Date().toISOString().slice(0, 10), valor: Number(order.total || 0), observacoes: order.payment_method || 'mercado_pago' }],
    observacoes: `Pedido site #${String(order.id).slice(0, 8).toUpperCase()}`,
  }

  await addLog(supabase, order.id, 'bling_nfe_solicitada', { endpoint: 'POST /nfe' })
  const nRes = await blingFetch('/nfe', token, { method: 'POST', body: JSON.stringify(nfePayload) })
  if (!nRes.ok) {
    await addLog(supabase, order.id, 'bling_nfe_error', { endpoint: 'POST /nfe', payload: nfePayload, response: nRes.data, status: nRes.status })
    await supabase.from('orders').update({ invoice_status: 'erro', invoice_error: `NF-e Bling: ${JSON.stringify(nRes.data).slice(0, 400)}` }).eq('id', order.id)
    return { error: 'Falha ao emitir NF-e', endpoint: '/nfe', response: nRes.data }
  }

  const nfeId = nRes.data?.data?.id
  let numero: string | null = nRes.data?.data?.numero ? String(nRes.data.data.numero) : null
  let chave: string | null = nRes.data?.data?.chaveAcesso || null

  await addLog(supabase, order.id, 'bling_nfe_criada', { nfe_id: nfeId, numero, chave })

  // 3. Send NF-e to SEFAZ
  if (nfeId) {
    const sendRes = await blingFetch(`/nfe/${nfeId}/enviar`, token, { method: 'POST' })
    if (!sendRes.ok) {
      await addLog(supabase, order.id, 'bling_nfe_send_warning', { endpoint: `POST /nfe/${nfeId}/enviar`, response: sendRes.data, status: sendRes.status })
    } else {
      await addLog(supabase, order.id, 'bling_nfe_enviada_sefaz', { nfe_id: nfeId })
      // Re-read NF-e to grab numero/chave if not returned initially
      const detRes = await blingFetch(`/nfe/${nfeId}`, token)
      if (detRes.ok) {
        numero = numero || (detRes.data?.data?.numero ? String(detRes.data.data.numero) : null)
        chave = chave || detRes.data?.data?.chaveAcesso || null
      }
    }

    // 4. Fetch PDF/XML links (best-effort)
    const pdfRes = await blingFetch(`/nfe/${nfeId}/pdf`, token)
    let pdfUrl: string | null = null
    let xmlUrl: string | null = null
    if (pdfRes.ok) {
      const p = pdfRes.data?.data?.pdf || pdfRes.data?.data?.link || pdfRes.data?.data?.url
      xmlUrl = pdfRes.data?.data?.xml || null
      if (p) pdfUrl = p.startsWith('http') ? p : `data:application/pdf;base64,${p}`
    } else {
      await addLog(supabase, order.id, 'bling_nfe_pdf_warning', { response: pdfRes.data })
    }

    await supabase.from('orders').update({
      status: 'nota_emitida',
      invoice_status: 'emitida',
      invoice_number: numero,
      invoice_key: chave,
      invoice_pdf_url: pdfUrl,
      invoice_xml_url: xmlUrl,
      invoice_issued_at: new Date().toISOString(),
      invoice_error: null,
    }).eq('id', order.id)

    await addLog(supabase, order.id, 'bling_nfe_emitida', { numero, chave, pdf_url: pdfUrl })
    return { success: true, nfe_id: nfeId, numero, chave, pdf_url: pdfUrl }
  }

  return { error: 'NF-e criada sem ID retornado', response: nRes.data }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const json = (data: any, status = 200) =>
    new Response(JSON.stringify(data), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const melhorEnvioToken = Deno.env.get('MELHOR_ENVIO_TOKEN')
    const blingApiKey = Deno.env.get('BLING_API_KEY')
    const supabase = createClient(supabaseUrl, supabaseKey)

    const body = await req.json()
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400)

    const { order_id } = parsed.data

    // Fetch order with items
    const { data: order, error: orderErr } = await supabase
      .from('orders').select('*').eq('id', order_id).single()
    if (orderErr || !order) return json({ error: 'Pedido não encontrado' }, 404)

    if (order.status !== 'pago') {
      return json({ error: 'Pedido não está com status pago', status: order.status }, 400)
    }

    const { data: items } = await supabase
      .from('order_items').select('*').eq('order_id', order_id)

    const results: any = { order_id, steps: {} }

    // ====== STEP 1: BLING - Emit NF-e (must run before shipping so status flows pago -> nota_emitida -> enviado) ======
    try {
      results.steps.invoice = await issueBlingInvoice(supabase, order, items || [])
    } catch (invErr: any) {
      console.error('Bling automation error:', invErr)
      await addLog(supabase, order_id, 'bling_exception', { error: invErr.message, stack: invErr.stack })
      await supabase.from('orders').update({ invoice_status: 'erro', invoice_error: invErr.message }).eq('id', order_id)
      results.steps.invoice = { error: invErr.message }
    }

    // Refresh order after invoice step (status may have changed)
    const { data: refreshedOrder } = await supabase.from('orders').select('*').eq('id', order_id).single()
    const orderNow = refreshedOrder || order

    // ====== STEP 2: MELHOR ENVIO - Generate shipping label ======
    if (melhorEnvioToken && order.shipping_service_id) {
      try {
        const addr = parseAddress(order.customer_address || '')
        const meHeaders = getMelhorEnvioHeaders(melhorEnvioToken)

        const products = (items || []).map((item: any) => ({
          name: item.product_name,
          quantity: item.quantity,
          unitary_value: Number(item.unit_price),
        }))

        // 1a. Add to cart
        const cartRes = await fetchRetry(`${MELHOR_ENVIO_BASE}/cart`, {
          method: 'POST',
          headers: meHeaders,
          body: JSON.stringify({
            service: order.shipping_service_id,
            from: FROM_ORIGIN,
            to: {
              name: order.customer_name,
              email: order.customer_email,
              phone: order.customer_phone || undefined,
              document: (order.customer_cpf || '').replace(/\D/g, '') || undefined,
              postal_code: addr.postalCode,
              address: addr.street,
              number: addr.number,
              neighborhood: addr.neighborhood,
              city: addr.city,
              state_abbr: addr.state,
            },
            products,
            volumes: [{ height: 10, width: 20, length: 30, weight: 0.5 }],
          }),
        })

        const cartData = await cartRes.json()
        if (!cartRes.ok) {
          console.error('Cart error:', JSON.stringify(cartData))
          await addLog(supabase, order_id, 'melhor_envio_cart_error', { error: cartData })
          results.steps.shipping = { error: 'Falha ao adicionar ao carrinho' }
        } else {
          const meOrderId = cartData.id
          await supabase.from('orders').update({
            shipping_order_id: meOrderId,
            shipping_status: 'no_carrinho',
              status: orderNow.status === 'nota_emitida' ? 'separado' : 'separado',
          }).eq('id', order_id)
          await addLog(supabase, order_id, 'melhor_envio_cart_ok', { me_order_id: meOrderId })

          // 1b. Generate label
          const genRes = await fetchRetry(`${MELHOR_ENVIO_BASE}/shipment/generate`, {
            method: 'POST', headers: meHeaders,
            body: JSON.stringify({ orders: [meOrderId] }),
          })
          const genData = await genRes.json()
          if (!genRes.ok) {
            console.error('Generate error:', JSON.stringify(genData))
            await addLog(supabase, order_id, 'melhor_envio_generate_error', { error: genData })
          } else {
            await addLog(supabase, order_id, 'melhor_envio_generate_ok', {})

            // 1c. Checkout (purchase)
            const checkRes = await fetchRetry(`${MELHOR_ENVIO_BASE}/shipment/checkout`, {
              method: 'POST', headers: meHeaders,
              body: JSON.stringify({ orders: [meOrderId] }),
            })
            const checkData = await checkRes.json()
            if (!checkRes.ok) {
              console.error('Checkout error:', JSON.stringify(checkData))
              await addLog(supabase, order_id, 'melhor_envio_checkout_error', { error: checkData })
            } else {
              // Extract tracking
              let trackingCode = ''
              const purchase = checkData.purchase || checkData
              if (purchase?.orders) {
                const info = purchase.orders.find((o: any) => o.id === meOrderId)
                trackingCode = info?.tracking || ''
              }

              await supabase.from('orders').update({
                shipping_status: 'etiqueta_gerada',
                tracking_code: trackingCode || null,
                status: 'enviado',
              }).eq('id', order_id)

              await addLog(supabase, order_id, 'melhor_envio_checkout_ok', { tracking: trackingCode })
              results.steps.shipping = { success: true, tracking: trackingCode, me_order_id: meOrderId }
            }
          }
        }
      } catch (shippingErr: any) {
        console.error('Shipping automation error:', shippingErr)
        await addLog(supabase, order_id, 'melhor_envio_exception', { error: shippingErr.message })
        results.steps.shipping = { error: shippingErr.message }
      }
    } else {
      results.steps.shipping = { skipped: true, reason: !melhorEnvioToken ? 'Token não configurado' : 'Sem serviço de frete' }
    }

    return json(results)
  } catch (error: any) {
    console.error('Automation error:', error)
    return json({ error: 'Erro interno na automação', message: error.message }, 500)
  }
})
