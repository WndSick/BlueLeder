"use client";

import { useCallback, useEffect, useState } from "react";

type Role = "ngo" | "community" | "admin" | "verifier" | "buyer";

type CreditBatchItem = {
  id: string;
  projectId: string;
  periodKey: string;
  reportHash?: string;
  issuedQuantity: number;
  currentHolder: string;
  status: "ISSUED" | "TRANSFERRED" | "RETIRED" | "CANCELLED" | string;
  createdAt: string;
  project: {
    name: string;
    ecosystem: string;
    state: string;
    district: string;
    village: string;
    areaHectares: number;
  };
};

type Certificate = {
  certificateId: string;
  certificateHash: string;
  project: string;
  quantity: number;
  beneficiary: string;
  retiredAt: string;
  ledgerEventId: string;
};

export default function MarketplaceWorkspace({ role }: { role: Role }) {
  const [listings, setListings] = useState<CreditBatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const loadListings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/blockchain/marketplace", { cache: "no-store" });
      const data = await response.json();
      if (response.ok) {
        setListings(data.listings ?? []);
      } else {
        setError(data.error ?? "Failed to load credit marketplace.");
      }
    } catch {
      setError("Network error loading marketplace data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  const connectMetaMask = async () => {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      try {
        const accounts = await (window as any).ethereum.request({ method: "eth_requestAccounts" });
        if (accounts && accounts[0]) {
          setWalletAddress(accounts[0]);
          setNotice(`Connected Web3 Wallet: ${accounts[0].slice(0, 6)}…${accounts[0].slice(-4)}`);
        }
      } catch (err: any) {
        setError(err.message || "Failed to connect MetaMask wallet.");
      }
    } else {
      setError("MetaMask wallet extension not detected in browser. Proceeding with relayer wallet.");
    }
  };

  const handleBuy = async (batchId: string) => {
    setProcessingId(batchId);
    setNotice("");
    setError("");
    try {
      const response = await fetch("/api/blockchain/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId, action: "BUY", walletAddress }),
      });
      const data = await response.json();
      if (response.ok) {
        setNotice(data.message ?? "Credit batch purchased and transferred.");
        await loadListings();
      } else {
        setError(data.error ?? "Purchase transaction failed.");
      }
    } catch {
      setError("Network error during buy transaction.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRetire = async (batchId: string) => {
    setProcessingId(batchId);
    setNotice("");
    setError("");
    try {
      const response = await fetch("/api/blockchain/retire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId,
          retirementReason: "Corporate Net-Zero Carbon Offset Claim",
          walletAddress,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setNotice("Credits permanently burned on Polygon Amoy testnet.");
        setCertificate(data.certificate);
        await loadListings();
      } else {
        setError(data.error ?? "Retirement transaction failed.");
      }
    } catch {
      setError("Network error during retirement transaction.");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="satellite-mrv-workspace">
      {notice && (
        <div className="notice">
          <span>✓</span>{notice}
          <button onClick={() => setNotice("")}>×</button>
        </div>
      )}
      {error && (
        <div className="ledger-alert error">
          <span>!</span>{error}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}

      {/* Hero Header */}
      <section className="mrv-hero">
        <div className="mrv-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%" }}>
          <div>
            <span className="eyebrow">On-Chain Marketplace · Polygon Amoy</span>
            <h1>Blue Carbon Credit Marketplace</h1>
            <p>OpenZeppelin ERC-1155 Tokenized Batches, Non-Custodial Trading, and On-Chain Proof-of-Retirement.</p>
          </div>
          <button
            className="primary-button"
            onClick={connectMetaMask}
            style={{ backgroundColor: walletAddress ? "#059669" : "#2563eb", whiteSpace: "nowrap" }}
          >
            {walletAddress ? `🦊 ${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : "Connect MetaMask"}
          </button>
        </div>
      </section>

      {/* Certificate Modal */}
      {certificate && (
        <section className="panel" style={{ padding: "1.5rem", backgroundColor: "#f0fdf4", borderLeft: "4px solid #16a34a", marginBottom: "2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, color: "#15803d" }}>📜 Cryptographic Proof-of-Retirement Certificate</h3>
            <button className="secondary-button" onClick={() => setCertificate(null)}>Close</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginTop: "1rem", fontSize: "0.9rem" }}>
            <div><span>Certificate ID:</span> <strong>{certificate.certificateId.slice(0, 12)}…</strong></div>
            <div><span>Project:</span> <strong>{certificate.project}</strong></div>
            <div><span>Retired Quantity:</span> <strong>{certificate.quantity} tCO₂e</strong></div>
            <div><span>Beneficiary:</span> <strong>{certificate.beneficiary}</strong></div>
            <div><span>Retired At:</span> <strong>{new Date(certificate.retiredAt).toLocaleDateString()}</strong></div>
            <div><span>SHA-256 Hash:</span> <strong style={{ fontSize: "0.8rem", wordBreak: "break-all" }}>{certificate.certificateHash}</strong></div>
          </div>
        </section>
      )}

      {/* Listings Grid */}
      <section className="ledger-panel panel">
        <header className="ledger-head">
          <div>
            <span className="eyebrow">Available token batches</span>
            <h2>Tokenized Blue Carbon Inventory</h2>
          </div>
        </header>

        {loading ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
            <span>🌀</span> Querying ERC-1155 token batches from ledger...
          </div>
        ) : listings.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.5rem", marginTop: "1rem" }}>
            {listings.map((item) => (
              <div key={item.id} className="evidence-card" style={{ border: "1px solid #cbd5e1" }}>
                <header style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: "0.75rem" }}>
                  <div>
                    <span className="evidence-type">{item.project.ecosystem.toUpperCase()} • {item.periodKey}</span>
                    <h3 style={{ margin: "0.25rem 0" }}>{item.project.name}</h3>
                    <small style={{ color: "#64748b" }}>{item.project.village}, {item.project.state}</small>
                  </div>
                  <span className={`evidence-status ${item.status === "ISSUED" ? "approved" : item.status === "RETIRED" ? "rejected" : "pending"}`}>
                    <i />
                    {item.status}
                  </span>
                </header>

                <div style={{ margin: "1rem 0", fontSize: "0.85rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <span style={{ color: "#64748b" }}>TokenID Hash:</span>
                    <strong style={{ fontSize: "0.8rem" }}>{(item.reportHash || item.id).slice(0, 10)}…</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <span style={{ color: "#64748b" }}>Available Quantity:</span>
                    <strong style={{ color: "#059669", fontSize: "1.1rem" }}>{item.issuedQuantity} tCO₂e</strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b" }}>Current Holder:</span>
                    <strong style={{ fontSize: "0.8rem" }}>{item.currentHolder}</strong>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
                  {item.status !== "RETIRED" ? (
                    <>
                      <button
                        className="secondary-button"
                        style={{ flex: 1 }}
                        disabled={processingId === item.id}
                        onClick={() => handleBuy(item.id)}
                      >
                        {processingId === item.id ? "Processing…" : "Buy Batch"}
                      </button>
                      <button
                        className="primary-button"
                        style={{ flex: 1, backgroundColor: "#dc2626" }}
                        disabled={processingId === item.id}
                        onClick={() => handleRetire(item.id)}
                      >
                        {processingId === item.id ? "Burning…" : "Retire & Burn"}
                      </button>
                    </>
                  ) : (
                    <div style={{ width: "100%", padding: "0.5rem", backgroundColor: "#fef2f2", color: "#991b1b", textAlign: "center", borderRadius: "4px", fontSize: "0.85rem", fontWeight: 600 }}>
                      🔥 Permanently Retired & Burned
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-ledger" style={{ padding: "3rem", textAlign: "center" }}>
            <span>🌱</span>
            <h3>No tokenized carbon credit batches available yet</h3>
            <p>Verify an automated satellite MRV report to mint the first ERC-1155 token batch.</p>
          </div>
        )}
      </section>
    </div>
  );
}
