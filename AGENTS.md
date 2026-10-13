# Arquivos de ambiente

- Nunca versionar `.env` nem variantes `.env.*`, na raiz ou em subdiretórios.
- Preservar arquivos de ambiente locais. Sem Enterprise, o build do Lovable
  usa `config/supabase.public.json`, autorizado pelo responsável, com somente
  a URL pública e a chave Supabase publishable/anon. O `.env` local pode
  sobrescrever esse par completo para desenvolvimento/Test.
- Não inserir credenciais privadas no código, documentação, testes ou
  mensagens de commit. A única exceção de configuração pública versionada é
  `config/supabase.public.json`; nunca incluir chaves secret/service_role ali.
- Não usar `git add -f` para incluir arquivos de ambiente. Executar
  `npm run check:env` antes de commits e instalar os hooks com
  `npm run hooks:install` em novos clones.
- O histórico foi limpo para remover esses arquivos. Não fazer merge ou push
  de cópias antigas que voltem a introduzi-los. Conferir o histórico com
  `node scripts/check-env-tracking.mjs --history` antes de enviar alterações.
- Logs de diagnóstico podem informar nomes de variáveis, mas nunca seus
  valores. Chaves privadas pertencem somente ao ambiente do backend.
