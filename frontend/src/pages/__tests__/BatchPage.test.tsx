import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import BatchPage from "../../pages/BatchPage";
import { ToastProvider } from "../../lib/toast";
import { contracts } from "../../lib/contracts";

// ── Module mocks ──────────────────────────────────────────────────────────────

const SENDER = "GBQG2SJ7MXUH34SI3MJ2I256I5UMGM2QSQZM77YFX5S6JOHXUQJEPC3A";
const RECIPIENT = "GCFXHS4GXL6BVUCXBWXGTITROWLVYXQKQLF4YH5O5JT3YZXCYPAFBJZB";
const signTx = vi.fn();

vi.mock("../../lib/wallet", () => ({
  useWallet: () => ({ connected: true, address: SENDER, signTx }),
}));

vi.mock("../../lib/contracts", () => ({
  contracts: {
    rwa: { batchTransfer: vi.fn() },
  },
}));

vi.mock("../../components/WalletGuard", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderBatchPage() {
  return render(
    <ToastProvider>
      <BatchPage />
    </ToastProvider>,
  );
}

function queueTransfer(amount: string) {
  fireEvent.change(screen.getByLabelText(/Target address/), { target: { value: RECIPIENT } });
  fireEvent.change(screen.getByLabelText(/Amount \(stroops\)/), { target: { value: amount } });
  fireEvent.click(screen.getByRole("button", { name: /Add to Batch/ }));
}

function executeBatch() {
  fireEvent.click(screen.getByRole("button", { name: /Execute 1 Operation/ }));
  const dialog = screen.getByRole("dialog");
  const buttons = within(dialog).getAllByRole("button");
  fireEvent.click(buttons[buttons.length - 1]);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("BatchPage – batch transfer submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits a valid batch through the rwa-token batch_transfer client with the wallet signer", async () => {
    vi.mocked(contracts.rwa.batchTransfer).mockResolvedValue(undefined);
    renderBatchPage();

    queueTransfer("1000");
    executeBatch();

    await waitFor(() => {
      expect(contracts.rwa.batchTransfer).toHaveBeenCalledWith(
        SENDER,
        [{ to: RECIPIENT, amount: 1000n }],
        signTx,
      );
    });
    // Successful batch clears the queue.
    await waitFor(() => {
      expect(screen.queryByText("Batch Queue")).toBeNull();
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("surfaces a rejected transaction without reporting success", async () => {
    vi.mocked(contracts.rwa.batchTransfer).mockRejectedValue(
      new Error("Transaction rejected by user"),
    );
    renderBatchPage();

    queueTransfer("1000");
    executeBatch();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Transaction rejected by user");
    // Queue is kept so the user can retry, and no success toast is shown.
    expect(screen.getByText("Batch Queue")).toBeDefined();
    expect(screen.queryByText(/executed successfully/)).toBeNull();
  });
});
