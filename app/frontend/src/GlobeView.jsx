import React, { useEffect, useRef, useState, useMemo } from 'react';
import createGlobe from 'cobe';
import {
  MapPin, Play, Pause, RotateCcw, AlertTriangle, ShieldCheck,
  Compass, ChevronRight, ZoomIn, ZoomOut, Maximize2
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
  if (r2 > 0.64) return null; // Clicked outside the globe sphere
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

export default function GlobeView({ stations, selectedId, onSelectStation, onNavigateToTab }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const pointerInteracting = useRef(null);
  const pointerInteractionMovement = useRef(0);
  const pointerStartPos = useRef({ x: 0, y: 0, time: 0 });

  const phiRef = useRef(4.2);
  const thetaRef = useRef(0.55);
  const scaleRef = useRef(1.0);
  const targetPhiRef = useRef(null);
  const targetThetaRef = useRef(null);
  const targetScaleRef = useRef(null);

  const [isAutoRotate, setIsAutoRotate] = useState(true);
  const isAutoRotateRef = useRef(true);
  const [scale, setScale] = useState(1.0);
  const [hoveredStation, setHoveredStation] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    isAutoRotateRef.current = isAutoRotate;
  }, [isAutoRotate]);

  const activeStation = useMemo(() => {
    return stations.find(s => s.id === selectedId) || stations[0];
  }, [stations, selectedId]);

  // Center on active station on mount or when selectedId changes
  useEffect(() => {
    if (activeStation) {
      const targetPhi = (-activeStation.lon * PI) / 180 + (3 * PI) / 2;
      const targetTheta = (activeStation.lat * PI) / 180;

      let currentPhi = phiRef.current;
      const twoPi = PI * 2;
      let diff = (targetPhi - currentPhi) % twoPi;
      if (diff > PI) diff -= twoPi;
      if (diff < -PI) diff += twoPi;

      targetPhiRef.current = currentPhi + diff;
      targetThetaRef.current = Math.max(-1.1, Math.min(1.1, targetTheta));
    }
  }, [selectedId, activeStation]);

  // WebGL Globe initialization and render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const markers = stations.map(s => {
      const isSelected = s.id === selectedId;
      const isSurge = s.peakFlow >= s.threshold90 * 1.5;
      return {
        location: [s.lat, s.lon],
        size: isSelected ? 0.085 : 0.05,
        color: isSurge
          ? [0.94, 0.27, 0.27]
          : isSelected
          ? [0.02, 0.55, 0.85]
          : [0.14, 0.46, 0.88],
        id: s.id,
      };
    });

    const arcs = [
      { from: [38.6253, -90.1794], to: [38.9497, -77.1275], color: [0.02, 0.62, 0.82] },
      { from: [38.6253, -90.1794], to: [30.2458, -97.6994], color: [0.02, 0.62, 0.82] },
      { from: [38.9497, -77.1275], to: [35.6511, -78.4717], color: [0.02, 0.62, 0.82] },
      { from: [38.4558, -121.5011], to: [30.2458, -97.6994], color: [0.14, 0.46, 0.88] },
    ];

    let globe = null;
    let animId = null;

    try {
      globe = createGlobe(canvas, {
        devicePixelRatio: Math.min(2, window.devicePixelRatio || 1),
        width: 1000,
        height: 1000,
        phi: phiRef.current,
        theta: thetaRef.current,
        scale: scaleRef.current,
        dark: 0,
        diffuse: 1.15,
        mapSamples: 16000,
        mapBrightness: 3.5,
        baseColor: [0.78, 0.88, 0.97],
        markerColor: [0.02, 0.55, 0.85],
        glowColor: [0.62, 0.79, 0.96],
        markers,
        arcs,
        arcColor: [0.02, 0.58, 0.82],
        arcWidth: 0.35,
        arcHeight: 0.18,
      });

      const animate = () => {
        // Auto-rotation when not dragging and no target tween
        if (isAutoRotateRef.current && pointerInteracting.current === null && targetPhiRef.current === null) {
          phiRef.current += 0.003;
        }

        // Smooth tween to target station
        if (targetPhiRef.current !== null && pointerInteracting.current === null) {
          const phiDiff = targetPhiRef.current - phiRef.current;
          const thetaDiff = targetThetaRef.current - thetaRef.current;

          phiRef.current += phiDiff * 0.08;
          thetaRef.current += thetaDiff * 0.08;

          if (Math.abs(phiDiff) < 0.001 && Math.abs(thetaDiff) < 0.001) {
            targetPhiRef.current = null;
            targetThetaRef.current = null;
          }
        }

        // Smooth zoom tween
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
          markers: stations.map(s => {
            const isHovered = hoveredStation && hoveredStation.id === s.id;
            const isSelected = s.id === selectedId;
            return {
              location: [s.lat, s.lon],
              size: isSelected ? 0.085 : isHovered ? 0.075 : 0.045,
              color: isSelected
                ? [0.14, 0.83, 0.93]
                : isHovered
                ? [0.96, 0.62, 0.07]
                : [0.25, 0.55, 0.9],
            };
          }),
        });

        animId = requestAnimationFrame(animate);
      };

      animId = requestAnimationFrame(animate);
    } catch (err) {
      console.error('Failed to initialize 3D Globe:', err);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (globe) globe.destroy();
    };
  }, [stations, selectedId, hoveredStation]);

  // Non-passive wheel listener for smooth zooming
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      const nextScale = Math.max(0.65, Math.min(2.8, scaleRef.current * zoomFactor));
      scaleRef.current = nextScale;
      setScale(Math.round(nextScale * 100) / 100);
      targetScaleRef.current = null;
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // Zoom control buttons
  const handleZoomIn = () => {
    const next = Math.min(2.8, scaleRef.current + 0.3);
    targetScaleRef.current = next;
  };

  const handleZoomOut = () => {
    const next = Math.max(0.65, scaleRef.current - 0.3);
    targetScaleRef.current = next;
  };

  const handleZoomReset = () => {
    targetScaleRef.current = 1.0;
  };

  // Pointer drag and click detection
  const handlePointerDown = (e) => {
    pointerInteracting.current = e.clientX - pointerInteractionMovement.current;
    pointerStartPos.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
  };

  const handlePointerUp = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const start = pointerStartPos.current;
    const dist = Math.hypot(e.clientX - start.x, e.clientY - start.y);
    const duration = Date.now() - start.time;

    pointerInteracting.current = null;
    if (canvas) canvas.style.cursor = 'grab';

    // Clicked (short tap / click with little to no movement)
    if (dist < 8 && duration < 400) {
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // 1. Direct hit check on projected station markers
      let closestStation = null;
      let minDistance = 34; // 34px clickable tolerance

      for (const s of stations) {
        const proj = projectToScreen([s.lat, s.lon], phiRef.current, thetaRef.current, scaleRef.current, rect.width, rect.height);
        if (proj.visible && proj.z > 0.05) {
          const d = Math.hypot(clickX - proj.x, clickY - proj.y);
          if (d < minDistance) {
            minDistance = d;
            closestStation = s;
          }
        }
      }

      if (closestStation) {
        onSelectStation(closestStation.id);
        return;
      }

      // 2. Click on the 3D globe surface: unproject to sphere (lat, lon)
      const surfacePoint = unproject(clickX, clickY, phiRef.current, thetaRef.current, scaleRef.current, rect.width, rect.height);
      if (surfacePoint) {
        // Find nearest station on Earth to the clicked point
        let nearest = null;
        let nearestDistDeg = 25; // within ~2500 km

        for (const s of stations) {
          const dLat = s.lat - surfacePoint.lat;
          const dLon = s.lon - surfacePoint.lon;
          const degDist = Math.hypot(dLat, dLon);
          if (degDist < nearestDistDeg) {
            nearestDistDeg = degDist;
            nearest = s;
          }
        }

        if (nearest) {
          onSelectStation(nearest.id);
        }
      }
    }
  };

  const handlePointerMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Active drag rotation
    if (pointerInteracting.current !== null) {
      const deltaX = e.clientX - pointerInteracting.current;
      pointerInteractionMovement.current = deltaX;
      phiRef.current = deltaX * 0.006;
      targetPhiRef.current = null; // stop any auto tween
      setHoveredStation(null);
      return;
    }

    // Hover detection over station markers
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    let hovered = null;
    let minD = 24;

    for (const s of stations) {
      const proj = projectToScreen([s.lat, s.lon], phiRef.current, thetaRef.current, scaleRef.current, rect.width, rect.height);
      if (proj.visible && proj.z > 0.1) {
        const d = Math.hypot(mouseX - proj.x, mouseY - proj.y);
        if (d < minD) {
          minD = d;
          hovered = s;
          setTooltipPos({ x: proj.x, y: proj.y });
        }
      }
    }

    if (hovered) {
      canvas.style.cursor = 'pointer';
      setHoveredStation(hovered);
    } else {
      canvas.style.cursor = 'grab';
      setHoveredStation(null);
    }
  };

  const handleResetView = () => {
    targetPhiRef.current = 4.2;
    targetThetaRef.current = 0.55;
    targetScaleRef.current = 1.0;
    setIsAutoRotate(true);
  };

  return (
    <div className="globe-page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="page-title">Interactive 3D Sensor Globe</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            className={`btn ${isAutoRotate ? 'btn-cyan' : 'btn-ghost'} btn-sm`}
            onClick={() => setIsAutoRotate(!isAutoRotate)}
          >
            {isAutoRotate ? <Pause size={13} /> : <Play size={13} />}
            {isAutoRotate ? 'Pause Rotation' : 'Auto Rotate'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={handleResetView}>
            <RotateCcw size={13} /> Reset View
          </button>
        </div>
      </div>

      <div className="globe-layout">
        {/* Left: Station Directory */}
        <div className="globe-stations-list card">
          <div className="card-title">
            <span className="icon-wrap"><Compass size={15} /></span>
            Active Gauges ({stations.length})
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {stations.map(s => {
              const isSelected = s.id === selectedId;
              const isHigh = s.peakFlow >= s.threshold90;
              return (
                <div
                  key={s.id}
                  onClick={() => onSelectStation(s.id)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: isSelected ? '#EFF6FF' : 'var(--bg-surface)',
                    border: `1px solid ${isSelected ? 'var(--blue)' : 'var(--border)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span className="text-mono" style={{ fontSize: '11px', fontWeight: 600, color: isSelected ? 'var(--blue)' : 'var(--text-1)' }}>
                      {s.id}
                    </span>
                    <span className={`badge ${isHigh ? 'badge-yellow' : 'badge-green'}`} style={{ fontSize: '9px', padding: '2px 6px' }}>
                      {s.state}
                    </span>
                  </div>
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-1)', lineHeight: 1.3 }}>
                    {s.name}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', color: 'var(--text-3)' }}>
                    <span>{s.lat.toFixed(2)}°N, {Math.abs(s.lon).toFixed(2)}°W</span>
                    <span>{s.drainageArea.toLocaleString()} sq mi</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center: 3D Globe Canvas Viewport with Zoom Controls and Tooltip */}
        <div
          ref={containerRef}
          className="globe-viewport card"
          style={{ position: 'relative', overflow: 'hidden', padding: 0 }}
        >
          {/* Top-Left Info Tag */}
          <div
            style={{
              position: 'absolute',
              top: 16,
              left: 18,
              zIndex: 10,
              pointerEvents: 'none',
              background: 'rgba(255, 255, 255, 0.92)',
              backdropFilter: 'blur(8px)',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: '10px', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Interactive 3D Sphere
            </div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--blue)', marginTop: '2px' }}>
              Click station to focus • Scroll or buttons to zoom
            </div>
          </div>

          {/* Top-Right Floating Zoom Controls */}
          <div
            style={{
              position: 'absolute',
              top: 16,
              right: 18,
              zIndex: 15,
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              background: 'rgba(255, 255, 255, 0.94)',
              backdropFilter: 'blur(8px)',
              padding: '6px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
            }}
          >
            <button
              className="btn btn-ghost btn-sm"
              style={{ width: 32, height: 32, padding: 0 }}
              onClick={handleZoomIn}
              title="Zoom In (or scroll up)"
            >
              <ZoomIn size={15} />
            </button>
            <button
              className="btn btn-ghost btn-sm"
              style={{ width: 32, height: 32, padding: 0 }}
              onClick={handleZoomOut}
              title="Zoom Out (or scroll down)"
            >
              <ZoomOut size={15} />
            </button>
            <button
              className="btn btn-ghost btn-sm"
              style={{ width: 32, height: 32, padding: 0, fontSize: '10px' }}
              onClick={handleZoomReset}
              title="Reset Zoom"
            >
              <Maximize2 size={13} />
            </button>
            <div style={{ fontSize: '9px', textAlign: 'center', color: 'var(--text-2)', fontFamily: 'var(--font-mono)', paddingTop: 2 }}>
              {Math.round(scale * 100)}%
            </div>
          </div>

          {/* Hover Tooltip Overlay over Station */}
          {hoveredStation && (
            <div
              style={{
                position: 'absolute',
                left: `${tooltipPos.x}px`,
                top: `${tooltipPos.y - 12}px`,
                transform: 'translate(-50%, -100%)',
                zIndex: 25,
                pointerEvents: 'none',
                background: 'rgba(255, 255, 255, 0.97)',
                border: '1px solid var(--blue)',
                boxShadow: '0 4px 16px rgba(23,43,77,0.14), 0 0 8px rgba(37,99,235,0.12)',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                whiteSpace: 'nowrap',
                transition: 'opacity 0.15s',
              }}
            >
              <div style={{ fontSize: '10px', color: 'var(--cyan)', fontWeight: 600 }}>
                {hoveredStation.id} • {hoveredStation.state}
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-1)', marginTop: '2px' }}>
                {hoveredStation.name}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '2px' }}>
                Click to inspect basin
              </div>
            </div>
          )}

          {/* Interactive Canvas */}
          <div
            style={{
              width: '100%',
              height: '520px',
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
                maxWidth: '560px',
                aspectRatio: '1',
                outline: 'none',
              }}
            />
          </div>

          {/* Bottom Legend */}
          <div
            style={{
              position: 'absolute',
              bottom: 14,
              left: 18,
              right: 18,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '11px',
              color: 'var(--text-2)',
              background: 'rgba(255, 255, 255, 0.92)',
              backdropFilter: 'blur(6px)',
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              pointerEvents: 'none',
            }}
          >
            <span>● Blue: Gauge Station</span>
            <span>● Cyan: Active Focus</span>
            <span>Zoom: {Math.round(scale * 100)}%</span>
            <span>― Arc: River Basin Corridor</span>
          </div>
        </div>

        {/* Right: Station Telemetry Card */}
        <div className="globe-telemetry card">
          <div className="card-title">
            <span className="icon-wrap"><MapPin size={15} /></span>
            Station Telemetry
          </div>

          <div style={{ padding: '14px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginBottom: '14px' }}>
            <div style={{ fontSize: '10.5px', color: 'var(--text-2)', textTransform: 'uppercase' }}>Selected Basin</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--blue)', marginTop: '3px' }}>
              {activeStation.river}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '2px' }}>
              {activeStation.name}
            </div>
            <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-3)', marginTop: '6px' }}>
              ID: {activeStation.id} ({activeStation.lat}° N, {activeStation.lon}° W)
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
            <div style={{ padding: '10px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase' }}>Drainage Area</div>
              <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px' }}>
                {activeStation.drainageArea.toLocaleString()} <span style={{ fontSize: '10px', fontWeight: 400, color: 'var(--text-3)' }}>sq mi</span>
              </div>
            </div>
            <div style={{ padding: '10px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase' }}>Elevation</div>
              <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px' }}>
                {activeStation.elevation.toLocaleString()} <span style={{ fontSize: '10px', fontWeight: 400, color: 'var(--text-3)' }}>ft</span>
              </div>
            </div>
            <div style={{ padding: '10px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase' }}>Basin Slope</div>
              <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px' }}>
                {activeStation.slope}%
              </div>
            </div>
            <div style={{ padding: '10px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-3)', textTransform: 'uppercase' }}>Forest Cover</div>
              <div style={{ fontSize: '14px', fontWeight: 700, marginTop: '2px' }}>
                {activeStation.forestCover}%
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
              <span style={{ color: 'var(--text-2)' }}>90th Pct Flood Peak</span>
              <span style={{ fontWeight: 700, color: 'var(--yellow)', fontFamily: 'var(--font-mono)' }}>
                {activeStation.threshold90.toLocaleString()} cfs
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '16px' }}>
              <span style={{ color: 'var(--text-2)' }}>Historical Peak</span>
              <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                {activeStation.peakFlow.toLocaleString()} cfs
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                className="btn btn-primary btn-block"
                onClick={() => onNavigateToTab('calculator', activeStation.id)}
              >
                Compute Discharge for Station <ChevronRight size={14} />
              </button>
              <button
                className="btn btn-ghost btn-block"
                onClick={() => onNavigateToTab('forecast', activeStation.id)}
              >
                View 30-Day Hydrograph <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
