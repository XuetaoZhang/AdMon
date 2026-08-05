import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Check,
  CircleDollarSign,
  Code2,
  MousePointerClick,
  Network,
  ShieldCheck,
  WalletCards,
  Zap
} from "lucide-react";

export default function Home() {
  return (
    <main className="product-page">
      <section className="product-hero">
        <div className="hero-copy">
          <p className="hero-kicker">Advertising infrastructure for AI agents</p>
          <h1>AdMon</h1>
          <p className="hero-lede">
            Transparent sponsored results for agent applications, with every verified click
            split automatically between the user, publisher, and protocol on Monad.
          </p>
          <div className="hero-actions">
            <Link className="primary-action" href="/demo">
              Open live agent <ArrowRight size={16} />
            </Link>
            <Link className="text-action" href="/dashboard">
              Manage campaigns
            </Link>
          </div>
          <dl className="hero-facts">
            <div><dt>400ms</dt><dd>block time</dd></div>
            <div><dt>800ms</dt><dd>finality</dd></div>
            <div><dt>1 click</dt><dd>three direct payouts</dd></div>
          </dl>
        </div>

        <div className="hero-product" aria-label="AdMon product flow">
          <div className="hero-agent-window">
            <div className="window-bar"><span /><span /><span /><b>AdMon agent</b></div>
            <div className="agent-line user-line">Find a safe way to swap MON</div>
            <div className="agent-line answer-line">
              <ShieldCheck size={15} /> Route simulated. No transaction was sent.
            </div>
            <div className="hero-ad-card">
              <div className="hero-ad-label">Sponsored · Kuru</div>
              <strong>Compare a Monad-native liquidity venue</strong>
              <p>Independent offer · reward settles after a verified click</p>
              <div><span>+0.0025 MON</span><button type="button">Visit</button></div>
            </div>
          </div>
          <div className="settlement-rail">
            <div><MousePointerClick size={16} /><span>Verified click</span></div>
            <i />
            <div><Zap size={16} /><span>Monad settlement</span></div>
            <i />
            <div className="settlement-payouts">
              <span>User 25%</span><span>Publisher 60%</span><span>Protocol 15%</span>
            </div>
          </div>
        </div>
      </section>

      <section className="value-band">
        <div className="section-intro">
          <p className="eyebrow">A native agent advertising model</p>
          <h2>Attention becomes an auditable transaction.</h2>
        </div>
        <div className="value-grid">
          <article>
            <Bot size={20} />
            <h3>Useful agents stay useful</h3>
            <p>The publisher classifies a topic locally. AdMon receives no raw conversation.</p>
          </article>
          <article>
            <CircleDollarSign size={20} />
            <h3>Revenue reaches every participant</h3>
            <p>A single contract call sends the user, publisher, and protocol shares directly.</p>
          </article>
          <article>
            <Network size={20} />
            <h3>Built for agent-scale traffic</h3>
            <p>Sixteen budget shards reduce write contention across independent clicks.</p>
          </article>
        </div>
      </section>

      <section className="integration-band">
        <div className="integration-copy">
          <p className="eyebrow">One integration boundary</p>
          <h2>Publish through MCP. Render in any capable host.</h2>
          <p>
            AdMon returns structured campaign data and a Markdown fallback. Custom agent hosts can
            render a native card; Codex and Claude Code can consume the same MCP tool output.
          </p>
          <ul>
            <li><Check size={15} /> Publisher wallet configured once</li>
            <li><Check size={15} /> User reward address passed per request</li>
            <li><Check size={15} /> Signed, expiring, one-time click links</li>
          </ul>
          <Link className="text-action with-icon" href="/dashboard">
            Open integration settings <ArrowRight size={15} />
          </Link>
        </div>
        <div className="code-panel">
          <div className="code-panel-title"><Code2 size={15} /> MCP configuration</div>
          <pre>{`"admon": {
  "command": "node",
  "args": ["mcp-server/dist/cli.js"],
  "env": {
    "ADMON_API_URL": "https://your-admon.app",
    "ADMON_PUBLISHER_ADDRESS": "0x..."
  }
}`}</pre>
        </div>
      </section>

      <section className="monad-band">
        <div>
          <p className="eyebrow">Why Monad</p>
          <h2>Blockchain settlement that stays behind the product experience.</h2>
        </div>
        <div className="monad-points">
          <span><Zap size={17} /> Fast confirmation for live reward feedback</span>
          <span><WalletCards size={17} /> Native MON supports direct micro-payouts</span>
          <span><ShieldCheck size={17} /> Solidity and standard EVM tooling</span>
        </div>
      </section>
    </main>
  );
}
