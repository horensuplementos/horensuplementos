import { corsHeaders } from '@supabase/supabase-js/cors'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

const BodySchema = z.object({
  to_zip: z.string().min(8).max(9),
  products: z.array(z.object({
    id: z.string(),
    width: z.number().min(1),
    height: z.number().min(1),
    length: z.number().min(1),
    weight: z.number().min(0.01),
    quantity: z.number().int().min(1),
    insurance_value: z.number().min(0),
  })).min(1),
})

const MELHOR_ENVIO_URL = 'https://melhorenvio.com.br/api/v2/me/shipment/calculate'
const FROM_ZIP = '02613000'

async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options)
      if (res.ok || res.status < 500) return res
      console.error(`Attempt ${i + 1} failed with status ${res.status}`)
    } catch (err) {
      console.error(`Attempt ${i + 1} network error:`, err)
      if (i === retries - 1) throw err
    }
    await new Promise(r => setTimeout(r, 1000 * (i + 1)))
  }
  throw new Error('Max retries reached')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const token = Deno.env.get('MELHOR_ENVIO_TOKEN')
    if (!token) {
      return new Response(JSON.stringify({ error: 'Token não configurado' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json()
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { to_zip, products } = parsed.data

    const response = await fetchWithRetry(MELHOR_ENVIO_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'HorenSuplementos contato@horen.com.br',
      },
      body: JSON.stringify({
        from: { postal_code: FROM_ZIP },
        to: { postal_code: to_zip.replace(/\D/g, '') },
        products,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Melhor Envio error:', JSON.stringify(data))
      return new Response(JSON.stringify({ error: 'Erro ao calcular frete', details: data }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const options = (Array.isArray(data) ? data : [])
      .filter((opt: any) => !opt.error)
      .map((opt: any) => ({
        id: opt.id,
        name: opt.name,
        company: opt.company?.name || '',
        price: parseFloat(opt.custom_price || opt.price),
        delivery_time: opt.custom_delivery_time || opt.delivery_time,
        currency: 'BRL',
      }))

    return new Response(JSON.stringify({ options }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Shipping calc error:', error)
    return new Response(JSON.stringify({ error: 'Erro interno no cálculo de frete' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
