#!/usr/bin/env bash
# Add an address to the compliance engine transfer blocklist.
# Usage: bash scripts/admin/add-blocklist.sh <address>
#
# Example:
#   bash scripts/admin/add-blocklist.sh GA...

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../../frontend/.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a; source "$ENV_FILE"; set +a
fi

ADDR="${1:?Usage: add-blocklist.sh <address>}"
NETWORK="${VITE_STELLAR_NETWORK:-testnet}"
IDENTITY="${ADMIN_IDENTITY:-alice}"

echo "==> Adding $ADDR to blocklist..."
stellar contract invoke \
  --id "$VITE_COMPLIANCE_ENGINE_ID" \
  --network "$NETWORK" \
  --source-account "$IDENTITY" \
  -- add_to_blocklist \
  --addr "$ADDR"

echo "Done."
