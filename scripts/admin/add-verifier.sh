#!/usr/bin/env bash
# Add a KYC verifier address to the KYC registry.
# Usage: bash scripts/admin/add-verifier.sh <verifier_address>
#
# Example:
#   bash scripts/admin/add-verifier.sh GBXXXXXX...

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../../frontend/.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a; source "$ENV_FILE"; set +a
fi

VERIFIER="${1:?Usage: add-verifier.sh <verifier_address>}"
NETWORK="${VITE_STELLAR_NETWORK:-testnet}"
IDENTITY="${ADMIN_IDENTITY:-alice}"
ADMIN_ADDR="${ADMIN_ADDR:-$(stellar keys address "$IDENTITY")}"

echo "==> Adding verifier $VERIFIER to KYC registry..."
stellar contract invoke \
  --id "$VITE_KYC_REGISTRY_ID" \
  --network "$NETWORK" \
  --source-account "$IDENTITY" \
  -- add_verifier \
  --admin "$ADMIN_ADDR" \
  --verifier "$VERIFIER"

echo "Done."
