import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BodySchema = z.object({
  order_id: z.string().uuid(),
})

const paidStatuses = new Set(['pago', 'paid', 'enviado', 'entregue'])

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
    const parsed = BodySchema.safeParse(await req.json())
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Não autenticado' }, 401)

    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data: { user }, error: userError } = await anonClient.auth.getUser(authHeader.slice('Bearer '.length))
    if (userError || !user) return json({ error: 'Token inválido' }, 401)

    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    const { data: order, error } = await supabase
      .from('orders')
      .select('id, user_id, status, total')
      .eq('id', parsed.data.order_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) return json({ error: 'Erro ao consultar pedido' }, 500)
    if (!order) return json({ error: 'Pedido não encontrado' }, 404)

    return json({
      id: order.id,
      status: order.status,
      total: order.total,
      paid: paidStatuses.has(String(order.status)),
    })
  } catch (error: any) {
    console.error('Check order status error:', error)
    return json({ error: 'Erro interno', message: error.message }, 500)
  }
})
