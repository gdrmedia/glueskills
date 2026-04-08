"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type SchemaType = "Article" | "FAQ" | "Product" | "LocalBusiness" | "Event";

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export default function SchemaGeneratorPage() {
  const [type, setType] = useState<SchemaType>("Article");
  const [copied, setCopied] = useState(false);

  // Article
  const [articleTitle, setArticleTitle] = useState("");
  const [articleAuthor, setArticleAuthor] = useState("");
  const [articleDate, setArticleDate] = useState("");
  const [articleImage, setArticleImage] = useState("");
  const [articleDesc, setArticleDesc] = useState("");

  // FAQ
  const [faqs, setFaqs] = useState<FaqItem[]>([
    { id: "1", question: "", answer: "" },
  ]);

  // Product
  const [prodName, setProdName] = useState("");
  const [prodDesc, setProdDesc] = useState("");
  const [prodPrice, setProdPrice] = useState("");
  const [prodCurrency, setProdCurrency] = useState("USD");
  const [prodImage, setProdImage] = useState("");
  const [prodBrand, setProdBrand] = useState("");

  // LocalBusiness
  const [bizName, setBizName] = useState("");
  const [bizAddress, setBizAddress] = useState("");
  const [bizPhone, setBizPhone] = useState("");
  const [bizUrl, setBizUrl] = useState("");

  // Event
  const [eventName, setEventName] = useState("");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventDesc, setEventDesc] = useState("");

  const schema = useMemo(() => {
    switch (type) {
      case "Article":
        return {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: articleTitle || undefined,
          author: articleAuthor ? { "@type": "Person", name: articleAuthor } : undefined,
          datePublished: articleDate || undefined,
          image: articleImage || undefined,
          description: articleDesc || undefined,
        };
      case "FAQ":
        return {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs
            .filter((f) => f.question && f.answer)
            .map((f) => ({
              "@type": "Question",
              name: f.question,
              acceptedAnswer: { "@type": "Answer", text: f.answer },
            })),
        };
      case "Product":
        return {
          "@context": "https://schema.org",
          "@type": "Product",
          name: prodName || undefined,
          description: prodDesc || undefined,
          image: prodImage || undefined,
          brand: prodBrand ? { "@type": "Brand", name: prodBrand } : undefined,
          offers: {
            "@type": "Offer",
            price: prodPrice || undefined,
            priceCurrency: prodCurrency,
          },
        };
      case "LocalBusiness":
        return {
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          name: bizName || undefined,
          address: bizAddress || undefined,
          telephone: bizPhone || undefined,
          url: bizUrl || undefined,
        };
      case "Event":
        return {
          "@context": "https://schema.org",
          "@type": "Event",
          name: eventName || undefined,
          startDate: eventStart || undefined,
          endDate: eventEnd || undefined,
          location: eventLocation
            ? { "@type": "Place", name: eventLocation }
            : undefined,
          description: eventDesc || undefined,
        };
    }
  }, [type, articleTitle, articleAuthor, articleDate, articleImage, articleDesc, faqs, prodName, prodDesc, prodPrice, prodCurrency, prodImage, prodBrand, bizName, bizAddress, bizPhone, bizUrl, eventName, eventStart, eventEnd, eventLocation, eventDesc]);

  const jsonLd = JSON.stringify(schema, null, 2);
  const scriptTag = `<script type="application/ld+json">\n${jsonLd}\n</script>`;

  function handleCopy() {
    navigator.clipboard.writeText(scriptTag);
    setCopied(true);
    toast.success("Schema copied");
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Schema Markup Generator</h1>

      <div className="flex flex-wrap gap-2">
        {(["Article", "FAQ", "Product", "LocalBusiness", "Event"] as SchemaType[]).map((t) => (
          <Badge
            key={t}
            variant={type === t ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setType(t)}
          >
            {t}
          </Badge>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{type} Fields</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {type === "Article" && (
              <>
                <div className="space-y-1"><Label className="text-xs">Headline</Label><Input value={articleTitle} onChange={(e) => setArticleTitle(e.target.value)} placeholder="Article title" /></div>
                <div className="space-y-1"><Label className="text-xs">Author</Label><Input value={articleAuthor} onChange={(e) => setArticleAuthor(e.target.value)} placeholder="Author name" /></div>
                <div className="space-y-1"><Label className="text-xs">Date Published</Label><Input type="date" value={articleDate} onChange={(e) => setArticleDate(e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">Image URL</Label><Input value={articleImage} onChange={(e) => setArticleImage(e.target.value)} placeholder="https://..." /></div>
                <div className="space-y-1"><Label className="text-xs">Description</Label><Textarea value={articleDesc} onChange={(e) => setArticleDesc(e.target.value)} placeholder="Brief description" className="min-h-[60px]" /></div>
              </>
            )}

            {type === "FAQ" && (
              <>
                {faqs.map((faq, i) => (
                  <div key={faq.id} className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Q{i + 1}</span>
                      {faqs.length > 1 && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFaqs((f) => f.filter((x) => x.id !== faq.id))}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <Input value={faq.question} onChange={(e) => setFaqs((f) => f.map((x) => x.id === faq.id ? { ...x, question: e.target.value } : x))} placeholder="Question" />
                    <Textarea value={faq.answer} onChange={(e) => setFaqs((f) => f.map((x) => x.id === faq.id ? { ...x, answer: e.target.value } : x))} placeholder="Answer" className="min-h-[60px]" />
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setFaqs((f) => [...f, { id: crypto.randomUUID(), question: "", answer: "" }])}>
                  <Plus className="mr-1 h-3 w-3" /> Add Question
                </Button>
              </>
            )}

            {type === "Product" && (
              <>
                <div className="space-y-1"><Label className="text-xs">Product Name</Label><Input value={prodName} onChange={(e) => setProdName(e.target.value)} placeholder="Product name" /></div>
                <div className="space-y-1"><Label className="text-xs">Brand</Label><Input value={prodBrand} onChange={(e) => setProdBrand(e.target.value)} placeholder="Brand name" /></div>
                <div className="space-y-1"><Label className="text-xs">Description</Label><Textarea value={prodDesc} onChange={(e) => setProdDesc(e.target.value)} placeholder="Product description" className="min-h-[60px]" /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><Label className="text-xs">Price</Label><Input type="number" value={prodPrice} onChange={(e) => setProdPrice(e.target.value)} placeholder="29.99" /></div>
                  <div className="space-y-1"><Label className="text-xs">Currency</Label><Input value={prodCurrency} onChange={(e) => setProdCurrency(e.target.value)} placeholder="USD" /></div>
                </div>
                <div className="space-y-1"><Label className="text-xs">Image URL</Label><Input value={prodImage} onChange={(e) => setProdImage(e.target.value)} placeholder="https://..." /></div>
              </>
            )}

            {type === "LocalBusiness" && (
              <>
                <div className="space-y-1"><Label className="text-xs">Business Name</Label><Input value={bizName} onChange={(e) => setBizName(e.target.value)} placeholder="Business name" /></div>
                <div className="space-y-1"><Label className="text-xs">Address</Label><Input value={bizAddress} onChange={(e) => setBizAddress(e.target.value)} placeholder="123 Main St, City, State" /></div>
                <div className="space-y-1"><Label className="text-xs">Phone</Label><Input value={bizPhone} onChange={(e) => setBizPhone(e.target.value)} placeholder="+1-555-123-4567" /></div>
                <div className="space-y-1"><Label className="text-xs">Website</Label><Input value={bizUrl} onChange={(e) => setBizUrl(e.target.value)} placeholder="https://..." /></div>
              </>
            )}

            {type === "Event" && (
              <>
                <div className="space-y-1"><Label className="text-xs">Event Name</Label><Input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Event name" /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1"><Label className="text-xs">Start Date</Label><Input type="datetime-local" value={eventStart} onChange={(e) => setEventStart(e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">End Date</Label><Input type="datetime-local" value={eventEnd} onChange={(e) => setEventEnd(e.target.value)} /></div>
                </div>
                <div className="space-y-1"><Label className="text-xs">Location</Label><Input value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} placeholder="Venue name" /></div>
                <div className="space-y-1"><Label className="text-xs">Description</Label><Textarea value={eventDesc} onChange={(e) => setEventDesc(e.target.value)} placeholder="Event description" className="min-h-[60px]" /></div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Generated JSON-LD</CardTitle>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
              Copy
            </Button>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-lg bg-muted/50 p-4 text-xs leading-relaxed font-mono">
              {scriptTag}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
