## Plano de Implementação - E-commerce Completo

### Fase 1: Banco de Dados (migrations)
1. **Tabela `user_roles`** — controle de admin via roles (seguro)
2. **Tabela `products`** — nome, descrição, preço, imagem_url, estoque, ativo, categoria
3. **Tabela `orders`** — user_id, status (pendente/pago/enviado/entregue), total, dados do cliente
4. **Tabela `order_items`** — order_id, product_id, quantidade, preço unitário
5. **Storage bucket** para upload de imagens de produtos
6. **RLS policies** — admin pode tudo, usuários só leem produtos e seus próprios pedidos
7. **Realtime** habilitado para pedidos

### Fase 2: Painel Administrativo
1. **Rota `/admin`** — protegida, só acessível por admins
2. **Dashboard** — resumo de vendas, pedidos recentes, produtos com estoque baixo
3. **CRUD de Produtos** — formulário com upload de imagem, edição inline
4. **Gestão de Pedidos** — listagem em tempo real, atualização de status

### Fase 3: Site Público (Loja)
1. **Produtos dinâmicos** — carregados do banco de dados
2. **Carrinho de compras** — já existe, adaptar para produtos do banco
3. **Checkout** — formulário com dados do cliente, integrado ao carrinho

### Fase 4: Pagamento (Mercado Pago)
1. **Edge Function** para criar preferência de pagamento
2. **Edge Function webhook** para receber confirmações
3. **Integração frontend** com SDK do Mercado Pago
4. ⚠️ **Requer chaves API** — ACCESS_TOKEN do Mercado Pago

### Fase 5: Segurança
1. Validação com Zod em todas as edge functions
2. RLS em todas as tabelas
3. Admin verificado via função `has_role`
4. JWT validado nas edge functions

### Observações
- O Mercado Pago precisa de uma chave de API (ACCESS_TOKEN). Vou solicitar quando chegarmos nessa fase.
- O sistema de roles é separado da tabela profiles (segurança contra escalação de privilégios)
- Produtos serão carregados 100% do banco — sem dados hardcoded
