# Validação e publicação segura da Horen Suplementos

## Diagnóstico confirmado
- A referência escolhida para publicação é a `main` atual, commit `596b13d`; o commit `23d8195` é ancestral e está três commits atrás.
- A cópia de trabalho está em uma branch de edição, mas `main`, `origin/main` e essa branch apontam para o mesmo commit. Não há alterações locais nem divergência de conteúdo.
- `calculate-shipping` é byte a byte igual à versão do commit `23d8195`.
- As ferramentas estão conectadas ao ambiente Live. Por decisão do usuário, o processo seguirá sem validar possíveis dados exclusivos em Test; isso será registrado como limitação.
- O Live está saudável e contém 1 produto e 33 arquivos no bucket `product-images` (aprox. 21 MB).
- O esquema já contém `image_urls`, campos de catálogo/IA e os quatro campos `shipping_*`. A correção da última imagem está ativa e as políticas de produtos permanecem presentes.

## Execução
1. Criar um pacote de recuperação do Live antes de qualquer outra alteração: exportação completa de `products`, inventário do bucket e cópia dos 33 arquivos de `product-images`.
2. Validar o pacote de recuperação, contagens e integridade dos arquivos; não executar migration se o esquema e a correção já estiverem completos.
3. Confirmar tipos gerados, integridade de galeria/logística e código de `calculate-shipping`; verificar somente a presença dos segredos necessários, sem expor valores.
4. Publicar novamente apenas `calculate-shipping` e testar seu comportamento e logs, confirmando que preço, estoque e dimensões vêm do banco.
5. No Preview, testar em desktop e celular: página individual, galeria, cadastro decimal, remoção da última imagem, carrinho e frete. Usar produto de teste e restaurar/remover os dados de teste ao final; não concluir pagamento.
6. Conferir console, rede, logs das funções e estado do projeto. Se qualquer teste falhar, interromper antes da publicação.
7. Se tudo passar, executar o Quick scan, publicar o frontend e validar no site publicado a página individual, carrinho e frete, além dos logs.
8. Informar URL publicada, commit `596b13d`, resultados por etapa, pacote preservado, limitações e erros encontrados.

## Critérios de bloqueio
- Não publicar com falha funcional, erro de console relevante, falha no scan ou inconsistência de dados.
- Não aplicar novamente migrations equivalentes `0001/0002`, `0003/0004` ou a correção já ativa.
- A ausência de validação do ambiente Test é uma limitação aceita explicitamente; nenhuma afirmação será feita sobre dados exclusivos desse ambiente.
