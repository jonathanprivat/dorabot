#!/bin/bash
# Setup multi-account OAuth for dorabot
# Run this script to register Claude accounts for auto-rotation.
#
# Usage:
#   ./scripts/setup-multi-account.sh migrate     # Migrate existing auth to slot 0
#   ./scripts/setup-multi-account.sh add <label>  # Add a new account via OAuth flow
#   ./scripts/setup-multi-account.sh list         # List registered accounts
#   ./scripts/setup-multi-account.sh switch <N>   # Switch to slot N
#   ./scripts/setup-multi-account.sh status       # Show multi-account status

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

case "${1:-help}" in
  migrate)
    echo "Migrating existing dorabot OAuth tokens to multi-account slot 0..."
    cd "$SCRIPT_DIR"
    node -e "
      import('./dist/auth/multi-account.js').then(m => {
        const ok = m.migrateFromLegacy('anthropic-oauth', '${2:-Primary}');
        if (ok) {
          console.log('Migrated to slot 0 as \"${2:-Primary}\"');
        } else {
          console.log('Nothing to migrate (no existing tokens or already migrated)');
        }
      });
    "
    ;;

  add)
    LABEL="${2:-Account}"
    echo "Adding account: $LABEL"
    echo ""
    echo "This will open a browser window for OAuth authentication."
    echo "Sign in with the Claude account you want to add."
    echo ""
    echo "Step 1: Opening authorization URL..."

    cd "$SCRIPT_DIR"
    # Generate PKCE challenge and open browser
    AUTH_DATA=$(node -e "
      import('node:crypto').then(crypto => {
        const verifier = crypto.randomBytes(32).toString('base64url');
        const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
        const state = crypto.randomBytes(32).toString('hex');
        const clientId = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
        const redirectUri = 'https://console.anthropic.com/oauth/code/callback';
        const params = new URLSearchParams({
          response_type: 'code',
          client_id: clientId,
          redirect_uri: redirectUri,
          scope: 'user:inference user:profile',
          state,
          code_challenge: challenge,
          code_challenge_method: 'S256',
        });
        const url = 'https://claude.ai/oauth/authorize?' + params;
        console.log(JSON.stringify({ verifier, state, url }));
      });
    ")

    VERIFIER=$(echo "$AUTH_DATA" | node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);console.log(j.verifier)})")
    STATE=$(echo "$AUTH_DATA" | node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);console.log(j.state)})")
    URL=$(echo "$AUTH_DATA" | node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);console.log(j.url)})")

    open "$URL"

    echo ""
    echo "Step 2: After signing in, you'll be redirected to a page with a code."
    echo "Paste the code#state value here (the full string from the URL/page):"
    read -r AUTH_CODE

    echo ""
    echo "Step 3: Exchanging code for tokens..."

    CODE_PART=$(echo "$AUTH_CODE" | cut -d'#' -f1)

    node -e "
      const clientId = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
      const tokenUrl = 'https://console.anthropic.com/v1/oauth/token';
      const redirectUri = 'https://console.anthropic.com/oauth/code/callback';

      fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code: '${CODE_PART}',
          state: '${STATE}',
          redirect_uri: redirectUri,
          client_id: clientId,
          code_verifier: '${VERIFIER}',
        }),
      })
      .then(r => r.json())
      .then(async data => {
        if (!data.access_token) {
          console.error('Token exchange failed:', data);
          process.exit(1);
        }
        const tokens = {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: Date.now() + ((data.expires_in || 28800) * 1000),
        };
        const m = await import('./dist/auth/multi-account.js');
        const slot = m.addAccount(tokens, '${LABEL}');
        if (slot !== null) {
          console.log('Added account \"${LABEL}\" at slot ' + slot);
          console.log('Accounts:', m.getAccountSummary());
        } else {
          console.error('Failed to add account (all slots full?)');
        }
      })
      .catch(err => { console.error('Error:', err); process.exit(1); });
    "
    ;;

  list)
    cd "$SCRIPT_DIR"
    node -e "
      import('./dist/auth/multi-account.js').then(m => {
        const accounts = m.listAccounts();
        if (accounts.length === 0) {
          console.log('No accounts registered. Run: ./scripts/setup-multi-account.sh migrate');
          return;
        }
        console.log(m.getAccountSummary());
        console.log('');
        console.log('Multi-account enabled:', m.isMultiAccountEnabled());
      });
    "
    ;;

  switch)
    SLOT="${2:?Usage: setup-multi-account.sh switch <slot-number>}"
    cd "$SCRIPT_DIR"
    node -e "
      import('./dist/auth/multi-account.js').then(m => {
        const ok = m.setActiveSlot(${SLOT});
        if (ok) {
          console.log('Switched to slot ${SLOT}');
          console.log(m.getAccountSummary());
        } else {
          console.log('Failed to switch (slot ${SLOT} not found or has no tokens)');
        }
      });
    "
    ;;

  status)
    cd "$SCRIPT_DIR"
    node -e "
      import('./dist/auth/multi-account.js').then(m => {
        console.log('Multi-account enabled:', m.isMultiAccountEnabled());
        console.log('Active slot:', m.getActiveSlot());
        console.log('Summary:', m.getAccountSummary());
        console.log('');
        const accounts = m.listAccounts();
        for (const a of accounts) {
          console.log('  Slot ' + a.slot + ': ' + a.label + ' (tokens: ' + a.hasTokens + ')');
        }
      });
    "
    ;;

  *)
    echo "dorabot multi-account setup"
    echo ""
    echo "Usage:"
    echo "  $0 migrate [label]    Migrate existing OAuth tokens to slot 0"
    echo "  $0 add <label>        Add a new account via OAuth flow"
    echo "  $0 list               List registered accounts"
    echo "  $0 switch <slot>      Switch active account"
    echo "  $0 status             Show multi-account status"
    echo ""
    echo "Quick start:"
    echo "  1. $0 migrate 'Primary'           # Move existing auth to slot 0"
    echo "  2. $0 add 'Work Account'          # Add second account"
    echo "  3. $0 status                      # Verify both accounts"
    echo ""
    echo "After setup, dorabot will auto-rotate between accounts on rate limit."
    ;;
esac
