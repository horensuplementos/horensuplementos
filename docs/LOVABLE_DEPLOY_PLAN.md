# Plano de aplicação no Lovable Cloud

Este repositório usa React/Vite e o backend gerenciado do Lovable Cloud. O commit no Git **não comprova** que uma migration SQL foi executada no banco nem que uma Edge Function foi publicada. O projeto sincroniza a branch `main`; não trocar de branch, recriar a conexão ou aplicar manualmente as duas cópias da mesma migration.

## Ordem segura

1. Em **Project settings → Git → GitHub**, confirme que `main` é a branch sincronizada e que o status não aponta divergência. Integre qualquer `lovable-sync` em `main` por merge commit antes de novas edições. Só então envie os commits locais para a branch sincronizada por quem tem acesso ao repositório.
2. Antes de alterar o banco, confirme o ambiente (Test ou Live) e salve uma exportação dos registros de `products`. Confira **More → Cloud → Database → Backups**. Os backups do banco não incluem arquivos do Storage; exporte ou preserve as imagens separadamente se for necessário um ponto de recuperação completo.
3. Em **More → Cloud → SQL editor**, execute apenas as consultas de diagnóstico abaixo. O commit `9cc1562` afirma ter aplicado o alinhamento do catálogo, mas isso deve ser confirmado no banco real. Não repita `0003`/`0004` sem verificar o histórico de migrations do Lovable.
4. No chat do projeto, em modo de implementação, peça ao Lovable para aplicar **somente as mudanças faltantes**, como migration revisada, preservando dados, políticas RLS e o bucket `product-images`. Para a galeria, a correção nova é `drizzle/migrations/0005_fix_product_image_sync.sql` (espelho para Supabase externo: `supabase/migrations/20260930130000_fix_product_image_sync.sql`). As migrations antigas `0001`/`0002` e `0003`/`0004` têm conteúdo equivalente e podem já constar do histórico: não executá-las duas vezes. Se o Lovable gerar uma migration própria, usar o SQL da `0005` como referência e evitar registrá-la/aplicá-la novamente.
5. Peça ao Lovable para regenerar `src/integrations/supabase/types.ts` a partir do banco. A tipagem gerada atual ainda não lista `shipping_width_cm`, `shipping_height_cm`, `shipping_length_cm` e `shipping_weight_kg`, apesar de o código de administração e checkout depender desses campos. Confirmar também `image_urls`, marca, sabor, ingredientes, benefícios e FAQ.
6. Peça ao Lovable para publicar a versão atual de `supabase/functions/calculate-shipping/index.ts` **antes de publicar o frontend**. Ela aceita chamadas antigas com campos extras, mas calcula preço, estoque e dimensões com os dados do banco. O frontend novo envia apenas `id` e `quantity`; a função antiga rejeita esse formato. Confirme os segredos `MELHOR_ENVIO_TOKEN`, `HOREN_FROM_ZIP` e as credenciais gerenciadas do backend sem exibir seus valores.
7. Teste no preview e só então publique a versão do frontend. A publicação visual, isoladamente, não substitui os passos de banco e função.

## Diagnóstico SQL (somente leitura)

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'products'
  AND column_name IN (
    'image_url', 'image_urls', 'brand', 'flavor', 'benefits_input', 'ingredients',
    'ai_description_short', 'ai_description_long', 'ai_benefits', 'ai_faq',
    'shipping_width_cm', 'shipping_height_cm', 'shipping_length_cm', 'shipping_weight_kg'
  )
ORDER BY column_name;

SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public' AND event_object_table = 'products'
  AND trigger_name = 'sync_product_primary_image';

SELECT to_regprocedure('public.sync_product_primary_image()') AS gallery_function;
```

Depois de confirmadas as colunas e aplicada a correção da galeria:

```sql
SELECT count(*) AS products_count,
       count(*) FILTER (WHERE image_url IS DISTINCT FROM nullif(image_urls[1], '')) AS image_mismatches,
       count(*) FILTER (WHERE cardinality(image_urls) > 8) AS oversized_galleries,
       count(*) FILTER (WHERE stock < 0 OR shipping_width_cm <= 0 OR shipping_height_cm <= 0
         OR shipping_length_cm <= 0 OR shipping_weight_kg <= 0) AS invalid_logistics
