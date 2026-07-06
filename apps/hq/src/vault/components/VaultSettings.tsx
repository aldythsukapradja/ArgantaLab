// HQ Vault — settings sheet: theme, accent, editor, layout, data management.

import { useRef } from 'react'
import { X, Download, Upload, RotateCcw, HardDrive } from 'lucide-react'
import { useVault } from '../store'
import { exportVault, importVault, downloadFile, vaultStats } from '../storage'
import type { AccentKey, VaultTheme } from '../types'

const ACCENTS: { key: AccentKey; color: string; label: string }[] = [
  { key: 'iris', color: '#8b7cf6', label: 'Iris' },
  { key: 'ember', color: '#f0a24b', label: 'Ember' },
  { key: 'jade', color: '#4ade80', label: 'Jade' },
  { key: 'aurum', color: '#eab308', label: 'Aurum' },
  { key: 'rose', color: '#f472b6', label: 'Rose' },
]
const THEMES: { key: VaultTheme; label: string }[] = [
  { key: 'dark', label: 'Dark' }, { key: 'light', label: 'Light' }, { key: 'system', label: 'System' },
]

function Row({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="vst-row">
      <div className="vst-lbl">
        <div>{label}</div>
        {sub && <div className="v-dim vst-sub">{sub}</div>}
      </div>
      <div className="vst-ctl">{children}</div>
    </div>
  )
}

export function VaultSettingsSheet() {
  const open = useVault(s => s.settingsOpen)
  const close = useVault(s => s.closeSettings)
  const settings = useVault(s => s.settings)
  const update = useVault(s => s.updateSettings)
  const notes = useVault(s => s.notes)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!open) return null
  const stats = vaultStats(notes)

  const doExport = () => {
    const st = useVault.getState()
    downloadFile('hq-vault-' + new Date().toISOString().slice(0, 10) + '.json',
      exportVault(st.notes, st.canvas, st.settings), 'application/json')
  }

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const res = importVault(await file.text())
    if (!res) { window.alert('Not a valid HQ Vault export.'); return }
    if (window.confirm(`Import ${res.notes.length} notes? This replaces the current vault.`)) {
      useVault.getState().replaceVault(res.notes, res.canvas, res.settings)
      close()
    }
  }

  return (
    <div className="vk-overlay" onClick={close}>
      <div className="vst" onClick={e => e.stopPropagation()} role="dialog" aria-label="Vault settings">
        <div className="vst-head">
          <b>Vault settings</b>
          <span className="v-dim vst-stats"><HardDrive size={12} /> local · {stats.count} notes · {stats.words.toLocaleString()} words</span>
          <button className="vg-tool" onClick={close}><X size={14} /></button>
        </div>

        <div className="vst-body">
          <div className="vst-sec">Appearance</div>
          <Row label="Theme" sub="Vault-only — HQ keeps its own theme">
            <div className="vb-mode">
              {THEMES.map(t => (
                <button key={t.key} className={settings.theme === t.key ? 'on' : ''}
                  onClick={() => update({ theme: t.key })}>{t.label}</button>
              ))}
            </div>
          </Row>
          <Row label="Accent">
            <div className="vst-accents">
              {ACCENTS.map(a => (
                <button key={a.key} title={a.label}
                  className={'vst-acc' + (settings.accent === a.key ? ' on' : '')}
                  style={{ background: a.color }}
                  onClick={() => update({ accent: a.key })} />
              ))}
            </div>
          </Row>
          <Row label="Editor font size" sub={settings.fontSize + 'px'}>
            <input type="range" min={12} max={20} step={1} value={settings.fontSize}
              onChange={e => update({ fontSize: +e.target.value })} />
          </Row>
          <Row label="Compact mode" sub="Denser explorer and panels">
            <button className={'vst-toggle' + (settings.compact ? ' on' : '')}
              onClick={() => update({ compact: !settings.compact })} aria-pressed={settings.compact}><i /></button>
          </Row>

          <div className="vst-sec">Layout</div>
          <Row label="Left sidebar">
            <button className={'vst-toggle' + (settings.leftOpen ? ' on' : '')}
              onClick={() => update({ leftOpen: !settings.leftOpen })} aria-pressed={settings.leftOpen}><i /></button>
          </Row>
          <Row label="Right sidebar">
            <button className={'vst-toggle' + (settings.rightOpen ? ' on' : '')}
              onClick={() => update({ rightOpen: !settings.rightOpen })} aria-pressed={settings.rightOpen}><i /></button>
          </Row>
          <Row label="Graph density" sub="Airier ↔ tighter constellation">
            <input type="range" min={0.6} max={1.5} step={0.05} value={settings.graphDensity}
              onChange={e => update({ graphDensity: +e.target.value })} />
          </Row>

          <div className="vst-sec">Data</div>
          <Row label="Export vault" sub="Everything as JSON — notes, canvas, settings">
            <button className="vc-btn" onClick={doExport}><Download size={13} /> Export</button>
          </Row>
          <Row label="Import vault" sub="Replaces the current vault">
            <button className="vc-btn" onClick={() => fileRef.current?.click()}><Upload size={13} /> Import…</button>
            <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={onImport} />
          </Row>
          <Row label="Reset vault" sub="Back to the seed notes — local changes are lost">
            <button className="vc-btn danger" onClick={() => {
              if (window.confirm('Reset the vault to the seed notes? Your local changes will be lost.')) {
                useVault.getState().resetVault(); close()
              }
            }}><RotateCcw size={13} /> Reset</button>
          </Row>
        </div>
      </div>
    </div>
  )
}
