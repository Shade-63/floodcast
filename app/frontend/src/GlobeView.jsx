import React, { useEffect, useRef, useState, useMemo } from 'react';
import createGlobe from 'cobe';
import {
  MapPin, Play, Pause, RotateCcw, Compass, ZoomIn, ZoomOut, Maximize2
} from 'lucide-react';
import { gsap } from './animations';

const PI = Math.PI;

function projectToScreen([lat, lon], phi, theta, scale = 1, width, height) {
  const r = (lat * PI) / 180;
  const a = (lon * PI) / 180 - PI;
  const o = Math.cos(r);
  const t = [-o * Math.cos(a), Math.sin(r), o * Math.sin(a)];
  const cosL = Math.cos(theta), cosF = Math.cos(phi);
  const sinL = Math.sin(theta), sinF = Math.sin(phi);
  const c = cosF * t[0] + sinF * t[2];
  const s = sinF * sinL * t[0] + cosL * t[1] - cosF * sinL * t[2];
  const z = -sinF * cosL * t[0] + sinL * t[1] + cosF * cosL * t[2];
  return { x: width * ((c * scale + 1) / 2), y: height * ((-s * scale + 1) / 2), visible: z >= 0, z };
}

function unproject(clickX, clickY, phi, theta, scale = 1, width, height) {
  const c = ((2 * clickX) / width - 1) / scale;
  const s = -((2 * clickY) / height - 1) / scale;
  const r2 = c * c + s * s;
  if (r2 > 0.64) return null;
  const z = Math.sqrt(0.64 - r2);
  const v = [c / 0.8, s / 0.8, z / 0.8];
  const cosL = Math.cos(theta), cosF = Math.cos(phi);
  const sinL = Math.sin(theta), sinF = Math.sin(phi);
  const t0 = cosF * v[0] + sinF * sinL * v[1] - sinF * cosL * v[2];
  const t1 = cosL * v[1] + sinL * v[2];
  const t2 = sinF * v[0] - cosF * sinL * v[1] + cosF * cosL * v[2];
  return {
    lat: (Math.asin(Math.max(-1, Math.min(1, t1))) * 180) / PI,
    lon: (Math.atan2(-t2, t0) * 180) / PI,
  };
}

