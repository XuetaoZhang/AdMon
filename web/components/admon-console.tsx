"use client";

import {
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleDollarSign,
  ExternalLink,
  LoaderCircle,
  MousePointerClick,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  WalletCards,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AgentResponse, ClickStatus } from "@/lib/ad-types";

const promptOptions = [
  "Swap exactly 0.1 MON for USDC. Simulate first and do not send.",
  "How should my Monad agent track a click through finality?",
  "Prepare a safe wallet action and explain what I will sign."
];

const demoWallet = "0x1111111111111111111111111111111111111111";

const initialStatus: ClickStatus = {
  clickId: "",
  state: "ready",
  claimableMon: "0",
  mode: "local-probe"
};

export function AdMonConsole() {
  const [prompt, setPrompt] = useState(promptOptions[0]);
  const [wallet, setWallet] = useState(demoWallet);
  const [response, setResponse] = useState<AgentResponse | null>(null);
  const [status, setStatus] = useState<ClickStatus>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState(false);

  const shortWallet = useMemo(
    () => `${wallet.slice(0, 6)}…${wallet.slice(-4)}`,
    [wallet]
  );

  useEffect(() => {
    if (
      !response ||
      status.state === "finalized" ||
      status.state === "claimed"
    ) return;
    const timer = window.setInterval(async () => {
      const result = await fetch(`/api/click/status/${response.offer.clickId}`);
      if (result.ok) setStatus(await result.json());
    }, 650);
    return () => window.clearInterval(timer);
  }, [response, status.state]);

  async function runAgent(nextPrompt = prompt) {
    setLoading(true);
    setError("");
    setDismissed(false);
    setStatus(initialStatus);
    try {
      const result = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: nextPrompt, userAddress: wallet })
      });
      const body = await result.json();
      if (!result.ok) throw new Error(body.error || "Agent request failed.");
      setResponse(body);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  async function claimReward() {
    if (!response) return;
    const result = await fetch("/api/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clickId: response.offer.clickId })
    });
    const body = await result.json();
    if (result.ok) setStatus(body);
    else setError(body.error);
  }

  async function resetDemo() {
    if (response) {
      await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clickId: response.offer.clickId })
      });
    }
    setResponse(null);
    setStatus(initialStatus);
    setDismissed(false);
    setError("");
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">AM</div>
          <div>
            <strong>AdMon</strong>
            <span>Agent advertising, settled on Monad</span>
          </div>
        </div>
        <div className="topbar-actions">
          <span className="network-pill">
            <span className="network-dot" /> Local probe
          </span>
          <button className="icon-button" onClick={resetDemo} title="Reset demo" type="button">
            <RefreshCw size={17} />
          </button>
        </div>
      </header>

      <div className="workspace">
        <section className="agent-pane">
          <div className="pane-heading">
            <div>
              <p className="eyebrow">Publisher reference integration</p>
              <h1>Moss-powered Onchain Agent</h1>
            </div>
            <div className="wallet-control">
              <WalletCards size={16} />
              <input
                aria-label="Reward wallet address"
                onChange={(event) => setWallet(event.target.value)}
                spellCheck={false}
                value={wallet}
              />
              <span>{shortWallet}</span>
            </div>
          </div>

          <div className="quick-prompts" aria-label="Example prompts">
            {promptOptions.map((option) => (
              <button
                key={option}
                onClick={() => {
                  setPrompt(option);
                  void runAgent(option);
                }}
                type="button"
              >
                {option}
                <ChevronRight size={14} />
              </button>
            ))}
          </div>

          <div className="conversation" aria-live="polite">
            {!response && !loading ? (
              <div className="empty-state">
                <TerminalSquare size={26} />
                <h2>Inspect an onchain action</h2>
                <p>Preview an unsigned action. AdMon keeps sponsorship separate.</p>
              </div>
            ) : null}

            {loading ? (
              <div className="loading-row">
                <LoaderCircle className="spin" size={18} /> Moss is simulating the request
              </div>
            ) : null}

            {response ? (
              <>
                <div className="user-message">{response.prompt}</div>
                <article className="agent-answer">
                  <div className="answer-label">
                    <ShieldCheck size={16} /> Neutral action preview
                  </div>
                  <h2>{response.answer.heading}</h2>
                  <p>{response.answer.summary}</p>
                  <ul className="check-list">
                    {response.answer.checks.map((check) => (
                      <li key={check}>
                        <Check size={15} /> {check}
                      </li>
                    ))}
                  </ul>
                  <div className="receipt-block">
                    <div>
                      <span>Moss Receipt contract</span>
                      <span>Local fixture</span>
                    </div>
                    {response.answer.receipt.map((line) => (
                      <code key={line}>{line}</code>
                    ))}
                  </div>
                </article>

                {!dismissed ? (
                  <article className="ad-card">
                    <div className="ad-card-topline">
                      <span className="sponsored-label">
                        <Sparkles size={14} /> Sponsored
                      </span>
                      <button
                        className="dismiss-button"
                        onClick={() => setDismissed(true)}
                        title="Dismiss advertisement"
                        type="button"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="ad-card-body">
                      <div className="advertiser-mark">K</div>
                      <div>
                        <p className="advertiser-name">{response.offer.advertiser}</p>
                        <h3>{response.offer.title}</h3>
                        <p>{response.offer.description}</p>
                      </div>
                    </div>
                    <div className="ad-meta">
                      <span>{response.offer.domain}</span>
                      <span>{response.offer.reason}</span>
                    </div>
                    <div className="ad-action-row">
                      <div>
                        <span>User click reward</span>
                        <strong>+{response.offer.rewardMon} MON</strong>
                      </div>
                      <a href={response.offer.clickUrl} rel="noreferrer" target="_blank">
                        Visit sponsor <ExternalLink size={15} />
                      </a>
                    </div>
                    <p className="disclosure">{response.offer.disclosure}</p>
                  </article>
                ) : (
                  <button className="restore-ad" onClick={() => setDismissed(false)} type="button">
                    Show dismissed sponsored result
                  </button>
                )}
              </>
            ) : null}
          </div>

          {error ? <p className="error-banner">{error}</p> : null}

          <form
            className="composer"
            onSubmit={(event) => {
              event.preventDefault();
              void runAgent();
            }}
          >
            <input
              aria-label="Ask the onchain agent"
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Ask Moss to inspect a Monad action"
              value={prompt}
            />
            <button disabled={loading} title="Send" type="submit">
              <Send size={17} />
            </button>
          </form>
        </section>

        <aside className="evidence-pane">
          <div className="evidence-heading">
            <div>
              <p className="eyebrow">Monad evidence</p>
              <h2>Click settlement</h2>
            </div>
            <span>{status.mode === "local-probe" ? "Simulated source" : "Onchain"}</span>
          </div>

          <ol className="timeline">
            {[
              ["ready", "Offer issued"],
              ["recorded", "Click recorded"],
              ["proposed", "Settlement proposed"],
              ["finalized", "Reward finalized"],
              ["claimed", "Reward claimed"]
            ].map(([state, label], index) => {
              const states = ["ready", "recorded", "proposed", "finalized", "claimed"];
              const activeIndex = states.indexOf(status.state);
              const complete = index <= activeIndex;
              return (
                <li className={complete ? "complete" : ""} key={state}>
                  <span>{complete ? <Check size={13} /> : index + 1}</span>
                  <div>
                    <strong>{label}</strong>
                    <small>{state === status.state ? "Current state" : complete ? "Complete" : "Waiting"}</small>
                  </div>
                </li>
              );
            })}
          </ol>

          <dl className="evidence-list">
            <div>
              <dt>Campaign</dt>
              <dd>{response?.offer.campaignId ?? "—"}</dd>
            </div>
            <div>
              <dt>Click ID</dt>
              <dd>{response ? `${response.offer.clickId.slice(0, 10)}…` : "—"}</dd>
            </div>
            <div>
              <dt>Transaction</dt>
              <dd>{status.transactionHash ? `${status.transactionHash.slice(0, 10)}…` : "—"}</dd>
            </div>
            <div>
              <dt>Block</dt>
              <dd>{status.blockNumber ?? "—"}</dd>
            </div>
          </dl>

          <section className="revenue-split">
            <div className="section-title">
              <CircleDollarSign size={17} /> Revenue split
            </div>
            <div className="split-bar" aria-label="User 25%, publisher 60%, protocol 15%">
              <span className="user-split" />
              <span className="publisher-split" />
              <span className="protocol-split" />
            </div>
            <div className="split-legend">
              <span><i className="user-key" /> User <strong>25%</strong></span>
              <span><i className="publisher-key" /> Publisher <strong>60%</strong></span>
              <span><i className="protocol-key" /> Protocol <strong>15%</strong></span>
            </div>
          </section>

          <div className="claim-panel">
            <span>Claimable reward</span>
            <strong>{status.state === "claimed" ? "0" : status.claimableMon} MON</strong>
            <button
              disabled={status.state !== "finalized"}
              onClick={() => void claimReward()}
              type="button"
            >
              {status.state === "claimed" ? (
                <><Check size={16} /> Claimed</>
              ) : (
                <><MousePointerClick size={16} /> Claim reward</>
              )}
            </button>
          </div>

          <a className="integration-link" href="https://github.com/nishuzumi/moss" rel="noreferrer" target="_blank">
            Moss builds and simulates unsigned actions
            <ArrowUpRight size={15} />
          </a>
          <p className="mode-note">
            The action and settlement values are deterministic fixtures. Live Moss simulation and finalized Monad reads replace them after deployment.
          </p>
        </aside>
      </div>
    </main>
  );
}
