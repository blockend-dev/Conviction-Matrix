import { NextRequest, NextResponse } from "next/server";

const SODEX_BASE = process.env.SODEX_BASE_URL ?? "https://api.sodex.com";
const SODEX_KEY  = process.env.SODEX_API_KEY ?? "";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { market, side, orderType, size, price, signature, sender, nonce, expiry } = body;

  if (!market || !side || !size || !signature || !sender) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const res = await fetch(`${SODEX_BASE}/v1/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": SODEX_KEY,
      },
      body: JSON.stringify({ market, side, orderType, size, price, signature, sender, nonce, expiry }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: "SoDEX rejected order", detail: errText }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: "SoDEX unreachable", detail: String(err) }, { status: 502 });
  }
}
