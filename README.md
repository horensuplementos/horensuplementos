# Horen Suplementos

Loja React/Vite com Supabase, Mercado Pago, Melhor Envio e Bling.

## Ambiente local

```bash
npm install
npm run dev
```

O frontend requer `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` no `.env`. Não versionar chaves privadas.

Verificações locais:

```bash
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm run build
npm test -- --run
```

## Deploy Supabase

Antes de publicar o frontend que contém as mudanças de checkout, aplique as migrations e faça deploy das Edge Functions, especialmente:

```bash
supabase db push
supabase functions deploy create-order
supabase functions deploy manage-bling
supabase functions deploy create-payment
supabase functions deploy payment-webhook
supabase functions deploy shipping-label
supabase functions deploy bling-oauth-callback
```

Configure no ambiente Supabase os segredos já usados pelas integrações: `MERCADO_PAGO_TOKEN`, `MELHOR_ENVIO_TOKEN`, `HOREN_FROM_ZIP`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` e os segredos de e-mail/IA quando esses recursos estiverem ativos.
