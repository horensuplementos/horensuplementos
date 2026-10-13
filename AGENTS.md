# Arquivos de ambiente

- Nunca versionar `.env` nem variantes `.env.*`, na raiz ou em subdiretórios.
- Preservar arquivos de ambiente locais e usar as variáveis gerenciadas do
  Lovable na hospedagem. Não inserir valores de credenciais no código,
  documentação, testes ou mensagens de commit.
- Não usar `git add -f` para incluir arquivos de ambiente. Executar
  `npm run check:env` antes de commits e instalar os hooks com
  `npm run hooks:install` em novos clones.
- O histórico foi limpo para remover esses arquivos. Não fazer merge ou push
  de cópias antigas que voltem a introduzi-los. Conferir o histórico com
  `node scripts/check-env-tracking.mjs --history` antes de enviar alterações.
- Logs de diagnóstico podem informar nomes de variáveis, mas nunca seus
  valores. Chaves privadas pertencem somente ao ambiente do backend.
