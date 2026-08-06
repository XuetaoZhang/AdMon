import { NextResponse } from "next/server";
import { ensurePostgresSchema, getPostgresPool } from "@/lib/postgres";
import { listCampaigns } from "@/lib/product-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const database = getPostgresPool();
  if (!database && process.env.VERCEL) {
    return NextResponse.json(
      { status: "degraded", storage: "local", error: "DATABASE_URL is not configured." },
      { status: 503 }
    );
  }

  if (database) {
    try {
      await ensurePostgresSchema();
      await database.query("SELECT 1");
      const campaigns = await listCampaigns();
      return NextResponse.json({ status: "ok", storage: "postgres", campaigns: campaigns.length });
    } catch (error) {
      console.error("AdMon database health check failed.", error);
      return NextResponse.json({ status: "degraded", storage: "postgres" }, { status: 503 });
    }
  }

  return NextResponse.json({
    status: "ok",
    storage: database ? "postgres" : "local",
    campaigns: 0
  });
}
