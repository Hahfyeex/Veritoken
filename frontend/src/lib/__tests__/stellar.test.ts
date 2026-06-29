import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoist mock functions so they are available inside vi.mock factory (which is
// hoisted to the top of the module before variable declarations).
const mockSimulate = vi.hoisted(() => vi.fn());
const mockSend = vi.hoisted(() => vi.fn());
const mockGet = vi.hoisted(() => vi.fn());
const mockAssemble = vi.hoisted(() => vi.fn());
const mockIsSimError = vi.hoisted(() => vi.fn());

vi.mock("@stellar/stellar-sdk", () => ({
  Networks: {
    PUBLIC: "Public Global Stellar Network ; September 2015",
    TESTNET: "Test SDF Network ; September 2015",
  },
  TransactionBuilder: {
    fromXDR: vi.fn(() => ({ toXDR: () => "mock-xdr" })),
  },
  rpc: {
    Server: vi.fn(() => ({
      simulateTransaction: mockSimulate,
      sendTransaction: mockSend,
      getTransaction: mockGet,
    })),
    Api: {
      isSimulationError: mockIsSimError,
    },
    assembleTransaction: mockAssemble,
  },
}));

// Mock networkStore so stellar.ts can initialise without localStorage
vi.mock("../networkStore", () => ({
  useNetworkStore: {
    getState: () => ({ network: "testnet" }),
  },
  getNetworkRpcUrl: () => "https://soroban-testnet.stellar.org",
}));

import { simulateAndSend, decodeContractError, validateStellarAddress } from "../stellar";

beforeEach(() => {
  vi.clearAllMocks();
  mockIsSimError.mockReturnValue(false);
  mockAssemble.mockReturnValue({ build: () => ({ toXDR: () => "assembled-xdr" }) });
});

describe("decodeContractError", () => {
  it("decodes known kyc error codes", () => {
    expect(decodeContractError("kyc", 1)).toBe("Contract already initialized");
    expect(decodeContractError("kyc", 2)).toBe("Not an authorized verifier");
  });

  it("decodes known compliance error codes", () => {
    expect(decodeContractError("compliance", 1)).toBe("Contract already initialized");
  });

  it("returns an unknown-error fallback for unrecognised codes", () => {
    const msg = decodeContractError("kyc", 999);
    expect(msg).toMatch(/unknown/i);
    expect(msg).toContain("999");
  });
});

describe("validateStellarAddress", () => {
  it("accepts a valid 56-char G address", () => {
    expect(validateStellarAddress("GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN")).toBe(true);
  });

  it("rejects an empty string", () => {
    expect(validateStellarAddress("")).toBe(false);
  });

  it("rejects addresses that start with S (secret seed)", () => {
    expect(validateStellarAddress("SAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN")).toBe(false);
  });
});

describe("simulateAndSend", () => {
  const mockSignTx = vi.fn(async (xdr: string) => `signed:${xdr}`);

  it("returns the transaction result on success", async () => {
    mockIsSimError.mockReturnValue(false);
    mockSend.mockResolvedValue({ status: "PENDING", hash: "abc123" });
    mockGet.mockResolvedValue({ status: "SUCCESS", resultXdr: "result" });

    const result = await simulateAndSend("fake-xdr", mockSignTx);
    expect(result.status).toBe("SUCCESS");
    expect(mockSignTx).toHaveBeenCalledWith("assembled-xdr");
  });

  it("throws when simulation returns an error", async () => {
    mockIsSimError.mockReturnValue(true);
    mockSimulate.mockResolvedValue({ error: "ContractError (code=3)" });

    await expect(simulateAndSend("fake-xdr", mockSignTx)).rejects.toThrow(
      /Contract error/,
    );
  });

  it("throws when the transaction send status is ERROR", async () => {
    mockIsSimError.mockReturnValue(false);
    mockSend.mockResolvedValue({ status: "ERROR", errorResult: { msg: "bad" } });

    await expect(simulateAndSend("fake-xdr", mockSignTx)).rejects.toThrow(
      /Transaction failed/,
    );
  });

  it("throws when the final transaction status is not SUCCESS", async () => {
    mockIsSimError.mockReturnValue(false);
    mockSend.mockResolvedValue({ status: "PENDING", hash: "abc123" });
    mockGet.mockResolvedValue({ status: "FAILED" });

    await expect(simulateAndSend("fake-xdr", mockSignTx)).rejects.toThrow(
      /not successful/i,
    );
  });
});
