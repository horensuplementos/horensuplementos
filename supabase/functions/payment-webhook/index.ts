import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    if (!MERCADO_PAGO_TOKEN) return json({ error: 'MERCADO_PAGO_TOKEN não configurado' }, 500)

    const body = await req.json()
    console.log('Webhook received:', JSON.stringify(body))

    // Mercado Pago sends notifications with type and data
    if (body.type !== 'payment' && body.action !== 'payment.updated' && body.action !== 'payment.created') {
      console.log('Ignoring non-payment notification:', body.type, body.action)
      return json({ ok: true })
    }

    const paymentId = body.data?.id
    if (!paymentId) {
      console.log('No payment ID in webhook body')
      return json({ ok: true })
    }

    // Fetch payment details from Mercado Pago
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${MERCADO_PAGO_TOKEN}`,
        'Content-Type': 'application/json',
      },
    })

    if (!mpRes.ok) {
      const errText = await mpRes.text()
      console.error(`MP API error ${mpRes.status}:`, errText)
      return json({ error: 'Erro ao consultar pagamento no MP' }, 502)
    }

    const payment = await mpRes.json()
    console.log('Payment status:', payment.status, 'external_reference:', payment.external_reference)

    if (payment.status !== 'approved') {
      console.log('Payment not approved, status:', payment.status)
      return json({ ok: true, status: payment.status })
    }

    // external_reference should be the order ID
    const orderId = payment.external_reference
    if (!orderId) {
      console.error('No external_reference in payment')
      return json({ error: 'Sem referência de pedido no pagamento' }, 400)
    }

    // Update order in database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      console.error('Order not found:', orderId, orderError)
      return json({ error: 'Pedido não encontrado' }, 404)
    }

    if (order.status === 'pago' || order.status === 'enviado' || order.status === 'entregue') {
      console.log('Order already processed:', order.status)
      return json({ ok: true, already_processed: true })
    }

    // Update order to "pago"
    const logEntry = {
      step: 'pagamento_aprovado',
      timestamp: new Date().toISOString(),
      payment_id: String(paymentId),
      payment_method: payment.payment_method_id || payment.payment_type_id,
    }

    const currentLog = Array.isArray(order.automation_log) ? order.automation_log : []

    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'pago',
        payment_id: String(paymentId),
        payment_method: payment.payment_method_id || payment.payment_type_id || 'mercado_pago',
        automation_log: [...currentLog, logEntry],
      })
      .eq('id', orderId)

    if (updateError) {
      console.error('Failed to update order:', updateError)
      return json({ error: 'Erro ao atualizar pedido' }, 500)
    }

    console.log('Order updated to pago:', orderId)

    // Trigger post-payment automation
    try {
      const automationRes = await fetch(
        `${supabaseUrl}/functions/v1/order-automation`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ order_id: orderId }),
        }
      )
      const automationData = await automationRes.json()
      console.log('Automation triggered:', JSON.stringify(automationData))
    } catch (automationErr) {
      console.error('Failed to trigger automation (will retry):', automationErr)
      // Don't fail the webhook - automation can be retried
    }

    return json({ ok: true, order_id: orderId, status: 'pago' })
  } catch (error) {
    console.error('Webhook error:', error)
    return json({ error: 'Erro interno no webhook' }, 500)
  }
})
