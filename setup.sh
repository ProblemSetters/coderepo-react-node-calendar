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

find_mongod() {
    MONGOD_BIN="$(command -v mongod || true)"
    BREW_BIN="$(command -v brew || true)"
    if [ -z "$BREW_BIN" ] && [ -x "/opt/homebrew/bin/brew" ]; then
        BREW_BIN="/opt/homebrew/bin/brew"
    fi
    if [ -z "$MONGOD_BIN" ] && [ -n "$BREW_BIN" ]; then
        MONGOD_PREFIX="$($BREW_BIN --prefix mongodb-community 2>/dev/null || true)"
        if [ -n "$MONGOD_PREFIX" ]; then MONGOD_BIN="$MONGOD_PREFIX/bin/mongod"; fi
    fi
}

check_mongo() {
    if pgrep -x "mongod" >/dev/null 2>&1; then
        log_info "MongoDB is already running"
        return
    fi
    find_mongod
    if [ ! -x "$MONGOD_BIN" ]; then
        log_error "MongoDB is required. Install it with: brew tap mongodb/brew && brew install mongodb-community"
        exit 1
    fi
    log_warn "MongoDB is not running; starting it"
    if [ -n "$BREW_BIN" ]; then "$BREW_BIN" services start mongodb-community >/dev/null 2>&1 || true; fi
    sleep 1
    if ! pgrep -x "mongod" >/dev/null 2>&1; then
        mkdir -p .mongodb/data
        "$MONGOD_BIN" --dbpath .mongodb/data --logpath .mongodb/mongod.log --fork >/dev/null 2>&1
    fi
    pgrep -x "mongod" >/dev/null 2>&1 || { log_error "MongoDB could not be started"; exit 1; }
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
