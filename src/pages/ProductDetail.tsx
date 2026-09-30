import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCart, type CartProduct } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Package, ShoppingBag, Minus, Plus, Truck } from "lucide-react";
import Header from "@/components/Header";
import CartDrawer from "@/components/CartDrawer";
import Footer from "@/components/Footer";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products">;
type FaqItem = { q: string; a: string };

const formatPrice = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const getImages = (product: Product) => {
  const gallery = Array.isArray(product.image_urls) ? product.image_urls.filter(Boolean) : [];
  return gallery.length ? gallery : product.image_url ? [product.image_url] : [];
};

const getBenefits = (product: Product) => {
  if (Array.isArray(product.ai_benefits)) {
    const benefits = product.ai_benefits.filter((item): item is string => typeof item === "string" && !!item.trim());
    if (benefits.length) return benefits;
  }
  return product.benefits_input?.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean) || [];
};

const getFaq = (product: Product): FaqItem[] =>
  Array.isArray(product.ai_faq)
    ? product.ai_faq.filter((item): item is FaqItem =>
        !!item && typeof item === "object" && !Array.isArray(item) &&
        typeof item.q === "string" && !!item.q.trim() &&
        typeof item.a === "string" && !!item.a.trim())
    : [];

const toCartProduct = (product: Product): CartProduct => ({
  id: product.id, name: product.name, price: product.price,
  image_url: getImages(product)[0] || null, weight: product.weight,
  category: product.category, stock: product.stock,
});

