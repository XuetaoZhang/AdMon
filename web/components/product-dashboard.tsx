"use client";

import {
  Activity,
  BadgeDollarSign,
  Check,
  Clipboard,
  Code2,
  ExternalLink,
  FilePenLine,
  LoaderCircle,
  Megaphone,
  Plus,
  Radio,
  Users,
  WalletCards,
  X
} from "lucide-react";
import { BrowserProvider, Contract, Interface, parseEther } from "ethers";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ProductCampaign, PublisherProfile } from "@/lib/product-store";

type DashboardTab = "advertiser" | "publisher";
type CampaignEditorMode = "edit" | "fund";

type BrowserEthereum = {
  request(args: { method: string; params?: readonly unknown[] | object }): Promise<unknown>;
};

const contractAddress = "0x2501155A34E0af59a21751045abB6A9056b7e1Ab";
const campaignInterface = new Interface([
  "function createCampaign(uint32 topicId,uint96 clickReward,uint64 activeUntil,string landingUrl) payable returns (uint256 campaignId)",
  "event CampaignCreated(uint256 indexed campaignId,address indexed advertiser,uint32 indexed topicId,uint96 clickReward,uint64 activeUntil,uint256 budget,string landingUrl)"
]);

const emptyCampaign: ProductCampaign = {
  id: "",
  campaignId: 1,
  advertiser: "",
  title: "",
  description: "",
  keywords: [],
  topicId: "onchain-actions",
  destinationUrl: "https://",
  domain: "",
  clickRewardMon: "0.01",
  budgetMon: "0.16",
  status: "active",
  clicks: 0,
  updatedAt: ""
};

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function ProductDashboard() {
  const [tab, setTab] = useState<DashboardTab>("advertiser");
  const [campaigns, setCampaigns] = useState<ProductCampaign[]>([]);
  const [publisher, setPublisher] = useState<PublisherProfile>({
    name: "AdMon Reference Agent",
    wallet: "0x719d34102D3c79C588f6C4BA3147cF10d00E4371"
  });
  const [userWallet, setUserWallet] = useState("");
  const [editorMode, setEditorMode] = useState<CampaignEditorMode | null>(null);
  const [draft, setDraft] = useState<ProductCampaign>(emptyCampaign);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void Promise.all([
      fetch("/api/admin/campaigns", { cache: "no-store" }),
      fetch("/api/admin/publisher", { cache: "no-store" })
    ]).then(async ([campaignResponse, publisherResponse]) => {
      const readBody = async (response: Response) => {
        const body = await response.text();
        try {
          return body ? JSON.parse(body) as { campaigns?: ProductCampaign[]; publisher?: PublisherProfile; error?: string } : {};
        } catch {
          return {};
        }
      };
      const [campaignBody, publisherBody] = await Promise.all([
        readBody(campaignResponse),
        readBody(publisherResponse)
      ]);
      if (!campaignResponse.ok || !publisherResponse.ok) {
        throw new Error(campaignBody.error || publisherBody.error || "Manage data is unavailable.");
      }
      setCampaigns(campaignBody.campaigns || []);
      if (publisherBody.publisher) setPublisher(publisherBody.publisher);
    }).catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Manage data is unavailable.");
    }).finally(() => {
      setLoading(false);
    });
    setUserWallet(
      window.localStorage.getItem("admon-user-wallet") ||
        "0x6BD73C2f2ae05f638E4ec39a93AA27ac8ba2F5D6"
    );
  }, []);

  const summary = useMemo(() => {
    const active = campaigns.filter((campaign) => campaign.status === "active").length;
    const clicks = campaigns.reduce((total, campaign) => total + campaign.clicks, 0);
    const budgets = new Map<number, number>();
    campaigns.forEach((campaign) => {
      budgets.set(
        campaign.campaignId,
        Math.max(budgets.get(campaign.campaignId) || 0, Number(campaign.budgetMon || 0))
      );
    });
    const budget = Array.from(budgets.values()).reduce((total, amount) => total + amount, 0);
    return { active, clicks, budget };
  }, [campaigns]);

  const mcpConfig = useMemo(
    () =>
      JSON.stringify(
        {
          mcpServers: {
            admon: {
              command: "node",
              args: ["mcp-server/dist/cli.js"],
              env: {
                ADMON_API_URL:
                  typeof window === "undefined" ? "https://your-admon.app" : window.location.origin,
                ADMON_PUBLISHER_ADDRESS: publisher.wallet
              }
            }
          }
        },
        null,
        2
      ),
    [publisher.wallet]
  );

  function openEditor(mode: CampaignEditorMode, campaign?: ProductCampaign) {
    setError("");
    setNotice("");
    setEditorMode(mode);
    setDraft(
      campaign
        ? {
            ...campaign,
            id: mode === "fund" ? `${campaign.id}-${Date.now()}` : campaign.id,
            clicks: mode === "fund" ? 0 : campaign.clicks
          }
        : { ...emptyCampaign, id: `campaign-${Date.now()}` }
    );
  }

  async function saveCreative(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (!draft.keywords.length) throw new Error("Add at least one campaign keyword.");
      const response = await fetch("/api/admin/campaigns", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft)
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Campaign could not be saved.");
      setCampaigns((current) =>
        current.map((campaign) => (campaign.id === body.campaign.id ? body.campaign : campaign))
      );
      setEditorMode(null);
      setNotice("Campaign creative updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Campaign could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function fundCampaign(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (!draft.keywords.length) throw new Error("Add at least one campaign keyword.");
      const ethereum = (window as unknown as { ethereum?: BrowserEthereum }).ethereum;
      if (!ethereum) throw new Error("No EVM wallet was found in this browser.");

      const provider = new BrowserProvider(ethereum);
      await provider.send("eth_requestAccounts", []);
      const network = await provider.getNetwork();
      if (network.chainId !== 10143n) {
        await ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x279f" }]
        });
      }

      const reward = parseEther(draft.clickRewardMon);
      const budget = parseEther(draft.budgetMon);
      if (budget < reward) throw new Error("Campaign budget must cover at least one click.");

      const signer = await provider.getSigner();
      const advertiser = await signer.getAddress();
      const contract = new Contract(contractAddress, campaignInterface, signer);
      const topicId = { "onchain-actions": 1, "monad-infra": 2, wallets: 3 }[
        draft.topicId
      ];
      const activeUntil = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
      const transaction = await contract.createCampaign(
        topicId,
        reward,
        activeUntil,
        draft.destinationUrl,
        { value: budget }
      );
      const receipt = await transaction.wait();
      const created = receipt.logs
        .map((log: { topics: readonly string[]; data: string }) => {
          try {
            return campaignInterface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((event: { name: string } | null) => event?.name === "CampaignCreated");
      if (!created) throw new Error("Campaign transaction finalized without a creation event.");

      const nextCampaign: ProductCampaign = {
        ...draft,
        campaignId: Number(created.args.campaignId),
        advertiser: draft.advertiser || shortAddress(advertiser),
        status: "active",
        updatedAt: new Date().toISOString()
      };
      const response = await fetch("/api/admin/campaigns", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextCampaign)
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Campaign metadata could not be saved.");
      setCampaigns((current) => [body.campaign, ...current]);
      setEditorMode(null);
      setNotice(`Campaign #${body.campaign.campaignId} funded on Monad.`);
    } catch (fundError) {
      setError(fundError instanceof Error ? fundError.message : "Campaign funding failed.");
    } finally {
      setSaving(false);
    }
  }

  async function savePublisher(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const response = await fetch("/api/admin/publisher", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(publisher)
    });
    const body = await response.json();
    setSaving(false);
    if (!response.ok) {
      setError(body.error || "Publisher could not be saved.");
      return;
    }
    window.localStorage.setItem("admon-user-wallet", userWallet);
    setPublisher(body.publisher);
    setNotice("Revenue wallets saved.");
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-heading">
        <div>
          <p className="eyebrow">Network operations</p>
          <h1>AdMon Console</h1>
        </div>
        <a
          className="contract-link"
          href={`https://testnet.monadscan.com/address/${contractAddress}`}
          rel="noreferrer"
          target="_blank"
        >
          Contract {shortAddress(contractAddress)} <ExternalLink size={14} />
        </a>
      </header>

      <div className="dashboard-tabs" role="tablist">
        <button className={tab === "advertiser" ? "active" : ""} onClick={() => setTab("advertiser")} type="button">
          <Megaphone size={16} /> Advertiser
        </button>
        <button className={tab === "publisher" ? "active" : ""} onClick={() => setTab("publisher")} type="button">
          <Radio size={16} /> Publisher
        </button>
      </div>

      {notice ? <div className="notice-banner"><Check size={15} /> {notice}</div> : null}
      {error && !editorMode ? <div className="dashboard-error">{error}</div> : null}

      {tab === "advertiser" ? (
        <>
          <section className="metric-strip" aria-label="Campaign summary">
            <div><Activity size={18} /><span>Active creatives</span><strong>{loading ? "-" : summary.active}</strong></div>
            <div><Users size={18} /><span>Verified clicks</span><strong>{loading ? "-" : summary.clicks}</strong></div>
            <div><BadgeDollarSign size={18} /><span>Funded campaign budget</span><strong>{loading ? "-" : `${summary.budget.toFixed(2)} MON`}</strong></div>
          </section>

          <section className="campaign-section">
            <div className="section-heading-row">
              <div><h2>Campaigns</h2><span>{loading ? "Loading campaigns..." : `${campaigns.length} creatives`}</span></div>
              <button className="primary-action compact" onClick={() => openEditor("fund")} type="button">
                <Plus size={15} /> New campaign
              </button>
            </div>
            <div className="campaign-table" aria-busy={loading} role="table">
              <div className="campaign-table-head" role="row">
                <span>Creative</span><span>Keywords</span><span>Reward</span><span>Clicks</span><span>Status</span><span />
              </div>
              {loading ? (
                <div className="campaign-loading" role="status">
                  <LoaderCircle className="spin" size={16} /> Loading campaign data...
                </div>
              ) : campaigns.map((campaign) => (
                <div className="campaign-row" role="row" key={campaign.id}>
                  <div className="campaign-identity">
                    <span>{campaign.advertiser.slice(0, 1)}</span>
                    <div><strong>{campaign.title}</strong><small>#{campaign.campaignId} · {campaign.domain}</small></div>
                  </div>
                  <code>{campaign.keywords.join(", ")}</code>
                  <strong>{campaign.clickRewardMon} MON</strong>
                  <span>{campaign.clicks}</span>
                  <span className={`status-chip ${campaign.status}`}>{campaign.status}</span>
                  <div className="row-actions">
                    <button onClick={() => openEditor("edit", campaign)} title="Edit creative" type="button"><FilePenLine size={15} /></button>
                    <button onClick={() => openEditor("fund", campaign)} title="Add budget as a new onchain campaign" type="button"><Plus size={15} /></button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="publisher-layout">
          <form className="publisher-settings" onSubmit={savePublisher}>
            <div className="section-heading-row">
              <div><h2>Revenue settings</h2><span>Applied to newly issued click links</span></div>
              <button className="primary-action compact" disabled={saving} type="submit">
                {saving ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />} Save
              </button>
            </div>
            <label><span>Publisher name</span><input value={publisher.name} onChange={(event) => setPublisher({ ...publisher, name: event.target.value })} /></label>
            <label><span>Publisher revenue wallet</span><div className="field-with-icon"><WalletCards size={16} /><input spellCheck={false} value={publisher.wallet} onChange={(event) => setPublisher({ ...publisher, wallet: event.target.value as `0x${string}` })} /></div></label>
            <label><span>Default user reward wallet</span><div className="field-with-icon"><Users size={16} /><input spellCheck={false} value={userWallet} onChange={(event) => setUserWallet(event.target.value)} /></div></label>
            <div className="split-summary">
              <span><i className="user-key" /> User <strong>25%</strong></span>
              <span><i className="publisher-key" /> Publisher <strong>60%</strong></span>
              <span><i className="protocol-key" /> Protocol <strong>15%</strong></span>
            </div>
          </form>

          <section className="mcp-settings">
            <div className="section-heading-row">
              <div><h2>MCP integration</h2><span>Codex, Claude Code, or a custom host</span></div>
              <button
                className="icon-text-button"
                onClick={async () => {
                  await navigator.clipboard.writeText(mcpConfig);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1400);
                }}
                type="button"
              >
                {copied ? <Check size={14} /> : <Clipboard size={14} />} {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="config-code"><Code2 size={16} /><pre>{mcpConfig}</pre></div>
            <div className="integration-health">
              <span><i /> Offer API</span><strong>Ready</strong>
              <span><i /> Monad settlement</span><strong>Live</strong>
              <span><i /> Structured MCP output</span><strong>Ready</strong>
            </div>
          </section>
        </section>
      )}

      {editorMode ? (
        <div className="modal-backdrop" role="presentation">
          <form className="campaign-modal" onSubmit={editorMode === "edit" ? saveCreative : fundCampaign}>
            <div className="modal-heading">
              <div><p className="eyebrow">{editorMode === "edit" ? "Offchain creative" : "Monad campaign"}</p><h2>{editorMode === "edit" ? "Edit campaign" : "Fund a new campaign"}</h2></div>
              <button onClick={() => setEditorMode(null)} title="Close" type="button"><X size={17} /></button>
            </div>
            <div className="form-grid">
              <label><span>Advertiser</span><input required value={draft.advertiser} onChange={(event) => setDraft({ ...draft, advertiser: event.target.value })} /></label>
              <label className="span-two"><span>Match keywords</span><input required placeholder="swap, liquidity, usdc" value={draft.keywords.join(", ")} onChange={(event) => setDraft({ ...draft, keywords: event.target.value.split(/[,，\n]/g).map((keyword) => keyword.trim()).filter(Boolean) })} /></label>
              <label className="span-two"><span>Title</span><input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
              <label className="span-two"><span>Description</span><textarea required value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
              <label className="span-two"><span>Destination URL</span><input required type="url" value={draft.destinationUrl} onChange={(event) => setDraft({ ...draft, destinationUrl: event.target.value })} /></label>
              <label><span>Click price (MON)</span><input disabled={editorMode === "edit"} inputMode="decimal" value={draft.clickRewardMon} onChange={(event) => setDraft({ ...draft, clickRewardMon: event.target.value })} /></label>
              {editorMode === "fund" ? <label><span>Budget (MON)</span><input inputMode="decimal" value={draft.budgetMon} onChange={(event) => setDraft({ ...draft, budgetMon: event.target.value })} /></label> : <label><span>Status</span><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as ProductCampaign["status"] })}><option value="active">Active</option><option value="paused">Paused</option><option value="draft">Draft</option></select></label>}
            </div>
            {error ? <p className="modal-error">{error}</p> : null}
            <div className="modal-actions">
              <button className="text-action" onClick={() => setEditorMode(null)} type="button">Cancel</button>
              <button className="primary-action" disabled={saving} type="submit">
                {saving ? <LoaderCircle className="spin" size={15} /> : editorMode === "edit" ? <Check size={15} /> : <WalletCards size={15} />}
                {editorMode === "edit" ? "Save creative" : "Fund on Monad"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
