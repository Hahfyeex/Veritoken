#!/usr/bin/env bash
# Check the KYC status of an address.
# Usage: bash scripts/admin/check-kyc.sh <address>
#
# Example:
#   bash scripts/admin/check-kyc.sh GA...

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../../frontend/.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a; source "$ENV_FILE"; set +a
fi

ADDR="${1:?Usage: check-kyc.sh <address>}"
NETWORK="${VITE_STELLAR_NETWORK:-testnet}"
IDENTITY="${ADMIN_IDENTITY:-alice}"

echo "==> KYC record for $ADDR:"
stellar contract invoke \
  --id "$VITE_KYC_REGISTRY_ID" \
  --network "$NETWORK" \
  --source-account "$IDENTITY" \
  -- get_record \
  --addr "$ADDR"
