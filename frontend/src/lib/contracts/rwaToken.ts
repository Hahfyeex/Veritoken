/**
 * Typed client for the rwa-token Soroban contract.
 *
 * Contract functions covered:
 *   Read:  asset_type, kyc_registry, compliance_engine, get_compliance_metadata,
 *          get_token_export, get_external_uri
 *   Write: set_external_uri, batch_transfer
 */

import type { rpc } from "@stellar/stellar-sdk";
import { nativeToScVal, xdr } from "@stellar/stellar-sdk";
import type { TokenExportMetadata, KycSyncStatus } from "../../types";
import {
  readCall,
  writeCall,
  fetchSequence,
  toAddress,
  toString,
  toI128,
  type SignTx,
} from "./base";

/** One leg of a `batch_transfer` call (mirrors the contract's `RecipientEntry`). */
export interface BatchRecipient {
  to: string;
  amount: bigint;
}

/** Encode a `RecipientEntry` struct as a Soroban map with sorted symbol keys. */
function toRecipientEntry({ to, amount }: BatchRecipient): xdr.ScVal {
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("amount"), val: toI128(amount) }),
    new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("to"), val: toAddress(to) }),
  ]);
}

export class RwaTokenClient {
  constructor(
    private readonly contractId: string,
    private readonly server: rpc.Server
  ) {}

  /** Returns the asset type string (e.g. "invoice", "property", "carbon_credit"). */
  async assetType(): Promise<string> {
    return readCall<string>(this.server, this.contractId, "asset_type", []);
  }

  /** Returns the KYC registry contract address. */
  async kycRegistry(): Promise<string> {
    return readCall<string>(this.server, this.contractId, "kyc_registry", []);
  }

  /** Returns the compliance engine contract address. */
  async complianceEngine(): Promise<string> {
    return readCall<string>(this.server, this.contractId, "compliance_engine", []);
  }

  /**
   * Returns a compliance metadata value by key (e.g. "legal_entity",
   * "governing_law", "isin"). Returns an empty string when unset.
   */
  async getComplianceMetadata(key: string): Promise<string> {
    return readCall<string>(this.server, this.contractId, "get_compliance_metadata", [
      nativeToScVal(key, { type: "symbol" }),
    ]);
  }

  /**
   * Returns the canonical metadata export snapshot for external integrations.
   *
   * This single call aggregates all token, compliance, and supply fields that
   * explorers and indexers need.  No auth is required — it is a pure read.
   *
   * ## Usage
   * ```ts
   * const meta = await contracts.rwa.getTokenExport();
   * console.log(meta.name, meta.isin, meta.external_uri);
   * ```
   *
   * ## Explorer integration
   * Point your explorer's metadata resolver at:
   *   `stellar contract invoke --id <CONTRACT_ID> -- get_token_export`
   * The returned XDR decodes to this struct.
   */
  async getTokenExport(): Promise<TokenExportMetadata> {
    return readCall<TokenExportMetadata>(
      this.server,
      this.contractId,
      "get_token_export",
      []
    );
  }

  /**
   * Returns the optional external URI stored on-chain.
   * Returns an empty string when no URI has been set.
   */
  async getExternalUri(): Promise<string> {
    return readCall<string>(this.server, this.contractId, "get_external_uri", []);
  }

  // ── KYC synchronization ───────────────────────────────────────────────────

  /**
   * Read-only: returns the live KYC status for `addr` as a single snapshot.
   *
   * Makes a cross-contract call from the token to the linked KYC registry,
   * evaluates both approval status and expiry, and returns the result.
   *
   * Use this to refresh wallet KYC state before showing transfer UI, or
   * after receiving a `kyc_stale` event from the token contract.
   *
   * @example
   * ```ts
   * const status = await contracts.rwa.checkKycStatus(walletAddress);
   * if (!status.is_active) showExpiredKycBanner();
   * ```
   */
  async checkKycStatus(addr: string): Promise<KycSyncStatus> {
    return readCall<KycSyncStatus>(
      this.server,
      this.contractId,
      "check_kyc_status",
      [toAddress(addr)]
    );
  }

  /**
   * Permissionless write: verify `addr`'s live KYC state on-chain and emit a
   * `kyc_stale` event.  Returns true when the KYC is still active.
   *
   * No auth required — anyone can call this.  Use from keeper bots or
   * automation scripts to broadcast KYC state changes to event subscribers.
   */
  async syncKycStatus(
    callerAddress: string,
    addr: string,
    signTx: SignTx
  ): Promise<void> {
    const seq = await fetchSequence(this.server, callerAddress);
    await writeCall(
      this.server,
      this.contractId,
      "sync_kyc_status",
      [toAddress(addr)],
      callerAddress,
      seq,
      signTx
    );
  }

  /**
   * Admin-only: set or clear the external metadata URI.
   *
   * The URI should point to an off-chain metadata document, e.g.:
   * - `ipfs://QmYourHash` — IPFS-hosted JSON-LD metadata
   * - `https://api.example.com/tokens/1` — REST metadata endpoint
   *
   * Pass an empty string to remove the URI.
   */
  async setExternalUri(
    adminAddress: string,
    uri: string,
    signTx: SignTx
  ): Promise<void> {
    const seq = await fetchSequence(this.server, adminAddress);
    await writeCall(
      this.server,
      this.contractId,
      "set_external_uri",
      [toString(uri)],
      adminAddress,
      seq,
      signTx
    );
  }

  /**
   * Atomic batch transfer from `fromAddress` to up to 10 recipients.
   *
   * The contract validates every leg (KYC, compliance, balance) before moving
   * any funds, so either all transfers land or the whole batch is rejected.
   */
  async batchTransfer(
    fromAddress: string,
    recipients: BatchRecipient[],
    signTx: SignTx
  ): Promise<void> {
    const seq = await fetchSequence(this.server, fromAddress);
    await writeCall(
      this.server,
      this.contractId,
      "batch_transfer",
      [toAddress(fromAddress), xdr.ScVal.scvVec(recipients.map(toRecipientEntry))],
      fromAddress,
      seq,
      signTx
    );
  }
}
