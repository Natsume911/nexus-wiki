#!/usr/bin/env bash
set -euo pipefail

# Decrypt .env.enc → .env.runtime, then merge with .env
# Usage: bash scripts/decrypt-env.sh

APP_DIR="/opt/nexus"
AGE_KEY="$APP_DIR/.age-key.txt"
ENV_ENC="$APP_DIR/.env.enc"
ENV_BASE="$APP_DIR/.env"
ENV_RUNTIME="$APP_DIR/.env.runtime"

RED='\033[0;31m'; GREEN='\033[0;32m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

[[ ! -f "$AGE_KEY" ]] && error "Age key not found at $AGE_KEY"
[[ ! -f "$ENV_ENC" ]] && error "Encrypted env not found at $ENV_ENC"

info "Decrypting .env.enc ..."
export SOPS_AGE_KEY_FILE="$AGE_KEY"
DECRYPTED=$(sops --decrypt --input-type dotenv --output-type dotenv "$ENV_ENC")

# Merge: .env (non-secret) + decrypted secrets → .env.runtime
{
  cat "$ENV_BASE"
  echo ""
  echo "# ─── Decrypted secrets (from .env.enc) ───"
  echo "$DECRYPTED"
} > "$ENV_RUNTIME"

chmod 600 "$ENV_RUNTIME"
info "Created $ENV_RUNTIME (merged .env + decrypted secrets)"
info "Secrets available: $(echo "$DECRYPTED" | grep -c '='  ) variables"
