# Horen Suplementos

Loja React/Vite com Supabase, Mercado Pago, Melhor Envio e Bling.

## Ambiente local

```bash
npm install
npm run dev
```

O frontend usa `config/supabase.public.json` como configuração pública padrão,
inclusive no build do Lovable sem Enterprise. O arquivo contém somente a URL e
a chave Supabase publishable/anon, que são públicas e já aparecem no bundle do
navegador. Nunca incluir chaves secret/service_role ou outras credenciais privadas.

Para apontar o ambiente local para outro projeto/Test, configurar **as duas**
variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` no `.env` local
(ignorado pelo Git) ou no ambiente do processo. Elas têm prioridade sobre o
arquivo público. Pares incompletos, valores vazios e chaves privilegiadas
interrompem o build, sem mostrar valores nos erros. Sem override, o ambiente
usa o backend definido no arquivo público: não testar gravações no Live.

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

## Lovable

- Projeto: [editor Lovable](https://lovable.dev/projects/c03127fc-aea6-454e-a4bd-f36279a6db2d)
- Ambiente publicado: https://horensuplementos.lovable.app
- A sincronização é feita pela branch `main`; alterações do Lovable que forem enviadas para `lovable-sync` devem ser integradas por merge commit, sem squash ou rebase.
- Manter `.env` e `.env.*` fora do Git. O build lê a configuração pública através
  de `vite.config.ts`, sem alterar o cliente Supabase gerado pelo Lovable.
- Após sincronizar a `main`, usar **Publish → Update** para recompilar e publicar.
  Apenas sincronizar o Git não substitui o bundle publicado. Confirmar no
  Preview e depois no site publicado que não existe o erro `supabaseUrl is required`.
- **Cloud → Secrets** atende somente Edge Functions/backend, não fornece as
  variáveis `VITE_*` ao frontend. Não pedir ao Lovable para restaurar o `.env`
  versionado. Ao trocar de backend, atualizar o arquivo público com o par
  correspondente e republicar.
