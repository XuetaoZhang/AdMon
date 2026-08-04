import Link from "next/link";
import { ArrowLeft, ArrowUpRight, ShieldCheck, Sparkles } from "lucide-react";

export default async function SponsorPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const alreadyUsed = params.status === "already-used";

  return (
    <main className="landing-shell">
      <Link className="back-link" href="/">
        <ArrowLeft size={16} /> Return to AdMon
      </Link>
      <section className="landing-content">
        <div className="landing-mark" aria-hidden="true">
          {alreadyUsed ? <ShieldCheck size={28} /> : <Sparkles size={28} />}
        </div>
        <p className="eyebrow">Kuru · Monad-native liquidity</p>
        <h1>{alreadyUsed ? "Offer already redeemed" : "Trade with speed and clarity"}</h1>
        <p className="landing-copy">
          {alreadyUsed
            ? "This sponsored link has already delivered its one-time reward."
            : "Explore a liquidity venue designed for Monad. Compare markets, inspect routes, and review every action before you sign."}
        </p>
        {!alreadyUsed ? (
          <a className="landing-cta" href="https://www.kuru.io" rel="noreferrer" target="_blank">
            Explore Kuru <ArrowUpRight size={16} />
          </a>
        ) : null}
      </section>
    </main>
  );
}
