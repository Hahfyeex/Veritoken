import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { computeAccessibleName } from "dom-accessibility-api";
import InvoicePage from "../../pages/InvoicePage";
import { ToastProvider } from "../../lib/toast";
import { contracts } from "../../lib/contracts/index";

// ── Module mocks ──────────────────────────────────────────────────────────────

const ADDRESS = "GBQG2SJ7MXUH34SI3MJ2I256I5UMGM2QSQZM77YFX5S6JOHXUQJEPC3A";

vi.mock("../../lib/wallet", () => ({
  useWallet: () => ({
    connected: true,
    address: "GBQG2SJ7MXUH34SI3MJ2I256I5UMGM2QSQZM77YFX5S6JOHXUQJEPC3A",
    signTx: vi.fn(),
  }),
}));

vi.mock("../../lib/stellar", () => ({
  CONTRACT_IDS: { invoiceToken: "CTEST123" },
  fetchContractEvents: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../lib/contracts/index", () => ({
  contracts: {
    invoice: {
      getMeta: vi.fn().mockResolvedValue({
        invoice_id: "INV-001",
        issuer: "Acme Corp",
        debtor: "Globex Inc",
        face_value_usd: 1000000n,
        currency: "USD",
        discount_rate_bps: 250,
        due_date: 1767225600,
        ipfs_doc_hash: "",
      }),
      isSettled: vi.fn().mockResolvedValue(true),
      totalSupply: vi.fn().mockResolvedValue(1000n),
      lifecyclePaused: vi.fn().mockResolvedValue(false),
      issue: vi.fn().mockResolvedValue(undefined),
      redeem: vi.fn().mockResolvedValue(undefined),
      settle: vi.fn().mockResolvedValue(undefined),
      getJournal: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock("../../components/WalletGuard", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../components/LockupStatusCard", () => ({
  default: () => null,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderInvoicePage() {
  return render(
    <ToastProvider>
      <InvoicePage />
    </ToastProvider>,
  );
}

/**
 * Asserts every input, select and textarea inside `container` has a
 * programmatically associated accessible name backed by a <label> element
 * (placeholder text alone does not count).
 */
function expectAllControlsLabelled(container: HTMLElement) {
  const controls = container.querySelectorAll<HTMLElement>("input, select, textarea");
  expect(controls.length).toBeGreaterThan(0);
  controls.forEach((control) => {
    const placeholder = control.getAttribute("placeholder");
    const name = computeAccessibleName(control);
    expect(name, `control ${control.outerHTML} has no accessible name`).not.toBe("");
    if (placeholder) expect(name).not.toBe(placeholder);
    expect((control as HTMLInputElement).labels?.length ?? 0).toBeGreaterThan(0);
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("InvoicePage – issue form accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("associates a label with every control in the issue form", async () => {
    renderInvoicePage();
    const submit = await screen.findByRole("button", { name: /Issue Invoice Tokens/i });
    expectAllControlsLabelled(submit.closest("form")!);
  });

  it("exposes the issue controls by accessible name", async () => {
    renderInvoicePage();
    expect(await screen.findByRole("textbox", { name: /Recipient Address/i })).toHaveAttribute(
      "name",
      "issueTo",
    );
    expect(screen.getByRole("spinbutton", { name: /^Amount \(stroops\)/i })).toHaveAttribute(
      "name",
      "issueAmount",
    );
  });

  it("still submits the issue form with the entered values", async () => {
    const issueMock = vi.mocked(contracts.invoice.issue);
    renderInvoicePage();

    fireEvent.change(await screen.findByLabelText(/Recipient Address/i), {
      target: { value: ADDRESS },
    });
    fireEvent.change(screen.getByLabelText(/^Amount \(stroops\)/i), {
      target: { value: "500" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Issue Invoice Tokens/i }));

    await waitFor(() => {
      expect(issueMock).toHaveBeenCalledWith(ADDRESS, ADDRESS, 500n, expect.any(Function));
    });
  });

  it("keeps validation errors associated with the amount control", async () => {
    renderInvoicePage();
    const amount = await screen.findByLabelText(/^Amount \(stroops\)/i);
    fireEvent.change(amount, { target: { value: "-5" } });

    await waitFor(() => {
      expect(amount).toHaveAttribute("aria-invalid", "true");
    });
    const errorId = amount.getAttribute("aria-describedby");
    expect(errorId).toBeTruthy();
    expect(document.getElementById(errorId!)).toHaveAttribute("role", "alert");
    expect(screen.getByRole("button", { name: /Issue Invoice Tokens/i })).toBeDisabled();
  });
});

describe("InvoicePage – redeem form accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("associates a label with every control in the redeem form", async () => {
    renderInvoicePage();
    fireEvent.click(screen.getByRole("button", { name: /^Redeem$/i }));
    const submit = await screen.findByRole("button", { name: /Redeem Tokens/i });
    expectAllControlsLabelled(submit.closest("form")!);
    expect(screen.getByRole("spinbutton", { name: /Amount to Redeem/i })).toHaveAttribute(
      "name",
      "redeemAmount",
    );
  });
});
