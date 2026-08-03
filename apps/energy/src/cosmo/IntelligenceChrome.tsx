import type { CSSProperties, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import './intelligence-chrome.css';

export type IntelligenceTabItem<T extends string> = { id: T; label: string; icon: LucideIcon; count?: number };

export function IntelligenceSurface({ accent = 'var(--teal)', className = '', children }: {
  accent?: string; className?: string; children: ReactNode;
}) {
  return <div className={`intel-shell ${className}`.trim()} style={{ '--intel-accent': accent } as CSSProperties}>{children}</div>;
}

export function IntelligenceHeader({ icon: Icon, title, subtitle, context, status, actions }: {
  icon: LucideIcon; title: string; subtitle: ReactNode; context?: ReactNode; status?: ReactNode; actions?: ReactNode;
}) {
  return (
    <header className="intel-header">
      <div className="intel-heading"><span className="intel-heading-icon"><Icon size={15} /></span><div><b>{title}</b><small>{subtitle}</small></div></div>
      {context && <div className="intel-context">{context}</div>}
      <span className="intel-spacer" />
      {status && <div className="intel-status">{status}</div>}
      {actions && <div className="intel-actions">{actions}</div>}
    </header>
  );
}

export function IntelligenceTabs<T extends string>({ items, active, onChange, ariaLabel }: {
  items: Array<IntelligenceTabItem<T>>; active: T; onChange: (id: T) => void; ariaLabel: string;
}) {
  return (
    <nav className="intel-tabs" aria-label={ariaLabel}>
      {items.map((item) => <button key={item.id} className={active === item.id ? 'active' : ''} onClick={() => onChange(item.id)}><item.icon size={12} />{item.label}{item.count != null && item.count > 0 && <i>{item.count}</i>}</button>)}
    </nav>
  );
}
