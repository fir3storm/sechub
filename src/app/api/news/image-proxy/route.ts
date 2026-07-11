import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAllowedImageUrl } from "@/lib/news/article-images";

const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 10_000;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawUrl = req.nextUrl.searchParams.get("url");
  if (!rawUrl || !isAllowedImageUrl(rawUrl)) {
    return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(rawUrl, {
      signal: controller.signal,
      headers: {
        Accept: "image/*",
        "User-Agent": "SecHub/1.0 Image Proxy",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Upstream fetch failed" }, { status: 502 });
    }

    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Not an image" }, { status: 415 });
    }

    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "Image too large" }, { status: 413 });
    }

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return NextResponse.json({ error: "Image fetch failed" }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
