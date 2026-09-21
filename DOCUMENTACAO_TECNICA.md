# Leitura técnica — Horen Suplementos

Data da leitura: 21 de setembro de 2026  
Escopo: repositório local inteiro (frontend, migrations e Edge Functions Supabase). Esta leitura não consulta dados de produção, configurações secretas nem o estado das integrações externas.

## 1. Visão geral

Horen Suplementos é uma loja de suplementos de alta performance, com comunicação visual premium e foco comercial em creatina, whey, kits e recompra. O projeto foi iniciado no Lovable e está estruturado como uma SPA:

| Camada | Implementação |
| --- | --- |
| Frontend | React 18 + TypeScript + Vite 5 |
| Estilos | Tailwind CSS + componentes shadcn/ui/Radix |
| Motion | Framer Motion |
| Dados, auth e storage | Supabase |
| Estado remoto disponível | TanStack React Query (ainda não utilizado nas telas) |
| Pagamento | Mercado Pago Checkout Pro |
| Frete e etiquetas | Melhor Envio |
| ERP / nota fiscal | Bling API v3 |
| E-mail | Supabase Auth hook + fila `pgmq` + Resend |
| IA editorial | OpenAI via Edge Functions |

O repositório tem aproximadamente 19 mil linhas em TypeScript/TSX/SQL, 11 assets de imagem locais (~700 KB) e histórico Git conectado a `github.com/horensuplementos/horensuplementos`.

## 2. Organização da base

```text
src/
  components/                 componentes reutilizáveis, layout e shadcn/ui
  contexts/                   carrinho e conteúdo administrável do site
  data/                       catálogo estático legado
  hooks/                      autorização de administração e utilitários
  integrations/supabase/      client e tipos gerados do banco
  pages/                      páginas públicas, checkout e painel administrativo
  assets/                     logos, banners e imagens de fallback
supabase/
  migrations/                 esquema, RLS, funções, views, triggers e seeds
  functions/                  automações e integrações server-side (Deno)
```

Há duas dependências de lockfile (`package-lock.json` e `bun.lockb`), mas a instalação local de dependências não está presente. Portanto, `npm run build` não chegou a executar o Vite (`vite: not found`); não houve alteração de código para instalar dependências nesta leitura.

## 3. Rotas e jornadas existentes

### Área pública

| Rota | Papel |
| --- | --- |
| `/` | Landing/storefront: header, carrossel, produtos, sobre e footer |
| `/produto/:id` | Detalhe de produto, quantidade e inclusão no carrinho |
| `/blog` | Listagem e leitura de artigos publicados, sem URL individual por artigo |
| `/calculadoras` | Calculadora de duração de creatina e TMB (Mifflin-St Jeor) |
| `/auth` | Login, cadastro e aceitação de convite por fluxo de autenticação |
| `/aceitar-convite` | Aceitação de convite administrativo com token |
| `/conta` | Perfil, pedidos e retomada de pagamento |
| `/checkout` | Endereços, frete, cupom, retirada e criação de pagamento |
| `/checkout/*` e `/pedido/sucesso` | Status e retomada do pagamento |

### Área administrativa

Protegida no cliente por `AdminRoute`, com verificação de `admin_profiles` e fallback para o papel legado `user_roles`.

| Rota | Papel |
| --- | --- |
| `/admin` | Resumo de pedidos, faturamento, produtos e pedidos recentes |
| `/admin/cupons` | CRUD e acompanhamento de cupons |
| `/admin/produtos` | CRUD de produtos, estoque e upload de imagens |
| `/admin/pedidos` | Status, etiqueta, rastreio, emissão/impressão de NF-e e exclusão |
| `/admin/editor` | Editor das seções administráveis do site |
| `/admin/blog` | CRUD de posts, capa e geração por IA |
| `/admin/administradores` | Convites e níveis de permissão |
| `/admin/metricas` | Receita, cupons e carrinhos |
| `/admin/bling` | Credenciais e OAuth do Bling |
| `/admin/configuracoes` | Retirada em loja |

Os níveis detalhados são `admin`, `operator` e `editor`. A navegação oculta itens não permitidos, mas o guard da rota aceita qualquer perfil administrativo; a proteção efetiva das ações deve continuar sendo RLS e validação nas Edge Functions.

