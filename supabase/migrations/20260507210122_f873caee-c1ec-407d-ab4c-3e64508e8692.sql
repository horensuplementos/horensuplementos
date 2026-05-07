INSERT INTO public.site_content_sections (section_key, title, subtitle, description, cta_label, cta_link, items, active)
VALUES (
  'calculators_section',
  'Calculadoras',
  'Ferramentas Horen',
  'Acompanhe seu consumo e seu metabolismo com precisão. Ferramentas pensadas para quem leva resultados a sério.',
  'Ver produtos Horen',
  '/#produtos',
  '[
    {
      "kind": "creatina",
      "title": "Duração da Creatina",
      "subtitle": "Estime quanto tempo seu pote dura",
      "label_grams": "Dose diária (g)",
      "label_stock": "Quantidade no pote (g)",
      "label_start": "Data de início",
      "default_grams": "5",
      "default_stock": "300",
      "result_pre": "Vai durar",
      "result_suffix": "dias",
      "result_end_label": "Previsão de término:"
    },
    {
      "kind": "tmb",
      "title": "Taxa Metabólica Basal",
      "subtitle": "Fórmula de Mifflin-St Jeor",
      "label_sex": "Sexo",
      "label_male": "Masculino",
      "label_female": "Feminino",
      "label_weight": "Peso (kg)",
      "label_height": "Altura (cm)",
      "label_age": "Idade",
      "label_activity": "Nível de atividade",
      "opt_sedentary": "Sedentário",
      "opt_light": "Levemente ativo (1-3x/sem)",
      "opt_moderate": "Moderado (3-5x/sem)",
      "opt_active": "Muito ativo (6-7x/sem)",
      "opt_extreme": "Extremamente ativo",
      "result_pre": "Sua TMB",
      "result_suffix": "kcal/dia",
      "result_total_label": "Gasto total estimado:"
    }
  ]'::jsonb,
  true
)
ON CONFLICT (section_key) DO NOTHING;