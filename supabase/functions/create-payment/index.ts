import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BodySchema = z.object({
  order_id: z.string().uuid(),
})

const EmailSchema = z.string().trim().email()

const normalizeFullName = (value: string | null | undefined) =>
  (value || '').replace(/\s+/g, ' ').trim()

const splitFullName = (value: string) => {
  const [firstName, ...rest] = value.split(' ')
  return {
    first_name: firstName || value,
    last_name: rest.join(' ').trim() || '-',
  }
}

const normalizePhone = (value: string | null | undefined) => {
  const digits = String(value || '').replace(/\D/g, '')

  if (digits.length === 10 || digits.length === 11) {
    return {
      area_code: digits.slice(0, 2),
      number: digits.slice(2),
    }
  }

  return undefined
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const json = (data: any, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const MERCADO_PAGO_TOKEN = Deno.env.get('MERCADO_PAGO_TOKEN')
    if (!MERCADO_PAGO_TOKEN) {
      return json({ error: 'MERCADO_PAGO_TOKEN não configurado' }, 500)
    }
    const isTestToken = MERCADO_PAGO_TOKEN.startsWith('TEST-')

    // Validate auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Não autenticado' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Verify user
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data: { user }, error: userError } = await anonClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (userError || !user) return json({ error: 'Token inválido' }, 401)

    const body = await req.json()
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400)

    const { order_id } = parsed.data

    // Fetch order
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .eq('user_id', user.id)
      .single()

    if (orderErr || !order) return json({ error: 'Pedido não encontrado' }, 404)

    const payerName = normalizeFullName(order.customer_name)
    const payerEmail = EmailSchema.safeParse(order.customer_email)
    const payerCpf = String(order.customer_cpf || '').replace(/\D/g, '')
    const payerPhone = normalizePhone(order.customer_phone)

    if (!payerName || payerName.split(' ').length < 2) {
      return json({ error: 'Nome completo do pagador é obrigatório' }, 400)
    }

    if (!payerEmail.success) {
      return json({ error: 'E-mail válido do pagador é obrigatório' }, 400)
    }

    if (payerCpf.length !== 11) {
      return json({ error: 'CPF válido do pagador é obrigatório' }, 400)
    }

    const { first_name, last_name } = splitFullName(payerName)

    // Fetch order items and current products. The database may contain an old
    // pending order, so always revalidate before charging the customer.
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order_id)
    if (itemsError || !items?.length) return json({ error: 'Pedido sem itens para pagamento' }, 400)

    const productIds = items.map((item: any) => item.product_id).filter(Boolean)
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, price, stock, active')
      .in('id', productIds)
    if (productsError || !products || products.length !== productIds.length) {
      return json({ error: 'Um ou mais produtos não estão mais disponíveis.' }, 409)
    }
    const productsById = new Map(products.map((product: any) => [product.id, product]))
    let currentSubtotal = 0
    for (const item of items) {
      const product: any = productsById.get(item.product_id)
      if (!product?.active || Number(product.stock) < Number(item.quantity)) {
        return json({ error: `Estoque insuficiente para ${product?.name || 'um produto do pedido'}.` }, 409)
      }
      currentSubtotal += Number(product.price) * Number(item.quantity)
    }

    // Persist the current server price; coupon totals are recalculated by the
    // existing database trigger instead of trusting a browser total.
    const { data: repricedOrder, error: repriceError } = await supabase
      .from('orders')
      .update({ subtotal_amount: currentSubtotal })
      .eq('id', order_id)
      .select('*')
      .single()
    if (repriceError || !repricedOrder) return json({ error: 'Não foi possível validar o total do pedido.' }, 409)

    // Build MP preference
    let remainingDiscount = Math.min(Number(repricedOrder.discount_amount || 0), currentSubtotal)
    const mpItems = items
      .map((item: any) => {
        const quantity = Number(item.quantity)
        const unitPrice = Number(productsById.get(item.product_id)?.price)
        const lineTotal = unitPrice * quantity
        const lineDiscount = Math.min(remainingDiscount, lineTotal)
        remainingDiscount -= lineDiscount
        return {
          title: `${String(productsById.get(item.product_id)?.name || item.product_name || '').trim()}${quantity > 1 ? ` (x${quantity})` : ''}`,
          // A single line preserves cent precision after applying a coupon.
          quantity: 1,
          unit_price: Math.round((lineTotal - lineDiscount) * 100) / 100,
          currency_id: 'BRL',
        }
      })
      .filter((item: any) => item.title && Number.isFinite(item.unit_price) && item.unit_price > 0)

    // Add shipping as item if present
    if (repricedOrder.shipping_price && Number(repricedOrder.shipping_price) > 0) {
      mpItems.push({
        title: `Frete - ${repricedOrder.shipping_service_name || 'Entrega'}`,
        quantity: 1,
        unit_price: Number(repricedOrder.shipping_price),
        currency_id: 'BRL',
      })
    }

    const PRODUCTION_URL = 'https://horensuplementos.com.br'
    const origin = req.headers.get('origin') || ''
    // Mercado Pago requires HTTPS public URLs for auto_return. Use production
    // domain unless the request comes from another HTTPS origin (e.g. preview).
    const siteUrl = origin && origin.startsWith('https://') ? origin : PRODUCTION_URL

    if (mpItems.length === 0) {
      return json({ error: 'Pedido sem itens para pagamento' }, 400)
    }

    const preference = {
      items: mpItems,
      external_reference: order_id,
      payer: {
        name: payerName,
        first_name,
        last_name,
        email: payerEmail.data,
        phone: payerPhone,
        identification: { type: 'CPF', number: payerCpf },
      },
      back_urls: {
        success: `${siteUrl}/pedido/sucesso?id=${order_id}`,
        failure: `${siteUrl}/checkout/payment-error?id=${order_id}`,
        pending: `${siteUrl}/checkout/pending?id=${order_id}`,
      },
      // 'all' garante o redirecionamento automático também para pagamentos
      // pendentes (Pix/Boleto), não somente para cartão aprovado.
      auto_return: 'all',
      payment_methods: {
        excluded_payment_methods: [],
        excluded_payment_types: [],
      },
      notification_url: `${supabaseUrl}/functions/v1/payment-webhook`,
      statement_descriptor: 'HOREN SUPLEMENTOS',
    }

    console.log('Creating MP preference:', JSON.stringify(preference))

    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MERCADO_PAGO_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preference),
    })

    const mpData = await mpRes.json()

    if (!mpRes.ok) {
      console.error('MP error:', JSON.stringify(mpData))
      return json({ error: 'Erro ao criar pagamento', details: mpData }, 502)
    }

    console.log('MP preference created:', mpData.id)

    const checkoutUrl = isTestToken ? mpData.sandbox_init_point : mpData.init_point

    if (!checkoutUrl) {
      return json({ error: 'Mercado Pago não retornou a URL de checkout esperada' }, 502)
    }

    // Update order with MP preference id
    await supabase
      .from('orders')
      .update({ status: 'aguardando_pagamento' })
      .eq('id', order_id)

    return json({
      checkout_url: checkoutUrl,
      init_point: mpData.init_point,
      sandbox_init_point: mpData.sandbox_init_point,
      preference_id: mpData.id,
    })
  } catch (error: any) {
    console.error('Create payment error:', error)
    return json({ error: 'Erro interno', message: error.message }, 500)
  }
})
