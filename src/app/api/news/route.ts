import { NextResponse } from "next/server";
import { getNewsFeed } from "@/lib/sosovalue/client";
import { mockNews } from "@/lib/sosovalue/mock";

const USE_MOCK = !process.env.SOSOVALUE_API_KEY || process.env.SOSOVALUE_API_KEY === "your_sosovalue_api_key_here";

export async function GET() {
  const news = USE_MOCK
    ? mockNews
    : await getNewsFeed(30).catch(() => mockNews);
  return NextResponse.json({ news });
}
