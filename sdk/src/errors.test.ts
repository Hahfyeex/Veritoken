import { describe, it, expect } from "vitest";
import {
  lookupError,
  parseContractError,
  formatContractError,
} from "./errors.js";

describe("lookupError", () => {
  it("returns the correct error for known RWA token code 2 (KycNotApproved)", () => {
    const err = lookupError("rwa", 2);
    expect(err).toEqual({
      code: 2,
      name: "KycNotApproved",
      message: "Address has not passed KYC verification",
    });
  });

  it("returns the correct error for known RWA token code 3 (TransferBlocked)", () => {
    const err = lookupError("rwa", 3);
    expect(err).toEqual({
      code: 3,
      name: "TransferBlocked",
      message: "Transfer was rejected by the compliance engine",
    });
  });

  it("returns the correct error for known RWA token code 6 (InsufficientAllowance)", () => {
    const err = lookupError("rwa", 6);
    expect(err).toEqual({
      code: 6,
      name: "InsufficientAllowance",
      message: "Insufficient allowance",
    });
  });

  it("returns the correct error for known KYC codes", () => {
    const err = lookupError("kyc", 3);
    expect(err).toEqual({
      code: 3,
      name: "NotApproved",
      message: "Subject does not have an approved KYC record",
    });
  });

  it("returns the correct error for known compliance codes", () => {
    const err = lookupError("compliance", 4);
    expect(err).toEqual({
      code: 4,
      name: "MaxHoldersBelowCurrentCount",
      message: "New max-holders limit is below the current holder count",
    });
  });

  it("returns the correct error for known invoice codes", () => {
    const err = lookupError("invoice", 11);
    expect(err).toEqual({
      code: 11,
      name: "InvoiceNotFound",
      message: "Invoice record not found",
    });
  });

  it("returns the correct error for known property codes", () => {
    const err = lookupError("property", 5);
    expect(err).toEqual({
      code: 5,
      name: "KycTierInsufficient",
      message: "KYC tier is too low for this operation",
    });
  });

  it("returns the correct error for known carbon codes", () => {
    const err = lookupError("carbon", 4);
    expect(err).toEqual({
      code: 4,
      name: "InsufficientBalance",
      message: "Insufficient token balance for retirement",
    });
  });

  it("returns null for unrecognised codes", () => {
    expect(lookupError("rwa", 999)).toBeNull();
    expect(lookupError("kyc", 500)).toBeNull();
  });

  // ── RWA errors — full enum coverage ────────────────────────────────────────
  it("returns correct entry for every RwaError variant", () => {
    const expected: Array<[number, string]> = [
      [1, "AlreadyInitialized"],
      [2, "KycNotApproved"],
      [3, "TransferBlocked"],
      [4, "InsufficientBalance"],
      [5, "AllowanceExpired"],
      [6, "InsufficientAllowance"],
      [7, "AccountFrozen"],
      [8, "NegativeAmount"],
      [9, "BatchTooLarge"],
      [10, "RecoveryNotConfigured"],
      [11, "NotRecoveryMember"],
      [12, "RecoveryAlreadyActive"],
      [13, "AlreadyApproved"],
      [14, "NoActiveRecovery"],
      [15, "InvalidRecoveryConfig"],
      [16, "ExceedsMaxSupply"],
      [17, "InvalidNonce"],
      [18, "ComplianceEngineUnavailable"],
      [19, "KycRegistryUnavailable"],
      [20, "UnauthorizedRole"],
      [21, "BatchAmountOverflow"],
      [22, "HolderLimitExceeded"],
      [23, "MigrationVersionConflict"],
      [24, "MigrationVersionNotSequential"],
      [25, "RecoveryExpired"],
      [26, "InsufficientApprovals"],
      [27, "ProposerCannotApprove"],
      [28, "RecoveryCooldown"],
      [29, "NotInitialized"],
      [30, "InvalidAssetType"],
      [31, "EmptyBatch"],
      [32, "NoPendingAdmin"],
      [33, "AlreadyAdmin"],
    ];

    for (const [code, name] of expected) {
      const err = lookupError("rwa", code);
      expect(err, `rwa code ${code}`).not.toBeNull();
      expect(err!.name, `rwa code ${code} name`).toBe(name);
      expect(err!.message.length, `rwa code ${code} message`).toBeGreaterThan(0);
    }
  });

  // ── KYC errors — full enum coverage ────────────────────────────────────────
  it("returns correct entry for every KycError variant", () => {
    const expected: Array<[number, string]> = [
      [1, "AlreadyInitialized"],
      [2, "NotVerifier"],
      [3, "NotApproved"],
      [4, "NoRecord"],
      [5, "InvalidJurisdiction"],
      [6, "NotAdmin"],
      [7, "EmptyAdminList"],
      [8, "NotAuthorized"],
      [9, "AlreadyAtSchemaVersion"],
      [10, "MigrationVersionNotSequential"],
    ];
    for (const [code, name] of expected) {
      const err = lookupError("kyc", code);
      expect(err, `kyc code ${code}`).not.toBeNull();
      expect(err!.name, `kyc code ${code} name`).toBe(name);
      expect(err!.message.length, `kyc code ${code} message`).toBeGreaterThan(0);
    }
  });

  // ── Compliance errors — full enum coverage ──────────────────────────────────
  it("returns correct entry for every ComplianceError variant", () => {
    const expected: Array<[number, string]> = [
      [1, "AlreadyInitialized"],
      [2, "MinHoldingPeriodExceeds365Days"],
      [3, "NegativeMaxTransferAmount"],
      [4, "MaxHoldersBelowCurrentCount"],
      [5, "NoRulesPending"],
      [6, "TooEarlyToActivate"],
      [7, "InvalidRiskScore"],
      [8, "InvalidRiskConfig"],
      [9, "AlreadyAtSchemaVersion"],
      [10, "MigrationVersionNotSequential"],
    ];
    for (const [code, name] of expected) {
      const err = lookupError("compliance", code);
      expect(err, `compliance code ${code}`).not.toBeNull();
      expect(err!.name, `compliance code ${code} name`).toBe(name);
      expect(err!.message.length, `compliance code ${code} message`).toBeGreaterThan(0);
    }
  });
});

