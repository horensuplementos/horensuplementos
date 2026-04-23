const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

const MELHOR_ENVIO_BASE = 'https://melhorenvio.com.br/api/v2/me'

const BodySchema = z.object({
  action: z.enum(['add_to_cart', 'generate', 'checkout', 'print', 'tracking']),
  // For add_to_cart
  shipment: z.object({
    service: z.number(),
    from: z.object({
      name: z.string(),
      phone: z.string().optional(),
      email: z.string().email(),
      document: z.string().optional(),
      postal_code: z.string(),
      address: z.string(),
      number: z.string(),
      neighborhood: z.string(),
      city: z.string(),
      state_abbr: z.string(),
    }),
    to: z.object({
      name: z.string(),
      phone: z.string().optional(),
      email: z.string().email(),
      document: z.string().optional(),
      postal_code: z.string(),
      address: z.string(),
      number: z.string(),
      neighborhood: z.string(),
      city: z.string(),
      state_abbr: z.string(),
    }),
    products: z.array(z.object({
      name: z.string(),
      quantity: z.number().int().min(1),
      unitary_value: z.number().min(0),
    })),
    volumes: z.array(z.object({
      height: z.number().min(1),
      width: z.number().min(1),
      length: z.number().min(1),
      weight: z.number().min(0.01),
    })),
  }).optional(),
  // For generate, checkout, print, tracking
  order_ids: z.array(z.string()).optional(),
})

function getHeaders(token: string) {
  return {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'User-Agent': 'HorenSuplementos sitehorensuplementos@gmail.com',
  }
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  let lastRes: Response | null = null
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options)
      if (res.ok || res.status < 500) return res
      const body = await res.text()
      console.error(`Attempt ${i + 1} failed: ${res.status} - ${body}`)
      lastRes = new Response(body, { status: res.status, headers: res.headers })
    } catch (err) {
      console.error(`Attempt ${i + 1} error:`, err)
      if (i === retries - 1) throw err
    }
    await new Promise(r => setTimeout(r, 1000 * (i + 1)))
  }
  if (lastRes) return lastRes
  throw new Error('Max retries reached')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const json = (data: any, status = 200) =>
    new Response(JSON.stringify(data), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  try {
    const token = Deno.env.get('MELHOR_ENVIO_TOKEN')
    if (!token) return json({ error: 'Token não configurado' }, 500)

    const body = await req.json()
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400)

    const { action, shipment, order_ids } = parsed.data
    const headers = getHeaders(token)

    // 1. Add shipment to Melhor Envio cart
    if (action === 'add_to_cart') {
      if (!shipment) return json({ error: 'Dados de envio obrigatórios' }, 400)

      const res = await fetchWithRetry(`${MELHOR_ENVIO_BASE}/cart`, {
        method: 'POST',
        headers,
        body: JSON.stringify(shipment),
      })
      const data = await res.json()
      if (!res.ok) {
        console.error('Add to cart error:', JSON.stringify(data))
        return json({ error: 'Erro ao adicionar ao carrinho do Melhor Envio', details: data }, 502)
      }
      return json({ success: true, data })
    }

    // 2. Generate label
    if (action === 'generate') {
      if (!order_ids?.length) return json({ error: 'order_ids obrigatório' }, 400)

      const res = await fetchWithRetry(`${MELHOR_ENVIO_BASE}/shipment/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ orders: order_ids }),
      })
      const data = await res.json()
      if (!res.ok) {
        console.error('Generate error:', JSON.stringify(data))
        return json({ error: 'Erro ao gerar etiqueta', details: data }, 502)
      }
      return json({ success: true, data })
    }

    // 3. Checkout (purchase label)
    if (action === 'checkout') {
      if (!order_ids?.length) return json({ error: 'order_ids obrigatório' }, 400)

      const res = await fetchWithRetry(`${MELHOR_ENVIO_BASE}/shipment/checkout`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ orders: order_ids }),
      })
      const data = await res.json()
      if (!res.ok) {
        console.error('Checkout error:', JSON.stringify(data))
        return json({ error: 'Erro ao comprar etiqueta', details: data }, 502)
      }
      return json({ success: true, data })
    }

    // 4. Print label
    if (action === 'print') {
      if (!order_ids?.length) return json({ error: 'order_ids obrigatório' }, 400)

      const res = await fetchWithRetry(`${MELHOR_ENVIO_BASE}/shipment/print`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ orders: order_ids }),
      })
      const data = await res.json()
      if (!res.ok) {
        console.error('Print error:', JSON.stringify(data))
        return json({ error: 'Erro ao imprimir etiqueta', details: data }, 502)
      }
      return json({ success: true, data })
    }

    // 5. Tracking
    if (action === 'tracking') {
      if (!order_ids?.length) return json({ error: 'order_ids obrigatório' }, 400)

      const res = await fetchWithRetry(`${MELHOR_ENVIO_BASE}/shipment/tracking`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ orders: order_ids }),
      })
      const data = await res.json()
      if (!res.ok) {
        console.error('Tracking error:', JSON.stringify(data))
        return json({ error: 'Erro ao buscar rastreio', details: data }, 502)
      }
      return json({ success: true, data })
    }

    return json({ error: 'Ação inválida' }, 400)
  } catch (error) {
    console.error('Shipping label error:', error)
    return json({ error: 'Erro interno' }, 500)
  }
})
