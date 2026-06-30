#!/usr/bin/env bash
# Set compliance rules on the compliance engine.
# Usage: bash scripts/admin/set-rules.sh <max_transfer_amount> <min_holding_period_secs> \
#          <max_holders> <require_same_jurisdiction> <paused> <allowlist_mode>
#
# Example (no limits, not paused, no allowlist):
#   bash scripts/admin/set-rules.sh 0 0 0 false false false
#
# Example (cap 1000 tokens, 7-day hold, 500 holders, same-jurisdiction only):
#   bash scripts/admin/set-rules.sh 1000 604800 500 true false false

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../../frontend/.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a; source "$ENV_FILE"; set +a
fi

MAX_TRANSFER="${1:?Usage: set-rules.sh <max_transfer> <min_holding_secs> <max_holders> <require_same_jurisdiction> <paused> <allowlist_mode>}"
MIN_HOLD="${2:?Missing min_holding_period_secs}"
MAX_HOLDERS="${3:?Missing max_holders}"
SAME_JURISDICTION="${4:?Missing require_same_jurisdiction (true/false)}"
PAUSED="${5:?Missing paused (true/false)}"
ALLOWLIST_MODE="${6:?Missing allowlist_mode (true/false)}"
NETWORK="${VITE_STELLAR_NETWORK:-testnet}"
IDENTITY="${ADMIN_IDENTITY:-alice}"

echo "==> Setting compliance rules..."
stellar contract invoke \
  --id "$VITE_COMPLIANCE_ENGINE_ID" \
  --network "$NETWORK" \
  --source-account "$IDENTITY" \
  -- set_rules \
  --rules "{\"max_transfer_amount\":$MAX_TRANSFER,\"min_holding_period\":$MIN_HOLD,\"max_holders\":$MAX_HOLDERS,\"require_same_jurisdiction\":$SAME_JURISDICTION,\"paused\":$PAUSED,\"allowlist_mode\":$ALLOWLIST_MODE}"

echo "Done."