## 4. Dados e modelo Supabase

### Entidades principais

| Grupo | Entidades e finalidade |
| --- | --- |
| Clientes | `profiles` (nome, telefone, CPF), `user_addresses` (endereços e padrão) |
| Catálogo | `products` (nome, descrição, preço, imagem, estoque, categoria, peso, ativo) |
| Vendas | `orders`, `order_items`, dados de entrega, frete, cupom, pagamento, NF-e e automação |
| Marketing | `coupons`, view `coupon_usage_summary`, `cart_sessions`, view `cart_metrics_summary` |
| Conteúdo | `site_content_sections`, `blog_posts`, `blog_automation_settings`, `site_settings` |
| Administração | `user_roles`, `admin_profiles`, `admin_invitations`, `bling_credentials` |
| Operação | logs/fila de e-mail e uso de IA |

### Proteções e automações já implementadas

- RLS está habilitado nas tabelas de negócio relevantes; usuários veem os próprios pedidos/endereços e perfis administrativos obtêm acesso segundo suas permissões.
- Buckets públicos: `product-images` e `site-assets`; gravação é restrita aos administradores por policy.
- Triggers atualizam `updated_at`, aplicam cupom ao pedido, alteram status de sessão de carrinho e baixam estoque na transição de pedido para `pago`.
- A função `validate_coupon` centraliza validade, período, limite de uso, valor mínimo e cálculo de desconto.
- A fila de e-mail tem controle de tentativas, deduplicação, DLQ e, em migration recente, revogação de execução pública das funções internas.
- Tipos Supabase são versionados em `src/integrations/supabase/types.ts`. As várias conversões `as any` indicam que os tipos gerados ficaram defasados das migrations mais recentes.

### Conteúdo administrável

As seções usam a tabela `site_content_sections`, carregada globalmente por `SiteContentProvider`. As chaves usadas são `hero_banner`, `products_section`, `about_section`, `footer`, `promo_banner` e `calculators_section`.

Cada seção combina campos de texto (`title`, `subtitle`, `description`, `cta_*`, `image_url`) com `items` em JSON. Se o registro estiver ausente/inativo ou vazio, o frontend usa um fallback codificado. Isso mantém o site apresentável, mas torna fácil haver divergência entre o painel e o conteúdo realmente exibido.

## 5. Fluxos de negócio

### Catálogo e carrinho

Produtos públicos são carregados diretamente da tabela `products`, apenas com `active = true`. O carrinho é um React Context em memória: soma itens/preços no navegador e abre um drawer; não usa localStorage, não persiste ao atualizar a página e não reserva estoque.

### Checkout e pagamento

1. Checkout exige autenticação e carrega perfil/endereço salvo.
2. Cliente salva/seleciona endereço, consulta CEP (ViaCEP) e frete (Melhor Envio), ou escolhe retirada local se habilitada.
3. O cupom é validado no banco; o frontend cria `orders` e `order_items`.
4. `create-payment` confirma que o pedido pertence ao usuário, monta a preferência do Mercado Pago a partir dos itens do pedido e retorna o link de checkout.
5. `payment-webhook` consulta o pagamento diretamente no Mercado Pago, marca o pedido como `pago` e aciona `order-automation`.
6. A automação cria pedido/NF-e no Bling, registra log e dispara e-mails; a expedição é operada pelo painel via Melhor Envio.

### Conteúdo, blog e IA

Administradores/editors podem editar seções e posts. O blog renderiza uma variante simples de Markdown no cliente. As funções `ai-generate-product` e `ai-generate-blog` exigem autenticação administrativa, usam OpenAI e registram uso em `ai_usage_log`.

## 6. Integrações e configuração operacional

| Integração | Componentes | Segredos/configurações necessários |
| --- | --- | --- |
| Supabase | client, auth, banco, storage e funções | variáveis públicas Vite e chaves server-side do Supabase |
| Mercado Pago | `create-payment`, `payment-webhook`, `check-order-status` | `MERCADO_PAGO_TOKEN` |
| Melhor Envio | `calculate-shipping`, `shipping-label`, `tracking-update` | `MELHOR_ENVIO_TOKEN`; CEP de origem está fixo em `02613000` |
| Bling | OAuth callback, NF-e e automação | client id/secret, access e refresh tokens |
| Resend | auth email hook e processador de fila | `RESEND_API_KEY` e domínio/remetente configurados |
| OpenAI | geradores de produto/blog | chave de API do servidor |

