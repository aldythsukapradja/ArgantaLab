import type { CSSProperties } from 'react'

export type PortfolioIconId =
  | 'arganta' | 'life' | 'energy' | 'studio'
  | 'hq' | 'kinetik' | 'lab' | 'lashira'

export type AgentIconId =
  | 'ceo' | 'coo' | 'cto' | 'cfo' | 'gc' | 'capo'
  | 'exploration' | 'field' | 'well' | 'reservoir' | 'drilling'
  | 'art-director' | 'product' | 'media' | 'transform' | 'launch'

export function IconDefinitions() {
  return (
    <svg width="0" height="0" aria-hidden="true" className="icon-defs">
      <defs>
        <symbol id="arg-mark-arganta" viewBox="0 0 120 120">
          <path className="soft" d="M29 39 A39 39 0 0 1 86 31" />
          <path className="soft" d="M91 40 A39 39 0 0 1 83 91" />
          <path className="soft" d="M72 97 A39 39 0 0 1 25 55" />
          <path className="accent-line" d="M39 49 A24 24 0 0 1 69 38" />
          <path className="accent-line" d="M78 45 A24 24 0 0 1 75 78" />
          <path className="accent-line" d="M65 84 A24 24 0 0 1 36 60" />
          <circle className="accent-hair" cx="60" cy="60" r="13" />
          <circle className="accent-fill" cx="60" cy="60" r="6" />
          <circle className="accent-fill" cx="88" cy="33" r="3.5" />
        </symbol>
        <symbol id="arg-mark-life" viewBox="0 0 120 120">
          <path className="line" d="M27 84 V61 Q27 39 45 29 Q60 20 75 29 Q93 39 93 61 V84" />
          <path className="accent-line" d="M36 82 Q45 70 60 70 Q75 70 84 82" />
          <circle className="accent-fill" cx="43" cy="58" r="5" />
          <circle className="accent-fill" cx="60" cy="49" r="6" />
          <circle className="accent-fill" cx="77" cy="58" r="5" />
          <path className="soft" d="M33 91 H87" />
        </symbol>
        <symbol id="arg-mark-energy" viewBox="0 0 120 120">
          <path className="line" d="M20 40 Q39 31 59 40 T100 40" />
          <path className="line" d="M20 59 Q39 50 59 59 T100 59" />
          <path className="line" d="M20 78 Q39 69 59 78 T100 78" />
          <path className="accent-line" d="M61 21 V82" />
          <path className="accent-hair" d="M61 82 L72 92" />
          <circle className="accent-fill" cx="74" cy="94" r="5" />
          <path className="soft" d="M27 29 H49 M73 29 H93" />
        </symbol>
        <symbol id="arg-mark-studio" viewBox="0 0 120 120">
          <path className="line" d="M24 45 V24 H45 M75 24 H96 V45 M96 75 V96 H75 M45 96 H24 V75" />
          <path className="soft" d="M34 81 L81 34" />
          <circle className="accent-fill" cx="39" cy="76" r="5" />
          <path className="accent-line" d="M74 36 L84 46 L74 56 L64 46 Z" />
          <path className="accent-hair" d="M74 28 V33 M74 59 V64 M56 46 H61 M87 46 H92" />
        </symbol>
        <symbol id="arg-mark-hq" viewBox="0 0 120 120">
          <circle className="soft" cx="60" cy="60" r="39" />
          <path className="hair" d="M60 60 L60 22 M60 60 L27 79 M60 60 L93 79" />
          <path className="hair" d="M60 60 L27 41 M60 60 L93 41 M60 60 L60 98" />
          <path className="accent-line" d="M60 48 L72 55 L72 69 L60 76 L48 69 L48 55 Z" />
          <circle className="accent-fill" cx="60" cy="60" r="6" />
          <circle className="accent-fill" cx="60" cy="21" r="4.5" />
          <circle className="accent-fill" cx="94" cy="40" r="3.5" />
          <circle className="accent-fill" cx="94" cy="80" r="3.5" />
          <circle className="accent-fill" cx="60" cy="99" r="3.5" />
          <circle className="accent-fill" cx="26" cy="80" r="3.5" />
          <circle className="accent-fill" cx="26" cy="40" r="3.5" />
        </symbol>
        <symbol id="arg-mark-kinetik" viewBox="0 0 120 120">
          <circle className="line" cx="60" cy="60" r="38" />
          <path className="line" d="M60 36 A24 24 0 1 1 39 48" />
          <circle className="accent-line" cx="60" cy="60" r="11" />
          <circle className="accent-fill" cx="60" cy="22" r="4" />
        </symbol>
        <symbol id="arg-mark-lab" viewBox="0 0 120 120">
          <path className="line" d="M60 18 L92 37 L92 75 L60 94 L28 75 L28 37 Z" />
          <path className="line" d="M28 37 L60 56 L92 37" />
          <path className="line" d="M60 56 V94" />
          <path className="accent-line" d="M28 37 L60 18 L92 37" />
          <circle className="accent-fill" cx="60" cy="18" r="4" />
        </symbol>
        <symbol id="arg-mark-lashira" viewBox="0 0 120 120">
          <path className="accent-line" d="M60 22 Q71 44 60 66 Q49 44 60 22 Z" />
          <path className="line" d="M32 34 Q54 44 60 66 Q36 58 32 34 Z" />
          <path className="line" d="M88 34 Q66 44 60 66 Q84 58 88 34 Z" />
          <path className="line" d="M20 62 Q42 58 60 66 Q38 76 20 62 Z" />
          <path className="line" d="M100 62 Q78 58 60 66 Q82 76 100 62 Z" />
          <path className="line" d="M60 66 V92" />
          <circle className="accent-fill" cx="60" cy="96" r="3.5" />
        </symbol>

        <symbol id="arg-command-ring" viewBox="0 0 120 120">
          <path className="soft" d="M39 26 A40 40 0 0 1 52 21 M68 21 A40 40 0 0 1 81 26 M94 39 A40 40 0 0 1 99 52 M99 68 A40 40 0 0 1 94 81 M81 94 A40 40 0 0 1 68 99 M52 99 A40 40 0 0 1 39 94 M26 81 A40 40 0 0 1 21 68 M21 52 A40 40 0 0 1 26 39" />
          <circle className="hair" cx="60" cy="60" r="31" />
          <circle className="accent-fill" cx="60" cy="20" r="3.7" />
        </symbol>
        <symbol id="arg-studio-frame" viewBox="0 0 120 120">
          <path className="soft" d="M18 42 V18 H42 M78 18 H102 V42 M102 78 V102 H78 M42 102 H18 V78" />
          <circle className="accent-fill" cx="91" cy="29" r="3.5" />
        </symbol>

        <symbol id="arg-agent-ceo" viewBox="0 0 120 120">
          <use href="#arg-command-ring" />
          <path className="hair" d="M60 47 V29 M49 52 L35 41 M71 52 L85 41 M45 64 L27 69 M75 64 L93 69" />
          <circle className="accent-hair" cx="60" cy="61" r="15" />
          <circle className="accent-fill" cx="60" cy="61" r="6" />
          <path className="accent-line" d="M60 46 V26 M54 33 L60 26 L66 33" />
        </symbol>
        <symbol id="arg-agent-coo" viewBox="0 0 120 120">
          <use href="#arg-command-ring" />
          <path className="accent-line" d="M42 53 A20 20 0 0 1 75 45 M69 40 L76 45 L70 51 M78 67 A20 20 0 0 1 45 75 M51 80 L44 75 L50 69" />
          <circle className="hair" cx="60" cy="60" r="7" />
          <circle className="accent-fill" cx="60" cy="60" r="3.5" />
          <circle className="accent-fill" cx="39" cy="60" r="3" />
          <circle className="accent-fill" cx="81" cy="60" r="3" />
        </symbol>
        <symbol id="arg-agent-cto" viewBox="0 0 120 120">
          <use href="#arg-command-ring" />
          <path className="hair" d="M43 46 L74 42 L79 72 L50 78 Z M43 46 L60 60 L74 42 M60 60 L79 72 M60 60 L50 78" />
          <circle className="accent-fill" cx="43" cy="46" r="5" />
          <circle className="accent-fill" cx="74" cy="42" r="4" />
          <circle className="accent-fill" cx="79" cy="72" r="5" />
          <circle className="accent-fill" cx="50" cy="78" r="4" />
          <circle className="accent-hair" cx="60" cy="60" r="7" />
          <circle className="accent-fill" cx="60" cy="60" r="3.5" />
        </symbol>
        <symbol id="arg-agent-cfo" viewBox="0 0 120 120">
          <use href="#arg-command-ring" />
          <path className="hair" d="M38 80 H83 M42 72 V54 M53 72 V44 M64 72 V60 M75 72 V36" />
          <path className="accent-line" d="M39 65 L51 56 L63 62 L79 42 M73 42 H79 V48" />
          <circle className="accent-fill" cx="39" cy="65" r="3.5" />
          <circle className="accent-fill" cx="51" cy="56" r="3.5" />
          <circle className="accent-fill" cx="63" cy="62" r="3.5" />
        </symbol>
        <symbol id="arg-agent-gc" viewBox="0 0 120 120">
          <use href="#arg-command-ring" />
          <path className="accent-line" d="M60 39 V82 M39 49 H81" />
          <path className="accent-hair" d="M45 49 L36 68 M51 49 L46 68 M69 49 L74 68 M75 49 L84 68" />
          <path className="line" d="M31 68 Q41 81 51 68 M69 68 Q79 81 89 68 M48 83 H72" />
          <path className="accent-line" d="M55 49 L60 44 L65 49 L60 54 Z" />
          <circle className="accent-fill" cx="60" cy="39" r="3.5" />
        </symbol>
        <symbol id="arg-agent-capo" viewBox="0 0 120 120">
          <use href="#arg-command-ring" />
          <circle className="accent-hair" cx="60" cy="60" r="12" />
          <circle className="accent-fill" cx="60" cy="60" r="5" />
          <path className="hair" d="M60 48 L60 36 M70 53 L80 46 M72 65 L84 69 M66 71 L70 83 M54 71 L50 83 M48 65 L36 69 M50 53 L40 46" />
          <circle className="accent-fill" cx="60" cy="35" r="3.5" />
          <circle className="accent-fill" cx="81" cy="45" r="3.5" />
          <circle className="accent-fill" cx="85" cy="70" r="3.5" />
          <circle className="accent-fill" cx="70" cy="84" r="3.5" />
          <circle className="accent-fill" cx="50" cy="84" r="3.5" />
          <circle className="accent-fill" cx="35" cy="70" r="3.5" />
          <circle className="accent-fill" cx="39" cy="45" r="3.5" />
        </symbol>

        <symbol id="arg-agent-exploration" viewBox="0 0 120 120">
          <rect className="soft" x="16" y="16" width="88" height="88" rx="21" />
          <circle className="hair" cx="58" cy="57" r="27" />
          <circle className="hair" cx="58" cy="57" r="17" />
          <path className="accent-line" d="M58 57 L78 38 A29 29 0 0 1 86 57" />
          <circle className="accent-fill" cx="78" cy="38" r="4" />
          <circle className="accent-fill" cx="91" cy="91" r="4" />
        </symbol>
        <symbol id="arg-agent-field" viewBox="0 0 120 120">
          <rect className="soft" x="16" y="16" width="88" height="88" rx="21" />
          <path className="hair" d="M29 52 Q47 43 61 51 T91 50 M29 67 Q47 58 61 66 T91 65 M29 82 Q47 73 61 81 T91 80" />
          <path className="accent-line" d="M42 35 V73 M78 35 V68" />
          <path className="accent-hair" d="M35 35 H49 M71 35 H85" />
          <circle className="accent-fill" cx="42" cy="74" r="4" />
          <circle className="accent-fill" cx="91" cy="91" r="4" />
        </symbol>
        <symbol id="arg-agent-well" viewBox="0 0 120 120">
          <rect className="soft" x="16" y="16" width="88" height="88" rx="21" />
          <path className="accent-line" d="M36 29 V47 Q36 64 53 66 Q72 68 78 84" />
          <path className="hair" d="M28 44 H44 M47 58 L58 69" />
          <circle className="accent-hair" cx="79" cy="87" r="8" />
          <circle className="accent-fill" cx="79" cy="87" r="3.5" />
          <circle className="accent-fill" cx="91" cy="91" r="4" />
        </symbol>
        <symbol id="arg-agent-reservoir" viewBox="0 0 120 120">
          <rect className="soft" x="16" y="16" width="88" height="88" rx="21" />
          <path className="hair" d="M32 52 Q47 44 60 52 T88 52 M32 66 Q47 58 60 66 T88 66 M32 80 Q47 72 60 80 T88 80" />
          <path className="accent-line" d="M39 42 A27 27 0 0 1 81 41 M78 35 L82 42 L74 44 M81 87 A27 27 0 0 1 39 88 M42 94 L38 87 L46 85" />
          <circle className="accent-fill" cx="91" cy="91" r="4" />
        </symbol>
        <symbol id="arg-agent-drilling" viewBox="0 0 120 120">
          <rect className="soft" x="16" y="16" width="88" height="88" rx="21" />
          <path className="accent-line" d="M46 29 L67 68 M67 68 L75 76 L69 87 L58 70 Z" />
          <path className="accent-hair" d="M41 35 L52 29 M48 47 L59 41 M55 59 L66 53" />
          <path className="hair" d="M31 91 H86 M37 86 V96 M54 86 V96 M71 86 V96" />
          <circle className="accent-fill" cx="91" cy="91" r="4" />
        </symbol>

        <symbol id="arg-agent-art-director" viewBox="0 0 120 120">
          <use href="#arg-studio-frame" />
          <path className="hair" d="M60 60 L36 47 M60 60 L42 79 M60 60 L82 74 M60 60 L79 40" />
          <circle className="accent-fill" cx="36" cy="47" r="4" />
          <circle className="accent-fill" cx="42" cy="79" r="4" />
          <circle className="accent-fill" cx="82" cy="74" r="4" />
          <path className="accent-line" d="M60 45 L75 60 L60 75 L45 60 Z" />
          <circle className="accent-fill" cx="60" cy="60" r="5" />
          <path className="accent-hair" d="M79 32 V38 M76 35 H82" />
        </symbol>
        <symbol id="arg-agent-product" viewBox="0 0 120 120">
          <use href="#arg-studio-frame" />
          <rect className="line" x="31" y="35" width="58" height="47" rx="5" />
          <path className="hair" d="M31 46 H89" />
          <circle className="accent-fill" cx="38" cy="41" r="2.5" />
          <path className="accent-line" d="M45 57 L37 65 L45 73 M75 57 L83 65 L75 73 M65 54 L55 76" />
        </symbol>
        <symbol id="arg-agent-media" viewBox="0 0 120 120">
          <use href="#arg-studio-frame" />
          <circle className="accent-hair" cx="60" cy="60" r="18" />
          <path className="accent-line" d="M54 49 L72 60 L54 71 Z" />
          <path className="hair" d="M60 42 V32 M78 60 H88 M60 78 V88 M42 60 H32" />
          <circle className="accent-fill" cx="60" cy="31" r="4" />
          <circle className="accent-fill" cx="89" cy="60" r="4" />
          <circle className="accent-fill" cx="60" cy="89" r="4" />
          <circle className="accent-fill" cx="31" cy="60" r="4" />
        </symbol>
        <symbol id="arg-agent-transform" viewBox="0 0 120 120">
          <use href="#arg-studio-frame" />
          <rect className="hair" x="33" y="45" width="18" height="18" rx="3" />
          <path className="accent-line" d="M51 54 H72 M66 48 L72 54 L66 60 M72 43 L87 51 V68 L72 77 L57 68 V62" />
          <circle className="accent-fill" cx="72" cy="60" r="4" />
          <circle className="accent-fill" cx="42" cy="54" r="3.5" />
        </symbol>
        <symbol id="arg-agent-launch" viewBox="0 0 120 120">
          <use href="#arg-studio-frame" />
          <path className="accent-line" d="M41 78 L77 42 M68 42 H77 V51" />
          <path className="hair" d="M37 72 V82 H47 M52 66 V82 H62 M67 58 V82 H82" />
          <circle className="accent-fill" cx="41" cy="78" r="4" />
          <circle className="accent-fill" cx="77" cy="42" r="4" />
        </symbol>
      </defs>
    </svg>
  )
}

function Icon({
  href,
  size,
  color,
  className,
}: {
  href: string
  size: number
  color: string
  className?: string
}) {
  return (
    <svg
      className={`arg-icon ${className ?? ''}`}
      viewBox="0 0 120 120"
      width={size}
      height={size}
      aria-hidden="true"
      style={{ '--icon-accent': color } as CSSProperties}
    >
      <use href={href} />
    </svg>
  )
}

export function PortfolioIcon({
  id,
  size = 64,
  color = 'currentColor',
  className,
}: {
  id: PortfolioIconId
  size?: number
  color?: string
  className?: string
}) {
  return <Icon href={`#arg-mark-${id}`} size={size} color={color} className={className} />
}

export function AgentIcon({
  id,
  size = 64,
  color = 'currentColor',
  className,
}: {
  id: AgentIconId
  size?: number
  color?: string
  className?: string
}) {
  return <Icon href={`#arg-agent-${id}`} size={size} color={color} className={className} />
}
