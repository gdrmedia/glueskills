import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = new Set([
  "assets.onepagelove.com",
  "r2.siteinspire.com",
  "www.siteinspire.com",
  "codrops-1f606.kxcdn.com",
  "tympanus.net",
  "mir-s3-cdn-cf.behance.net",
  "www.awwwards.com",
  "awwwards.com",
  "www.behance.net",
]);

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new NextResponse("Invalid URL", { status: 400 });
  }

  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return new NextResponse("Host not allowed", { status: 403 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "GlueSkills/1.0",
        Accept: "image/*",
        Referer: parsed.origin + "/",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return new NextResponse("Upstream error", { status: 502 });
    }

    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
        "CDN-Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new NextResponse("Failed to fetch image", { status: 502 });
  }
}
