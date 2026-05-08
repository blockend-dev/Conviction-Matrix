import { NextResponse } from "next/server";
import { computeAllSectors } from "@/lib/conviction/engine";
import { generateAllNarratives } from "@/lib/claude";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const signals = await computeAllSectors();
    const withNarratives = process.env.ANTHROPIC_API_KEY
      ? await generateAllNarratives(signals)
      : signals;

    return NextResponse.json({ signals: withNarratives, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("Conviction engine error:", err);
    return NextResponse.json({ error: "Engine failed", detail: String(err) }, { status: 500 });
  }
}
