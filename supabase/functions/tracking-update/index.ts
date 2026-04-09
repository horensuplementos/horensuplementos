import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MELHOR_ENVIO_BASE = 'https://melhorenvio.com.br/api/v2/me'

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

    if (!melhorEnvioToken) return json({ error: 'MELHOR_ENVIO_TOKEN não configurado' }, 500)

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch orders that are "enviado" and have shipping_order_id
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, shipping_order_id, status, tracking_code')
      .in('status', ['enviado', 'separado'])
      .not('shipping_order_id', 'is', null)

    if (error) {
      console.error('Query error:', error)
      return json({ error: 'Erro ao buscar pedidos' }, 500)
    }

    if (!orders || orders.length === 0) {
      return json({ ok: true, message: 'Nenhum pedido para rastrear', updated: 0 })
    }

    const meHeaders = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${melhorEnvioToken}`,
      'User-Agent': 'HorenSuplementos contato@horen.com.br',
    }

    const orderIds = orders.map(o => o.shipping_order_id).filter(Boolean)
    
    // Batch tracking request
    const trackRes = await fetch(`${MELHOR_ENVIO_BASE}/shipment/tracking`, {
      method: 'POST',
      headers: meHeaders,
      body: JSON.stringify({ orders: orderIds }),
    })

    const trackData = await trackRes.json()
    if (!trackRes.ok) {
      console.error('Tracking API error:', JSON.stringify(trackData))
      return json({ error: 'Erro na API de rastreio' }, 502)
    }

    let updated = 0
    const results: any[] = []

    for (const order of orders) {
      const tracking = trackData[order.shipping_order_id]
      if (!tracking) continue

      const lastEvent = tracking.events?.[0] // Most recent event
      if (!lastEvent) continue

      let newStatus = order.status
      let newShippingStatus = ''

      // Map Melhor Envio status to order status
      const eventTag = (lastEvent.tag || '').toLowerCase()
      if (eventTag.includes('delivered') || eventTag.includes('entregue')) {
        newStatus = 'entregue'
        newShippingStatus = 'entregue'
      } else if (eventTag.includes('in_transit') || eventTag.includes('transito') || eventTag.includes('posted')) {
        newStatus = 'enviado'
        newShippingStatus = 'em_transporte'
      }

      if (newShippingStatus && newShippingStatus !== order.status) {
        const updateData: any = { shipping_status: newShippingStatus }
        if (newStatus !== order.status) updateData.status = newStatus
        if (tracking.tracking && tracking.tracking !== order.tracking_code) {
          updateData.tracking_code = tracking.tracking
        }

        await supabase.from('orders').update(updateData).eq('id', order.id)
        updated++
        results.push({ order_id: order.id, new_status: newStatus, shipping_status: newShippingStatus })
      }
    }

    console.log(`Tracking update: ${updated} orders updated`)
    return json({ ok: true, updated, results })
  } catch (error: any) {
    console.error('Tracking update error:', error)
    return json({ error: 'Erro interno', message: error.message }, 500)
  }
})
