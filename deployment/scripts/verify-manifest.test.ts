/**
 * verify-manifest.test.ts — Regression tests for verifyManifest
 *
 * Covers blank or whitespace-only contract IDs and placeholder-looking
 * values, which must be rejected before any RPC verification call is
 * attempted.
 */

import { describe, it, expect, vi } from "vitest";
import type { SorobanRpc } from "@stellar/stellar-sdk";
import {
  isPlaceholderValue,
  verifyManifest,
  type Manifest,
} from "./verify-manifest.ts";

const VALID_CONTRACT_ID =
  "CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE";
const VALID_WASM_HASH =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

const PLACEHOLDERS = [
  "todo",
  "TODO",
  "changeme",
  "CHANGE_ME",
  "change-me",
  "replace_me",
  "placeholder",
  "tbd",
  "fixme",
  "xxxx",
  "<CONTRACT_ID>",
  "${WASM_HASH}",
  "{{contract_id}}",
  "your_contract_id",
  "  todo  ",
];

function manifestWith(
  contractId: string,
  wasmHash: string = VALID_WASM_HASH
): Manifest {
  return {
    schema_version: 1,
    git_sha: "abc123",
    network: "testnet",
    deployed_at: "2026-01-01T00:00:00Z",
    contracts: {
      "kyc-registry": {
        contract_id: contractId,
        wasm_hash: wasmHash,
        deployed_at: "2026-01-01T00:00:00Z",
        network: "testnet",
      },
    },
  };
}

function stubServer() {
  return {
    getLedgerEntries: vi.fn(),
    getAccount: vi.fn(),
    simulateTransaction: vi.fn(),
  };
}

describe("verifyManifest", () => {
  it.each(["", "   ", "\t\n"])(
    "rejects blank contract_id %j before calling the RPC",
    async (contractId) => {
      const server = stubServer();
      await expect(
        verifyManifest(
          manifestWith(contractId),
          server as unknown as SorobanRpc.Server
        )
      ).rejects.toThrow(/empty contract_id/);
      expect(server.getLedgerEntries).not.toHaveBeenCalled();
      expect(server.simulateTransaction).not.toHaveBeenCalled();
    }
  );

  it.each(PLACEHOLDERS)(
    "rejects placeholder contract_id %j before calling the RPC",
    async (placeholder) => {
      const server = stubServer();
      const result = verifyManifest(
        manifestWith(placeholder),
        server as unknown as SorobanRpc.Server
      );
      await expect(result).rejects.toThrow(
        /"kyc-registry" has a placeholder value in contract_id/
      );
      expect(server.getLedgerEntries).not.toHaveBeenCalled();
      expect(server.simulateTransaction).not.toHaveBeenCalled();
    }
  );

  it.each(PLACEHOLDERS)(
    "rejects placeholder wasm_hash %j before calling the RPC",
    async (placeholder) => {
      const server = stubServer();
      await expect(
        verifyManifest(
          manifestWith(VALID_CONTRACT_ID, placeholder),
          server as unknown as SorobanRpc.Server
        )
      ).rejects.toThrow(/"kyc-registry" has a placeholder value in wasm_hash/);
      expect(server.getLedgerEntries).not.toHaveBeenCalled();
    }
  );

  it("does not echo the rejected value in the error message", async () => {
    const secretLike = "<SECRET_KEY_SBXYZ123>";
    const server = stubServer();
    const error = await verifyManifest(
      manifestWith(secretLike),
      server as unknown as SorobanRpc.Server
    ).catch((err: Error) => err);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("contract_id");
    expect((error as Error).message).not.toContain(secretLike);
    expect((error as Error).message).not.toContain("SBXYZ123");
  });

  it("accepts valid contract_id and wasm_hash values and proceeds to the RPC", async () => {
    const server = stubServer();
    server.getLedgerEntries.mockResolvedValue({ entries: [] });
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(console, "log").mockImplementation(() => {});

    const result = await verifyManifest(
      manifestWith(VALID_CONTRACT_ID),
      server as unknown as SorobanRpc.Server
    );

    expect(result).toBe(false);
    expect(server.getLedgerEntries).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });
});

describe("isPlaceholderValue", () => {
  it.each(PLACEHOLDERS)("flags %j as a placeholder", (value) => {
    expect(isPlaceholderValue(value)).toBe(true);
  });

  it.each([VALID_CONTRACT_ID, VALID_WASM_HASH, "todolist-contract", "hash"])(
    "does not flag %j as a placeholder",
    (value) => {
      expect(isPlaceholderValue(value)).toBe(false);
    }
  );
});
