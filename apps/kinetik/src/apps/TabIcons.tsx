// Clean line icons for native-app tab bars — same stroke language as the
// main app's NavIcons (24-grid, round caps, currentColor stroke).
const S = (d: React.ReactNode) => (
  <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{d}</svg>
)

export const TAB_ICONS: Record<string, React.ReactNode> = {
  gear: S(<><circle cx="12" cy="12" r="3.2" /><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4 5.3 5.3" /></>),
  users: S(<><circle cx="9" cy="8" r="3.4" /><path d="M2.5 20c0-3.4 2.9-5.6 6.5-5.6s6.5 2.2 6.5 5.6" /><path d="M16.5 5.2a3.4 3.4 0 0 1 0 6.4M21.5 20c0-2.4-1.4-4.2-3.6-5" /></>),
  grid: S(<><rect x="3" y="3" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="2" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" /></>),
  trophy: S(<><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M7 6H4a3 3 0 0 0 3 5M17 6h3a3 3 0 0 1-3 5" /></>),
  shield: S(<><path d="M12 3 5 6v5c0 4.4 3 7.5 7 8.8 4-1.3 7-4.4 7-8.8V6l-7-3Z" /><path d="m9 11.5 2 2 4-4" /></>),
  wallet: S(<><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M3 10h18M16.5 14.5h.01" /></>),
  compass: S(<><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /></>),
  map: S(<><path d="m9 4 6 2 6-2v14l-6 2-6-2-6 2V6l6-2Z" /><path d="M9 4v14M15 6v14" /></>),
  suitcase: S(<><rect x="3" y="7" width="18" height="13" rx="3" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M12 11v5" /></>),
  book: S(<><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z" /><path d="M4 5v14M9 7h6M9 11h6" /></>),
  calendar: S(<><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></>),
  cart: S(<><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /><path d="M2.5 3h2l2.2 11.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 7H6" /></>),
  basket: S(<><path d="m5 8 4-5M19 8l-4-5M3 8h18l-1.5 10.5a2 2 0 0 1-2 1.5H6.5a2 2 0 0 1-2-1.5L3 8Z" /><path d="M9.5 12v3.5M14.5 12v3.5" /></>),
}

export function TabIcon({ name }: { name: string }) {
  return <>{TAB_ICONS[name] ?? TAB_ICONS.grid}</>
}
