import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Calculator, Calendar as CalendarIcon, Flame, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useSiteSection } from "@/contexts/SiteContentContext";
import { getSectionItems, getSectionText } from "@/lib/siteContent";

const Calculators = () => {
  const navigate = useNavigate();
  const { section } = useSiteSection("calculators_section");
  const text = getSectionText(section, {
    title: "Calculadoras",
    subtitle: "Ferramentas Horen",
    description: "Acompanhe seu consumo e seu metabolismo com precisão. Ferramentas pensadas para quem leva resultados a sério.",
    cta_label: "Ver produtos Horen",
    cta_link: "/#produtos",
  });
  const items = getSectionItems<any>(section, []);
  const creatinaCfg = items.find((i) => i?.kind === "creatina") || {};
  const tmbCfg = items.find((i) => i?.kind === "tmb") || {};
  const ctaSize = (creatinaCfg.cta_size || "lg") as "sm" | "default" | "lg";

  // Creatina
  const [grams, setGrams] = useState<string>(creatinaCfg.default_grams || "5");
  const [stock, setStock] = useState<string>(creatinaCfg.default_stock || "300");
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0, 10));

  const creatinaResult = useMemo(() => {
    const g = parseFloat(grams);
    const s = parseFloat(stock);
    if (!g || !s || g <= 0 || s <= 0) return null;
    const days = Math.floor(s / g);
    const end = new Date(startDate);
    end.setDate(end.getDate() + days);
    return { days, endDate: end.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) };
  }, [grams, stock, startDate]);

  // TMB
  const [sex, setSex] = useState<"M" | "F">("M");
  const [weight, setWeight] = useState<string>("70");
  const [height, setHeight] = useState<string>("170");
  const [age, setAge] = useState<string>("25");
  const [activity, setActivity] = useState<string>("1.55");

  const tmbResult = useMemo(() => {
    const w = parseFloat(weight);
    const h = parseFloat(height);
    const a = parseFloat(age);
    const f = parseFloat(activity);
    if (!w || !h || !a) return null;
    // Mifflin-St Jeor
    const tmb = sex === "M"
      ? 10 * w + 6.25 * h - 5 * a + 5
      : 10 * w + 6.25 * h - 5 * a - 161;
    return { tmb: Math.round(tmb), gasto: Math.round(tmb * f) };
  }, [sex, weight, height, age, activity]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <CartDrawer />
      <div className="pt-28 pb-20">
        <div className="container mx-auto px-6 max-w-5xl">
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar ao início
          </button>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-body font-medium mb-4">
              <Calculator className="w-3.5 h-3.5" /> {text.subtitle}
            </div>
            <h1 className="font-heading text-4xl md:text-5xl font-bold text-foreground mb-3">
              {text.title}
            </h1>
            <p className="font-body text-muted-foreground max-w-2xl">
              {text.description}
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Creatina */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-card border border-border rounded-2xl p-8 shadow-sm"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <CalendarIcon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-heading text-xl font-bold text-foreground">{creatinaCfg.title || "Duração da Creatina"}</h2>
                  <p className="text-xs text-muted-foreground font-body">{creatinaCfg.subtitle || "Estime quanto tempo seu pote dura"}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="grams">{creatinaCfg.label_grams || "Dose diária (g)"}</Label>
                  <Input id="grams" type="number" min="0" step="0.5" value={grams} onChange={(e) => setGrams(e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="stock">{creatinaCfg.label_stock || "Quantidade no pote (g)"}</Label>
                  <Input id="stock" type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="start">{creatinaCfg.label_start || "Data de início"}</Label>
                  <Input id="start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1.5" />
                </div>

                {creatinaResult && (
                  <div className="mt-6 p-5 rounded-xl bg-primary/5 border border-primary/20">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-body mb-1">{creatinaCfg.result_pre || "Vai durar"}</p>
                    <p className="font-heading text-3xl font-bold text-primary">{creatinaResult.days} {creatinaCfg.result_suffix || "dias"}</p>
                    <p className="text-sm text-foreground font-body mt-2">
                      {creatinaCfg.result_end_label || "Previsão de término:"} <span className="font-semibold">{creatinaResult.endDate}</span>
                    </p>
                  </div>
                )}
              </div>
            </motion.section>

            {/* TMB */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-card border border-border rounded-2xl p-8 shadow-sm"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Flame className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-heading text-xl font-bold text-foreground">{tmbCfg.title || "Taxa Metabólica Basal"}</h2>
                  <p className="text-xs text-muted-foreground font-body">{tmbCfg.subtitle || "Fórmula de Mifflin-St Jeor"}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>{tmbCfg.label_sex || "Sexo"}</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1.5">
                    {(["M", "F"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSex(s)}
                        className={`h-10 rounded-md border text-sm font-body font-medium transition-colors ${
                          sex === s ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input hover:bg-secondary"
                        }`}
                      >
                        {s === "M" ? (tmbCfg.label_male || "Masculino") : (tmbCfg.label_female || "Feminino")}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="w">{tmbCfg.label_weight || "Peso (kg)"}</Label>
                    <Input id="w" type="number" value={weight} onChange={(e) => setWeight(e.target.value)} className="mt-1.5" />
                  </div>
                  <div>
                    <Label htmlFor="h">{tmbCfg.label_height || "Altura (cm)"}</Label>
                    <Input id="h" type="number" value={height} onChange={(e) => setHeight(e.target.value)} className="mt-1.5" />
                  </div>
                  <div>
                    <Label htmlFor="a">{tmbCfg.label_age || "Idade"}</Label>
                    <Input id="a" type="number" value={age} onChange={(e) => setAge(e.target.value)} className="mt-1.5" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="act">{tmbCfg.label_activity || "Nível de atividade"}</Label>
                  <select
                    id="act"
                    value={activity}
                    onChange={(e) => setActivity(e.target.value)}
                    className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="1.2">{tmbCfg.opt_sedentary || "Sedentário"}</option>
                    <option value="1.375">{tmbCfg.opt_light || "Levemente ativo (1-3x/sem)"}</option>
                    <option value="1.55">{tmbCfg.opt_moderate || "Moderado (3-5x/sem)"}</option>
                    <option value="1.725">{tmbCfg.opt_active || "Muito ativo (6-7x/sem)"}</option>
                    <option value="1.9">{tmbCfg.opt_extreme || "Extremamente ativo"}</option>
                  </select>
                </div>

                {tmbResult && (
                  <div className="mt-6 p-5 rounded-xl bg-primary/5 border border-primary/20">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-body mb-1">{tmbCfg.result_pre || "Sua TMB"}</p>
                    <p className="font-heading text-3xl font-bold text-primary">{tmbResult.tmb} {tmbCfg.result_suffix || "kcal/dia"}</p>
                    <p className="text-sm text-foreground font-body mt-2">
                      {tmbCfg.result_total_label || "Gasto total estimado:"} <span className="font-semibold">{tmbResult.gasto} {tmbCfg.result_suffix || "kcal/dia"}</span>
                    </p>
                  </div>
                )}
              </div>
            </motion.section>
          </div>

          <div className="mt-12 text-center">
            <Button onClick={() => navigate(text.cta_link || "/#produtos")} size={ctaSize}>
              {text.cta_label || "Ver produtos Horen"}
            </Button>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Calculators;
