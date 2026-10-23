#!/usr/bin/env bash
set -euo pipefail

# The hosted runner's Azure mirror can stall or deliver packages at a trickle.
# Prefer the HTTPS archive while retaining Azure failover and the security mirror.
if [ -f /etc/apt/apt-mirrors.txt ]; then
  sudo sed -i '
    /priority:1$/s|^http://azure\.archive\.ubuntu\.com/ubuntu/|https://archive.ubuntu.com/ubuntu/|
    /priority:2$/s|^https://archive\.ubuntu\.com/ubuntu/|http://azure.archive.ubuntu.com/ubuntu/|
  ' /etc/apt/apt-mirrors.txt
fi

# Playwright invokes apt through sudo, which drops environment-only APT_CONFIG.
# Keep stalled mirror requests bounded in the ephemeral runner's apt config.
sudo tee /etc/apt/apt.conf.d/99-croco-playwright >/dev/null <<'APT'
Acquire::http::Timeout "30";
Acquire::https::Timeout "30";
Acquire::Retries "2";
APT

pnpm --dir packages/docs run playwright:install
