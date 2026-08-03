import { NextResponse } from "next/server";
import { z } from "zod";
import { claimClick } from "@/lib/click-store";

const claimSchema = z.object({
  clickId: z.string().regex(/^0x[0-9a-f]{64}$/)
});

export async function POST(request: Request) {
  const parsed = claimSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid click ID." }, { status: 400 });
  }

  const click = claimClick(parsed.data.clickId);
  if (!click) {
    return NextResponse.json(
      { error: "The local reward is not finalized or has already been claimed." },
      { status: 409 }
    );
  }
  return NextResponse.json(click);
}
