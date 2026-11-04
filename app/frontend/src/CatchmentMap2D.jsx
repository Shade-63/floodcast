import React, { useState, useMemo } from 'react';
import { Search, MapPin, Filter, Layers, Info } from 'lucide-react';

// Geographic bounds for Brazil CAMELS-BR domain
const MIN_LON = -74.5;
const MAX_LON = -34.0;
const MIN_LAT = -34.5;
const MAX_LAT = 5.5;

const WIDTH = 680;
const HEIGHT = 660;

function project(lat, lon) {
  // Equirectangular projection
  const x = ((lon - MIN_LON) / (MAX_LON - MIN_LON)) * WIDTH;
  const y = ((MAX_LAT - lat) / (MAX_LAT - MIN_LAT)) * HEIGHT;
  return { x, y };
}

export default function CatchmentMap2D({
  catchments = [],
  selectedId,
  onSelectCatchment,
  onSwitchTo3D
}) {
  const [search, setSearch] = useState('');
  const [splitFilter, setSplitFilter] = useState('all');
  const [colorMode, setColorMode] = useState('split'); // 'split' or 'threshold'
  const [hovered, setHovered] = useState(null);

  const filteredCatchments = useMemo(() => {
    return catchments.filter((c) => {
      if (splitFilter !== 'all' && c.split !== splitFilter) return false;
      if (search) {
        return c.gauge_id.includes(search.trim());
      }
      return true;
    });
  }, [catchments, splitFilter, search]);

  const selectedCatchment = useMemo(() => {
    return catchments.find((c) => c.gauge_id === selectedId) || null;
  }, [catchments, selectedId]);

  const getColor = (c) => {
    if (colorMode === 'split') {
      if (c.split === 'train') return '#3B82F6';
      if (c.split === 'validation') return '#8B5CF6';
      if (c.split === 'test') return '#10B981';
      return '#94A3B8';
    } else {
      return c.threshold_eligible ? '#0284C7' : '#CBD5E1';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', height: '100%' }}>
      {/* Map Control Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          background: 'var(--bg-surface)',
          padding: '12px 16px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 240px' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '240px' }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-3)' }}
            />
            <input
              id="search-gauge-input"
              name="search_gauge"
              type="text"
              placeholder="Search Gauge ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 10px 7px 32px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                background: 'var(--bg-base)',
                fontSize: '12.5px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-1)',
              }}
            />
          </div>

          {/* Split filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {['all', 'train', 'validation', 'test'].map((sp) => (
              <button
                key={sp}
                onClick={() => setSplitFilter(sp)}
                style={{
                  padding: '5px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid',
                  borderColor: splitFilter === sp ? 'var(--blue)' : 'var(--border)',
                  background: splitFilter === sp ? 'var(--blue)' : 'var(--bg-base)',
                  color: splitFilter === sp ? '#FFFFFF' : 'var(--text-2)',
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'capitalize',
                  cursor: 'pointer',
                }}
              >
                {sp}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>
            Showing <strong>{filteredCatchments.length}</strong> / {catchments.length} Basins
          </div>

          {onSwitchTo3D && (
            <button
              onClick={onSwitchTo3D}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                background: 'var(--bg-elevated)',
                color: 'var(--blue)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Layers size={14} />
              Switch to 3D Globe
            </button>
          )}
        </div>
      </div>

      {/* Main Map Canvas Area */}
      <div
        style={{
          position: 'relative',
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '10px',
        }}
      >
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          style={{ width: '100%', maxWidth: '680px', height: 'auto', display: 'block' }}
          onMouseLeave={() => setHovered(null)}
        >
          {/* Brazil Approximate Coastal & Border Contour for Context */}
          <path
            d="M 280 60 L 370 80 L 460 140 L 580 180 L 640 220 L 630 270 L 590 340 L 560 410 L 490 510 L 440 590 L 380 620 L 330 560 L 320 480 L 250 440 L 190 390 L 120 360 L 60 280 L 120 180 L 210 120 Z"
            fill="var(--bg-elevated)"
            stroke="var(--border)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.8"
          />

          {/* Graticule gridlines */}
          {[-70, -60, -50, -40].map((lon) => {
            const { x } = project(0, lon);
            return (
              <g key={`lon-${lon}`}>
                <line x1={x} y1={20} x2={x} y2={HEIGHT - 20} stroke="var(--border)" strokeWidth="0.8" opacity="0.6" />
                <text x={x} y={HEIGHT - 6} textAnchor="middle" fontSize="9" fill="var(--text-3)" fontFamily="var(--font-mono)">
                  {lon}°W
                </text>
              </g>
            );
          })}

          {[-30, -20, -10, 0].map((lat) => {
            const { y } = project(lat, 0);
            return (
              <g key={`lat-${lat}`}>
                <line x1={20} y1={y} x2={WIDTH - 20} y2={y} stroke="var(--border)" strokeWidth="0.8" opacity="0.6" />
                <text x={24} y={y - 3} textAnchor="start" fontSize="9" fill="var(--text-3)" fontFamily="var(--font-mono)">
                  {lat}°
                </text>
              </g>
            );
          })}

          {/* Catchment Points */}
          {filteredCatchments.map((c) => {
            const { x, y } = project(c.lat, c.lon);
            const isSelected = c.gauge_id === selectedId;
            const color = getColor(c);

            return (
              <g
                key={c.gauge_id}
                onClick={() => onSelectCatchment(c.gauge_id)}
                onMouseEnter={() => setHovered(c)}
                style={{ cursor: 'pointer' }}
              >
                {isSelected && (
                  <>
                    <circle cx={x} cy={y} r="14" fill="none" stroke="#2563EB" strokeWidth="2" opacity="0.4" />
                    <circle cx={x} cy={y} r="8" fill="none" stroke="#2563EB" strokeWidth="2.5" />
                  </>
                )}
                <circle
                  cx={x}
                  cy={y}
                  r={isSelected ? 5.5 : 3.5}
                  fill={isSelected ? '#1D4ED8' : color}
                  stroke="#FFFFFF"
                  strokeWidth="0.75"
                  opacity={hovered && hovered.gauge_id !== c.gauge_id ? 0.7 : 0.95}
                />
              </g>
            );
          })}

          {/* Selected Catchment Pin Callout */}
          {selectedCatchment && (
            (() => {
              const { x, y } = project(selectedCatchment.lat, selectedCatchment.lon);
              return (
                <g>
                  <line x1={x} y1={y} x2={x + 30} y2={y - 25} stroke="#172B4D" strokeWidth="1.5" />
                  <rect
                    x={x + 30}
                    y={y - 40}
                    width="120"
                    height="24"
                    rx="4"
                    fill="#172B4D"
                    opacity="0.92"
                  />
                  <text
                    x={x + 90}
                    y={y - 24}
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize="11"
                    fontWeight="700"
                    fontFamily="var(--font-mono)"
                  >
                    {selectedCatchment.gauge_id}
                  </text>
                </g>
              );
            })()
          )}
        </svg>

        {/* Floating Tooltip */}
        {hovered && (
          <div
            style={{
              position: 'absolute',
              right: '20px',
              top: '20px',
              background: 'rgba(23, 43, 77, 0.95)',
              color: '#FFFFFF',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              fontSize: '12px',
              pointerEvents: 'none',
              boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
              maxWidth: '220px',
              backdropFilter: 'blur(4px)',
              zIndex: 20,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '13px', marginBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '3px' }}>
              Gauge {hovered.gauge_id}
            </div>
            <div>Coordinates: {hovered.lat.toFixed(3)}°, {hovered.lon.toFixed(3)}°</div>
            <div>
              Split:{' '}
              <span
                style={{
                  fontWeight: 700,
                  color: hovered.split === 'test' ? '#34D399' : hovered.split === 'validation' ? '#C084FC' : '#60A5FA',
                }}
              >
                {hovered.split.toUpperCase()}
              </span>
            </div>
            {hovered.area && <div>Drainage Area: {hovered.area.toLocaleString()} km²</div>}
            {hovered.elev_mean && <div>Elevation: {hovered.elev_mean.toFixed(0)} m</div>}
            <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.1)', color: '#FCD34D' }}>
              {hovered.threshold_eligible
                ? `P95: ${hovered.P95_mm_day?.toFixed(2)} mm/d | P99: ${hovered.P99_mm_day?.toFixed(2)} mm/d`
                : 'Threshold: Not Eligible'}
            </div>
            <div style={{ marginTop: '4px', fontSize: '10px', color: '#94A3B8' }}>Click to inspect catchment</div>
          </div>
        )}

        {/* Legend */}
        <div
          style={{
            position: 'absolute',
            left: '20px',
            bottom: '20px',
            background: 'rgba(255, 255, 255, 0.92)',
            border: '1px solid var(--border)',
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            fontSize: '11px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ fontWeight: 700, color: 'var(--text-1)', marginBottom: '2px' }}>Spatial Split</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#3B82F6' }} />
            <span>Train (552 Basins)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#8B5CF6' }} />
            <span>Validation (118 Basins)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#10B981' }} />
            <span>Test (118 Basins)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

