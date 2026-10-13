# Arquivos de ambiente e histórico Git

Arquivos `.env` e variantes `.env.*`, inclusive em subdiretórios, ficam fora do
versionamento. O arquivo local continua disponível para Vite; a hospedagem deve
fornecer as variáveis pelo ambiente gerenciado. Não colocar credenciais privadas
em variáveis `VITE_*`, pois o frontend as inclui no código enviado ao navegador.

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
[tipos de chaves Supabase](https://supabase.com/docs/guides/getting-started/api-keys).
