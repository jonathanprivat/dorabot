/**
 * Multi-account OAuth management for Claude.
 *
 * Stores multiple sets of OAuth tokens in the macOS Keychain under separate
 * account names (anthropic-oauth-0, anthropic-oauth-1, ...).  A config entry
 * tracks which slot is currently active and optional labels (email) for each.
 *
 * The module is intentionally stateless between calls: every function reads
 * fresh from the keychain so the gateway can be hot-reloaded without drift.
 */

import { keychainLoad, keychainStore, keychainDelete } from './keychain.js';

// ── Types ──────────────────────────────────────────────────────────

export interface AccountSlot {
  slot: number;
  label: string;          // e.g. email or friendly name
  hasTokens: boolean;
}

export interface MultiAccountConfig {
  activeSlot: number;
  accounts: { slot: number; label: string }[];
  /** Timestamp (ms) of the last automatic rotation. */
  lastRotatedAt?: number;
}

interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

// ── Constants ──────────────────────────────────────────────────────

const CONFIG_ACCOUNT = 'multi-account-config';
const OAUTH_SLOT_PREFIX = 'anthropic-oauth-';
const MAX_SLOTS = 4;
/** Cooldown between automatic rotations (prevent tight loops). */
const ROTATION_COOLDOWN_MS = 30_000; // 30 s

// ── Config persistence ─────────────────────────────────────────────

function loadConfig(): MultiAccountConfig {
  const raw = keychainLoad(CONFIG_ACCOUNT);
  if (raw) {
    try { return JSON.parse(raw); } catch { /* fall through */ }
  }
  return { activeSlot: 0, accounts: [] };
}

function saveConfig(cfg: MultiAccountConfig): void {
  keychainStore(CONFIG_ACCOUNT, JSON.stringify(cfg));
}

// ── Slot helpers ───────────────────────────────────────────────────

function slotKey(slot: number): string {
  return `${OAUTH_SLOT_PREFIX}${slot}`;
}

