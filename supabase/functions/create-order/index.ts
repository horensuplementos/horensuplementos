import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BodySchema = z.object({
  items: z.array(z.object({ product_id: z.string().uuid(), quantity: z.number().int().min(1).max(50) })).min(1).max(20),
  customer: z.object({
    name: z.string().trim().min(3).max(120),
    email: z.string().trim().email().max(254),
    phone: z.string().trim().max(30).optional().nullable(),
    cpf: z.string().trim().max(18),
  }),
  delivery_method: z.enum(['shipping', 'pickup']),
  address_id: z.string().uuid().optional().nullable(),
  shipping_service_id: z.number().int().positive().optional().nullable(),
  coupon_code: z.string().trim().max(64).optional().nullable(),
  cart_session_key: z.string().uuid().optional().nullable(),
})

const MELHOR_ENVIO_URL = 'https://melhorenvio.com.br/api/v2/me/shipment/calculate'
const FROM_ZIP = Deno.env.get('HOREN_FROM_ZIP') || '02613000'

const digits = (value: string | null | undefined) => String(value || '').replace(/\D/g, '')

function validCpf(value: string) {
  if (value.length !== 11 || /^(\d)\1+$/.test(value)) return false
  const digit = (size: number) => {
    let sum = 0
    for (let i = 0; i < size; i++) sum += Number(value[i]) * (size + 1 - i)
    const result = (sum * 10) % 11
    return result === 10 ? 0 : result
  }
  return digit(9) === Number(value[9]) && digit(10) === Number(value[10])
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Não autenticado' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data: { user }, error: userError } = await anon.auth.getUser(authHeader.slice(7))
    if (userError || !user) return json({ error: 'Token inválido' }, 401)

    const parsed = BodySchema.safeParse(await req.json())
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400)
    const body = parsed.data
    const cpf = digits(body.customer.cpf)
    if (body.customer.name.split(/\s+/).length < 2 || !validCpf(cpf)) {
      return json({ error: 'Nome completo e CPF válido são obrigatórios.' }, 400)
    }

    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const quantities = new Map<string, number>()
    for (const item of body.items) quantities.set(item.product_id, (quantities.get(item.product_id) || 0) + item.quantity)
    const ids = [...quantities.keys()]
    const { data: products, error: productError } = await admin
      .from('products').select('*').in('id', ids).eq('active', true)
    if (productError || !products || products.length !== ids.length) return json({ error: 'Um ou mais produtos não estão disponíveis.' }, 409)

    const productById = new Map(products.map((product: any) => [product.id, product]))
    for (const [id, quantity] of quantities) {
      const product: any = productById.get(id)
      if (!product || Number(product.stock) < quantity) return json({ error: `Estoque insuficiente para ${product?.name || 'o produto selecionado'}.` }, 409)
    }

    let customerAddress = ''
    let shippingPrice = 0
    let shippingServiceName = 'Retirada na Loja'
    let shippingServiceId: number | null = null

    if (body.delivery_method === 'pickup') {
      const { data: settings } = await admin.from('site_settings').select('local_pickup_enabled, pickup_address').eq('id', 1).maybeSingle()
      if (!settings?.local_pickup_enabled) return json({ error: 'Retirada na loja não está disponível.' }, 400)
      customerAddress = `RETIRADA NA LOJA — ${settings.pickup_address || 'Endereço a confirmar'}`
    } else {
      if (!body.address_id || !body.shipping_service_id) return json({ error: 'Endereço e modalidade de frete são obrigatórios.' }, 400)
      const { data: address } = await admin.from('user_addresses').select('*').eq('id', body.address_id).eq('user_id', user.id).maybeSingle()
      if (!address) return json({ error: 'Endereço de entrega inválido.' }, 403)

      const toZip = digits(address.zip_code)
      if (toZip.length !== 8) return json({ error: 'CEP de entrega inválido.' }, 400)
      const token = Deno.env.get('MELHOR_ENVIO_TOKEN')
      if (!token) return json({ error: 'Frete indisponível no momento.' }, 503)

      const shippingProducts = [...quantities].map(([id, quantity]) => {
        const product: any = productById.get(id)
        return {
          id,
          width: Number(product.shipping_width_cm),
          height: Number(product.shipping_height_cm),
          length: Number(product.shipping_length_cm),
          weight: Number(product.shipping_weight_kg),
          quantity,
          insurance_value: Number(product.price) * quantity,
        }
      })
      const quoteResponse = await fetch(MELHOR_ENVIO_URL, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'User-Agent': 'HorenSuplementos sitehorensuplementos@gmail.com' },
        body: JSON.stringify({ from: { postal_code: FROM_ZIP }, to: { postal_code: toZip }, products: shippingProducts }),
      })
      const quote = await quoteResponse.json()
      if (!quoteResponse.ok) return json({ error: 'Não foi possível recalcular o frete.' }, 502)
      const option = (Array.isArray(quote) ? quote : []).find((item: any) => Number(item.id) === body.shipping_service_id && !item.error)
      if (!option) return json({ error: 'A modalidade de frete expirou. Calcule novamente.' }, 409)
      shippingPrice = Number.parseFloat(option.custom_price || option.price)
      if (!Number.isFinite(shippingPrice) || shippingPrice < 0) return json({ error: 'Cotação de frete inválida.' }, 502)
      shippingServiceId = Number(option.id)
      shippingServiceName = `${option.company?.name || ''} - ${option.name || ''}`.replace(/^\s*-\s*/, '')
      customerAddress = `${address.street}, ${address.number}${address.complement ? ` (${address.complement})` : ''} - ${address.neighborhood}, ${address.city} - ${address.state}, CEP: ${address.zip_code}`
    }

    const subtotal = [...quantities].reduce((total, [id, quantity]) => total + Number((productById.get(id) as any).price) * quantity, 0)
    let cartSessionId: string | null = null
    if (body.cart_session_key) {
      const { data: session } = await admin.from('cart_sessions').select('id, user_id').eq('session_id', body.cart_session_key).maybeSingle()
      if (session && (!session.user_id || session.user_id === user.id)) cartSessionId = session.id
    }

    const { data: order, error: orderError } = await admin.from('orders').insert({
      user_id: user.id,
      subtotal_amount: subtotal,
      coupon_code: body.coupon_code || null,
      total: subtotal + shippingPrice,
      customer_name: body.customer.name.replace(/\s+/g, ' ').trim(),
      customer_email: body.customer.email.toLowerCase(),
      customer_phone: body.customer.phone || null,
      customer_cpf: cpf,
      customer_address: customerAddress,
      status: 'pendente',
      shipping_service_id: shippingServiceId,
      shipping_service_name: shippingServiceName,
      shipping_price: shippingPrice,
      delivery_method: body.delivery_method,
      cart_session_id: cartSessionId,
    }).select('*').single()
    if (orderError || !order) return json({ error: 'Não foi possível criar o pedido.' }, 500)

    const orderItems = [...quantities].map(([id, quantity]) => {
      const product: any = productById.get(id)
      return { order_id: order.id, product_id: id, quantity, unit_price: product.price, product_name: product.name }
    })
    const { error: itemError } = await admin.from('order_items').insert(orderItems)
    if (itemError) {
      await admin.from('orders').delete().eq('id', order.id)
      return json({ error: 'Não foi possível registrar os itens do pedido.' }, 500)
    }

    await admin.from('profiles').update({ name: body.customer.name, phone: body.customer.phone || null, cpf }).eq('user_id', user.id)
    return json({ order })
  } catch (error: any) {
    console.error('Create order error:', error)
    return json({ error: 'Erro interno ao criar pedido.' }, 500)
  }
})
