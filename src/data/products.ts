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
  }
];
