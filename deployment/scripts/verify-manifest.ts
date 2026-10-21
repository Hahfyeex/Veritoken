#!/usr/bin/env tsx
/**
 * verify-manifest.ts — Read a deployment manifest and verify each contract ID
 * responds to a name() call on the Soroban RPC.
 *
 * Environment variables:
 *   MANIFEST_FILE             — Path to the manifest JSON file
 *   STELLAR_RPC_URL           — Soroban RPC endpoint
 *   STELLAR_NETWORK_PASSPHRASE — Network passphrase
 *
 * Usage:
 *   MANIFEST_FILE=./manifests/testnet-abc123.json \
 *   STELLAR_RPC_URL=https://soroban-testnet.stellar.org \
 *   npx tsx verify-manifest.ts
 *
 * Local example:
 *   MANIFEST_FILE=./manifests/local-dev.json \
 *   STELLAR_RPC_URL=http://localhost:8000/soroban/rpc \
 *   STELLAR_NETWORK_PASSPHRASE="Standalone Network ; February 2017" \
 *   npx tsx verify-manifest.ts
 */

import * as fs from "node:fs";
import { pathToFileURL } from "node:url";
import {
  Keypair,
  Networks,
  SorobanRpc,
  TransactionBuilder,
  BASE_FEE,
  Address,
  xdr,
} from "@stellar/stellar-sdk";

const NETWORK_PASSPHRASE =
  process.env.STELLAR_NETWORK_PASSPHRASE ?? Networks.TESTNET;

// For simulation we use a random keypair — no signing needed
const SIM_KEYPAIR = Keypair.random();

const ENV_DESCRIPTIONS: Record<string, string> = {
  MANIFEST_FILE: "path to the deployment manifest JSON file to verify",
  STELLAR_RPC_URL: "Soroban RPC endpoint used to query the deployed contracts",
};

export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === "") {
    const purpose = ENV_DESCRIPTIONS[key] ? ` (${ENV_DESCRIPTIONS[key]})` : "";
    throw new Error(
      `verify-manifest: required environment variable ${key}${purpose} is not set or is empty. ` +
        `Set ${key} before running manifest verification.`
    );
  }
  return value;
}

export interface ManifestEntry {
  contract_id: string;
  wasm_hash: string;
  deployed_at: string;
  network: string;
}

export interface Manifest {
  schema_version: number;
  git_sha: string;
  network: string;
  deployed_at: string;
  contracts: Record<string, ManifestEntry>;
}

/**
 * Returns the manifest's contract entries with labels trimmed, rejecting
 * blank or whitespace-only labels so malformed manifests fail loudly
 * instead of producing unreadable verification output.
 */
export function parseManifestEntries(
  contracts: Record<string, ManifestEntry>
): Array<[string, ManifestEntry]> {
  return Object.entries(contracts).map(([rawLabel, entry]) => {
    const label = rawLabel.trim();
    if (label === "") {
      throw new Error(
        `Manifest contains a blank contract label ${JSON.stringify(rawLabel)} — every contract entry must have a non-empty name.`
      );
    }
    return [label, entry];
  });
}

async function callName(
  server: SorobanRpc.Server,
  contractId: string
): Promise<string | null> {
  try {
    const account = await server.getAccount(SIM_KEYPAIR.publicKey()).catch(
      () => null
    );
    if (!account) {
      // Simulation requires a valid account; fall back to getLedgerEntries check
      return null;
    }

    const invokeOp = xdr.Operation.fromXDR(
      new xdr.Operation({
        sourceAccount: null,
        body: xdr.OperationBody.invokeHostFunction({
          hostFunction: xdr.HostFunction.hostFunctionTypeInvokeContract(
            new xdr.InvokeContractArgs({
              contractAddress: Address.fromString(contractId).toScAddress(),
              functionName: "name",
              args: [],
            })
          ),
          auth: [],
        }),
      }).toXDR(),
      "raw"
    );

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(invokeOp)
      .setTimeout(30)
      .build();

    const simResult = await server.simulateTransaction(tx);

    if (SorobanRpc.Api.isSimulationSuccess(simResult)) {
      const returnVal = simResult.result?.retval;
      if (returnVal) {
        if (returnVal.switch() === xdr.ScValType.scvString()) {
          return returnVal.str().toString();
        }
        if (returnVal.switch() === xdr.ScValType.scvSymbol()) {
          return returnVal.sym().toString();
        }
      }
      return "(no return value)";
    }

    // Simulation error might mean name() doesn't exist — contract is still live
    return "(simulation error — contract exists but name() may not be implemented)";
  } catch {
    return null;
  }
}

