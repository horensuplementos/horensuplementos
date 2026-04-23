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
    const payerPhone = String(order.customer_phone || '').replace(/\D/g, '')

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

    // Fetch order items
    const { data: items } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order_id)

    // Build MP preference
    const mpItems = (items || []).map((item: any) => ({
      title: item.product_name,
      quantity: item.quantity,
      unit_price: Number(item.unit_price),
      currency_id: 'BRL',
    }))

    // Add shipping as item if present
    if (order.shipping_price && Number(order.shipping_price) > 0) {
      mpItems.push({
        title: `Frete - ${order.shipping_service_name || 'Entrega'}`,
        quantity: 1,
        unit_price: Number(order.shipping_price),
        currency_id: 'BRL',
      })
    }

    const siteUrl = req.headers.get('origin') || 'https://horensuplementos.lovable.app'

    const preference = {
      items: mpItems,
      external_reference: order_id,
      payer: {
        name: payerName,
        first_name,
        last_name,
        email: payerEmail.data,
        phone: payerPhone ? { number: payerPhone } : undefined,
        identification: { type: 'CPF', number: payerCpf },
      },
      back_urls: {
        success: `${siteUrl}/checkout/sucesso?order_id=${order_id}`,
        failure: `${siteUrl}/checkout/falha?order_id=${order_id}`,
        pending: `${siteUrl}/checkout/pendente?order_id=${order_id}`,
      },
      auto_return: 'approved',
      payment_methods: {
        excluded_payment_methods: [],
        excluded_payment_types: [],
        installments: 12,
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
