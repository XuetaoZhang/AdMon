"use client";

import {
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleDollarSign,
  ExternalLink,
  LoaderCircle,
  MousePointerClick,
  RadioTower,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  WalletCards,
  X
} from "lucide-react";
import { useEffect, useState } from "react";
import type { AgentResponse, ClickStatus, LiveProof } from "@/lib/ad-types";

const promptOptions = [
  "Swap exactly 0.1 MON for USDC. Simulate first and do not send.",
  "How should my Monad agent track a click through finality?",
  "Prepare a safe wallet action and explain what I will sign."
];

const defaultWallet = "0x1111111111111111111111111111111111111111";
const monadTestnetChainId = "0x279f";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

const initialStatus: ClickStatus = {
  clickId: "",
  state: "ready",
  claimableMon: "0",
  mode: "session-preview"
};

export function AdMonConsole() {
  const [prompt, setPrompt] = useState(promptOptions[0]);
  const [wallet, setWallet] = useState(defaultWallet);
  const [response, setResponse] = useState<AgentResponse | null>(null);
  const [status, setStatus] = useState<ClickStatus>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const [liveProof, setLiveProof] = useState<LiveProof | null>(null);
  const [liveProofUnavailable, setLiveProofUnavailable] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [claimSubmitting, setClaimSubmitting] = useState(false);

  const canClaim =
    status.mode === "monad-testnet" &&
    status.state === "finalized" &&
    !status.chainError;

  async function switchToMonadTestnet(provider: EthereumProvider): Promise<void> {
    const chainId = await provider.request({ method: "eth_chainId" });
    if (String(chainId).toLowerCase() === monadTestnetChainId) return;
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: monadTestnetChainId }]
      });
    } catch (switchError) {
      const code = (switchError as { code?: number }).code;
      if (code !== 4902) throw new Error("Switch the connected wallet to Monad testnet to continue.");
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: monadTestnetChainId,
            chainName: "Monad Testnet",
            nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
            rpcUrls: ["https://testnet-rpc.monad.xyz"],
            blockExplorerUrls: ["https://testnet.monadscan.com"]
          }
        ]
      });
    }
  }

  async function connectWallet() {
    const provider = window.ethereum;
    if (!provider) {
      setError("A browser wallet is required to claim MON. Install a wallet, then reconnect.");
      return;
    }
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const account = accounts[0];
      if (!account) throw new Error("The wallet did not return an account.");
      await switchToMonadTestnet(provider);
      if (response && account.toLowerCase() !== wallet.toLowerCase()) {
        throw new Error("This wallet does not match the reward address used for this offer. Run the request again with this wallet.");
      }
      setWallet(account);
      setWalletConnected(true);
      setError("");
    } catch (requestError) {
      setWalletConnected(false);
      setError(requestError instanceof Error ? requestError.message : "Wallet connection failed.");
    }
  }

  useEffect(() => {
    let active = true;
    async function loadLiveProof() {
      try {
        const result = await fetch("/api/live-proof", { cache: "no-store" });
        if (!result.ok) throw new Error("Live proof unavailable.");
        const body = (await result.json()) as LiveProof;
        if (active) setLiveProof(body);
      } catch {
        if (active) setLiveProofUnavailable(true);
      }
    }
    void loadLiveProof();
    return () => {
      active = false;
    };
  }, []);

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
    const provider = window.ethereum;
    if (!provider) {
      setError("A browser wallet is required to claim MON. Install a wallet, then reconnect.");
      return;
    }
    setClaimSubmitting(true);
    setError("");
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const account = accounts[0];
      if (!account || account.toLowerCase() !== wallet.toLowerCase()) {
        throw new Error("Connect the wallet that owns this reward address before claiming.");
      }
      await switchToMonadTestnet(provider);
      const prepare = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clickId: response.offer.clickId, userAddress: account })
      });
      const prepared = await prepare.json();
      if (!prepare.ok) throw new Error(prepared.error || "The reward is not ready to claim.");
      const gasLimit = BigInt(prepared.transaction.gasLimit).toString(16);
      const transactionHash = (await provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: account,
            to: prepared.transaction.to,
            data: prepared.transaction.data,
            gas: `0x${gasLimit}`
          }
        ]
      })) as string;
      const submitted = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clickId: response.offer.clickId,
          userAddress: account,
          claimTransactionHash: transactionHash
        })
      });
      const submittedBody = await submitted.json();
      if (!submitted.ok) throw new Error(submittedBody.error || "The claim transaction could not be recorded.");
      setStatus(submittedBody);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Claim failed.");
    } finally {
      setClaimSubmitting(false);
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
    setWalletConnected(false);
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
            <div className="wallet-control">
              <WalletCards size={16} />
              <input
                aria-label="Reward wallet address"
                onChange={(event) => setWallet(event.target.value)}
                spellCheck={false}
                value={wallet}
              />
              <button className="wallet-connect" onClick={() => void connectWallet()} type="button">
                {walletConnected ? "Connected" : "Connect"}
              </button>
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
          {status.chainError ? <p className="error-banner">Settlement status: {status.chainError}</p> : null}

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
            <span>{status.mode === "session-preview" ? "Session preview" : "Onchain"}</span>
          </div>

          <section className="live-proof-band" aria-live="polite">
            <div className="live-proof-title">
              <span><RadioTower size={14} /> Monad testnet proof</span>
              <strong>
                {liveProof ? "Verified" : liveProofUnavailable ? "Unavailable" : "Checking"}
              </strong>
            </div>
            {liveProof ? (
              <>
                <p>
                  Click used · claim cleared · finalized at block {liveProof.finalizedBlockNumber}
                </p>
                <div className="live-proof-links">
                  <a
                    href={`https://testnet.monadscan.com/tx/${liveProof.settlementTransactionHash}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Settlement <ExternalLink size={12} />
                  </a>
                  <a
                    href={`https://testnet.monadscan.com/tx/${liveProof.claimTransactionHash}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Claim <ExternalLink size={12} />
                  </a>
                </div>
              </>
            ) : (
              <p>
                {liveProofUnavailable
                  ? "RPC proof is offline; session activity remains available."
                  : "Reading finalized chain state."}
              </p>
            )}
          </section>

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
            <strong>
              {status.mode === "session-preview"
                ? "Preview only"
                : `${status.state === "claimed" ? "0" : status.claimableMon} MON`}
            </strong>
            <button
              disabled={!canClaim || claimSubmitting}
              onClick={() => void claimReward()}
              type="button"
            >
              {status.mode === "monad-testnet" && status.state === "claimed" ? (
                <><Check size={16} /> Claimed</>
              ) : (
                <><MousePointerClick size={16} /> {claimSubmitting ? "Waiting for wallet" : canClaim ? "Claim reward" : "Awaiting settlement"}</>
              )}
            </button>
          </div>

          <a className="integration-link" href="https://github.com/nishuzumi/moss" rel="noreferrer" target="_blank">
            Moss builds and simulates unsigned actions
            <ArrowUpRight size={15} />
          </a>
          <p className="mode-note">
            Session activity is isolated from live balances. The testnet proof above is read independently from finalized Monad state.
          </p>
        </aside>
      </div>
    </main>
  );
}
