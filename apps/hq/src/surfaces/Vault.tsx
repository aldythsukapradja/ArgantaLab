// HQ Vault surface — the founder knowledge workspace. All logic lives in
// src/vault/*; this wrapper just mounts the shell full-bleed.

import { VaultShell } from '../vault/components/VaultShell'
import type { CenterView } from '../vault/store'
import '../vault/vault.css'

export function Vault({ forceView }: { forceView?: CenterView } = {}) {
  return <VaultShell forceView={forceView} />
}