O domínio de produção está fixado como `https://horensuplementos.com.br` em vários fluxos (retornos de pagamento, OAuth e e-mails). Qualquer mudança de domínio precisa ser tratada como mudança de configuração central, não apenas de frontend.

## 7. Padrão visual a preservar nos próximos desenvolvimentos

Esta é a referência obrigatória para novos componentes e telas.

### Identidade

- Tema escuro azul-petróleo: fundo `hsl(213 56% 11%)`; superfícies em `card` e `secondary` da mesma família.
- Texto claro em bege; `primary`/`accent` também são tons de bege-dourado. Não introduzir cores arbitrárias: usar os tokens CSS/Tailwind (`background`, `foreground`, `card`, `secondary`, `muted`, `primary`, `border`, `destructive`).
- Tipografia: `Outfit` para títulos e números de destaque (`font-heading`); `Space Grotesk` para corpo, controles e navegação (`font-body`).
- Borda padrão `border-border`; raio base `0.75rem`. Cards e blocos comerciais adotam `rounded-xl` ou `rounded-2xl`.

### Composição e responsividade

- Usar `container mx-auto px-6`; as seções em geral usam `py-24 md:py-32`.
- Grades seguem progressão mobile-first: uma coluna, `md`, depois `lg`; cards de catálogo usam borda sutil, fundo `card`, hover com `primary/30` e sombra discreta.
- Header é fixo, altura `h-20`; páginas internas compensam com `pt-20`/`pt-28`.
- Hierarquia recorrente: eyebrow em caixa alta, `tracking-[0.3em]`, `text-muted-foreground`; título grande em `font-heading font-bold`; descrição em muted.
- Botões principais usam `Button` do shadcn, altura frequente `h-14`, `rounded-xl`, texto em `font-heading`, fundo `primary` e texto `primary-foreground`.

### Interação

- Framer Motion é o padrão para entrada (`opacity + translateY`) e hover de cards/imagens.
- Movimentos são breves e discretos; respeitar o padrão já existente de `transition-colors`, `transition-transform` e escala leve em CTA.
- Ícones são Lucide; manter tamanhos de 3.5–5 unidades Tailwind e não misturar bibliotecas de ícones.
- Componentes base devem vir de `src/components/ui` sempre que possível, em vez de implementar variantes paralelas.

## 8. Pontos de atenção priorizados

Os itens abaixo são achados da leitura estática. Eles devem ser confirmados no ambiente Supabase/Mercado Pago antes de qualquer mudança de produção.

### Críticos

1. **`shipping-label` não autoriza quem chama a função.** A função aceita ações que adicionam envios, geram/compram/imprimem etiquetas e consultam rastreio usando o token operacional do Melhor Envio, mas o código não valida `Authorization` nem papel de administrador. Mesmo que a plataforma exija um JWT no deploy, um token anônimo/publicável não equivale a permissão operacional. Prioridade: validar JWT, exigir `admin`/`operator` no servidor e validar vínculo de cada pedido ao pedido interno antes de chamar o Melhor Envio.
2. **O conteúdo do blog permite HTML não sanitizado.** `Blog.tsx` usa `dangerouslySetInnerHTML` após conversão de Markdown muito limitada. Um editor que inserir HTML ou conteúdo gerado por IA pode produzir XSS para visitantes. Prioridade: trocar por parser Markdown com sanitização rigorosa ou sanitizar HTML com allowlist no servidor/cliente.
3. **Segredos do Bling são lidos e mantidos no navegador.** O painel busca `select('*')` em `bling_credentials`, incluindo `client_secret`, e as credenciais estão em campos textuais no banco. Mesmo para administradores, é melhor guardar segredo apenas em Supabase Secrets/Vault e expor ao painel somente flags de configuração/conexão.

### Alta prioridade