const ProductDetail = () => {
  const { id } = useParams();
  const { addItem, items } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "not-found" | "error">("loading");
  const [qty, setQty] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setProduct(null);
    setRelatedProducts([]);
    setQty(1);
    setSelectedImage(0);
    if (!id) { setStatus("not-found"); return; }

    const loadProduct = async () => {
      const { data, error } = await supabase.from("products").select("*").eq("id", id).eq("active", true).maybeSingle();
      if (cancelled) return;
      if (error) { setStatus("error"); return; }
      if (!data) { setStatus("not-found"); return; }
      setProduct(data);
      setStatus("ready");
      if (data.category) {
        const { data: related } = await supabase.from("products").select("*")
          .eq("active", true).eq("category", data.category).neq("id", data.id).limit(4);
        if (!cancelled) setRelatedProducts(related || []);
      }
    };
    void loadProduct();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!product) return;
    const previousTitle = document.title;
    document.title = `${product.name} | Horen Suplementos`;
    return () => { document.title = previousTitle; };
  }, [product]);

  if (status === "loading") return <div className="min-h-screen bg-background flex items-center justify-center" role="status" aria-label="Carregando produto"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  if (status !== "ready" || !product) return <div className="min-h-screen bg-background">
    <Header /><CartDrawer />
    <main className="container mx-auto flex min-h-[65vh] flex-col items-center justify-center px-6 pt-20 text-center">
      <Package className="mb-5 h-12 w-12 text-muted-foreground/40" />
      <h1 className="font-heading text-2xl font-bold">{status === "error" ? "Não foi possível carregar o produto" : "Produto não encontrado"}</h1>
      <p className="mt-2 text-muted-foreground">{status === "error" ? "Tente novamente em instantes." : "Ele pode ter sido removido ou não estar disponível."}</p>
      <Button asChild variant="outline" className="mt-6"><Link to="/#produtos">Ver produtos</Link></Button>
    </main><Footer />
  </div>;

  const images = getImages(product);
  const activeImage = images[selectedImage] || images[0];
  const benefits = getBenefits(product);
  const faq = getFaq(product);
  const longDescription = product.ai_description_long?.trim() || product.description?.trim();
  const shortDescription = product.ai_description_short?.trim();
  const inCart = items.find((item) => item.product.id === product.id)?.quantity || 0;
  const availableToAdd = Math.max(0, product.stock - inCart);
  const selectedQty = Math.min(qty, availableToAdd);
  const showPreviousImage = () => setSelectedImage((index) => (index - 1 + images.length) % images.length);
  const showNextImage = () => setSelectedImage((index) => (index + 1) % images.length);

  return <div className="min-h-screen bg-background">
    <Header /><CartDrawer />
    <main className="pt-20"><div className="container mx-auto px-6 py-10 md:py-14">
      <nav aria-label="Navegação do produto" className="mb-8 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link to="/" className="inline-flex items-center gap-2 transition-colors hover:text-primary"><ArrowLeft className="h-4 w-4" /> Início</Link><span aria-hidden="true">/</span>
        <Link to="/#produtos" className="transition-colors hover:text-primary">Produtos</Link><span aria-hidden="true">/</span>
        <span className="max-w-[16rem] truncate text-foreground" aria-current="page">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-14">
        <div>
          <div className="relative aspect-square overflow-hidden rounded-2xl bg-secondary">
            {activeImage ? <img src={activeImage} alt={`${product.name} — imagem ${selectedImage + 1} de ${images.length}`} className="h-full w-full object-cover" />
              : <div className="flex h-full w-full items-center justify-center"><ShoppingBag className="h-24 w-24 text-muted-foreground/20" /></div>}
            {images.length > 1 && <>
              <button type="button" onClick={showPreviousImage} aria-label="Imagem anterior" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-background/90 p-2 text-foreground shadow-sm hover:bg-background"><ChevronLeft className="h-5 w-5" /></button>
              <button type="button" onClick={showNextImage} aria-label="Próxima imagem" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-background/90 p-2 text-foreground shadow-sm hover:bg-background"><ChevronRight className="h-5 w-5" /></button>
              <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-background/90 px-3 py-1 text-xs font-medium text-foreground">{selectedImage + 1} / {images.length}</span>
            </>}
          </div>
          {images.length > 1 && <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-6">{images.map((image, index) => <button key={`${image}-${index}`} type="button" onClick={() => setSelectedImage(index)} aria-label={`Ver imagem ${index + 1}`} aria-current={index === selectedImage ? "true" : undefined} className={`aspect-square overflow-hidden rounded-lg border transition-colors ${index === selectedImage ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/50"}`}><img src={image} alt="" loading="lazy" className="h-full w-full object-cover" /></button>)}</div>}
        </div>

        <div className="flex flex-col justify-center">
          {product.category && <span className="mb-2 text-sm font-body tracking-wider uppercase text-primary">{product.category}</span>}
          <h1 className="mb-3 font-heading text-3xl font-bold text-foreground md:text-4xl">{product.name}</h1>
          {(product.brand || product.weight || product.flavor) && <div className="mb-5 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {product.brand && <span>{product.brand}</span>}{product.weight && <span>{product.weight}</span>}{product.flavor && <span>Sabor: {product.flavor}</span>}
          </div>}
          {shortDescription && <p className="mb-5 leading-relaxed text-muted-foreground">{shortDescription}</p>}
          <p className="mb-2 font-heading text-3xl font-bold text-primary">{formatPrice(product.price)}</p>
          <p className="mb-7 text-xs text-muted-foreground">Frete e prazo calculados no checkout.</p>
          {product.stock > 0 ? <div className="space-y-4">
            <p className="text-sm font-medium text-foreground">{availableToAdd > 0 ? `${product.stock} em estoque` : "Todas as unidades disponíveis já estão no carrinho"}</p>
            {availableToAdd > 0 && <><div className="flex items-center gap-4"><div className="flex items-center rounded-xl border border-border">
              <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} disabled={qty <= 1} aria-label="Diminuir quantidade" className="flex h-11 w-11 items-center justify-center rounded-l-xl transition-colors hover:bg-muted disabled:opacity-40"><Minus className="h-4 w-4" /></button>
              <span className="w-8 text-center font-heading font-semibold" aria-live="polite">{selectedQty}</span>
              <button type="button" onClick={() => setQty(Math.min(availableToAdd, qty + 1))} disabled={selectedQty >= availableToAdd} aria-label="Aumentar quantidade" className="flex h-11 w-11 items-center justify-center rounded-r-xl transition-colors hover:bg-muted disabled:opacity-40"><Plus className="h-4 w-4" /></button>
            </div><span className="text-sm text-muted-foreground">Máximo {availableToAdd} para adicionar</span></div>
              <Button onClick={() => addItem(toCartProduct(product), selectedQty)} className="h-14 w-full gap-2 rounded-xl font-heading text-base font-semibold"><ShoppingBag className="h-5 w-5" /> Adicionar ao carrinho</Button>
            </>}
          </div> : <div className="rounded-xl bg-destructive/10 p-4 text-center font-semibold text-destructive">Produto esgotado</div>}
          <div className="mt-7 grid gap-3 border-t border-border pt-6 text-sm text-muted-foreground sm:grid-cols-2">
            <p className="flex items-center gap-2"><Truck className="h-4 w-4 shrink-0 text-primary" /> Entrega ou retirada conforme disponibilidade no checkout</p>
            <p className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-primary" /> Pagamento finalizado em ambiente seguro</p>
          </div>
        </div>
      </div>

      {(longDescription || benefits.length > 0 || product.ingredients || faq.length > 0) && <section className="mt-16 border-t border-border pt-12" aria-labelledby="product-information">
        <h2 id="product-information" className="mb-7 font-heading text-2xl font-bold text-foreground">Conheça o produto</h2>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"><div className="space-y-9">
          {longDescription && <div><h3 className="mb-3 font-heading text-lg font-semibold">Descrição</h3><div className="space-y-3 leading-relaxed text-muted-foreground">{longDescription.split(/\n+/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div></div>}
          {benefits.length > 0 && <div><h3 className="mb-4 font-heading text-lg font-semibold">Benefícios informados</h3><ul className="grid gap-3 sm:grid-cols-2">{benefits.map((benefit, index) => <li key={`${benefit}-${index}`} className="flex gap-3 rounded-xl border border-border bg-card p-4 text-sm leading-relaxed text-muted-foreground"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{benefit}</li>)}</ul></div>}
        </div>
          {(product.ingredients || product.weight || product.flavor || product.brand) && <aside className="h-fit rounded-2xl border border-border bg-card p-6"><h3 className="mb-4 font-heading text-lg font-semibold">Informações do produto</h3><dl className="space-y-4 text-sm">
            {product.brand && <div><dt className="font-medium text-foreground">Marca</dt><dd className="mt-1 text-muted-foreground">{product.brand}</dd></div>}
            {product.weight && <div><dt className="font-medium text-foreground">Apresentação</dt><dd className="mt-1 text-muted-foreground">{product.weight}</dd></div>}
            {product.flavor && <div><dt className="font-medium text-foreground">Sabor</dt><dd className="mt-1 text-muted-foreground">{product.flavor}</dd></div>}
            {product.ingredients && <div><dt className="font-medium text-foreground">Ingredientes</dt><dd className="mt-1 whitespace-pre-line leading-relaxed text-muted-foreground">{product.ingredients}</dd></div>}
          </dl></aside>}
        </div>
        {faq.length > 0 && <div className="mt-12 max-w-3xl"><h3 className="mb-4 font-heading text-lg font-semibold">Perguntas frequentes</h3><Accordion type="single" collapsible className="rounded-2xl border border-border bg-card px-5">{faq.map((item, index) => <AccordionItem key={`${item.q}-${index}`} value={`faq-${index}`}><AccordionTrigger className="text-left font-body">{item.q}</AccordionTrigger><AccordionContent className="whitespace-pre-line leading-relaxed text-muted-foreground">{item.a}</AccordionContent></AccordionItem>)}</Accordion></div>}
      </section>}

      {relatedProducts.length > 0 && <section className="mt-16 border-t border-border pt-12" aria-labelledby="related-products"><h2 id="related-products" className="mb-6 font-heading text-2xl font-bold">Você também pode gostar</h2><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{relatedProducts.map((related) => <Link key={related.id} to={`/produto/${related.id}`} className="group overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/40"><div className="aspect-square overflow-hidden bg-secondary">{getImages(related)[0] ? <img src={getImages(related)[0]} alt={related.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center"><ShoppingBag className="h-12 w-12 text-muted-foreground/20" /></div>}</div><div className="p-4"><h3 className="font-heading font-semibold text-foreground group-hover:text-primary">{related.name}</h3><p className="mt-2 font-heading font-bold text-primary">{formatPrice(related.price)}</p></div></Link>)}</div></section>}
    </div></main><Footer />
  </div>;
};

export default ProductDetail;
