import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MELHOR_ENVIO_BASE = 'https://melhorenvio.com.br/api/v2/me'
const FROM_ORIGIN = {
  name: 'Horen Suplementos',
  email: 'contato@horen.com.br',
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
    'User-Agent': 'HorenSuplementos contato@horen.com.br',
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

    // ====== STEP 1: MELHOR ENVIO - Generate shipping label ======
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
            status: 'separado',
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

    // ====== STEP 2: BLING - Create order and generate NF-e ======
    if (blingApiKey) {
      try {
        const blingItems = (items || []).map((item: any) => ({
          descricao: item.product_name,
          quantidade: item.quantity,
          valor: Number(item.unit_price),
          codigo: item.product_id || item.id,
        }))

        // Create order in Bling
        const blingOrderRes = await fetchRetry('https://www.bling.com.br/Api/v3/pedidos/vendas', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${blingApiKey}`,
          },
          body: JSON.stringify({
            contato: {
              nome: order.customer_name,
              email: order.customer_email,
              fone: order.customer_phone || '',
            },
            itens: blingItems,
            observacoes: `Pedido #${order.id}`,
            observacoesInternas: `Automação Horen - Payment: ${order.payment_id}`,
          }),
        })

        const blingOrderData = await blingOrderRes.json()
        if (!blingOrderRes.ok) {
          console.error('Bling order error:', JSON.stringify(blingOrderData))
          await addLog(supabase, order_id, 'bling_order_error', { error: blingOrderData })
          results.steps.invoice = { error: 'Falha ao criar pedido no Bling' }
        } else {
          const blingId = blingOrderData.data?.id
          await supabase.from('orders').update({ bling_order_id: String(blingId) }).eq('id', order_id)
          await addLog(supabase, order_id, 'bling_order_ok', { bling_id: blingId })

          // Generate NF-e
          const nfeRes = await fetchRetry(`https://www.bling.com.br/Api/v3/nfe`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${blingApiKey}`,
            },
            body: JSON.stringify({
              tipo: 1, // NF-e de saída
              contato: {
                nome: order.customer_name,
                email: order.customer_email,
              },
              itens: blingItems.map(item => ({
                ...item,
                tipo: 'P',
                origem: 0,
              })),
            }),
          })

          const nfeData = await nfeRes.json()
          if (!nfeRes.ok) {
            console.error('NF-e error:', JSON.stringify(nfeData))
            await addLog(supabase, order_id, 'bling_nfe_error', { error: nfeData })
            results.steps.invoice = { error: 'Falha ao gerar NF-e' }
          } else {
            const invoiceNumber = nfeData.data?.numero
            const invoiceKey = nfeData.data?.chaveAcesso

            await supabase.from('orders').update({
              invoice_number: invoiceNumber ? String(invoiceNumber) : null,
              invoice_key: invoiceKey || null,
            }).eq('id', order_id)

            await addLog(supabase, order_id, 'bling_nfe_ok', { numero: invoiceNumber, chave: invoiceKey })
            results.steps.invoice = { success: true, number: invoiceNumber, key: invoiceKey }
          }
        }
      } catch (blingErr: any) {
        console.error('Bling automation error:', blingErr)
        await addLog(supabase, order_id, 'bling_exception', { error: blingErr.message })
        results.steps.invoice = { error: blingErr.message }
      }
    } else {
      results.steps.invoice = { skipped: true, reason: 'BLING_API_KEY não configurado' }
    }

    return json(results)
  } catch (error: any) {
    console.error('Automation error:', error)
    return json({ error: 'Erro interno na automação', message: error.message }, 500)
  }
})
