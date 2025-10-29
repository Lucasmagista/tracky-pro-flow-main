import { Package, Mail, MapPin, Phone } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-smooth">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                RastreioInteligente
              </span>
            </Link>
            <p className="text-sm text-muted-foreground">
              Rastreamento inteligente de pedidos para lojas online.
            </p>
          </div>

          {/* Product */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Produto</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="#funcionalidades" className="hover:text-foreground transition-smooth">
                  Funcionalidades
                </a>
              </li>
              <li>
                <a href="#planos" className="hover:text-foreground transition-smooth">
                  Planos e Preços
                </a>
              </li>
              <li>
                <Link to="/dashboard" className="hover:text-foreground transition-smooth">
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Suporte</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="#" className="hover:text-foreground transition-smooth">
                  Documentação
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-smooth">
                  API
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-foreground transition-smooth">
                  Central de Ajuda
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Contato</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span>contato@rastreio.com</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <span>(11) 9999-9999</span>
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>São Paulo, SP</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t text-center text-sm text-muted-foreground">
          <p>&copy; 2025 RastreioInteligente. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
