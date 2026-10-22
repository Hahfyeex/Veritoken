# Contract Size Budget

Every Soroban contract in this repository has an enforced maximum WASM binary
size. The hard cap is checked automatically in CI on every push and pull
request, and the per-contract budgets can also be checked locally.

---

## Why a size budget?

- Soroban charges per byte of uploaded WASM. Smaller contracts cost less to
  deploy and upgrade.
- A hard limit forces early detection of accidental size regressions (unused
  dependencies, bloated constants, etc.) before they reach production.
- A documented budget makes the trade-off explicit when a new feature genuinely
  needs more space.

---

## Current budgets

| Contract WASM | Budget |
|---|---|
| `kyc_registry.wasm` | 128 KB (131072 bytes) |
| `compliance_engine.wasm` | 128 KB (131072 bytes) |
| `rwa_token.wasm` | 128 KB (131072 bytes) |
| `invoice_token.wasm` | 128 KB (131072 bytes) |
| `property_token.wasm` | 128 KB (131072 bytes) |
| `carbon_credit_token.wasm` | 128 KB (131072 bytes) |
| `token_helpers.wasm` | 64 KB (65536 bytes) |
| _(any other .wasm)_ | 128 KB (default) |

**The authoritative limit is the 128 KB (131072-byte) CI cap.** No per-contract
budget may exceed it; a budget may only be tighter (as with `token_helpers`).

---

## Which command enforces which check

| Check | Command | Threshold | Runs in CI? |
|---|---|---|---|
| Deployment artifact bounds (existence, WASM magic bytes, 4 KB min, 128 KB max) | `bash scripts/verify-artifacts.sh` | `MAX_BYTES=131072` | Yes — `rust` job in `.github/workflows/ci.yml` |
| CI size report for every built `.wasm` | inline "Check WASM sizes against CI threshold" step | `THRESHOLD_BYTES=131072` | Yes — `rust` job in `.github/workflows/ci.yml` |
| Per-contract budgets with near-limit (≥ 90 %) warnings | `bash scripts/check-wasm-size.sh` | `BUDGETS` table (≤ 131072) | No — local pre-PR check |

`MAX_BYTES` in `scripts/verify-artifacts.sh` and `THRESHOLD_BYTES` in
`.github/workflows/ci.yml` must always hold the same value.

---

## Checking sizes locally

Build first, then run the check script:

```bash
cargo build --release --target wasm32v1-none
bash scripts/check-wasm-size.sh
```

To run the same checks CI enforces:

```bash
WASM_DIR=target/wasm32v1-none/release bash scripts/verify-artifacts.sh
```

To print sizes without enforcing limits (useful when measuring a new baseline):

```bash
bash scripts/check-wasm-size.sh --print-sizes
```

---

## CI integration

After every release WASM build, the `rust` job in `.github/workflows/ci.yml`
runs `scripts/verify-artifacts.sh` and then the inline size-threshold step. A
contract that exceeds the 128 KB cap fails CI immediately, preventing the
oversized binary from being merged. `scripts/check-wasm-size.sh` is not run in
CI; use it locally to catch contracts approaching their budget.

---

## Reducing binary size

If a contract grows beyond its budget, try the following in order:

1. **Remove unused dependencies** — audit `Cargo.toml` for crates that are no
   longer needed.
2. **Profile release settings** — confirm `Cargo.toml` (workspace root) has:
   ```toml
   [profile.release]
   opt-level = "z"
   lto = true
   codegen-units = 1
   strip = "symbols"
   ```
3. **`wasm-opt`** — run `wasm-opt -Oz <file>.wasm -o <file>.wasm` from the
   [binaryen](https://github.com/WebAssembly/binaryen) toolchain.
4. **Review data** — large string literals and look-up tables are a common
   source of bloat in no-std WASM.
5. **Split the contract** — if the feature genuinely requires more code,
   consider whether it belongs in a helper library or a separate contract.

---

## Raising a budget

If the growth is intentional and unavoidable:

1. Update the `BUDGETS` table in `scripts/check-wasm-size.sh`.
2. Update the table in this file.
3. If a budget must exceed 128 KB, raise `MAX_BYTES` in
   `scripts/verify-artifacts.sh` and `THRESHOLD_BYTES` in
   `.github/workflows/ci.yml` to the same value in the same PR.
4. Add a dated entry to the *Budget history* section below explaining why.
5. Open a PR — the change will be reviewed alongside the feature that caused it.

---

## Budget history

| Date | Contract | Old budget | New budget | Reason |
|---|---|---|---|---|
| 2026-07-28 | all | — | initial | Initial size budget established |
| 2026-10-21 | all except `token_helpers` | 200–256 KB | 128 KB | Aligned with the 128 KB cap already enforced by CI; previous values could never pass CI |
