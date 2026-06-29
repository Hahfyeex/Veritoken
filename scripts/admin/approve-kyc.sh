#!/usr/bin/env bash
# Approve KYC for a subject address.
# Usage: bash scripts/admin/approve-kyc.sh <subject_address> <tier> <expiry_timestamp> <jurisdiction>
#
# Example:
#   bash scripts/admin/approve-kyc.sh GA... 1 1735689600 US

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../../frontend/.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a; source "$ENV_FILE"; set +a
fi

SUBJECT="${1:?Usage: approve-kyc.sh <subject_address> <tier> <expiry_timestamp> <jurisdiction>}"
TIER="${2:?Missing tier (e.g. 1)}"
EXPIRY="${3:?Missing expiry timestamp (unix seconds; 0 = no expiry)}"
JURISDICTION="${4:?Missing jurisdiction (e.g. US)}"
NETWORK="${VITE_STELLAR_NETWORK:-testnet}"
IDENTITY="${ADMIN_IDENTITY:-alice}"
ADMIN_ADDR="${ADMIN_ADDR:-$(stellar keys address "$IDENTITY")}"

echo "==> Approving KYC for $SUBJECT (tier=$TIER expiry=$EXPIRY jurisdiction=$JURISDICTION)..."
stellar contract invoke \
  --id "$VITE_KYC_REGISTRY_ID" \
  --network "$NETWORK" \
  --source-account "$IDENTITY" \
  -- approve \
  --verifier "$ADMIN_ADDR" \
  --subject "$SUBJECT" \
  --tier "$TIER" \
  --expiry "$EXPIRY" \
  --jurisdiction "$JURISDICTION"

echo "Done."
