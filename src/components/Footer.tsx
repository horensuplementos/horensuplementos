import { Instagram, Mail, Phone } from "lucide-react";
import logo from "@/assets/horen-logo-transparent.png";
import { useSiteSection } from "@/contexts/SiteContentContext";
import { getSectionText, getSectionItems } from "@/lib/siteContent";

type FooterItem = { type?: string; label?: string; href?: string };

const Footer = () => {
  const { section } = useSiteSection("footer");
  const text = getSectionText(section, {
    description:
      "Suplementos premium para quem leva saúde e performance a sério. Qualidade, confiança e resultados reais.",
  });
  const fallbackContacts: FooterItem[] = [
    { type: "email", label: "sitehorensuplementos@gmail.com", href: "mailto:sitehorensuplementos@gmail.com" },
    { type: "phone", label: "(11) 99999-9999", href: "tel:+5511999999999" },
    { type: "instagram", label: "@horensuplementos", href: "https://www.instagram.com/horensuplementos/" },
  ];
  const contacts = getSectionItems<FooterItem>(section, fallbackContacts);

  const iconFor = (type?: string) => {
    if (type === "phone") return Phone;
    if (type === "instagram") return Instagram;
    return Mail;
  };

  return (
    <footer id="contato" className="bg-background border-t border-border">
      <div className="container mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div>
            <img src={logo} alt="Horen" className="h-7 w-auto mb-4" />
            <p className="text-sm text-muted-foreground font-body leading-relaxed max-w-xs">
              {text.description}
            </p>
          </div>

          <div>
            <h3 className="font-heading font-semibold text-foreground mb-4">Links</h3>
            <nav className="space-y-3">
              {["Início", "Produtos", "Sobre", "Contato"].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`}
                  className="block text-sm text-muted-foreground hover:text-primary transition-colors font-body"
                >
                  {item}
                </a>
              ))}
            </nav>
          </div>

          <div>
            <h3 className="font-heading font-semibold text-foreground mb-4">Contato</h3>
            <div className="space-y-3">
              {contacts.map((item, idx) => {
                const Icon = iconFor(item.type);
                const external = item.type === "instagram";
                return (
                  <a
                    key={`${item.label}-${idx}`}
                    href={item.href || "#"}
                    target={external ? "_blank" : undefined}
                    rel={external ? "noopener noreferrer" : undefined}
                    className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors font-body"
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        <div className="border-t border-border mt-12 pt-8 text-center">
          <p className="text-xs text-muted-foreground font-body">
            © 2026 Horen®. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
