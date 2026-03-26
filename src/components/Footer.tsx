import { Instagram, Mail, Phone } from "lucide-react";
import logo from "@/assets/horen-logo-azul.jpg";

const Footer = () => {
  return (
    <footer id="contato" className="bg-card border-t border-border">
      <div className="container mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div>
            <img src={logo} alt="Horen" className="h-8 w-auto mb-4" />
            <p className="text-sm text-muted-foreground font-body leading-relaxed max-w-xs">
              Suplementos premium para quem leva saúde e performance a sério.
              Qualidade, confiança e resultados reais.
            </p>
          </div>

          <div>
            <h3 className="font-heading font-semibold text-foreground mb-4">Links</h3>
            <nav className="space-y-3">
              {["Início", "Produtos", "Sobre", "Contato"].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`}
                  className="block text-sm text-muted-foreground hover:text-foreground transition-colors font-body"
                >
                  {item}
                </a>
              ))}
            </nav>
          </div>

          <div>
            <h3 className="font-heading font-semibold text-foreground mb-4">Contato</h3>
            <div className="space-y-3">
              <a
                href="mailto:contato@horen.com.br"
                className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors font-body"
              >
                <Mail className="w-4 h-4" />
                contato@horen.com.br
              </a>
              <a
                href="tel:+5511999999999"
                className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors font-body"
              >
                <Phone className="w-4 h-4" />
                (11) 99999-9999
              </a>
              <a
                href="https://instagram.com/horen"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors font-body"
              >
                <Instagram className="w-4 h-4" />
                @horen
              </a>
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
