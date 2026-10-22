# Contributing to Veritoken

Thanks for your interest in contributing. Veritoken is a Soroban smart contract toolkit for RWA tokenization on Stellar — contributions of all kinds are welcome.

---

## Prerequisites

- Rust (stable)
- `wasm32-unknown-unknown` target: `rustup target add wasm32-unknown-unknown`
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli)
- Node.js ≥ 20 (for frontend work)

---

## Setup

```bash
git clone https://github.com/abore9769/Veritoken
cd Veritoken
```

### Contracts

```bash
# Check all contracts compile
cargo check --target wasm32-unknown-unknown

# Run tests
cargo test --features testutils

# Build WASM artifacts
cargo build --release --target wasm32-unknown-unknown
```

### Frontend

```bash
cd frontend
cp .env.example .env   # fill in your deployed contract IDs
npm install
npm run dev
```

### Test commands by area

Run the narrowest suite that covers your change. Cargo commands run from the
repository root; npm commands run from the directory in the **Working dir**
column. Contract crates expose Soroban test helpers behind the `testutils`
feature, so pass `--features testutils` where shown (the smoke crate has no
such feature and must be run without it). None of these commands need
credentials or a funded account.

| Area | Kind | Working dir | Command |
| --- | --- | --- | --- |
| Single contract (e.g. `rwa-token`, `kyc-registry`, `compliance-engine`, `invoice-token`, `property-token`, `carbon-credit-token`, `token-helpers`) | Unit | repo root | `cargo test -p rwa-token --features testutils` |
| All contracts and Rust test crates | Unit + integration | repo root | `cargo test --features testutils` |
| Cross-contract integration suite | Integration | repo root | `cargo test -p integration-tests --features testutils` |
| Smoke tests | Integration | repo root | `cargo test -p smoke-tests` |
| Property-based fuzz tests | Integration | repo root | `cargo test -p fuzz-tests --features testutils` |
| Dividend regression tests | Integration | repo root | `cargo test -p dividend-regression-tests --features testutils` |
| SDK | Unit | `sdk/` | `npm test` |
| Frontend (all) | Unit | `frontend/` | `npm test` |
| Frontend (one file) | Unit | `frontend/` | `npx vitest run src/lib/__tests__/drafts.test.ts` |
| Integration fixtures (no network) | Unit | `tests/integration/` | `npm run test:unit` |
| Lifecycle against local quickstart | Integration | `tests/integration/` | `npm run test:lifecycle` (requires `cargo build --release --target wasm32-unknown-unknown` and `docker compose up -d` first) |
| Browser end-to-end | Integration | `tests/e2e/` | `npm test` (requires Docker and built WASMs; see `tests/e2e/README.md`) |

Install dependencies once with `npm install` from the repository root (covers
the `frontend` and `sdk` workspaces); `tests/integration` and `tests/e2e` are
separate installs inside their own directories.

---

## Making Changes

All incoming issues and pull requests must conform to the new template files. See our [Issue Triage Workflow](.github/triage-workflow.md) for more details.

1. Fork the repo and create a feature branch: `git checkout -b feat/your-feature`
2. Make your changes
3. Ensure the following pass before opening a PR:
   ```bash
   cargo fmt --check
   cargo clippy --target wasm32-unknown-unknown
   cargo test --features testutils
   ```
4. For frontend changes: `npm run build` and `npm run lint` must pass
5. Open a pull request against `main` with a clear description of what and why

---

## Contract Size Budget

Every contract in this repository has a documented maximum WASM binary size.
CI enforces these limits automatically after every release build.

Before adding a new feature to an existing contract, check the current binary
size:

```bash
cargo build --release --target wasm32-unknown-unknown
bash scripts/check-wasm-size.sh --print-sizes
```

If your change causes a contract to exceed its budget, you must either reduce
the size (remove unused code/deps, rely on workspace profile settings) or
explicitly raise the budget by updating `scripts/check-wasm-size.sh` and
`docs/contract-size-budget.md` in the same PR with a justification.

See [docs/contract-size-budget.md](docs/contract-size-budget.md) for the full
policy, current limits, and reduction techniques.

---

## Good First Issues

Look for issues labelled [`good first issue`](https://github.com/abore9769/Veritoken/issues?q=label%3A%22good+first+issue%22) — these are scoped to be approachable without deep familiarity with the full codebase.

---

## Versioning

Veritoken uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Version numbers apply to the contract suite as a whole.

| Change type | Version bump |
|---|---|
| Breaking change to a public contract function (rename, remove, change signature) | **Major** (e.g. `0.1.0` → `1.0.0`) |
| New public function added to any contract | **Minor** (e.g. `0.1.0` → `0.2.0`) |
| Bug fix with no ABI change | **Patch** (e.g. `0.1.0` → `0.1.1`) |

When opening a PR that bumps the version:

1. Update the `version` field in every `contracts/*/Cargo.toml`
2. Add an entry to `CHANGELOG.md` under a new `[x.y.z]` section following the [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format
3. After the PR merges, tag the commit: `git tag vx.y.z && git push origin vx.y.z`

Breaking changes (major bumps) must be discussed in an issue before implementation.

---

## Questions

Open an [issue](https://github.com/abore9769/Veritoken/issues) or start a discussion on GitHub. For significant changes, open an issue first to align on approach before writing code. Please use the appropriate [issue template](.github/ISSUE_TEMPLATE/) when creating new issues.

---

## Troubleshooting

If you run into problems with environment setup, contract deployment, wallet
connection, or CI, see [docs/troubleshooting.md](docs/troubleshooting.md) for
symptoms, causes, and concrete fixes.

---

## Security Review

Before submitting changes that touch authorization logic, storage keys, or
transfer flow, work through the [Security Review Checklist](docs/security-checklist.md).
It is specific to the current architecture and covers the most common findings
in Soroban contract reviews.
