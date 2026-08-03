import Link from "next/link";
import { ArrowLeft, CheckCircle2, MousePointerClick, ShieldCheck } from "lucide-react";

export default async function SponsorPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const alreadyUsed = params.status === "already-used";
  const clickId = typeof params.clickId === "string" ? params.clickId : "";

  return (
    <main className="landing-shell">
      <Link className="back-link" href="/">
        <ArrowLeft size={16} /> Return to AdMon
      </Link>
      <section className="landing-content">
        <div className="landing-mark" aria-hidden="true">
          {alreadyUsed ? <ShieldCheck size={28} /> : <MousePointerClick size={28} />}
        </div>
        <p className="eyebrow">Controlled advertiser destination</p>
        <h1>{alreadyUsed ? "This click was already recorded" : "Click receipt recorded"}</h1>
        <p className="landing-copy">
          {alreadyUsed
            ? "The same AdMon link cannot create a second redirect receipt or reward."
            : "This safe landing page stands in for an advertiser site. Return to the agent to watch the reward move from recorded to finalized."}
        </p>
        <div className="receipt-line">
          <CheckCircle2 size={16} />
          <span>Click ID</span>
          <code>{clickId ? `${clickId.slice(0, 14)}…${clickId.slice(-8)}` : "Unavailable"}</code>
        </div>
        <p className="probe-disclosure">
          Local risk-probe mode. The production redirect will submit this receipt to
          the deployed Monad settlement contract before redirecting.
        </p>
      </section>
    </main>
  );
}
