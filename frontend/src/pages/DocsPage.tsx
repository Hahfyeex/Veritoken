import { PageHeader } from "../components/ui";

export default function DocsPage() {
  return (
    <div style={{ maxWidth: 720 }}>
      <PageHeader
        eyebrow="Reference"
        title="Documentation"
        description="Everything you need to get started with Veritoken — from wallet setup to on-chain compliance."
      />

      <section style={styles.section}>
        <h2 style={styles.h2}>Getting Started</h2>
        <p style={styles.p}>
          Veritoken runs on the Stellar network. To interact with the app you need the{" "}
          <strong>Freighter</strong> browser wallet extension. Install it from{" "}
          <a href="https://freighter.app" target="_blank" rel="noopener noreferrer" style={styles.link}>
            freighter.app
          </a>
          , create or import a Stellar account, and click <em>Connect Wallet</em> in the top-right
          corner of this app. Switch between Testnet and Mainnet using the buttons in the header.
        </p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.h2}>KYC Process</h2>
        <p style={styles.p}>
          All token interactions require an active KYC approval recorded on-chain. Veritoken
          supports three KYC tiers:
        </p>
        <ul style={styles.ul}>
          <li><strong>Tier 0 — Basic:</strong> identity verified, suitable for small retail positions.</li>
          <li><strong>Tier 1 — Accredited:</strong> accredited investor status confirmed, required for property tokens.</li>
          <li><strong>Tier 2 — Institutional:</strong> institutional-grade due diligence, required for high-value placements.</li>
        </ul>
        <p style={styles.p}>
          A designated verifier submits your approval on-chain. Once approved, your status is
          stored persistently. Approvals may carry an expiry date; renew with your verifier before
          it lapses to avoid transfer blocks.
        </p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.h2}>Invoice Tokens</h2>
        <p style={styles.p}>
          Invoice tokens represent fractional ownership of a receivable. The lifecycle is:
        </p>
        <ol style={styles.ol}>
          <li>Admin mints tokens to the invoice originator after KYC and compliance checks pass.</li>
          <li>Token holders can transfer their position to other KYC-approved addresses.</li>
          <li>On settlement, the admin redeems the tokens and distributes proceeds.</li>
        </ol>
        <p style={styles.p}>
          All transfers are gated by the compliance engine — paused contracts and blocklisted
          addresses are rejected automatically.
        </p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.h2}>Property Tokens</h2>
        <p style={styles.p}>
          Property tokens represent fractional shares of a real-estate asset. Each token equals one
          share out of the authorized total. Dividends (rental income, etc.) are deposited by the
          admin and distributed pro-rata to all shareholders. Holders can claim their accrued
          dividend at any time from the Property page.
        </p>
        <p style={styles.p}>
          The Net Asset Value (NAV) per share is calculated on-chain as{" "}
          <code style={styles.code}>total_valuation_usd / minted_shares</code> and updated
          whenever the admin revalues the property.
        </p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.h2}>Carbon Credits</h2>
        <p style={styles.p}>
          Carbon credit tokens follow the <strong>1 token = 1 tonne CO₂e</strong> convention.
          Credits are minted against a verified project (VCS, Gold Standard, CDM, or ACR). To
          claim an offset, a holder <em>retires</em> credits — this permanently burns the tokens
          and records an on-chain retirement receipt including beneficiary name and reason. Retired
          credits cannot be re-issued. Each project is linked to an external registry via its
          registry URL and project ID, allowing independent verification.
        </p>
      </section>

      <section style={styles.section}>
        <h2 style={styles.h2}>Further Reading</h2>
        <p style={styles.p}>
          For contract interfaces, deployment instructions, and integration guides see the{" "}
          <a
            href="https://github.com/VERITOKEN-xx/Veritoken"
            target="_blank"
            rel="noopener noreferrer"
            style={styles.link}
          >
            Veritoken GitHub README
          </a>
          .
        </p>
      </section>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  section: {
    marginBottom: "2rem",
    paddingBottom: "1.5rem",
    borderBottom: "1px solid var(--border)",
  },
  h2: {
    fontSize: "1.15rem",
    fontWeight: 700,
    marginBottom: "0.6rem",
  },
  p: {
    color: "var(--text-muted)",
    lineHeight: 1.65,
    marginBottom: "0.6rem",
  },
  ul: {
    color: "var(--text-muted)",
    paddingLeft: "1.25rem",
    lineHeight: 1.8,
    marginBottom: "0.6rem",
  },
  ol: {
    color: "var(--text-muted)",
    paddingLeft: "1.25rem",
    lineHeight: 1.8,
    marginBottom: "0.6rem",
  },
  link: {
    color: "var(--accent-2)",
    textDecoration: "underline",
  },
  code: {
    fontFamily: "monospace",
    fontSize: "0.88em",
    background: "var(--surface-2)",
    padding: "0.1em 0.35em",
    borderRadius: 4,
  },
};
