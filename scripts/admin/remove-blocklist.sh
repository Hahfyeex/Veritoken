#!/usr/bin/env bash
# Remove an address from the compliance engine transfer blocklist.
# Usage: bash scripts/admin/remove-blocklist.sh <address>
#
# Example:
#   bash scripts/admin/remove-blocklist.sh GA...

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../../frontend/.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a; source "$ENV_FILE"; set +a
fi

ADDR="${1:?Usage: remove-blocklist.sh <address>}"
NETWORK="${VITE_STELLAR_NETWORK:-testnet}"
IDENTITY="${ADMIN_IDENTITY:-alice}"

echo "==> Removing $ADDR from blocklist..."
stellar contract invoke \
  --id "$VITE_COMPLIANCE_ENGINE_ID" \
  --network "$NETWORK" \
  --source-account "$IDENTITY" \
  -- remove_from_blocklist \
  --addr "$ADDR"

echo "Done."
