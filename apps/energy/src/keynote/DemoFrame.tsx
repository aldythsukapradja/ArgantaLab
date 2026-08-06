// Slide 7 — the real ArgantaEnergy, running, in a device frame.
//
// Three modes because a cold meeting room needs a fallback:
//   Live      the actual app in an iframe. Most convincing, most fragile.
//   Loop      a pre-recorded GIF/WebM. Guaranteed clean, no network, no
//             half-loaded map. This is what you present when the wifi is bad.
// Desktop ↔ mobile morphs the frame; the app re-flows inside it for real.
import { useState } from 'react';

export type DeviceKind = 'desktop' | 'mobile';
export type DemoSource = 'live' | 'loop';

/** Recorded loops, dropped in later. Missing files fall back to Live rather
 *  than showing a broken image in front of an audience. */
const LOOPS: Record<DeviceKind, string> = {
  desktop: '/keynote/demo-desktop.gif',
  mobile: '/keynote/demo-mobile.gif',
};

export function DemoFrame({ initial = 'desktop' }: { initial?: DeviceKind }) {
  const [device, setDevice] = useState<DeviceKind>(initial);
  const [source, setSource] = useState<DemoSource>('live');
  const [loopFailed, setLoopFailed] = useState(false);
  const showLoop = source === 'loop' && !loopFailed;
  // The swap is instant on purpose. A Flip morph between two very different
  // aspect ratios left a stuck non-uniform scale on the frame, and a broken
  // morph in front of an audience is far worse than a clean cut. Only the
  // corner radius eases, which is enough to read as a device change.

  return (
    <div className="kn-demo">
      <div className="kn-demo-row" data-rise>
        <div className="kn-seg" role="group" aria-label="Device">
          {(['desktop', 'mobile'] as DeviceKind[]).map((d) => (
            <button key={d} className={device === d ? 'on' : ''}
              onClick={() => setDevice(d)} aria-pressed={device === d}>
              {d === 'desktop' ? 'Desktop' : 'Mobile'}
            </button>
          ))}
        </div>
        <div className="kn-seg" role="group" aria-label="Source">
          {(['live', 'loop'] as DemoSource[]).map((s) => (
            <button key={s} className={source === s ? 'on' : ''}
              onClick={() => { setSource(s); setLoopFailed(false); }} aria-pressed={source === s}>
              {s === 'live' ? 'Live' : 'Loop'}
            </button>
          ))}
        </div>
      </div>

      <div className={`kn-device ${device}`} data-device>
        {device === 'desktop' && (
          <div className="kn-device-bar"><i /><i /><i /></div>
        )}
        {showLoop ? (
          <img src={LOOPS[device]} alt="" onError={() => setLoopFailed(true)} />
        ) : (
          /* The app itself. Same origin, so it just runs. */
          <iframe src="/?keynote-demo=1" title="ArgantaEnergy" loading="lazy" />
        )}
      </div>

      {source === 'loop' && loopFailed && (
        <p className="kn-quiet" data-rise>
          No recorded loop yet — showing the live app. Drop one at
          <span className="kn-mono"> public{LOOPS[device]}</span>.
        </p>
      )}
    </div>
  );
}
