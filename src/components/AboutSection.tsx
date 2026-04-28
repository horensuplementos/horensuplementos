import { motion } from "framer-motion";
import { Shield, FlaskConical, Award, TrendingUp } from "lucide-react";
import { useSiteSection } from "@/contexts/SiteContentContext";
import { getSectionText, getSectionItems } from "@/lib/siteContent";

const iconList = [Shield, FlaskConical, Award, TrendingUp];

const fallbackValues = [
  {
    title: "Confiança",
    description: "Todos os nossos produtos são registrados na Anvisa e testados em laboratório.",
  },
  {
    title: "Qualidade",
    description: "Matéria prima selecionada e formulações eficientes para resultados reais.",
  },
  {
    title: "Premium",
    description: "Posicionamento premium com padrão de excelência em cada produto.",
  },
  {
    title: "Performance",
    description: "Desenvolvidos para quem busca evolução física e melhora contínua.",
  },
];

const AboutSection = () => {
  const { section } = useSiteSection("about_section");
  const text = getSectionText(section, {
    subtitle: "Sobre a Horen",
    title: "Excelência em cada detalhe",
    description:
      "A Horen é uma marca de creatina de alta qualidade, com matéria prima selecionada e formulações eficientes testadas para ganho de resultados. Produtos para todas as pessoas que buscam uma melhora no estilo de vida.",
  });
  const values = getSectionItems<{ title: string; description: string }>(section, fallbackValues);

  return (
    <section id="sobre" className="py-24 md:py-32 bg-card">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-sm font-body tracking-[0.3em] uppercase text-muted-foreground mb-4">{text.subtitle}</p>
          <h2 className="font-heading text-4xl md:text-5xl font-bold text-foreground mb-6">
            {text.title}
          </h2>
          <p className="text-muted-foreground font-body max-w-2xl mx-auto text-base leading-relaxed">
            {text.description}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {values.map((item, index) => {
            const Icon = iconList[index % iconList.length];
            return (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="text-center p-8 rounded-2xl bg-secondary border border-border"
            >
              <Icon className="w-8 h-8 text-primary mx-auto mb-4" />
              <h3 className="font-heading text-lg font-semibold text-foreground mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground font-body leading-relaxed">{item.description}</p>
            </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
