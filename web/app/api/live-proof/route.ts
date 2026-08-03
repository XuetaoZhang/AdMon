import { NextResponse } from "next/server";
import { readLiveProof } from "@/lib/live-proof";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await readLiveProof());
  } catch (error) {
    return NextResponse.json(
      {
        status: "unavailable",
        error: error instanceof Error ? error.message : "Live proof unavailable."
      },
      { status: 503 }
    );
  }
}