1. **Estados de pedido incompatíveis.** `create-payment` tenta atualizar para `aguardando_pagamento`, porém a migration mais recente de constraint aceita `pendente`, `pago`, `nota_emitida`, `separado`, `enviado`, `entregue`, `cancelado` e `aguardando_pagamento_melhor_envio` — não `aguardando_pagamento`. O erro dessa atualização não é checado, deixando uma falha silenciosa e métricas/status inconsistentes. Definir uma enumeração única de estados e validá-la em todos os fluxos.
2. **Pagamento não revalida preços, estoque, frete e cupom no servidor.** O pedido é criado pelo cliente usando preço/quantidade do carrinho em memória; `create-payment` apenas transforma `order_items` já inseridos em preferência de pagamento. Isso permite pedido com informação desatualizada e não cria reserva de estoque. Mover a criação/reprecificação do pedido para uma transação/função server-side que consulta `products`, recalcula frete/cupom e verifica estoque.
3. **Risco de estoque negativo e concorrência.** A baixa ocorre somente após pagamento e é `stock = stock - quantity`, sem condição de saldo suficiente ou bloqueio. Compras simultâneas podem vender acima do estoque. Usar função transacional com lock/`WHERE stock >= quantity`, estado de reserva com expiração ou estratégia equivalente.
4. **Métricas de carrinho e recuperação não funcionam no frontend atual.** Há schema, função `upsert_cart_session`, triggers e views para carrinhos, mas não há chamada a `upsert_cart_session` no `src`. As métricas de abandono/conversão exibidas no painel tenderão a zero/obsoletas e o campo `cart_session_id` não é preenchido no checkout.
5. **O cálculo de frete usa dimensões e peso fixos.** Todo item é enviado ao Melhor Envio como `20×10×30`, `0,5 kg`, independentemente do produto ou quantidade. O valor pode ser inválido, principalmente para kits. Dados logísticos devem pertencer ao catálogo e ser protegidos do cliente.

### Média prioridade

1. **O carrinho não persiste entre sessões/refresh** e não limita quantidade pela disponibilidade no drawer; somente a página de detalhe limita o seletor. Isso prejudica conversão e permite chegar ao checkout com quantidade inconsistente.
2. **Dados e textos de fallback conflitam com a marca/conteúdo administrado.** Existem mensagens de whey, combos e frete gratuito em imagens/fallback, enquanto o seed mais recente fala em especialização em creatina. Além disso, `PromoBanner`, `HeroSection`, `ProductCard` e `src/data/products.ts` estão presentes mas não entram na home atual. Limpar o legado ou decidir explicitamente qual fonte é canônica.
3. **Links de footer têm destino incorreto para "Sobre".** O footer deriva `#sobre`, correto, mas também cria `#inicio`, `#produtos`, `#contato` sem lidar com navegação a partir das páginas internas. O header possui uma solução parcial; padronizar um componente de navegação.
4. **A página de artigo não tem rota indexável por slug.** O estado do artigo vive em memória de `/blog`; atualização, compartilhamento ou SEO não preservam a leitura. Criar `/blog/:slug` se o blog for canal de aquisição.
5. **Métricas contam pedidos ainda não pagos como faturamento.** Dashboard e Métricas excluem apenas `cancelado`, portanto pedidos `pendente` também entram em receita/ticket. A regra de faturamento deve considerar apenas estados financeiros confirmados.
6. **O OAuth do Bling gera `state`, mas não o persiste nem valida no callback.** Implementar estado assinado/persistido, com expiração, e validar o usuário administrativo que iniciou a conexão.
7. **Erros de carregamento de dados são frequentemente ignorados.** Catálogo, conteúdo, blog e alguns painéis assumem arrays vazios em caso de erro. Diferenciar "sem dados" de "falha de conexão" para não mascarar indisponibilidade operacional.

## 9. Desempenho, qualidade e testes

