"use client";

import {
  Check,
  ChevronRight,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  WalletCards,
  X
} from "lucide-react";
import { useEffect, useState } from "react";
import type { AgentResponse, ClickStatus } from "@/lib/ad-types";

const promptOptions = [
  "Swap exactly 0.1 MON for USDC. Simulate first and do not send.",
  "Which Monad RPC is suitable for a latency-sensitive agent?",
  "Prepare a safe wallet action and explain what I will sign."
];

const defaultWallet = "0x6BD73C2f2ae05f638E4ec39a93AA27ac8ba2F5D6";
const initialStatus: ClickStatus = {
  clickId: "",
  state: "ready",
  paidMon: "0",
  mode: "monad-testnet"
};

export function AdMonConsole() {
  const [prompt, setPrompt] = useState(promptOptions[0]);
  const [wallet, setWallet] = useState(defaultWallet);
  const [response, setResponse] = useState<AgentResponse | null>(null);
  const [status, setStatus] = useState<ClickStatus>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!response || status.state === "paid" || status.chainError) return;
    const clickId = response.offer.clickId;
    let cancelled = false;
    let timer: number | undefined;
    async function poll() {
      const result = await fetch(`/api/click/status/${clickId}`, {
        cache: "no-store"
      });
      if (!cancelled && result.ok) setStatus(await result.json());
      if (!cancelled) timer = window.setTimeout(poll, 1_200);
    }
    void poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [response, status.state, status.chainError]);

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

  async function resetSession() {
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
            <span className="network-dot" /> Monad testnet
          </span>
          <button className="icon-button" onClick={resetSession} title="Reset session" type="button">
            <RefreshCw size={17} />
          </button>
        </div>
      </header>

      <div className="workspace">
        <section className="agent-pane">
          <div className="pane-heading">
            <div>
              <p className="eyebrow">Publisher console</p>
              <h1>Moss-powered Onchain Agent</h1>
            </div>
            <label className="wallet-control">
              <WalletCards size={16} />
              <span className="sr-only">Reward wallet address</span>
              <input
                aria-label="Reward wallet address"
                onChange={(event) => setWallet(event.target.value)}
                spellCheck={false}
                value={wallet}
              />
            </label>
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
                      <span>Moss action receipt</span>
                      <span>Unsigned preview</span>
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
                      <div className="advertiser-mark">{response.offer.advertiser.slice(0, 1)}</div>
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
                      {status.state === "paid" ? (
                        <span className="payout-confirmation">
                          <Check size={15} /> +{status.paidMon} MON sent
                        </span>
                      ) : status.state === "recorded" || status.state === "proposed" ? (
                        <span className="payout-confirmation">
                          <LoaderCircle className="spin" size={15} /> Sending reward
                        </span>
                      ) : (
                        <a
                          href={response.offer.clickUrl}
                          onClick={() =>
                            setStatus({
                              clickId: response.offer.clickId,
                              state: "recorded",
                              paidMon: "0",
                              mode: "monad-testnet"
                            })
                          }
                          rel="noreferrer"
                          target="_blank"
                        >
                          Visit sponsor <ExternalLink size={15} />
                        </a>
                      )}
                    </div>
                    {status.state === "recorded" || status.state === "proposed" ? (
                      <p className="settlement-note">
                        <LoaderCircle className="spin" size={13} /> Sending MON reward
                      </p>
                    ) : null}
                    {status.chainError ? (
                      <p className="settlement-error">Reward transfer is temporarily unavailable.</p>
                    ) : null}
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
      </div>
    </main>
  );
}
