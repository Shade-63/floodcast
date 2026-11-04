import React, { useEffect, useRef, useState, useMemo } from 'react';
import createGlobe from 'cobe';
import {
  MapPin, Play, Pause, RotateCcw, AlertTriangle, ShieldCheck,
  Compass, ChevronRight, ZoomIn, ZoomOut, Maximize2, Layers
} from 'lucide-react';

const PI = Math.PI;

// Project [lat, lon] to 2D canvas screen coordinates matching cobe's WebGL projection
function projectToScreen([lat, lon], phi, theta, scale = 1, width = 560, height = 560) {
  const r = (lat * PI) / 180;
  const a = (lon * PI) / 180 - PI;
  const o = Math.cos(r);
  const t = [-o * Math.cos(a), Math.sin(r), o * Math.sin(a)];

  const cosL = Math.cos(theta), cosF = Math.cos(phi);
  const sinL = Math.sin(theta), sinF = Math.sin(phi);

  const c = cosF * t[0] + sinF * t[2];
  const s = sinF * sinL * t[0] + cosL * t[1] - cosF * sinL * t[2];
  const z = -sinF * cosL * t[0] + sinL * t[1] + cosF * cosL * t[2];

  const visible = z >= 0;
  const x = width * ((c * scale + 1) / 2);
  const y = height * ((-s * scale + 1) / 2);

  return { x, y, visible, z };
}

// Convert 2D canvas click back to 3D spherical [lat, lon]
function unproject(clickX, clickY, phi, theta, scale = 1, width = 560, height = 560) {
  const c = ((2 * clickX) / width - 1) / scale;
  const s = -((2 * clickY) / height - 1) / scale;
  const r2 = c * c + s * s;
  // Normalized sphere radius in cobe is 0.8
  if (r2 > 0.64) return null;
  const z = Math.sqrt(0.64 - r2);

  const v = [c / 0.8, s / 0.8, z / 0.8];
  const cosL = Math.cos(theta), cosF = Math.cos(phi);
  const sinL = Math.sin(theta), sinF = Math.sin(phi);

  const t0 = cosF * v[0] + sinF * sinL * v[1] - sinF * cosL * v[2];
  const t1 = cosL * v[1] + sinL * v[2];
  const t2 = sinF * v[0] - cosF * sinL * v[1] + cosF * cosL * v[2];

  const lat = (Math.asin(Math.max(-1, Math.min(1, t1))) * 180) / PI;
  const lon = (Math.atan2(-t2, t0) * 180) / PI;
  return { lat, lon };
}

