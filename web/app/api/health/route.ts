import { NextResponse } from "next/server";
import { ensurePostgresSchema, getPostgresPool } from "@/lib/postgres";

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
    } catch (error) {
      console.error("AdMon database health check failed.", error);
      return NextResponse.json({ status: "degraded", storage: "postgres" }, { status: 503 });
    }
  }

  return NextResponse.json({
    status: "ok",
    storage: database ? "postgres" : "local"
  });
}
