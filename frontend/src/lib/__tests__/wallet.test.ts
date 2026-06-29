import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @stellar/freighter-api before importing the wallet store
const mockIsConnected = vi.hoisted(() => vi.fn());
const mockGetPublicKey = vi.hoisted(() => vi.fn());
const mockSignTransaction = vi.hoisted(() => vi.fn());
const mockSetAllowed = vi.hoisted(() => vi.fn());

vi.mock("@stellar/freighter-api", () => ({
  isConnected: mockIsConnected,
  getPublicKey: mockGetPublicKey,
  signTransaction: mockSignTransaction,
  setAllowed: mockSetAllowed,
}));

// Mock stellar.ts to avoid the full SDK initialisation chain
vi.mock("../stellar", () => ({
  NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
  getNetwork: () => "testnet",
  getRpcUrl: () => "https://soroban-testnet.stellar.org",
  getNetworkPassphrase: () => "Test SDF Network ; September 2015",
  server: {},
  CONTRACT_IDS: {},
  validateStellarAddress: (addr: string) => /^G[A-Z2-7]{55}$/.test(addr),
}));

import { useWallet } from "../wallet";

beforeEach(() => {
  // Reset Zustand store state between tests
  useWallet.setState({ address: null, connected: false });
  vi.clearAllMocks();
});

describe("useWallet initial state", () => {
  it("starts disconnected with no address", () => {
    const { address, connected } = useWallet.getState();
    expect(address).toBeNull();
    expect(connected).toBe(false);
  });
});

describe("useWallet.connect", () => {
  it("throws if Freighter is not installed", async () => {
    mockIsConnected.mockResolvedValue(false);
    await expect(useWallet.getState().connect()).rejects.toThrow(
      /Freighter wallet is not installed/i,
    );
  });

  it("sets address and connected=true on success", async () => {
    mockIsConnected.mockResolvedValue(true);
    mockSetAllowed.mockResolvedValue(undefined);
    mockGetPublicKey.mockResolvedValue("GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN");

    await useWallet.getState().connect();

    const { address, connected } = useWallet.getState();
    expect(connected).toBe(true);
    expect(address).toBe("GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN");
  });
});

describe("useWallet.disconnect", () => {
  it("clears address and sets connected=false", async () => {
    // First connect
    mockIsConnected.mockResolvedValue(true);
    mockSetAllowed.mockResolvedValue(undefined);
    mockGetPublicKey.mockResolvedValue("GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN");
    await useWallet.getState().connect();
    expect(useWallet.getState().connected).toBe(true);

    // Then disconnect
    useWallet.getState().disconnect();
    expect(useWallet.getState().address).toBeNull();
    expect(useWallet.getState().connected).toBe(false);
  });
});

describe("useWallet.signTx", () => {
  it("throws if wallet is not connected", async () => {
    await expect(useWallet.getState().signTx("some-xdr")).rejects.toThrow(
      /Wallet not connected/i,
    );
  });

  it("calls freighter signTransaction and returns signed XDR", async () => {
    // Manually set connected state
    useWallet.setState({ address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN", connected: true });
    mockSignTransaction.mockResolvedValue("signed-xdr-result");

    const result = await useWallet.getState().signTx("input-xdr");
    expect(result).toBe("signed-xdr-result");
    expect(mockSignTransaction).toHaveBeenCalledWith("input-xdr", {
      networkPassphrase: "Test SDF Network ; September 2015",
    });
  });
});
