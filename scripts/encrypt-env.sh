#!/usr/bin/env bash
set -euo pipefail

# Encrypt .env.secret → .env.enc with SOPS + age
# Usage: 1) edit .env.secret  2) bash scripts/encrypt-env.sh

APP_DIR="/opt/nexus"
AGE_KEY="$APP_DIR/.age-key.txt"
ENV_SECRET="$APP_DIR/.env.secret"
ENV_ENC="$APP_DIR/.env.enc"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

[[ ! -f "$AGE_KEY" ]] && error "Age key not found at $AGE_KEY"

AGE_PUB=$(grep "public key:" "$AGE_KEY" | awk '{print $NF}')
info "Using age public key: $AGE_PUB"

if [[ ! -f "$ENV_SECRET" ]]; then
    info "Creating .env.secret template ..."
    cat > "$ENV_SECRET" << 'TMPL'
# ═══════════════════════════════════════════════════════════
# Nexus Wiki — Secrets (will be encrypted with SOPS + age)
# ═══════════════════════════════════════════════════════════
# ─── OpenAI ───
OPENAI_API_KEY=your-key-here
# ─── External platform DB password ───
EXTERNAL_DB_PASSWORD=your-password-here
TMPL
    chmod 600 "$ENV_SECRET"
    warn "Template created at $ENV_SECRET — edit it, then run this script again"
    exit 0
fi

info "Encrypting .env.secret → .env.enc ..."
sops --encrypt \
    --age "$AGE_PUB" \
    --input-type dotenv \
    --output-type dotenv \
    "$ENV_SECRET" > "$ENV_ENC"

chmod 600 "$ENV_ENC"
info "Encrypted: $ENV_ENC"

# Verify
info "Verifying decryption ..."
export SOPS_AGE_KEY_FILE="$AGE_KEY"
if sops --decrypt --input-type dotenv --output-type dotenv "$ENV_ENC" | grep -q "OPENAI_API_KEY"; then
    info "✅ Verification OK"
else
    error "Decryption verification failed!"
fi

echo ""
echo -e "${YELLOW}Delete plaintext .env.secret? (recommended) [y/N]${NC}"
read -r REPLY
if [[ "$REPLY" =~ ^[Yy]$ ]]; then
    rm -f "$ENV_SECRET"
    info "Plaintext .env.secret deleted"
else
    warn "Plaintext .env.secret kept — consider deleting it manually"
fi
