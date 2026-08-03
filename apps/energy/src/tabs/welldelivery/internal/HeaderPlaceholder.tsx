import type { LucideIcon } from 'lucide-react';

export function HeaderPlaceholder({ icon: Icon, title, detail }: { icon: LucideIcon; title: string; detail: string }) {
  return <div className="wds-loading"><Icon size={22} /><b>{title}</b><span>{detail}</span></div>;
}
