#!/usr/bin/env bash
# Revoke KYC approval for a subject address.
# Usage: bash scripts/admin/revoke-kyc.sh <subject_address>
#
# Example:
#   bash scripts/admin/revoke-kyc.sh GA...

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../../frontend/.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a; source "$ENV_FILE"; set +a
fi

SUBJECT="${1:?Usage: revoke-kyc.sh <subject_address>}"
NETWORK="${VITE_STELLAR_NETWORK:-testnet}"
IDENTITY="${ADMIN_IDENTITY:-alice}"
ADMIN_ADDR="${ADMIN_ADDR:-$(stellar keys address "$IDENTITY")}"

echo "==> Revoking KYC for $SUBJECT..."
stellar contract invoke \
  --id "$VITE_KYC_REGISTRY_ID" \
  --network "$NETWORK" \
  --source-account "$IDENTITY" \
  -- revoke \
  --verifier "$ADMIN_ADDR" \
  --subject "$SUBJECT"

echo "Done."
