const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const BodySchema = z.object({
  to_zip: z.string().regex(/^\d{5}-?\d{3}$/),
  products: z.array(z.object({
    id: z.string().uuid(),
    quantity: z.number().int().min(1).max(50),
  })).min(1).max(20),
})

const MELHOR_ENVIO_URL = 'https://melhorenvio.com.br/api/v2/me/shipment/calculate'
const FROM_ZIP = Deno.env.get('HOREN_FROM_ZIP') || '02613000'

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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data: { user }, error: userError } = await anonClient.auth.getUser(authHeader.slice('Bearer '.length))
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

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
    const quantities = new Map<string, number>()
    for (const item of products) quantities.set(item.id, (quantities.get(item.id) || 0) + item.quantity)
    if ([...quantities.values()].some((quantity) => quantity > 50)) {
      return new Response(JSON.stringify({ error: 'Quantidade por produto acima do limite.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    const ids = [...quantities.keys()]
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: catalog, error: catalogError } = await admin
      .from('products')
      .select('id, name, price, stock, shipping_width_cm, shipping_height_cm, shipping_length_cm, shipping_weight_kg')
      .in('id', ids)
      .eq('active', true)
    if (catalogError || !catalog || catalog.length !== ids.length) {
      return new Response(JSON.stringify({ error: 'Um ou mais produtos não estão disponíveis.' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    const shippingProducts = catalog.map((product) => ({
      id: product.id,
      width: Number(product.shipping_width_cm),
      height: Number(product.shipping_height_cm),
      length: Number(product.shipping_length_cm),
      weight: Number(product.shipping_weight_kg),
      quantity: quantities.get(product.id)!,
      insurance_value: Number(product.price) * quantities.get(product.id)!,
    }))
    if (catalog.some((product) => Number(product.stock) < quantities.get(product.id)!) ||
        shippingProducts.some((product) => !Number.isFinite(product.insurance_value) || product.insurance_value < 0 ||
          !Number.isFinite(product.width) || product.width <= 0 ||
          !Number.isFinite(product.height) || product.height <= 0 ||
          !Number.isFinite(product.length) || product.length <= 0 ||
          !Number.isFinite(product.weight) || product.weight <= 0)) {
      return new Response(JSON.stringify({ error: 'Estoque ou dados logísticos inválidos. Atualize o carrinho.' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const response = await fetchWithRetry(MELHOR_ENVIO_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'HorenSuplementos sitehorensuplementos@gmail.com',
      },
      body: JSON.stringify({
        from: { postal_code: FROM_ZIP },
        to: { postal_code: to_zip.replace(/\D/g, '') },
        products: shippingProducts,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Melhor Envio error:', JSON.stringify(data))
      return new Response(JSON.stringify({ error: 'Erro ao calcular frete' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const options = (Array.isArray(data) ? data : [])
      .filter((opt: any) => !opt.error && Number.isFinite(Number.parseFloat(opt.custom_price || opt.price)) && Number.parseFloat(opt.custom_price || opt.price) >= 0)
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
