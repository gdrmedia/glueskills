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

  try {
    const res = await fetch(targetUrl, {
      headers: {
        "User-Agent": "GlueSkills SEO Scraper/1.0",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch: ${res.status} ${res.statusText}` },
        { status: 400 }
      );
    }

    const html = await res.text();

    // Parse meta tags and headings from HTML
    const getTag = (name: string) => {
      const match = html.match(
        new RegExp(`<meta[^>]*(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, "i")
      ) || html.match(
        new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`, "i")
      );
      return match?.[1] ?? null;
    };

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch?.[1]?.trim() ?? null;

    const headingRegex = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
    const headings: { tag: string; text: string }[] = [];
    let m;
    while ((m = headingRegex.exec(html)) !== null) {
      headings.push({
        tag: m[1].toLowerCase(),
        text: m[2].replace(/<[^>]*>/g, "").trim(),
      });
    }

    // Count links
    const internalLinks = (html.match(/href=["'][^"']*["']/gi) || []).length;

    // Count images and find missing alt
    const imgRegex = /<img[^>]*>/gi;
    const images: { src: string; alt: string }[] = [];
    let imgMatch;
    while ((imgMatch = imgRegex.exec(html)) !== null) {
      const srcMatch = imgMatch[0].match(/src=["']([^"']*)["']/i);
      const altMatch = imgMatch[0].match(/alt=["']([^"']*)["']/i);
      images.push({
        src: srcMatch?.[1] ?? "",
        alt: altMatch?.[1] ?? "",
      });
    }

    const canonical = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i)?.[1] ?? null;

    return NextResponse.json({
      url: targetUrl,
      title,
      metaDescription: getTag("description"),
      ogTitle: getTag("og:title"),
      ogDescription: getTag("og:description"),
      ogImage: getTag("og:image"),
      twitterCard: getTag("twitter:card"),
      twitterTitle: getTag("twitter:title"),
      canonical,
      headings: headings.slice(0, 50),
      linkCount: internalLinks,
      imageCount: images.length,
      imagesWithoutAlt: images.filter((i) => !i.alt).length,
      htmlSize: Math.round(html.length / 1024),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to scrape";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
