/* /__design/compare — the reference (design/handoff) and the implementation side by side, for every screen
   and viewport, with overlay / difference modes. Dev only; deliberately unstyled by the design system. */
import { useState, type CSSProperties } from 'react';
import { implementationUrl, referenceUrl, SCREENS, VIEWPORTS } from './screens';

type Mode = 'side' | 'overlay' | 'diff';

const bar: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  alignItems: 'center',
  padding: 16,
  font: '14px system-ui',
  position: 'sticky',
  top: 0,
  background: '#fff',
  zIndex: 1,
  borderBottom: '1px solid #ddd',
};

export default function ComparePage() {
  const [vp, setVp] = useState(0);
  const [mode, setMode] = useState<Mode>('side');
  const [filter, setFilter] = useState('');
  const v = VIEWPORTS[vp] ?? VIEWPORTS[0];
  const scale = Math.min(1, 560 / v.width);
  const frame = (src: string, style: CSSProperties = {}) => (
    <iframe
      src={src}
      loading="lazy"
      style={{ width: v.width, height: v.height, border: 0, background: '#fff', ...style }}
    />
  );
  const box: CSSProperties = {
    width: v.width * scale,
    height: v.height * scale,
    overflow: 'hidden',
    outline: '1px solid #ccc',
  };
  const inner: CSSProperties = {
    transform: `scale(${scale})`,
    transformOrigin: '0 0',
    position: 'relative',
    width: v.width,
    height: v.height,
  };
  return (
    <div style={{ background: '#f4f4f4', minHeight: '100vh' }}>
      <div style={bar}>
        <b>Handoff ↔ implementation</b>
        <select value={vp} onChange={(e) => setVp(Number(e.target.value))}>
          {VIEWPORTS.map((x, i) => (
            <option key={x.name} value={i}>
              {x.width}×{x.height}
            </option>
          ))}
        </select>
        {(['side', 'overlay', 'diff'] as const).map((m) => (
          <label key={m}>
            <input type="radio" checked={mode === m} onChange={() => setMode(m)} />{' '}
            {m === 'side' ? 'side by side' : m === 'overlay' ? 'overlay 50%' : 'difference'}
          </label>
        ))}
        <input placeholder="filter" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32, padding: 16 }}>
        {SCREENS.filter((s) => (s.label + s.q).toLowerCase().includes(filter.toLowerCase())).map(
          (s) => (
            <section key={s.q} style={{ font: '13px system-ui' }}>
              <div style={{ marginBottom: 8 }}>
                <b>{s.label}</b> <code>{s.q}</code>
              </div>
              {mode === 'side' ? (
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <div>reference</div>
                    <div style={box}>
                      <div style={inner}>{frame(referenceUrl(s.q))}</div>
                    </div>
                  </div>
                  <div>
                    <div>implementation</div>
                    <div style={box}>
                      <div style={inner}>{frame(implementationUrl(s.q))}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={box}>
                  <div style={{ ...inner, isolation: 'isolate' }}>
                    {frame(referenceUrl(s.q), { position: 'absolute', inset: 0 })}
                    {frame(implementationUrl(s.q), {
                      position: 'absolute',
                      inset: 0,
                      ...(mode === 'overlay' ? { opacity: 0.5 } : { mixBlendMode: 'difference' }),
                    })}
                  </div>
                </div>
              )}
            </section>
          ),
        )}
      </div>
    </div>
  );
}