FROM public.products;
```

Os três contadores de inconsistência devem ser zero. Se algum campo estiver ausente, **não** execute a segunda consulta; peça ao Lovable para aplicar o alinhamento de catálogo primeiro.

## Prompt para o Lovable

> Este projeto Horen Suplementos é sincronizado com a branch `main` e usa Lovable Cloud. Antes de alterar qualquer coisa, inspecione o esquema e o histórico de migrations aplicadas no banco deste ambiente. Confirme os campos `products.image_urls`, `brand`, `flavor`, `benefits_input`, `ingredients`, campos `ai_*` e os quatro campos `shipping_*`. Aplique apenas o que estiver faltando, sem apagar dados nem repetir as migrations equivalentes `0001`/`0002` e `0003`/`0004`. Aplique a correção idempotente de `drizzle/migrations/0005_fix_product_image_sync.sql` para que remover a última imagem deixe `image_urls = '{}'` e `image_url = NULL`, mas escritas legadas em `image_url` continuem compatíveis. Regere os tipos do Supabase a partir do banco e publique a Edge Function `calculate-shipping` do repositório. Não mude a identidade visual, as políticas RLS ou as integrações de pagamento. Mostre o resultado da migration, do deploy da função e dos testes antes de publicar o frontend.

## Aceite antes da publicação

- Criar/editar produto com preço decimal, dimensões e peso; salvar, recarregar e verificar que os valores persistiram.
- Enviar várias imagens, reordenar, remover uma e depois todas em um produto de teste; conferir `image_urls` e `image_url` no banco e as imagens no card e na página individual.
- Conferir descrição, marca, sabor, benefícios, ingredientes, FAQ e produtos relacionados na página individual. Testar produto esgotado e URL de produto inativo/inexistente.
- Abrir o carrinho com preço/estoque alterados no cadastro; verificar que ele é atualizado antes de cotar ou criar pedido. Testar quantidade máxima de 50 e limite de estoque.
- Com usuário autenticado e endereço de teste, cotar frete de produto cujas dimensões sejam diferentes dos antigos valores fixos (20 × 10 × 30 cm, 0,5 kg). Confirmar nos logs da função que a cotação usa os dados persistidos. Testar criação de pedido até o redirecionamento de pagamento em ambiente seguro de teste, sem efetuar compra real.
- Conferir logs de `calculate-shipping`/`create-order`, erros de console e layout em celular e desktop. Só publicar após as verificações; caso o esquema ou a função não estejam atualizados, manter o frontend novo fora do ar.

Em caso de falha, interromper a publicação e corrigir com uma nova migration. Restaurar backup do banco é último recurso: a restauração perde alterações posteriores e não restaura arquivos do Storage.

## Pendências de compatibilidade e validação

O `npm audit` ainda sinaliza dois avisos moderados de `react-router`/`react-router-dom` 6. O redirecionamento variável após login agora aceita somente caminhos internos; a outra ocorrência é ligada à hidratação SSR, que este app Vite com `BrowserRouter` não usa. A correção indicada pelo audit exige React Router 7 (mudança de versão principal); migrar o roteamento deve ser uma tarefa separada, com teste de todas as rotas no Lovable. O audit completo também aponta dependências de desenvolvimento, incluindo aviso alto do servidor Vite em caminhos alternativos do Windows; o bundle publicado não executa o servidor de desenvolvimento. Não atualizar automaticamente Vite/Vitest/Drizzle para versões principais sem testar o preview do Lovable.

Os testes automatizados locais cobrem a página individual, carrinho e validação de rotas internas. Um teste real com banco, Storage, conta autenticada, frete e pagamento depende do ambiente Cloud e deve ser executado no preview pelo responsável antes da publicação.

Referências: [Banco de dados do Lovable](https://docs.lovable.dev/features/database), [Lovable Cloud](https://docs.lovable.dev/features/cloud), [Edge Functions](https://docs.lovable.dev/features/edge-functions), [sincronização com GitHub](https://docs.lovable.dev/integrations/github).
