# Metadados e identidade de compartilhamento

O domínio canônico é `https://horensuplementos.com.br/`. A imagem oficial é
`src/assets/og_image.png` (1200 × 630). O script `assets:generate`, executado antes
do desenvolvimento e build, publica uma cópia idêntica em `/og_image.png`. Os
arquivos de `public/` também são versionados para o preview do Lovable.

`index.html` entrega os metadados completos, JSON-LD e um H1 acessível no HTML
inicial. Quando React inicia, substitui o conteúdo inicial e a home mantém um
único H1 acessível; os títulos das campanhas continuam como H2. Isso preserva o
layout e evita que o tema principal dependa do slide ativo. O painel usa o título
de cada tela como seu único H1.

`SiteSeo` mantém título, descrição, canonical, Open Graph e JSON-LD por rota. A
página de produto acrescenta dados estruturados de Product/Offer apenas com as
informações reais do cadastro. Páginas privadas recebem `noindex`. A imagem de
compartilhamento permanece a arte oficial da marca em todas as rotas.

Os ícones usam o monograma H nas cores do site. `icons:generate` gera PNGs e ICO
a partir de `public/favicon.svg` usando o navegador local; os builds do Lovable
usam os ícones já versionados e não precisam desse navegador. O manifest define
nome, ícones e cores de instalação, sem adicionar serviço de cache offline.

Validação local:

```sh
npm run build
npm run verify:seo
npm test -- --run
# Em outro terminal: npm run preview -- --host 127.0.0.1 --port 4177 --strictPort
npm run verify:seo:browser
```

O teste de navegador intercepta todas as chamadas externas e não escreve no
Cloud. Após sincronizar e publicar no Lovable, conferir `/og_image.png`, ícones,
manifest e a página principal no domínio público. Reexecutar o scanner e os
depuradores das redes sociais para renovar o preview armazenado em cache.

O [Lovable pré-renderiza apps React/Vite para crawlers verificados](https://docs.lovable.dev/features/seo-aeo).
Scanners genéricos podem receber o HTML inicial da SPA. Por isso os metadados
globais também estão no HTML estático, enquanto os dados das rotas são mantidos
no React, sem trocar a plataforma ou introduzir migrations.
