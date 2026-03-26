export interface Product {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  price: number;
  image: string;
  category: string;
  details: string[];
  weight: string;
}

export const products: Product[] = [
  {
    id: "whey-protein",
    name: "Whey Protein Isolado",
    subtitle: "Premium Isolate",
    description: "Proteína isolada de altíssima qualidade, com 27g de proteína por dose. Formulação pura, sem adição de açúcares, com absorção rápida para máxima recuperação muscular.",
    price: 289.90,
    image: "product-whey",
    category: "Proteínas",
    details: [
      "27g de proteína por dose",
      "Zero açúcar adicionado",
      "Absorção ultrarrápida",
      "Testado em laboratório",
      "Registrado na Anvisa"
    ],
    weight: "900g"
  },
  {
    id: "creatina",
    name: "Creatina Monohidratada",
    subtitle: "Pure Monohydrate",
    description: "Creatina monohidratada 100% pura, sem aditivos. Melhora a performance, aumenta a força e acelera a recuperação. Uso diário e contínuo para resultados reais.",
    price: 149.90,
    image: "product-creatina",
    category: "Performance",
    details: [
      "100% monohidratada pura",
      "5g por dose",
      "Sem aditivos ou conservantes",
      "Testado em laboratório",
      "Registrado na Anvisa"
    ],
    weight: "300g"
  },
  {
    id: "multivitaminico",
    name: "Multivitamínico Premium",
    subtitle: "Daily Essential",
    description: "Fórmula completa com vitaminas e minerais essenciais para o dia a dia. Suporte completo para saúde, imunidade e performance física.",
    price: 119.90,
    image: "product-multi",
    category: "Saúde",
    details: [
      "25 vitaminas e minerais",
      "1 cápsula por dia",
      "Fórmula biodisponível",
      "Testado em laboratório",
      "Registrado na Anvisa"
    ],
    weight: "60 cápsulas"
  }
];
