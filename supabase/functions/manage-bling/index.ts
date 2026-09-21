import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('status') }),
  z.object({ action: z.literal('configure'), client_id: z.string().trim().min(3).max(512), client_secret: z.string().trim().min(8).max(1024) }),
  z.object({ action: z.literal('start_oauth') }),
])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Não autenticado' }, 401)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data: { user }, error: userError } = await userClient.auth.getUser(authHeader.slice(7))
    if (userError || !user) return json({ error: 'Token inválido' }, 401)
    const { data: allowed } = await userClient.rpc('has_admin_permission_level', {
      _user_id: user.id,
      _levels: ['admin'],
    })
    if (!allowed) return json({ error: 'Sem permissão.' }, 403)

    const parsed = BodySchema.safeParse(await req.json())
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400)
    const body = parsed.data
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    if (body.action === 'status') {
      const { data: credential } = await admin
        .from('bling_credentials')
        .select('id, client_id, expires_at, access_token')
        .limit(1)
        .maybeSingle()
      return json({
        configured: Boolean(credential?.client_id),
        connected: Boolean(credential?.access_token),
        expires_at: credential?.expires_at || null,
      })
    }

    if (body.action === 'configure') {
      const { data: existing } = await admin.from('bling_credentials').select('id').limit(1).maybeSingle()
      const payload = { client_id: body.client_id, client_secret: body.client_secret, connected_by: user.id }
      const result = existing
        ? await admin.from('bling_credentials').update(payload).eq('id', existing.id)
        : await admin.from('bling_credentials').insert(payload)
      if (result.error) return json({ error: 'Não foi possível salvar as credenciais.' }, 500)
      return json({ ok: true })
    }

    const { data: credential } = await admin.from('bling_credentials').select('client_id').limit(1).maybeSingle()
    if (!credential?.client_id) return json({ error: 'Configure o Client ID antes de conectar.' }, 400)
    const state = crypto.randomUUID()
    const { error: stateError } = await admin.from('bling_oauth_states').insert({
      state,
      created_by: user.id,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    })
    if (stateError) return json({ error: 'Não foi possível iniciar a autorização.' }, 500)
    const url = `https://www.bling.com.br/Api/v3/oauth/authorize?response_type=code&client_id=${encodeURIComponent(credential.client_id)}&state=${state}`
    return json({ url })
  } catch (error) {
    console.error('Manage Bling error:', error)
    return json({ error: 'Erro interno.' }, 500)
  }
})
