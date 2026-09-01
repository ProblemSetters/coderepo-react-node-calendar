#!/bin/bash
set -e

MODE="${1:-}"
SEED_SIGNATURE_FILE=".seed-signature"

log_info() { echo -e "\033[0;32m[INFO]\033[0m $1"; }
log_warn() { echo -e "\033[1;33m[WARN]\033[0m $1"; }
log_error() { echo -e "\033[0;31m[ERROR]\033[0m $1"; }

setup_env() {
    for file in .env frontend/.env backend/.env; do
        example="${file}.example"
        if [ -f "$example" ] && [ ! -f "$file" ]; then
            cp "$example" "$file"
            log_info "Created $file"
        fi
    done
}

MONGO_HOST="127.0.0.1"
MONGO_PORT="27017"

mongo_is_reachable() {
    (exec 3<>"/dev/tcp/${MONGO_HOST}/${MONGO_PORT}") >/dev/null 2>&1
}

check_mongo() {
    if mongo_is_reachable; then
        log_info "MongoDB is already reachable on ${MONGO_PORT}"
        return
    fi
    log_warn "MongoDB is not reachable; starting it"
    mongod --config /etc/mongod.conf --fork >/dev/null 2>&1 || true
    mongo_is_reachable || {
        log_error "MongoDB is required on ${MONGO_HOST}:${MONGO_PORT}. Start it, then run this again."
        exit 1
    }
}

seed_signature() {
    if command -v md5sum >/dev/null 2>&1; then
        md5sum backend/src/scripts/seed.js | cut -d' ' -f1
    else
        md5 -q backend/src/scripts/seed.js
    fi
}

seed_if_needed() {
    current_signature="$(seed_signature)"
    stored_signature="$(test -f "$SEED_SIGNATURE_FILE" && sed -n '1p' "$SEED_SIGNATURE_FILE" || true)"
    if [ "$current_signature" = "$stored_signature" ]; then
        log_info "Seed data is current"
        return
    fi
    log_info "Seeding Calendar database"
    bun run seed
    seed_signature > "$SEED_SIGNATURE_FILE"
}

setup_env
check_mongo

case "$MODE" in
    --start) ;;
    --seed) bun run seed; seed_signature > "$SEED_SIGNATURE_FILE" ;;
    --ensure-seeded|"") seed_if_needed ;;
    *) log_error "Unknown setup mode: $MODE"; exit 1 ;;
esac

log_info "Calendar setup complete"
