import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";

const articles = [
  {
    id: "importancia-do-sono",
    title: "A Importância do Sono para Quem Treina",
    excerpt:
      "Descubra por que dormir bem é tão importante quanto treinar e como o sono impacta diretamente nos seus resultados.",
    readTime: "5 min",
    date: "20 Mar 2026",
    category: "Saúde",
    content: `
O sono é um dos pilares mais subestimados quando falamos em performance esportiva e ganho de massa muscular. Muitos atletas e praticantes de musculação focam exclusivamente na dieta e no treino, mas esquecem que é durante o sono que a mágica acontece.

## Por que o sono é tão importante?

Durante o sono profundo, o corpo libera grandes quantidades de **GH (hormônio do crescimento)**, essencial para a recuperação e o crescimento muscular. Sem um sono de qualidade, essa liberação é comprometida, o que pode prejudicar significativamente seus resultados.

### Benefícios de uma boa noite de sono:

- **Recuperação muscular acelerada**: Os tecidos musculares danificados durante o treino são reparados e fortalecidos.
- **Regulação hormonal**: Além do GH, hormônios como testosterona e cortisol são regulados durante o sono.
- **Melhora na performance cognitiva**: Foco, motivação e disposição para treinar dependem de um cérebro descansado.
- **Controle do apetite**: A privação de sono aumenta a grelina (hormônio da fome) e reduz a leptina (saciedade).

## Quantas horas dormir?

Para praticantes de atividade física, o ideal é entre **7 a 9 horas** de sono por noite. Atletas de alta performance podem precisar de ainda mais.

## Dicas para melhorar o sono:

1. **Mantenha horários regulares** para dormir e acordar.
2. **Evite telas** pelo menos 1 hora antes de dormir.
3. **Crie um ambiente escuro e fresco** no quarto.
4. **Evite cafeína** após as 16h.
5. **Considere suplementos** como magnésio e melatonina, se necessário.

Lembre-se: treinar duro sem dormir bem é como tentar encher um balde furado. Priorize seu descanso e veja seus resultados decolarem.
    `,
  },
  {
    id: "creatina-como-usar",
    title: "Creatina: Para Que Serve e Como Usar Corretamente",
    excerpt:
      "Tudo o que você precisa saber sobre o suplemento mais estudado do mundo: benefícios, dosagem e mitos desvendados.",
    readTime: "7 min",
    date: "15 Mar 2026",
    category: "Suplementação",
    content: `
A creatina é, sem dúvida, o suplemento mais estudado e comprovado cientificamente no mundo da nutrição esportiva. Se você treina e ainda não usa creatina, está deixando ganhos na mesa.

## O que é a Creatina?

A creatina é uma substância produzida naturalmente pelo nosso corpo (no fígado, rins e pâncreas) e também encontrada em alimentos como carne vermelha e peixes. Ela é armazenada nos músculos na forma de **fosfocreatina**, servindo como reserva de energia rápida.

## Benefícios comprovados:

- **Aumento de força e potência**: Melhora a performance em exercícios de alta intensidade e curta duração.
- **Ganho de massa muscular**: Auxilia na volumização celular e na síntese proteica.
- **Recuperação mais rápida**: Reduz marcadores de dano muscular pós-treino.
- **Benefícios cognitivos**: Estudos mostram melhora na memória e função cerebral.
- **Segurança comprovada**: Centenas de estudos confirmam sua segurança a longo prazo.

## Como tomar Creatina?

### Protocolo simples (recomendado):

- **Dose**: 3 a 5 gramas por dia, todos os dias.
- **Horário**: Pode ser tomada a qualquer momento do dia. A consistência é mais importante que o horário.
- **Com o quê**: Misture com água, suco ou junto com seu shake de proteína.

### Fase de saturação (opcional):

- 20g/dia divididos em 4 doses de 5g, por 5 a 7 dias.
- Depois, manter com 3 a 5g/dia.

## Mitos desvendados:

- ❌ **"Creatina faz mal aos rins"** → Estudos com pessoas saudáveis não mostram danos renais.
- ❌ **"Precisa ciclar creatina"** → Não há necessidade de pausas no uso.
- ❌ **"Creatina causa retenção hídrica indesejada"** → A retenção ocorre dentro das células musculares, não subcutânea.

## Qual creatina escolher?

A **creatina monohidratada** é a mais estudada e com melhor custo-benefício. Outras formas (HCL, micronizada) não demonstram superioridade significativa nos estudos.

Na Horen, trabalhamos com creatina monohidratada de alta pureza, testada em laboratório e registrada na Anvisa.
    `,
  },
  {
    id: "whey-protein-como-usar",
    title: "Whey Protein: Guia Completo de Uso e Benefícios",
    excerpt:
      "Entenda os diferentes tipos de whey, quando tomar e como ele pode acelerar seus resultados na academia.",
    readTime: "6 min",
    date: "10 Mar 2026",
    category: "Suplementação",
    content: `
O Whey Protein é o suplemento proteico mais popular do mundo, e por boas razões. Rico em aminoácidos essenciais e de rápida absorção, ele é uma ferramenta poderosa para quem busca ganho muscular, recuperação e praticidade na dieta.

## O que é Whey Protein?

O Whey é a proteína extraída do soro do leite durante o processo de fabricação do queijo. Ele passa por processos de filtragem que resultam em diferentes tipos:

### Tipos de Whey:

- **Whey Concentrado (WPC)**: 70-80% de proteína. Melhor custo-benefício, contém pequenas quantidades de gordura e lactose.
- **Whey Isolado (WPI)**: 90%+ de proteína. Menos gordura e lactose, ideal para intolerantes.
- **Whey Hidrolisado (WPH)**: Pré-digerido para absorção ultrarrápida. Mais caro, indicado para situações específicas.

## Benefícios do Whey Protein:

- **Alto valor biológico**: Contém todos os aminoácidos essenciais em proporções ideais.
- **Rica em BCAAs**: Especialmente leucina, o principal aminoácido para síntese proteica.
- **Absorção rápida**: Ideal para o pós-treino, quando o corpo mais precisa de nutrientes.
- **Praticidade**: Uma forma rápida e saborosa de atingir suas metas proteicas diárias.
- **Saciedade**: Ajuda no controle do apetite em dietas de emagrecimento.

## Como e quando tomar?

### Pós-treino (momento clássico):
- 1 a 2 scoops (25-50g de proteína) com água ou leite.
- Pode adicionar frutas, aveia ou pasta de amendoim.

### Café da manhã:
- Ótima opção para começar o dia com proteína de qualidade.

### Lanches intermediários:
- Shake rápido entre as refeições para manter o aporte proteico.

### Antes de dormir:
- Pode ser combinado com caseína ou alimentos de digestão lenta.

## Quanta proteína por dia?

Para praticantes de musculação, a recomendação é de **1.6 a 2.2g de proteína por kg de peso corporal por dia**. O whey entra como complemento à alimentação, não como substituto de refeições.

## Dicas importantes:

1. **Whey não substitui comida de verdade** — use como complemento.
2. **A qualidade importa** — escolha marcas com laudos de pureza.
3. **Consistência > timing** — mais importante que o horário é bater a meta diária de proteína.

Na Horen, nosso Whey Protein passa por rigorosos testes de qualidade, garantindo a concentração proteica informada no rótulo.
    `,
  },
];

