# Arquivos de ambiente e histórico Git

Arquivos `.env` e variantes `.env.*`, inclusive em subdiretórios, ficam fora do
versionamento. O arquivo local continua disponível para Vite. Não colocar
credenciais privadas em variáveis `VITE_*`, pois o frontend as inclui no código
enviado ao navegador.

## Build do Lovable sem Enterprise

A remoção do `.env` exige outra fonte de configuração no build: o Secrets do
Cloud atende somente o backend, não o frontend. Conforme autorização do
responsável, `config/supabase.public.json` guarda **apenas** `url` e
`publishableKey` (chave pública publishable ou JWT com papel `anon`). Esse arquivo
não é um cofre de segredos; seu conteúdo é público e vai para o bundle.

O `vite.config.ts` valida e injeta somente essas duas informações nas variáveis
já usadas pelo cliente gerado pelo Lovable e pelo callback OAuth do Bling.
`config/supabase-public.ts` rejeita campos extras, URLs inválidas, chaves
privilegiadas e pares de URL/JWT de projetos diferentes. A validação do JWT
confere os metadados, não sua assinatura; a autenticação permanece a cargo do
Supabase. Chaves publishable opacas não permitem verificar offline qual projeto
as emitiu. A segurança dos dados depende das políticas RLS e permissões do
backend, não de esconder a chave pública.

Overrides locais usam o par completo `VITE_SUPABASE_URL` e
`VITE_SUPABASE_PUBLISHABLE_KEY`, com prioridade sobre o arquivo público. Se uma
delas estiver ausente ou vazia, o build falha em vez de misturar Test e Live.
Sem override, o clone usa a configuração pública padrão; evitar testes que
gravem no Live. Logs de validação nunca incluem os valores recebidos.

Após sincronizar o código no Lovable, recompilar e republicar com **Publish →
Update**. Confirmar Preview, home e login sem erro de inicialização, e conferir
que nenhuma alteração reintroduziu `.env` no Git.

Instalar os bloqueios locais em cada clone:

```sh
npm run hooks:install
npm run check:env
```

O pre-commit rejeita arquivos de ambiente incluídos no índice, mesmo usando
`git add -f`. O pre-push verifica o histórico dos commits a enviar, impedindo que
um merge com a história antiga reintroduza esses arquivos. O workflow
`Prevent environment files in Git` também valida o histórico no GitHub.
Ignorar hooks ou checks explicitamente continua sendo possível para quem tem
acesso; eles não substituem a revisão de alterações e as permissões do provedor.

Após a reescrita do histórico, os hashes antigos deixam de ser a referência.
Outros colaboradores devem preservar alterações próprias fora do clone antigo
e obter uma nova cópia do repositório. Não fazer merge da história anterior na
nova. Conferir no Lovable que o projeto sincroniza a `main` limpa e que o editor
não está tentando reenviar commits antigos ou versionar o `.env` gerenciado.

A remoção de branches/tags alcançáveis não apaga cópias de terceiros nem garante
a eliminação imediata de objetos e páginas em cache do GitHub. Quando necessário,
solicitar ao suporte a limpeza de referências antigas e cache. Se credenciais
privadas tiverem sido expostas, revogar/rotacionar no serviço de origem antes de
considerar o incidente resolvido. Chaves Supabase `anon`/publishable são públicas
por natureza; chaves `service_role`/secret são privilegiadas.

Referências: [remoção de dados no GitHub](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository),
[tipos de chaves Supabase](https://supabase.com/docs/guides/getting-started/api-keys),
[Secrets versus variáveis VITE no Lovable](https://docs.lovable.dev/features/secrets),
[variáveis de ambiente no Vite](https://vite.dev/guide/env-and-mode).