export function loadSlotTokens(slot: number): OAuthTokens | null {
  const raw = keychainLoad(slotKey(slot));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function persistSlotTokens(slot: number, tokens: OAuthTokens): void {
  keychainStore(slotKey(slot), JSON.stringify(tokens));
}

function deleteSlotTokens(slot: number): void {
  keychainDelete(slotKey(slot));
}

// ── Public API ─────────────────────────────────────────────────────

/** Returns true when at least two account slots have tokens. */
export function isMultiAccountEnabled(): boolean {
  const cfg = loadConfig();
  if (cfg.accounts.length < 2) return false;
  let count = 0;
  for (const a of cfg.accounts) {
    if (loadSlotTokens(a.slot)) count++;
    if (count >= 2) return true;
  }
  return false;
}

/** Get the currently active slot index. */
export function getActiveSlot(): number {
  return loadConfig().activeSlot;
}

/** Load OAuth tokens for the currently active slot. */
export function loadActiveTokens(): OAuthTokens | null {
  return loadSlotTokens(loadConfig().activeSlot);
}

/** Persist tokens to the currently active slot. */
export function persistActiveTokens(tokens: OAuthTokens): void {
  persistSlotTokens(loadConfig().activeSlot, tokens);
}

/**
 * Rotate to the next account slot that has valid tokens.
 * Returns the new active slot, or null if rotation is on cooldown or
 * no alternate slot has tokens.
 */
export function rotateAccount(): { slot: number; label: string } | null {
  const cfg = loadConfig();

  // Cooldown guard
  if (cfg.lastRotatedAt && Date.now() - cfg.lastRotatedAt < ROTATION_COOLDOWN_MS) {
    console.log('[multi-account] rotation on cooldown, skipping');
    return null;
  }

  const candidates = cfg.accounts.filter(a => a.slot !== cfg.activeSlot);
  for (const candidate of candidates) {
    const tokens = loadSlotTokens(candidate.slot);
    if (tokens?.access_token) {
      cfg.activeSlot = candidate.slot;
      cfg.lastRotatedAt = Date.now();
      saveConfig(cfg);
      console.log(`[multi-account] rotated to slot ${candidate.slot} (${candidate.label})`);
      return { slot: candidate.slot, label: candidate.label };
    }
  }
  console.log('[multi-account] no alternate account available');
  return null;
}

/** Force-set the active slot (manual switch). */
export function setActiveSlot(slot: number): boolean {
  const cfg = loadConfig();
  const entry = cfg.accounts.find(a => a.slot === slot);
  if (!entry) return false;
  const tokens = loadSlotTokens(slot);
  if (!tokens?.access_token) return false;
  cfg.activeSlot = slot;
  saveConfig(cfg);
  console.log(`[multi-account] switched to slot ${slot} (${entry.label})`);
  return true;
}

/**
 * Register an account. Assigns the next free slot (0-based).
 * Returns the assigned slot number, or null if all slots are taken.
 */
export function addAccount(tokens: OAuthTokens, label: string): number | null {
  const cfg = loadConfig();
  // Find first unused slot
  const usedSlots = new Set(cfg.accounts.map(a => a.slot));
  let slot = -1;
  for (let i = 0; i < MAX_SLOTS; i++) {
    if (!usedSlots.has(i)) { slot = i; break; }
  }
  if (slot === -1) return null; // all slots taken

  persistSlotTokens(slot, tokens);
  cfg.accounts.push({ slot, label });

  // If this is the only account, make it active
  if (cfg.accounts.length === 1) cfg.activeSlot = slot;

  saveConfig(cfg);
  console.log(`[multi-account] added account "${label}" at slot ${slot}`);
  return slot;
}

/** Remove an account by slot number. */
export function removeAccount(slot: number): boolean {
  const cfg = loadConfig();
  const idx = cfg.accounts.findIndex(a => a.slot === slot);
  if (idx === -1) return false;

  cfg.accounts.splice(idx, 1);
  deleteSlotTokens(slot);

  // If we removed the active slot, switch to another
  if (cfg.activeSlot === slot) {
    cfg.activeSlot = cfg.accounts.length > 0 ? cfg.accounts[0].slot : 0;
  }

  saveConfig(cfg);
  console.log(`[multi-account] removed slot ${slot}`);
  return true;
}

/** List all registered accounts with their slot, label, and token status. */
export function listAccounts(): AccountSlot[] {
  const cfg = loadConfig();
  return cfg.accounts.map(a => ({
    slot: a.slot,
    label: a.label,
    hasTokens: !!loadSlotTokens(a.slot)?.access_token,
  }));
}

/** Get a display summary: "Account A (active) | Account B" */
export function getAccountSummary(): string {
  const cfg = loadConfig();
  if (cfg.accounts.length === 0) return 'No accounts configured';
  return cfg.accounts.map(a => {
    const active = a.slot === cfg.activeSlot ? ' (active)' : '';
    const tokens = loadSlotTokens(a.slot);
    const health = !tokens ? 'no tokens' : Date.now() > tokens.expires_at ? 'expired' : 'valid';
    return `slot ${a.slot}: ${a.label}${active} [${health}]`;
  }).join(' | ');
}

/**
 * Migrate existing single-account tokens into the multi-account system.
 * Called once to bootstrap: reads from the legacy `anthropic-oauth` keychain
 * entry and moves it to slot 0.
 */
export function migrateFromLegacy(legacyAccountName: string, label: string = 'Primary'): boolean {
  const cfg = loadConfig();
  // Already has accounts? Skip.
  if (cfg.accounts.length > 0) return false;

  const raw = keychainLoad(legacyAccountName);
  if (!raw) return false;

  try {
    const tokens = JSON.parse(raw) as OAuthTokens;
    if (!tokens.access_token) return false;

    persistSlotTokens(0, tokens);
    cfg.accounts.push({ slot: 0, label });
    cfg.activeSlot = 0;
    saveConfig(cfg);
    console.log(`[multi-account] migrated legacy tokens to slot 0 (${label})`);
    return true;
  } catch {
    return false;
  }
}