- React Query está instalado, porém fetches usam `useEffect`/estado local em todas as páginas. Não há cache, deduplicação, retry coerente, invalidação ou estados de erro padronizados.
- O `SiteContentProvider` consulta conteúdo uma vez para toda a SPA, o que é adequado, mas não há tratamento de erro nem cache persistente.
- Imagens de cards usam lazy loading; o hero prioriza imagem local. Para imagens do storage, definir dimensões e política de compressão/WebP/AVIF antes do catálogo crescer.
- O carrossel é renderizado com banners de fallback locais e intervalos de 5 s; caso uma seção de conteúdo ativa tenha lista vazia, a lógica pode ficar sem slides válidos. Validar itens no editor e no componente.
- Existe somente um teste de exemplo, sem cobertura de checkout, cupom, permissões, estoque ou funções. Playwright está configurado via pacote Lovable, mas não há cenários end-to-end próprios.
- Build, lint e testes não puderam ser executados porque `node_modules` não existe neste checkout. Após instalação reproduzível (`npm ci` ou decisão de usar Bun), executar `npm run build`, `npm run lint` e `npm test -- --run` antes de alterações funcionais.

## 10. Diretriz de trabalho futuro

1. Tratar o checkout como prioridade de segurança e integridade: proteger funções, centralizar validações no servidor, unificar estados e resolver concorrência de estoque.
2. Reconectar ou retirar completamente a funcionalidade de carrinhos abandonados antes de usar suas métricas em decisões comerciais.
3. Gerar novamente `types.ts` após consolidar migrations e remover `as any` de tabelas/campos maduros.
4. Implantar testes de integração para RLS/Edge Functions e E2E para compra aprovada, pendente, cupom, frete, retirada, estoque e permissões.
5. Em cada tela nova, usar os tokens, tipografia, espaçamento, componentes e animações definidos na seção 7 — sem criar uma segunda linguagem visual.

## 11. Arquivos de referência para manutenção

| Assunto | Arquivos principais |
| --- | --- |
| Rotas e providers | `src/App.tsx`, `src/main.tsx` |
| Tokens e tema | `src/index.css`, `tailwind.config.ts` |
| Loja e carrinho | `src/components/ProductsSection.tsx`, `src/components/ProductDetail.tsx`, `src/contexts/CartContext.tsx` |
| Checkout/pedidos | `src/pages/Checkout.tsx`, `src/pages/AccountOrders.tsx`, `src/pages/CheckoutStatus.tsx` |
| Permissões | `src/components/AdminRoute.tsx`, `src/hooks/useAdmin*.ts`, migrations de papéis/perfis |
| Conteúdo | `src/contexts/SiteContentContext.tsx`, `src/pages/admin/AdminContentEditor.tsx`, `src/lib/siteContent.ts` |
| Pagamento | `supabase/functions/create-payment`, `payment-webhook`, `check-order-status` |
| Logística | `supabase/functions/calculate-shipping`, `shipping-label`, `tracking-update` |
| ERP/NF-e | `supabase/functions/order-automation`, `bling-invoice`, `bling-oauth-callback` |
| E-mail | `auth-email-hook`, `process-email-queue`, `supabase/functions/_shared/email-templates` |

## 12. Correções aplicadas após a leitura

Em 21 de setembro de 2026 foram implementadas as seguintes mitigações. Elas exigem a aplicação da migration e o deploy das novas Edge Functions no projeto Supabase antes de entrarem em produção.

- Checkout agora cria pedidos pela função autenticada `create-order`; catálogo, preço, estoque, endereço, retirada, modalidade e frete são revalidados no servidor. As policies que permitiam inserção direta do cliente em `orders` e `order_items` foram removidas.
- O pagamento revalida produtos/estoque, reprifica o pedido no servidor, aplica o desconto ao valor enviado ao Mercado Pago e confere valor/moeda do pagamento no webhook.
- Estoque possui constraint não negativa e baixa atômica, bloqueando a confirmação que deixaria qualquer produto negativo.
- Foram incluídos campos logísticos no produto (dimensões e peso) e controles no painel; o servidor usa esses dados para cotar frete, em vez de dados fornecidos pelo navegador.
- `shipping-label` passou a exigir usuário autenticado com perfil `admin` ou `operator` e a configuração declara `verify_jwt = true`.
- O Markdown do blog passou a ser renderizado como texto/elementos React, sem `dangerouslySetInnerHTML`.
- Credenciais e tokens do Bling deixaram de ser lidos pelo navegador. A nova `manage-bling` é autenticada e administrativa; o OAuth usa estado persistido, expirável e de uso único.
- O carrinho agora persiste localmente, respeita o estoque conhecido e sincroniza sessões de carrinho. A sessão anterior é preservada como convertida após uma compra, permitindo métricas consistentes.