const Blog = () => {
  const navigate = useNavigate();
  const [selectedArticle, setSelectedArticle] = useState<string | null>(null);

  const article = articles.find((a) => a.id === selectedArticle);

  if (article) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <CartDrawer />
        <main className="pt-20">
          <div className="container mx-auto px-6 py-12 max-w-3xl">
            <button
              onClick={() => setSelectedArticle(null)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8 font-body"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar ao blog
            </button>

            <motion.article
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <span className="text-xs font-body tracking-[0.2em] uppercase text-primary mb-3 block">
                {article.category}
              </span>
              <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-4">
                {article.title}
              </h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground font-body mb-10">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  {article.date}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  {article.readTime} de leitura
                </span>
              </div>

              <div className="prose prose-invert prose-sm md:prose-base max-w-none font-body 
                prose-headings:font-heading prose-headings:text-foreground 
                prose-p:text-foreground/80 prose-li:text-foreground/80
                prose-strong:text-primary prose-a:text-primary
                prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
                prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
                prose-ul:space-y-1 prose-ol:space-y-1">
                {article.content.split("\n").map((line, i) => {
                  const trimmed = line.trim();
                  if (!trimmed) return null;
                  if (trimmed.startsWith("## "))
                    return (
                      <h2 key={i} className="font-heading text-2xl font-bold text-foreground mt-10 mb-4">
                        {trimmed.replace("## ", "")}
                      </h2>
                    );
                  if (trimmed.startsWith("### "))
                    return (
                      <h3 key={i} className="font-heading text-lg font-semibold text-foreground mt-6 mb-3">
                        {trimmed.replace("### ", "")}
                      </h3>
                    );
                  if (trimmed.startsWith("- "))
                    return (
                      <li key={i} className="text-foreground/80 ml-4 list-disc">
                        <span
                          dangerouslySetInnerHTML={{
                            __html: trimmed
                              .replace("- ", "")
                              .replace(/\*\*(.*?)\*\*/g, '<strong class="text-primary">$1</strong>')
                              .replace(/❌/g, "❌"),
                          }}
                        />
                      </li>
                    );
                  if (/^\d+\./.test(trimmed))
                    return (
                      <li key={i} className="text-foreground/80 ml-4 list-decimal">
                        <span
                          dangerouslySetInnerHTML={{
                            __html: trimmed
                              .replace(/^\d+\.\s*/, "")
                              .replace(/\*\*(.*?)\*\*/g, '<strong class="text-primary">$1</strong>'),
                          }}
                        />
                      </li>
                    );
                  return (
                    <p
                      key={i}
                      className="text-foreground/80 leading-relaxed mb-4"
                      dangerouslySetInnerHTML={{
                        __html: trimmed.replace(
                          /\*\*(.*?)\*\*/g,
                          '<strong class="text-primary">$1</strong>'
                        ),
                      }}
                    />
                  );
                })}
              </div>
            </motion.article>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <CartDrawer />
      <main className="pt-20">
        <div className="container mx-auto px-6 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <span className="text-xs font-body tracking-[0.3em] uppercase text-primary mb-3 block">
              Blog
            </span>
            <h1 className="font-heading text-3xl md:text-5xl font-bold text-foreground">
              Conteúdo & Conhecimento
            </h1>
            <p className="text-muted-foreground font-body mt-4 max-w-lg mx-auto">
              Artigos sobre saúde, suplementação e performance para você alcançar seus objetivos.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {articles.map((a, index) => (
              <motion.button
                key={a.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => setSelectedArticle(a.id)}
                className="text-left group"
              >
                <div className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/30 transition-all duration-300 h-full flex flex-col">
                  <div className="h-2 bg-primary/20 group-hover:bg-primary/40 transition-colors" />
                  <div className="p-6 flex flex-col flex-1">
                    <span className="text-[10px] font-body tracking-[0.2em] uppercase text-primary mb-3">
                      {a.category}
                    </span>
                    <h2 className="font-heading text-lg font-bold text-foreground mb-3 group-hover:text-primary transition-colors">
                      {a.title}
                    </h2>
                    <p className="text-sm text-muted-foreground font-body leading-relaxed mb-4 flex-1">
                      {a.excerpt}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground font-body">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {a.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {a.readTime}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Blog;
