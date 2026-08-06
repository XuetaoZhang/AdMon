import { NextResponse } from "next/server";
import { z } from "zod";
import { getPublisherProfile, savePublisherProfile } from "@/lib/product-store";

const publisherSchema = z.object({
  name: z.string().trim().min(2).max(80),
  wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/)
});

export async function GET() {
  try {
    return NextResponse.json({ publisher: await getPublisherProfile() });
  } catch (error) {
    console.error("Unable to load AdMon publisher profile.", error);
    return NextResponse.json({ error: "Publisher service is unavailable." }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const parsed = publisherSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Publisher profile is invalid." }, { status: 400 });
  }
  try {
    return NextResponse.json({
      publisher: await savePublisherProfile({
        ...parsed.data,
        wallet: parsed.data.wallet as `0x${string}`
      })
    });
  } catch (error) {
    console.error("Unable to save AdMon publisher profile.", error);
    return NextResponse.json({ error: "Publisher service is unavailable." }, { status: 503 });
  }
}
