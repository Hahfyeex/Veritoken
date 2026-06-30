# Veritoken Admin CLI Scripts

Bash scripts for common admin operations on deployed Veritoken contracts.

All scripts read contract IDs and network settings from `frontend/.env`. Set
`ADMIN_IDENTITY` in your shell (or rely on the default `alice`) to select which
`stellar` CLI identity signs each transaction.

```bash
export ADMIN_IDENTITY=my-operator-key
```

## Prerequisites

- [`stellar` CLI](https://developers.stellar.org/docs/tools/stellar-cli) installed and in `PATH`
- A funded identity on the target network
- `frontend/.env` populated (see `frontend/.env` for required keys)

---

## KYC Registry

### `add-verifier.sh`

Register a new authorized KYC verifier.

```bash
bash scripts/admin/add-verifier.sh <verifier_address>
```

| Argument | Description |
|---|---|
| `verifier_address` | Stellar address to grant verifier privileges |

---

### `approve-kyc.sh`

Approve KYC for an investor.

```bash
bash scripts/admin/approve-kyc.sh <subject_address> <tier> <expiry_timestamp> <jurisdiction>
```

| Argument | Description |
|---|---|
| `subject_address` | Investor address to approve |
| `tier` | KYC tier (0 = Basic, 1 = Accredited, 2 = Institutional) |
| `expiry_timestamp` | Unix timestamp for expiry; `0` = no expiry |
| `jurisdiction` | Two-letter country code (e.g. `US`, `DE`) |

**Example:**
```bash
bash scripts/admin/approve-kyc.sh GA... 1 1735689600 US
```

---

### `revoke-kyc.sh`

Revoke KYC approval for an investor.

```bash
bash scripts/admin/revoke-kyc.sh <subject_address>
```

---

### `check-kyc.sh`

Query the full KYC record for an address.

```bash
bash scripts/admin/check-kyc.sh <address>
```

---

## Compliance Engine

### `set-rules.sh`

Replace the active compliance rule set.

```bash
bash scripts/admin/set-rules.sh \
  <max_transfer_amount> \
  <min_holding_period_secs> \
  <max_holders> \
  <require_same_jurisdiction> \
  <paused> \
  <allowlist_mode>
```

| Argument | Description |
|---|---|
| `max_transfer_amount` | Max tokens per transfer (0 = unlimited) |
| `min_holding_period_secs` | Min seconds before a holder can transfer (0 = none; max 31536000) |
| `max_holders` | Max distinct holders (0 = unlimited) |
| `require_same_jurisdiction` | `true` / `false` |
| `paused` | `true` / `false` |
| `allowlist_mode` | `true` = only allowlisted addresses may transfer; `false` = open |

**Example (open, no limits):**
```bash
bash scripts/admin/set-rules.sh 0 0 0 false false false
```

**Example (7-day hold, 500 holder cap, same-jurisdiction only):**
```bash
bash scripts/admin/set-rules.sh 0 604800 500 true false false
```

---

### `pause.sh`

Halt all transfers immediately.

```bash
bash scripts/admin/pause.sh
```

---

### `unpause.sh`

Resume transfers.

```bash
bash scripts/admin/unpause.sh
```

---

### `add-blocklist.sh`

Block an address from sending or receiving tokens.

```bash
bash scripts/admin/add-blocklist.sh <address>
```

---

### `remove-blocklist.sh`

Remove an address from the blocklist.

```bash
bash scripts/admin/remove-blocklist.sh <address>
```
