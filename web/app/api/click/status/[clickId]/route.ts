import { NextResponse } from "next/server";
import { getClickStatus } from "@/lib/click-store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ clickId: string }> }
) {
  const { clickId } = await context.params;
  return NextResponse.json(getClickStatus(clickId));
}
