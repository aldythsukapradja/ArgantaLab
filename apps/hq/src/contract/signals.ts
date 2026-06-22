export type Severity = 'info' | 'success' | 'warn' | 'danger'

export interface Signal {
  id: string
  severity: Severity
  icon?: string
  headline: string
  driver?: string
  action?: string
  appId?: string
}
