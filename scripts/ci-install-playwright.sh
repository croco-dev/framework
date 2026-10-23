#!/usr/bin/env bash
set -euo pipefail

# Playwright invokes apt through sudo, which drops environment-only APT_CONFIG.
# Keep stalled mirror requests bounded in the ephemeral runner's apt config.
sudo tee /etc/apt/apt.conf.d/99-croco-playwright >/dev/null <<'APT'
Acquire::http::Timeout "30";
Acquire::https::Timeout "30";
Acquire::Retries "2";
APT

pnpm --dir packages/docs run playwright:install