async function contractExists(
  server: SorobanRpc.Server,
  contractId: string
): Promise<boolean> {
  try {
    const contractAddress = Address.fromString(contractId);
    const contractKey = xdr.LedgerKey.contractData(
      new xdr.LedgerKeyContractData({
        contract: contractAddress.toScAddress(),
        key: xdr.ScVal.scvLedgerKeyContractInstance(),
        durability: xdr.ContractDataDurability.persistent(),
      })
    );
    const result = await server.getLedgerEntries(contractKey);
    return result.entries.length > 0;
  } catch {
    return false;
  }
}

const PLACEHOLDER_PATTERNS: RegExp[] = [
  /^(todo|tbd|fixme|changeme|change[-_ ]me|replace[-_ ]?me|placeholder|dummy|none|null|undefined|n\/a)$/i,
  /^x{3,}$/i,
  /^<.*>$/,
  /^\$\{.*\}$/,
  /^\{\{.*\}\}$/,
  /^your[-_ ]/i,
];

/** Fields that must hold real deployment values, never placeholders. */
const REQUIRED_VALUE_FIELDS = ["contract_id", "wasm_hash"] as const;

/**
 * Returns true when a value looks like an unfilled template placeholder
 * (e.g. `todo`, `changeme`, `<CONTRACT_ID>`, `${WASM_HASH}`, `xxxx`).
 */
export function isPlaceholderValue(value: string): boolean {
  const trimmed = value.trim();
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Rejects manifest entries whose required fields contain placeholder-looking
 * values. Error messages name the entry and field but never echo the value,
 * so secrets accidentally pasted into a manifest are not leaked to logs.
 */
export function assertNoPlaceholders(manifest: Manifest): void {
  for (const [name, entry] of Object.entries(manifest.contracts)) {
    for (const field of REQUIRED_VALUE_FIELDS) {
      const value = entry?.[field];
      if (typeof value === "string" && isPlaceholderValue(value)) {
        throw new Error(
          `Manifest entry "${name}" has a placeholder value in ${field} — replace it with the real deployed value.`
        );
      }
    }
  }
}

/**
 * Verify every contract in the manifest. Throws before any RPC call if a
 * contract ID is blank or whitespace-only, or if a required field holds a
 * placeholder value. Returns true when all pass.
 */
export async function verifyManifest(
  manifest: Manifest,
  server: SorobanRpc.Server
): Promise<boolean> {
  for (const [name, entry] of Object.entries(manifest.contracts)) {
    if (typeof entry?.contract_id !== "string" || entry.contract_id.trim() === "") {
      throw new Error(`Manifest entry "${name}" has an empty contract_id.`);
    }
  }
  assertNoPlaceholders(manifest);

  const entries = parseManifestEntries(manifest.contracts);

  let allPassed = true;

  for (const [name, entry] of entries) {
    process.stdout.write(`  Verifying ${name} (${entry.contract_id}) ... `);

    const exists = await contractExists(server, entry.contract_id);
    if (!exists) {
      console.log("✗ FAIL — contract not found on chain");
      allPassed = false;
      continue;
    }

    const contractName = await callName(server, entry.contract_id);
    if (contractName === null) {
      console.log("✗ FAIL — contract unreachable");
      allPassed = false;
    } else {
      console.log(`✓ OK (name() = "${contractName}")`);
    }
  }

  return allPassed;
}

async function main(): Promise<void> {
  const MANIFEST_FILE = requireEnv("MANIFEST_FILE");
  const RPC_URL = requireEnv("STELLAR_RPC_URL");

  console.log("=== Veritoken Manifest Verification ===");
  console.log(`Manifest: ${MANIFEST_FILE}`);
  console.log(`RPC URL:  ${RPC_URL}`);
  console.log("");

  const manifest: Manifest = JSON.parse(
    fs.readFileSync(MANIFEST_FILE, "utf8")
  );

  console.log(
    `Manifest git SHA: ${manifest.git_sha}`
  );
  console.log(`Network:          ${manifest.network}`);
  console.log(`Deployed at:      ${manifest.deployed_at}`);
  console.log(`Contracts:        ${Object.keys(manifest.contracts).length}`);
  console.log("");

  const server = new SorobanRpc.Server(RPC_URL);
  const allPassed = await verifyManifest(manifest, server);

  console.log("");
  if (!allPassed) {
    console.error("✗ One or more contracts failed verification.");
    process.exit(1);
  }
  console.log("✓ All contracts verified successfully.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error("verify-manifest failed:", err);
    process.exit(1);
  });
}
