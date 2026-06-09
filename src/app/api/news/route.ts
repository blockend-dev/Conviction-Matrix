import { NextResponse } from "next/server";
import { getNewsFeed } from "@/lib/sosovalue/client";
import { mockNews } from "@/lib/sosovalue/mock";

export const dynamic = "force-dynamic";

const USE_MOCK = !process.env.SOSOVALUE_API_KEY || process.env.SOSOVALUE_API_KEY === "your_sosovalue_api_key_here";

export async function GET() {
  if (USE_MOCK) {
    return NextResponse.json({ news: mockNews, source: "mock" });
  }
  try {
    const news = await getNewsFeed(30);
    return NextResponse.json({ news, source: "live" });
  } catch {
    return NextResponse.json({ news: mockNews, source: "mock" });
  }
}
