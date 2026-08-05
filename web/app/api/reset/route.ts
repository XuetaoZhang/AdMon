import { NextResponse } from "next/server";
import { z } from "zod";
import { resetClick } from "@/lib/click-store";

const resetSchema = z.object({ clickId: z.string().min(1) });

export async function POST(request: Request) {
  const parsed = resetSchema.safeParse(await request.json());
  if (parsed.success) await resetClick(parsed.data.clickId);
  return NextResponse.json({ reset: parsed.success });
}