export default function GlobeView({
  catchments = [],
  selectedId,
  onSelectCatchment,
  onSwitchTo2D
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const globeRef = useRef(null);

  const pointerInteracting = useRef(null);
  const pointerStartPos = useRef({ x: 0, y: 0, time: 0 });

  // Initial center on Brazil (Lat ~ -15, Lon ~ -48)
  const phiRef = useRef(5.45);
  const thetaRef = useRef(-0.25);
  const scaleRef = useRef(1.15);
  const targetPhiRef = useRef(null);
  const targetThetaRef = useRef(null);
  const targetScaleRef = useRef(null);

  const [isAutoRotate, setIsAutoRotate] = useState(true);
  const isAutoRotateRef = useRef(true);
  const [scale, setScale] = useState(1.15);
  const [hoveredCatchment, setHoveredCatchment] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    isAutoRotateRef.current = isAutoRotate;
  }, [isAutoRotate]);

  const activeCatchment = useMemo(() => {
    return catchments.find((c) => c.gauge_id === selectedId) || catchments[0];
  }, [catchments, selectedId]);

  // Build markers list with colors and sizes
  const buildMarkers = useMemo(() => {
    return catchments.map((c) => {
      const isSelected = c.gauge_id === selectedId;
      const isHovered = hoveredCatchment && hoveredCatchment.gauge_id === c.gauge_id;
      return {
        location: [c.lat, c.lon],
        size: isSelected ? 0.085 : isHovered ? 0.065 : 0.038,
        color: isSelected
          ? [0.05, 0.75, 0.95] // bright cyan for selected
          : isHovered
          ? [0.96, 0.62, 0.07] // amber hover
          : c.split === 'test'
          ? [0.10, 0.65, 0.45] // emerald for test
          : [0.15, 0.39, 0.92], // blue for others
      };
    });
  }, [catchments, selectedId, hoveredCatchment]);

  // Center on active catchment when selectedId changes
  useEffect(() => {
    if (activeCatchment) {
      const targetPhi = (-activeCatchment.lon * PI) / 180 + (3 * PI) / 2;
      const targetTheta = (activeCatchment.lat * PI) / 180;

      let currentPhi = phiRef.current;
      const twoPi = PI * 2;
      let diff = (targetPhi - currentPhi) % twoPi;
      if (diff > PI) diff -= twoPi;
      if (diff < -PI) diff += twoPi;

      targetPhiRef.current = currentPhi + diff;
      targetThetaRef.current = Math.max(-1.1, Math.min(1.1, targetTheta));
    }
  }, [selectedId, activeCatchment]);

  // Initialize and run Cobe WebGL Globe
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animId = null;
    const container = containerRef.current;
    const baseW = container ? Math.min(container.clientWidth - 40, 560) : 520;
    const size = Math.max(baseW, 400);

    try {
      const globe = createGlobe(canvas, {
        devicePixelRatio: Math.min(2, window.devicePixelRatio || 1),
        width: size * 2,
        height: size * 2,
        phi: phiRef.current,
        theta: thetaRef.current,
        scale: scaleRef.current,
        dark: 0,
        diffuse: 1.15,
        mapSamples: 16000,
        mapBrightness: 3.5,
        baseColor: [0.76, 0.86, 0.96], // Soft blue oceans
        markerColor: [0.15, 0.39, 0.92],
        glowColor: [0.65, 0.82, 0.98], // Light glowing atmosphere
        markers: buildMarkers,
      });

      globeRef.current = globe;

      const animate = () => {
        // Auto-rotation when not interacting
        if (isAutoRotateRef.current && pointerInteracting.current === null && targetPhiRef.current === null) {
          phiRef.current += 0.0018;
        }

        // Smooth tween azimuth (phi)
        if (targetPhiRef.current !== null && pointerInteracting.current === null) {
          const diff = targetPhiRef.current - phiRef.current;
          phiRef.current += diff * 0.08;
          if (Math.abs(diff) < 0.001) {
            targetPhiRef.current = null;
          }
        }

        // Smooth tween elevation (theta)
        if (targetThetaRef.current !== null && pointerInteracting.current === null) {
          const diff = targetThetaRef.current - thetaRef.current;
          thetaRef.current += diff * 0.08;
          if (Math.abs(diff) < 0.001) {
            targetThetaRef.current = null;
          }
        }

        // Smooth zoom scale
        if (targetScaleRef.current !== null) {
          const sDiff = targetScaleRef.current - scaleRef.current;
          scaleRef.current += sDiff * 0.1;
          if (Math.abs(sDiff) < 0.005) {
            scaleRef.current = targetScaleRef.current;
            targetScaleRef.current = null;
          }
          setScale(Math.round(scaleRef.current * 100) / 100);
        }

        globe.update({
          phi: phiRef.current,
          theta: thetaRef.current,
          scale: scaleRef.current,
        });

        animId = requestAnimationFrame(animate);
      };

      animate();
    } catch (e) {
      console.error('Globe WebGL initialization error:', e);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (globeRef.current) {
        globeRef.current.destroy();
        globeRef.current = null;
      }
    };
  }, []); // Run on mount

  // Update markers on selection or hover changes
  useEffect(() => {
    if (globeRef.current) {
      globeRef.current.update({
        markers: buildMarkers,
      });
    }
  }, [buildMarkers]);

  const handleZoom = (delta) => {
    const next = Math.max(0.75, Math.min(1.85, scaleRef.current + delta));
    targetScaleRef.current = next;
  };

  const handleReset = () => {
    targetPhiRef.current = 5.45;
    targetThetaRef.current = -0.25;
    targetScaleRef.current = 1.15;
    setIsAutoRotate(true);
  };

  const handlePointerDown = (e) => {
    pointerInteracting.current = { x: e.clientX, y: e.clientY };
    pointerStartPos.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    setIsAutoRotate(false);
    if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
  };

  const handlePointerMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Active drag rotation
    if (pointerInteracting.current !== null) {
      const dx = e.clientX - pointerInteracting.current.x;
      const dy = e.clientY - pointerInteracting.current.y;
      phiRef.current += dx * 0.004;
      thetaRef.current = Math.max(-1.1, Math.min(1.1, thetaRef.current - dy * 0.004));
      pointerInteracting.current = { x: e.clientX, y: e.clientY };
      targetPhiRef.current = null;
      targetThetaRef.current = null;
      setHoveredCatchment(null);
      return;
    }

    // Hover detection over catchment markers
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    let hovered = null;
    let minD = 16;

    for (const c of catchments) {
      const proj = projectToScreen([c.lat, c.lon], phiRef.current, thetaRef.current, scaleRef.current, rect.width, rect.height);
      if (proj.visible && proj.z > 0.1) {
        const d = Math.hypot(mouseX - proj.x, mouseY - proj.y);
        if (d < minD) {
          minD = d;
          hovered = c;
          setTooltipPos({ x: proj.x, y: proj.y });
        }
      }
    }

    if (hovered) {
      canvas.style.cursor = 'pointer';
      setHoveredCatchment(hovered);
    } else {
      canvas.style.cursor = 'grab';
      setHoveredCatchment(null);
    }
  };

  const handlePointerUp = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const start = pointerStartPos.current;
    const dist = Math.hypot(e.clientX - start.x, e.clientY - start.y);
    const duration = Date.now() - start.time;

    pointerInteracting.current = null;
    canvas.style.cursor = 'grab';

    // Click selection (minimal movement and brief click)
    if (dist < 8 && duration < 400) {
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // 1. Direct hit check on projected catchment markers
      let closest = null;
      let minDist = 18;
      for (const c of catchments) {
        const proj = projectToScreen([c.lat, c.lon], phiRef.current, thetaRef.current, scaleRef.current, rect.width, rect.height);
        if (proj.visible && proj.z > 0.1) {
          const d = Math.hypot(clickX - proj.x, clickY - proj.y);
          if (d < minDist) {
            minDist = d;
            closest = c;
          }
        }
      }

      // 2. Fallback to unprojecting spherical surface coordinates
      if (!closest) {
        const coords = unproject(clickX, clickY, phiRef.current, thetaRef.current, scaleRef.current, rect.width, rect.height);
        if (coords) {
          let minDeg = 4.0;
          for (const c of catchments) {
            const d = Math.hypot(c.lat - coords.lat, c.lon - coords.lon);
            if (d < minDeg) {
              minDeg = d;
              closest = c;
            }
          }
        }
      }

      if (closest) {
        onSelectCatchment(closest.gauge_id);
      }
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px', minHeight: '600px' }}>
      {/* 3D Globe Interactive Canvas */}
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          background: 'linear-gradient(145deg, #F8FAFC 0%, #EFF6FF 100%)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          padding: '20px',
          boxShadow: 'inset 0 0 40px rgba(37,99,235,0.03)',
        }}
        onWheel={(e) => {
          handleZoom(e.deltaY > 0 ? -0.1 : 0.1);
        }}
      >
        {/* Floating Globe Controls Header */}
        <div
          style={{
            position: 'absolute',
            left: '20px',
            top: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setIsAutoRotate(!isAutoRotate)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 10px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                background: isAutoRotate ? '#EFF6FF' : 'var(--bg-card)',
                color: isAutoRotate ? 'var(--blue)' : 'var(--text-1)',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              }}
            >
              {isAutoRotate ? <Pause size={13} /> : <Play size={13} />}
              {isAutoRotate ? 'Pause' : 'Rotate'}
            </button>
            <button
              onClick={handleReset}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 10px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                color: 'var(--text-1)',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              }}
            >
              <RotateCcw size={13} />
              Reset View
            </button>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => handleZoom(0.2)}
              style={{
                padding: '6px 9px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                color: 'var(--text-1)',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              }}
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>
            <button
              onClick={() => handleZoom(-0.2)}
              style={{
                padding: '6px 9px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                color: 'var(--text-1)',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              }}
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>
            <button
              onClick={() => {
                targetScaleRef.current = 1.15;
              }}
              style={{
                padding: '6px 9px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                color: 'var(--text-1)',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              }}
              title="Scale"
            >
              {Math.round(scale * 100)}%
            </button>
            {onSwitchTo2D && (
              <button
                onClick={onSwitchTo2D}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-elevated)',
                  color: 'var(--blue)',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                }}
              >
                <Layers size={13} />
                2D Map
              </button>
            )}
          </div>
        </div>

        {/* Hover Tooltip Overlay */}
        {hoveredCatchment && (
          <div
            style={{
              position: 'absolute',
              left: `${tooltipPos.x}px`,
              top: `${tooltipPos.y - 12}px`,
              transform: 'translate(-50%, -100%)',
              zIndex: 25,
              pointerEvents: 'none',
              background: 'rgba(15, 23, 42, 0.95)',
              color: '#FFFFFF',
              border: '1px solid rgba(56, 189, 248, 0.5)',
              boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              whiteSpace: 'nowrap',
              fontSize: '11px',
              backdropFilter: 'blur(4px)',
            }}
          >
            <div style={{ color: '#38BDF8', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              Gauge {hoveredCatchment.gauge_id}
            </div>
            <div style={{ color: '#E2E8F0', fontSize: '10px', marginTop: '2px' }}>
              Split: <strong style={{ textTransform: 'uppercase' }}>{hoveredCatchment.split}</strong> • Area: {hoveredCatchment.area?.toLocaleString()} km²
            </div>
            <div style={{ color: '#94A3B8', fontSize: '9.5px', marginTop: '2px' }}>
              Click to select catchment
            </div>
          </div>
        )}

        {/* Globe canvas */}
        <div
          style={{
            width: '520px',
            height: '520px',
            maxWidth: '100%',
            aspectRatio: '1',
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
              width: '100%',
              height: '100%',
              maxWidth: '520px',
              aspectRatio: '1',
              outline: 'none',
            }}
          />
        </div>

        {/* Bottom Legend */}
        <div
          style={{
            position: 'absolute',
            bottom: '16px',
            left: '20px',
            right: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '11px',
            color: 'var(--text-2)',
            background: 'rgba(255, 255, 255, 0.90)',
            backdropFilter: 'blur(6px)',
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            pointerEvents: 'none',
          }}
        >
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#05B8F3' }} /> Selected Basin
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10A773' }} /> Test Gauges
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563EB' }} /> Gauges ({catchments.length})
            </span>
          </div>
          <div style={{ color: 'var(--text-3)' }}>
            Drag to orbit • Scroll to zoom • Click marker to focus
          </div>
        </div>
      </div>

      {/* Selected Catchment Inspector Panel */}
      <div
        style={{
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          overflowY: 'auto',
        }}
      >
        <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Selected CAMELS-BR Basin
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-1)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
            {activeCatchment ? activeCatchment.gauge_id : 'Select a basin'}
          </div>
        </div>

        {activeCatchment ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ background: 'var(--bg-elevated)', padding: '10px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '10.5px', color: 'var(--text-2)' }}>Latitude</div>
                <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  {activeCatchment.lat.toFixed(4)}°
                </div>
              </div>
              <div style={{ background: 'var(--bg-elevated)', padding: '10px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '10.5px', color: 'var(--text-2)' }}>Longitude</div>
                <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  {activeCatchment.lon.toFixed(4)}°
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-2)' }}>Spatial Split:</span>
                <span
                  style={{
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color:
                      activeCatchment.split === 'test'
                        ? '#10B981'
                        : activeCatchment.split === 'validation'
                        ? '#8B5CF6'
                        : '#3B82F6',
                  }}
                >
                  {activeCatchment.split}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-2)' }}>Drainage Area:</span>
                <span style={{ fontWeight: 600 }}>
                  {activeCatchment.area ? `${activeCatchment.area.toLocaleString()} km²` : 'N/A'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-2)' }}>Mean Elevation:</span>
                <span style={{ fontWeight: 600 }}>
                  {activeCatchment.elev_mean ? `${activeCatchment.elev_mean.toFixed(0)} m` : 'N/A'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-2)' }}>Record Period:</span>
                <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                  {activeCatchment.start_date} to {activeCatchment.end_date}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span style={{ color: 'var(--text-2)' }}>Valid 30d Windows:</span>
                <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  {activeCatchment.valid_windows?.toLocaleString()}
                </span>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '8px' }}>
                Flow Extremes Thresholds
              </div>
              {activeCatchment.threshold_eligible ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: '#D97706', fontWeight: 600 }}>P95 Flow Threshold:</span>
                    <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {activeCatchment.P95_mm_day?.toFixed(2)} mm/day
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: '#DC2626', fontWeight: 700 }}>P99 Flow Threshold:</span>
                    <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {activeCatchment.P99_mm_day?.toFixed(2)} mm/day
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '11.5px', color: 'var(--text-3)', fontStyle: 'italic' }}>
                  Catchment has insufficient reference streak to establish official flow thresholds.
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>Loading catchment list...</div>
        )}
      </div>
    </div>
  );
}
