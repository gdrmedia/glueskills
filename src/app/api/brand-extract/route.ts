import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { url } = await req.json();

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  let targetUrl = url;
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = `https://${targetUrl}`;
  }

  try {
    new URL(targetUrl);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const origin = new URL(targetUrl).origin;

  try {
    const res = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; GlueSkills/1.0; +https://glueskills.com)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch: ${res.status} ${res.statusText}` },
        { status: 400 }
      );
    }

    const html = await res.text();

    // --- Collect all CSS (inline + external stylesheets) ---
    const styleBlocks = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
    const inlineStyles = html.match(/style=["'][^"']*["']/gi) || [];
    let cssText = [...styleBlocks, ...inlineStyles].join("\n");

    // Fetch linked stylesheets for font and color extraction
    const linkRegex =
      /<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi;
    const linkRegex2 =
      /<link[^>]*href=["']([^"']+)["'][^>]*rel=["']stylesheet["']/gi;
    const cssUrls = new Set<string>();
    let linkMatch;
    while ((linkMatch = linkRegex.exec(html)) !== null) {
      cssUrls.add(resolveUrl(linkMatch[1], origin));
    }
    while ((linkMatch = linkRegex2.exec(html)) !== null) {
      cssUrls.add(resolveUrl(linkMatch[1], origin));
    }

    // Fetch up to 10 external stylesheets (skip massive CDN bundles)
    const cssFetches = [...cssUrls].slice(0, 10).map(async (cssUrl) => {
      try {
        const cssRes = await fetch(cssUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; GlueSkills/1.0)" },
          signal: AbortSignal.timeout(5000),
        });
        if (cssRes.ok) {
          const text = await cssRes.text();
          // Only use first 500KB to avoid processing huge bundles
          return text.slice(0, 512_000);
        }
      } catch {
        // Skip failed stylesheets
      }
      return "";
    });
    const externalCss = await Promise.all(cssFetches);
    cssText += "\n" + externalCss.join("\n");

    // --- Logos / Icons ---
    const logos: { type: string; url: string }[] = [];

    // Extract all <link> tags into individual strings for safe per-tag matching
    const linkTags = html.match(/<link[^>]*>/gi) || [];

    for (const tag of linkTags) {
      const rel = tag.match(/rel=["']([^"']+)["']/i)?.[1]?.toLowerCase() ?? "";
      const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
      if (!href) continue;

      if (rel.includes("apple-touch-icon")) {
        logos.push({ type: "Apple Touch Icon", url: resolveUrl(href, origin) });
      } else if (rel === "icon" || rel === "shortcut icon") {
        logos.push({ type: "Favicon", url: resolveUrl(href, origin) });
      }
    }

    // OG image
    const ogImage = getMetaContent(html, "og:image");
    if (ogImage) logos.push({ type: "OG Image", url: resolveUrl(ogImage, origin) });

    // Images with "logo" in src URL path
    const imgSrcRegex = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
    let imgMatch;
    while ((imgMatch = imgSrcRegex.exec(html)) !== null) {
      if (/logo/i.test(imgMatch[1])) {
        logos.push({ type: "Logo (from URL)", url: resolveUrl(imgMatch[1], origin) });
      }
    }

    // Images with "logo" in class or id (NOT alt — alt text often describes logos in unrelated hero images)
    const imgLogoAttrRegex =
      /<img[^>]*(?:class|id)=["'][^"']*logo[^"']*["'][^>]*>/gi;
    let logoAttrMatch;
    while ((logoAttrMatch = imgLogoAttrRegex.exec(html)) !== null) {
      const srcInner = logoAttrMatch[0].match(/src=["']([^"']+)["']/i);
      if (srcInner) {
        logos.push({ type: "Logo (detected)", url: resolveUrl(srcInner[1], origin) });
      }
    }

    // Links/anchors with "logo" class wrapping images
    const logoLinkRegex =
      /<a[^>]*class=["'][^"']*logo[^"']*["'][^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["'][^>]*>[\s\S]*?<\/a>/gi;
    let logoLinkMatch;
    while ((logoLinkMatch = logoLinkRegex.exec(html)) !== null) {
      logos.push({ type: "Logo (linked)", url: resolveUrl(logoLinkMatch[1], origin) });
    }

    // First image inside <header> (often the logo)
    const headerMatch = html.match(
      /<header[^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["'][^>]*>/i
    );
    if (headerMatch) {
      logos.push({ type: "Header Image", url: resolveUrl(headerMatch[1], origin) });
    }

    // Manifest icon
    const manifestTag = linkTags.find((t) =>
      /rel=["']manifest["']/i.test(t)
    );
    const manifestHref = manifestTag?.match(/href=["']([^"']+)["']/i)?.[1];
    if (manifestHref) {
      try {
        const manifestUrl = resolveUrl(manifestHref, origin);
        const manifestRes = await fetch(manifestUrl, {
          signal: AbortSignal.timeout(3000),
        });
        if (manifestRes.ok) {
          const manifest = await manifestRes.json();
          if (manifest.icons && Array.isArray(manifest.icons)) {
            const sorted = manifest.icons.sort((a: { sizes?: string }, b: { sizes?: string }) => {
              const sizeA = parseInt(a.sizes?.split("x")[0] || "0");
              const sizeB = parseInt(b.sizes?.split("x")[0] || "0");
              return sizeB - sizeA;
            });
            if (sorted[0]?.src) {
              logos.push({
                type: "Manifest Icon",
                url: resolveUrl(sorted[0].src, origin),
              });
            }
          }
        }
      } catch {
        // Skip manifest errors
      }
    }

    // Default favicon fallback
    if (logos.length === 0) {
      logos.push({ type: "Default Favicon", url: `${origin}/favicon.ico` });
    }

    // --- Colors ---
    const colors = new Set<string>();

    // Theme color meta
    const themeColor = getMetaContent(html, "theme-color");
    if (themeColor) colors.add(themeColor.toLowerCase());

    // MS tile color
    const msColor = getMetaContent(html, "msapplication-TileColor");
    if (msColor) colors.add(msColor.toLowerCase());

    // Hex colors from all CSS
    const hexRegex = /#(?:[0-9a-f]{3,4}){1,2}\b/gi;
    const hexMatches = cssText.match(hexRegex) || [];
    for (const hex of hexMatches) {
      colors.add(hex.toLowerCase());
    }

    // RGB/HSL colors
    const rgbRegex =
      /(?:rgba?|hsla?)\(\s*[\d.]+[%,\s]+[\d.]+[%,\s]+[\d.]+[%,\s]*[\d.]*\s*\)/gi;
    const rgbMatches = cssText.match(rgbRegex) || [];
    for (const c of rgbMatches) {
      colors.add(c.replace(/\s+/g, " ").toLowerCase());
    }

    // CSS custom properties that look like brand colors
    const cssVarRegex = /--[\w-]*(?:color|brand|primary|secondary|accent)[\w-]*:\s*([^;]+)/gi;
    let cssVarMatch;
    while ((cssVarMatch = cssVarRegex.exec(cssText)) !== null) {
      const val = cssVarMatch[1].trim().toLowerCase();
      if (val && !val.startsWith("var(")) colors.add(val);
    }

    // Filter out common non-brand colors
    const trivialColors = new Set([
      "#fff", "#ffffff", "#000", "#000000", "#333", "#333333",
      "#666", "#666666", "#999", "#999999", "#ccc", "#cccccc",
      "#eee", "#eeeeee", "#f5f5f5", "#fafafa", "#ddd", "#dddddd",
      "#f0f0f0", "#e5e5e5", "#d4d4d4", "#a3a3a3", "#737373",
      "#525252", "#404040", "#262626", "#171717",
      "transparent", "inherit", "currentcolor",
    ]);
    const filteredColors = [...colors].filter((c) => !trivialColors.has(c));

    // --- Fonts ---
    const fonts = new Set<string>();

    // Google Fonts from <link> tags
    const gfRegex = /fonts\.googleapis\.com\/css2?\?[^"'\s>)]+/gi;
    const gfMatches = html.match(gfRegex) || [];
    for (const gfUrl of gfMatches) {
      const familyMatches = gfUrl.match(/family=([^&"')\s]+)/gi) || [];
      for (const fm of familyMatches) {
        const families = fm
          .replace("family=", "")
          .split("|")
          .map((f) => decodeURIComponent(f).split(":")[0].replace(/\+/g, " "));
        for (const f of families) fonts.add(f);
      }
    }

    // Google Fonts from @import in CSS
    const gfImportRegex = /fonts\.googleapis\.com\/css2?\?[^"'\s)]+/gi;
    const gfImportMatches = cssText.match(gfImportRegex) || [];
    for (const gfUrl of gfImportMatches) {
      const familyMatches = gfUrl.match(/family=([^&"')\s]+)/gi) || [];
      for (const fm of familyMatches) {
        const families = fm
          .replace("family=", "")
          .split("|")
          .map((f) => decodeURIComponent(f).split(":")[0].replace(/\+/g, " "));
        for (const f of families) fonts.add(f);
      }
    }

    // Adobe Fonts (Typekit)
    const typekitRegex = /use\.typekit\.net\/([a-z0-9]+)\.css/gi;
    if (typekitRegex.test(html) || typekitRegex.test(cssText)) {
      // We can't resolve Typekit font names without JS execution,
      // but we can flag it
      fonts.add("(Adobe Fonts / Typekit detected)");
    }

    // @font-face declarations from all CSS
    const fontFaceRegex =
      /@font-face\s*\{[^}]*font-family:\s*["']?([^"';}\n]+)["']?/gi;
    let ffaceMatch;
    while ((ffaceMatch = fontFaceRegex.exec(cssText)) !== null) {
      const name = ffaceMatch[1].trim();
      if (name && !isGenericFont(name)) fonts.add(name);
    }
    // Also search in raw HTML (for inline @font-face)
    while ((ffaceMatch = fontFaceRegex.exec(html)) !== null) {
      const name = ffaceMatch[1].trim();
      if (name && !isGenericFont(name)) fonts.add(name);
    }

    // font-family declarations from all CSS
    const fontFamilyRegex = /font-family:\s*([^;}"]+)/gi;
    let ffMatch;
    while ((ffMatch = fontFamilyRegex.exec(cssText)) !== null) {
      const families = ffMatch[1].split(",").map((f) =>
        f.trim().replace(/^["']|["']$/g, "")
      );
      for (const f of families) {
        if (f && !isGenericFont(f)) fonts.add(f);
      }
    }

    // --- Brand meta ---
    const title =
      html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? null;
    const description = getMetaContent(html, "description");
    const ogSiteName = getMetaContent(html, "og:site_name");

    return NextResponse.json({
      url: targetUrl,
      siteName: ogSiteName || title,
      description,
      logos: dedupeByUrl(logos),
      colors: filteredColors.slice(0, 30),
      fonts: [...fonts].slice(0, 20),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to extract";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function getMetaContent(html: string, name: string): string | null {
  const match =
    html.match(
      new RegExp(
        `<meta[^>]*(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`,
        "i"
      )
    ) ||
    html.match(
      new RegExp(
        `<meta[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`,
        "i"
      )
    );
  return match?.[1] ?? null;
}

function resolveUrl(href: string, origin: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("/")) return `${origin}${href}`;
  return `${origin}/${href}`;
}

function isGenericFont(f: string): boolean {
  const generics = new Set([
    "serif", "sans-serif", "monospace", "cursive", "fantasy",
    "system-ui", "ui-serif", "ui-sans-serif", "ui-monospace", "ui-rounded",
    "emoji", "math", "fangsong", "inherit", "initial", "unset",
  ]);
  return generics.has(f.toLowerCase());
}

function dedupeByUrl(
  logos: { type: string; url: string }[]
): { type: string; url: string }[] {
  const seen = new Set<string>();
  return logos.filter((l) => {
    if (seen.has(l.url)) return false;
    seen.add(l.url);
    return true;
  });
}