describe("parseContractError", () => {
  it("preserves unknown contract error codes in a stable fallback", () => {
    const parsed = parseContractError("carbon", "Error(Contract, #9876)");

    expect(parsed).toEqual({
      code: 9876,
      name: "UnknownContractError",
      message: "Unknown error 9876 from contract carbon",
    });
  });

  it("parses an AlreadyInitialized Soroban error", () => {
    const parsed = parseContractError(
      "rwa",
      "Error(Contract, #1)"
    );
    expect(parsed).toEqual({
      code: 1,
      name: "AlreadyInitialized",
      message: "Contract is already initialized",
    });
  });

  it("parses an error string with whitespace variations", () => {
    const parsed = parseContractError(
      "compliance",
      "Error(Contract,#2)"
    );
    expect(parsed).toEqual({
      code: 2,
      name: "MinHoldingPeriodExceeds365Days",
      message: "Minimum holding period cannot exceed 365 days",
    });
  });

  it("returns null for non-contract errors", () => {
    expect(parseContractError("rwa", "Some other error")).toBeNull();
    expect(parseContractError("kyc", "Timeout")).toBeNull();
  });

  it("returns null for a string with no error code (#622)", () => {
    expect(parseContractError("rwa", "InvokeHostFunctionFailed")).toBeNull();
    expect(parseContractError("carbon", "Transaction failed")).toBeNull();
  });

  it("returns a well-defined fallback when the error code is not recognised", () => {
    const parsed = parseContractError("rwa", "Error(Contract, #9999)");
    expect(parsed).not.toBeNull();
    expect(parsed!.name).toBe("UnknownContractError");
    expect(parsed!.code).toBe(9999);
  });
});

describe("formatContractError", () => {
  it("formats a recognised Soroban contract error", () => {
    const err = new Error("Transaction failed: Error(Contract, #7)");
    const formatted = formatContractError("rwa", err);
    expect(formatted).toContain("Account is frozen");
    expect(formatted).toContain("AccountFrozen");
    expect(formatted).toContain("#7");
  });

  it("returns the raw message for unrecognised errors", () => {
    const err = new Error("Network timeout");
    const formatted = formatContractError("rwa", err);
    expect(formatted).toBe("Network timeout");
  });

  it("handles non-Error objects", () => {
    const formatted = formatContractError("kyc", "Plain string error");
    expect(formatted).toBe("Plain string error");
  });

  it("formats different contracts correctly", () => {
    const carbonErr = formatContractError(
      "carbon",
      new Error("Error(Contract, #10)")
    );
    expect(carbonErr).toContain("Amount must be greater than zero");
    expect(carbonErr).toContain("InvalidAmount");

    const invoiceErr = formatContractError(
      "invoice",
      new Error("Error(Contract, #12)")
    );
    expect(invoiceErr).toContain("Invoice has already been settled");
    expect(invoiceErr).toContain("InvoiceAlreadySettled");
  });
});