export default function GlobeView({ catchments, selectedId, onSelectCatchment, onSwitchTo2D }) {
  const canvasRef    = useRef(null);
  const containerRef = useRef(null);
  const globeRef     = useRef(null);

  // GSAP animation targets
  const infoPanelRef   = useRef(null);
  const controlsRowRef = useRef(null);

  const pointerInteracting        = useRef(null);
  const pointerInteractionMovement = useRef(0);
  const pointerStartPos           = useRef({ x: 0, y: 0, time: 0 });

  // Show all CAMELS-BR basins: centroid ≈ lat −17°, lon −50°
  // phi  = 50 × π/180 + 3π/2 ≈ 5.585  (longitude)
  // theta = −17 × π/180      ≈ −0.297 (latitude tilt)
  const DEFAULT_PHI   = 5.585;
  const DEFAULT_THETA = -0.297;
  const DEFAULT_SCALE = 0.80;

  const phiRef         = useRef(DEFAULT_PHI);
  const thetaRef       = useRef(DEFAULT_THETA);
  const scaleRef       = useRef(DEFAULT_SCALE);
  const targetPhiRef   = useRef(null);
  const targetThetaRef = useRef(null);
  const targetScaleRef = useRef(null);

  // Track whether the user has explicitly selected a catchment (vs page-load default)
  const userSelectedRef = useRef(false);

  const [isAutoRotate, setIsAutoRotate] = useState(false);
  const isAutoRotateRef = useRef(false);
  const [scale, setScale]               = useState(0.80);
  const [hoveredCatchment, setHoveredCatchment] = useState(null);
  const [tooltipPos, setTooltipPos]     = useState({ x: 0, y: 0 });
  const [canvasSize, setCanvasSize]     = useState(0);

  // Responsive canvas size — watch container width so globe rebuilds to fill it
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (w > 50) setCanvasSize(w);
    });
    ro.observe(el);
    const w = Math.round(el.getBoundingClientRect().width);
    if (w > 50) setCanvasSize(w);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    isAutoRotateRef.current = isAutoRotate;
  }, [isAutoRotate]);

  const activeCatchment = useMemo(() => {
    if (!catchments || catchments.length === 0) return null;
    return catchments.find(c => c.gauge_id === selectedId) || catchments[0];
  }, [catchments, selectedId]);
  // ── GSAP: Globe container + controls entry animation on mount ─────
  useEffect(() => {
    const ctx = gsap.context(() => {
      if (controlsRowRef.current) {
        gsap.fromTo(controlsRowRef.current,
          { y: -16, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.45, ease: 'power3.out', delay: 0.1 }
        );
      }
      if (containerRef.current) {
        gsap.fromTo(containerRef.current,
          { scale: 0.96, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.55, ease: 'power3.out', delay: 0.2 }
        );
      }
      if (infoPanelRef.current) {
        gsap.fromTo(infoPanelRef.current,
          { x: 24, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.5, ease: 'power3.out', delay: 0.35 }
        );
      }
    });
    return () => ctx.revert();
  }, []);

  // ── GSAP: Re-animate info panel stat chips when selected basin changes
  useEffect(() => {
    if (!infoPanelRef.current) return;
    gsap.fromTo(
      infoPanelRef.current.querySelector('.globe-gauge-id'),
      { scale: 1.08, color: '#06B6D4' },
      { scale: 1, color: '#2563EB', duration: 0.4, ease: 'power2.out' }
    );
    const chips = infoPanelRef.current.querySelectorAll('.globe-stat-chip');
    if (chips.length) {
      gsap.fromTo(Array.from(chips),
        { y: 10, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.32, ease: 'power2.out', stagger: 0.06, delay: 0.05 }
      );
    }
  }, [selectedId]);

  // Center on active catchment ONLY when user explicitly changes selectedId (not on mount)
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; } // skip first render
    if (activeCatchment) {
      const targetPhi = (-activeCatchment.lon * PI) / 180 + (3 * PI) / 2;
      const targetTheta = (activeCatchment.lat * PI) / 180;
      let currentPhi = phiRef.current;
      const twoPi = PI * 2;
      let diff = (targetPhi - currentPhi) % twoPi;
      if (diff > PI) diff -= twoPi;
      if (diff < -PI) diff += twoPi;
      targetPhiRef.current   = currentPhi + diff;
      targetThetaRef.current = Math.max(-1.1, Math.min(1.1, targetTheta));
    }
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Globe init — re-create when container resizes
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !catchments || catchments.length === 0) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = container.getBoundingClientRect();
    const cssPx = Math.round(Math.min(rect.width, rect.height));  // CSS pixels (square)
    const bufPx = cssPx * dpr;                                     // buffer pixels for cobe

    if (bufPx < 100) return;

    // Set canvas CSS size to exactly match the square container
    canvas.style.width  = `${cssPx}px`;
    canvas.style.height = `${cssPx}px`;

    const buildMarkers = () => catchments.map(c => {
      const isSelected = c.gauge_id === selectedId;
      const isTrain    = c.split === 'train';
      return {
        location: [c.lat, c.lon],
        size:  isSelected ? 0.075 : 0.038,
        color: isSelected
          ? [0.06, 0.72, 0.95]
          : isTrain ? [0.18, 0.50, 0.92] : [0.94, 0.62, 0.07],
      };
    });

    let animId = null;
    let globe;
    try {
      globe = createGlobe(canvas, {
        devicePixelRatio: dpr,
        width:  bufPx,
        height: bufPx,
        phi:    phiRef.current,
        theta:  thetaRef.current,
        scale:  scaleRef.current,
        dark:        0,
        diffuse:     1.2,
        mapSamples:  14000,
        mapBrightness: 4,
        baseColor:   [0.72, 0.84, 0.96],
        markerColor: [0.02, 0.55, 0.85],
        glowColor:   [0.58, 0.78, 0.97],
        markers: buildMarkers(),
      });
      globeRef.current = globe;

      const animate = () => {
        if (isAutoRotateRef.current && pointerInteracting.current === null && targetPhiRef.current === null) {
          phiRef.current += 0.003;
        }
        if (targetPhiRef.current !== null && pointerInteracting.current === null) {
          phiRef.current   += (targetPhiRef.current   - phiRef.current)   * 0.08;
          thetaRef.current += (targetThetaRef.current - thetaRef.current) * 0.08;
          if (Math.abs(targetPhiRef.current   - phiRef.current)   < 0.001 &&
              Math.abs(targetThetaRef.current - thetaRef.current) < 0.001) {
            targetPhiRef.current   = null;
            targetThetaRef.current = null;
          }
        }
        if (targetScaleRef.current !== null) {
          const diff = targetScaleRef.current - scaleRef.current;
          scaleRef.current += diff * 0.1;
          if (Math.abs(diff) < 0.005) {
            scaleRef.current   = targetScaleRef.current;
            targetScaleRef.current = null;
          }
          setScale(Math.round(scaleRef.current * 100) / 100);
        }

        globe.update({
          phi:   phiRef.current,
          theta: thetaRef.current,
          scale: scaleRef.current,
          markers: catchments.map(c => {
            const isH   = hoveredCatchment && hoveredCatchment.gauge_id === c.gauge_id;
            const isSel = c.gauge_id === selectedId;
            const isTrain = c.split === 'train';
            return {
              location: [c.lat, c.lon],
              size:  isSel ? 0.085 : isH ? 0.065 : 0.038,
              color: isSel  ? [0.06, 0.72, 0.95]
                   : isH   ? [0.96, 0.62, 0.07]
                   : isTrain ? [0.18, 0.50, 0.92] : [0.94, 0.62, 0.07],
            };
          }),
        });
        animId = requestAnimationFrame(animate);
      };
      animId = requestAnimationFrame(animate);
    } catch (err) {
      console.error('Globe init failed:', err);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (globe) globe.destroy();
      globeRef.current = null;
    };
  }, [catchments, canvasSize]); // eslint-disable-line react-hooks/exhaustive-deps

  // Wheel zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = e => {
      e.preventDefault();
      const next = Math.max(0.6, Math.min(3.0, scaleRef.current * (e.deltaY < 0 ? 1.08 : 0.93)));
      scaleRef.current   = next;
      setScale(Math.round(next * 100) / 100);
      targetScaleRef.current = null;
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  const handleZoomIn    = () => { targetScaleRef.current = Math.min(3.0, scaleRef.current + 0.25); };
  const handleZoomOut   = () => { targetScaleRef.current = Math.max(0.6, scaleRef.current - 0.25); };
  const handleZoomReset = () => { targetScaleRef.current = 1.0; };

  const handlePointerDown = e => {
    // Anchor interaction to current phi so drag continues from wherever the globe is,
    // not from zero — fixes the classic "first drag snaps globe to 0°" bug.
    pointerInteractionMovement.current = phiRef.current / 0.006;
    pointerInteracting.current = e.clientX - pointerInteractionMovement.current;
    pointerStartPos.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
  };

  const handlePointerUp = e => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y, time } = pointerStartPos.current;
    const dist = Math.hypot(e.clientX - x, e.clientY - y);
    pointerInteracting.current = null;
    canvas.style.cursor = 'grab';

    if (dist < 8 && Date.now() - time < 400) {
      const rect = canvas.getBoundingClientRect();
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
      let best = null, bestD = 32;
      for (const c of catchments) {
        const p = projectToScreen([c.lat, c.lon], phiRef.current, thetaRef.current, scaleRef.current, rect.width, rect.height);
        if (p.visible && p.z > 0.05) {
          const d = Math.hypot(cx - p.x, cy - p.y);
          if (d < bestD) { bestD = d; best = c; }
        }
      }
      if (best) { onSelectCatchment(best.gauge_id); return; }

      const sp = unproject(cx, cy, phiRef.current, thetaRef.current, scaleRef.current, rect.width, rect.height);
      if (sp) {
        let near = null, nearD = 8;
        for (const c of catchments) {
          const d = Math.hypot(c.lat - sp.lat, c.lon - sp.lon);
          if (d < nearD) { nearD = d; near = c; }
        }
        if (near) onSelectCatchment(near.gauge_id);
      }
    }
  };

  const handlePointerMove = e => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (pointerInteracting.current !== null) {
      const delta = e.clientX - pointerInteracting.current;
      pointerInteractionMovement.current = delta;
      phiRef.current = delta * 0.006;
      targetPhiRef.current = null;
      setHoveredCatchment(null);
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    let hov = null, minD = 22;
    for (const c of catchments) {
      const p = projectToScreen([c.lat, c.lon], phiRef.current, thetaRef.current, scaleRef.current, rect.width, rect.height);
      if (p.visible && p.z > 0.1) {
        const d = Math.hypot(mx - p.x, my - p.y);
        if (d < minD) { minD = d; hov = c; setTooltipPos({ x: p.x, y: p.y }); }
      }
    }
    canvas.style.cursor = hov ? 'pointer' : 'grab';
    setHoveredCatchment(hov);
  };

  const handleResetView = () => {
    targetPhiRef.current   = 5.585;
    targetThetaRef.current = -0.297;
    targetScaleRef.current = 0.80;
    setIsAutoRotate(false);
  };

  if (!catchments || catchments.length === 0) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, color: 'var(--text-2)' }}>Loading…</div>;
  }

  const splitCounts = catchments.reduce((acc, c) => { acc[c.split] = (acc[c.split] || 0) + 1; return acc; }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* Controls row */}
      <div ref={controlsRowRef} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className={`btn ${isAutoRotate ? 'btn-cyan' : 'btn-ghost'} btn-sm`} onClick={() => setIsAutoRotate(v => !v)}>
            {isAutoRotate ? <Pause size={13} /> : <Play size={13} />}
            {isAutoRotate ? 'Pause' : 'Auto Rotate'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={handleResetView}>
            <RotateCcw size={13} /> Reset View
          </button>
          {onSwitchTo2D && (
            <button className="btn btn-ghost btn-sm" onClick={onSwitchTo2D}>Switch to 2D Map</button>
          )}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '14px', fontSize: '11px', color: 'var(--text-2)', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563EB', display: 'inline-block' }} /> Train ({splitCounts.train || 0})
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }} /> Val/Test ({(splitCounts.val || 0) + (splitCounts.test || 0)})
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#06B6D4', display: 'inline-block' }} /> Selected
          </span>
        </div>
      </div>

      {/* Main layout: Globe centered | Info panel right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 230px', gap: '16px', alignItems: 'start' }}>

        {/* Globe viewport — square, centered, capped to fit viewport */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div
            ref={containerRef}
            style={{
              position: 'relative',
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              overflow: 'hidden',
              aspectRatio: '1 / 1',
              width: '100%',
              maxWidth: 'min(100%, calc(80vh / 1.25))',
            }}
          >
          {/* Zoom buttons */}
          <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 15, display: 'flex', flexDirection: 'column', gap: 4, background: 'rgba(255,255,255,0.93)', backdropFilter: 'blur(8px)', padding: 4, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <button className="btn btn-ghost btn-sm" style={{ width: 28, height: 28, padding: 0 }} onClick={handleZoomIn}><ZoomIn size={13} /></button>
            <button className="btn btn-ghost btn-sm" style={{ width: 28, height: 28, padding: 0 }} onClick={handleZoomOut}><ZoomOut size={13} /></button>
            <button className="btn btn-ghost btn-sm" style={{ width: 28, height: 28, padding: 0 }} onClick={handleZoomReset}><Maximize2 size={11} /></button>
            <div style={{ fontSize: '9px', textAlign: 'center', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{Math.round(scale * 100)}%</div>
          </div>

          {/* Tooltip */}
          {hoveredCatchment && (
            <div style={{ position: 'absolute', left: tooltipPos.x, top: tooltipPos.y - 10, transform: 'translate(-50%, -100%)', zIndex: 25, pointerEvents: 'none', background: 'rgba(255,255,255,0.97)', border: '1px solid var(--blue)', boxShadow: '0 4px 14px rgba(23,43,77,0.13)', padding: '5px 11px', borderRadius: 'var(--radius-sm)', whiteSpace: 'nowrap' }}>
              <div style={{ fontSize: '10px', color: 'var(--cyan)', fontWeight: 700 }}>{hoveredCatchment.gauge_id}</div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-1)' }}>{hoveredCatchment.lat.toFixed(2)}°, {hoveredCatchment.lon.toFixed(2)}°</div>
              <div style={{ fontSize: '10px', color: 'var(--text-3)' }}>Click to select</div>
            </div>
          )}

          {/* Canvas — absolutely fills the square container and is perfectly centered */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'grab',
            }}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerMove={handlePointerMove}
          >
            <canvas
              ref={canvasRef}
              style={{
                display: 'block',
                outline: 'none',
              }}
            />
          </div>

          {/* Footer bar — pinned to bottom */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(4px)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: 'var(--text-3)', padding: '5px 14px', zIndex: 10 }}>
            <span>897 CAMELS-BR Gauges</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>Zoom: {Math.round(scale * 100)}%</span>
            <span>Drag · Scroll · Click</span>
          </div>
          </div>
        </div> {/* end centering wrapper */}

        {/* Right info panel */}
        {activeCatchment && (
          <div ref={infoPanelRef} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* Selected basin */}
            <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '14px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>
                <MapPin size={11} style={{ display: 'inline', marginRight: 3 }} />Selected Basin
              </div>
              <div className="globe-gauge-id" style={{ fontSize: '15px', fontWeight: 800, color: 'var(--blue)', fontFamily: 'var(--font-mono)' }}>
                {activeCatchment.gauge_id}
              </div>
              <div style={{ fontSize: '10.5px', color: 'var(--text-3)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>
                {activeCatchment.lat.toFixed(4)}°, {activeCatchment.lon.toFixed(4)}°
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 10 }}>
                {[
                  { label: 'Area',      value: activeCatchment.area      ? (activeCatchment.area / 1000).toFixed(1) + 'k' : '—', unit: 'km²' },
                  { label: 'Elevation', value: activeCatchment.elev_mean ? Math.round(activeCatchment.elev_mean) : '—',          unit: 'm'   },
                  { label: 'P95',       value: activeCatchment.P95_mm_day ? activeCatchment.P95_mm_day.toFixed(2) : '—',         unit: 'mm/d', color: '#D97706' },
                  { label: 'P99',       value: activeCatchment.P99_mm_day ? activeCatchment.P99_mm_day.toFixed(2) : '—',         unit: 'mm/d', color: '#DC2626' },
                ].map(({ label, value, unit, color }) => (
                  <div key={label} className="globe-stat-chip" style={{ background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', padding: '7px 9px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '9.5px', color: 'var(--text-3)', fontWeight: 600 }}>{label}</div>
                    <div style={{ fontSize: '12.5px', fontWeight: 700, color: color || 'var(--text-1)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                      {value} <span style={{ fontSize: '9px', color: 'var(--text-3)', fontWeight: 400 }}>{unit}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10.5px', color: 'var(--text-3)' }}>
                  {activeCatchment.start_date?.slice(0, 4)} – {activeCatchment.end_date?.slice(0, 4)}
                </span>
                <span className="globe-stat-chip" style={{
                  padding: '2px 7px', borderRadius: 4, fontSize: '10px', fontWeight: 800,
                  background: activeCatchment.split === 'train' ? '#DBEAFE'
                    : activeCatchment.split === 'val'  ? '#D1FAE5'
                    : activeCatchment.split === 'test' ? '#D1FAE5' : '#F3F4F6',
                  color: activeCatchment.split === 'train' ? '#1D4ED8'
                    : activeCatchment.split === 'val'  ? '#065F46'
                    : activeCatchment.split === 'test' ? '#065F46' : '#6B7280',
                }}>
                  {(activeCatchment.split ?? 'N/A').toUpperCase()}
                </span>
              </div>
            </div>

            {/* Dataset split summary */}
            <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '14px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 10 }}>
                <Compass size={11} style={{ display: 'inline', marginRight: 3 }} />Dataset Split
              </div>
              {Object.entries(splitCounts).sort().map(([split, count]) => (
                <div key={split} className="globe-stat-chip" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', display: 'inline-block',
                      background: split === 'train' ? '#2563EB' : split === 'val' ? '#10B981' : split === 'test' ? '#10B981' : '#9CA3AF',
                    }} />
                    <span style={{ fontSize: '11.5px', color: 'var(--text-2)', fontWeight: 600 }}>
                      {split.charAt(0).toUpperCase() + split.slice(1)}
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
