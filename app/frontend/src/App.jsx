import React, { useState, useMemo, useEffect } from 'react';
import {
  Waves, CloudRain, AlertTriangle, ShieldCheck, Activity, BarChart3,
  MapPin, Droplets, Mountain, Trees, Calculator, Download, Plus, Trash2,
  FileSpreadsheet, Zap, Globe, Compass,
} from 'lucide-react';
import GlobeView from './GlobeView';

/* ─── Station data ───────────────────────────────────────────────── */
const STATIONS = [
  {
    id: '01646500', name: 'Potomac River near Washington DC', state: 'DC',
    river: 'Potomac River', drainageArea: 11560, elevation: 1180, slope: 5.4,
    forestCover: 58.0, baseFlow: 3000, peakFlow: 36493, threshold90: 9933,
    lat: 38.9497, lon: -77.1275,
  },
  {
    id: '07010000', name: 'Mississippi River at St. Louis MO', state: 'MO',
    river: 'Mississippi River', drainageArea: 697000, elevation: 820, slope: 2.1,
    forestCover: 22.0, baseFlow: 120000, peakFlow: 358011, threshold90: 166414,
    lat: 38.6253, lon: -90.1794,
  },
  {
    id: '08158000', name: 'Colorado River at Austin TX', state: 'TX',
    river: 'Colorado River', drainageArea: 38200, elevation: 1450, slope: 3.8,
    forestCover: 28.5, baseFlow: 1500, peakFlow: 27249, threshold90: 5888,
    lat: 30.2458, lon: -97.6994,
  },
  {
    id: '02087500', name: 'Neuse River near Clayton NC', state: 'NC',
    river: 'Neuse River', drainageArea: 1140, elevation: 290, slope: 2.4,
    forestCover: 48.0, baseFlow: 800, peakFlow: 9620, threshold90: 2610,
    lat: 35.6511, lon: -78.4717,
  },
  {
    id: '11447650', name: 'Sacramento River at Freeport CA', state: 'CA',
    river: 'Sacramento River', drainageArea: 23500, elevation: 2200, slope: 8.2,
    forestCover: 42.0, baseFlow: 14000, peakFlow: 74320, threshold90: 29388,
    lat: 38.4558, lon: -121.5011,
  },
];

/* ─── Hydrological Physical Model ────────────────────────────────── */
function computeDischarge(precip, soil, area, slope, forest, tmax = 26.5, snowpackPrev = 0, kMelt = 2.5) {
  // 1. Daily Precipitation Partitioning
  const pSnow = tmax <= 0.0 ? precip : 0.0;
  const pRain = tmax > 0.0 ? precip : 0.0;

  // 2. Snowpack Accumulation & Melt Tracking
  const melt = Math.min(snowpackPrev, kMelt * Math.max(0.0, tmax));
  const effectiveWater = pRain + melt;

  // 3. Supporting Unique Features
  // A. Soil-Saturation Runoff Potential
  const runoffPotential = effectiveWater * soil;

  // B. Catchment-Scaled Dynamic API
  const gamma = 0.85 - (0.3 * (slope / 100.0));

  // C. Drainage-Normalized Runoff Volume
  const runoffVolume = (effectiveWater * area) / 100.0;

  // Baseflow scaling
  const base = Math.max(50, area * 0.22);
  const vegBuffering = Math.max(0.65, 1 - forest / 250);
  const discharge = base + (runoffVolume * soil * vegBuffering * (1 + gamma * 0.5) * 0.16);

  return Math.max(5, Math.round(discharge * 100) / 100);
}

function fmt(n) { return n.toLocaleString(undefined, { maximumFractionDigits: 0 }); }
function fmt2(n) { return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

/* ─── Sub-components ─────────────────────────────────────────────── */

function Field({ label, children }) {
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}

function StatTile({ label, value, unit, sub, color }) {
  return (
    <div className="stat-tile">
      <div className="stat-tile-label">{label}</div>
      <div className="stat-tile-value" style={color ? { color } : {}}>
        {value} <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-3)' }}>{unit}</span>
      </div>
      {sub && <div className="stat-tile-sub">{sub}</div>}
    </div>
  );
}

/* ─── TAB: Calculator ────────────────────────────────────────────── */
function CalculatorTab({ selectedId, onSelectStation }) {
  const [preset, setPreset] = useState(selectedId || '01646500');
  const [date, setDate] = useState('2023-08-15');
  const [precip, setPrecip] = useState(45);
  const [soil, setSoil] = useState(0.42);
  const [tmax, setTmax] = useState(26.5);
  const [tmin, setTmin] = useState(18);
  const [area, setArea] = useState(11560);
  const [slope, setSlope] = useState(5.4);
  const [forest, setForest] = useState(58);

  useEffect(() => {
    if (selectedId && selectedId !== preset) {
      handlePreset(selectedId);
    }
  }, [selectedId]);
  const [queue, setQueue] = useState([
    { station_id: '01646500', date: '2023-08-15', discharge_cfs: 11420.50, rain: 45, status: 'Flood Alert' },
    { station_id: '01646500', date: '2023-08-16', discharge_cfs: 8650.25, rain: 20, status: 'Elevated' },
    { station_id: '07010000', date: '2023-08-15', discharge_cfs: 172300.0, rain: 35, status: 'Flood Alert' },
    { station_id: '02087500', date: '2023-08-15', discharge_cfs: 2840.10, rain: 52, status: 'Flood Alert' },
  ]);

  const meta = STATIONS.find(s => s.id === preset);

  const q = useMemo(() => computeDischarge(precip, soil, area, slope, forest, tmax), [precip, soil, area, slope, forest, tmax]);
  const isFlood = meta ? q >= meta.threshold90 : q > 10000;

  const handlePreset = (id) => {
    setPreset(id);
    if (onSelectStation) onSelectStation(id);
    const s = STATIONS.find(x => x.id === id);
    if (s) { setArea(s.drainageArea); setSlope(s.slope); setForest(s.forestCover); }
  };

  const addRow = () => {
    setQueue(prev => [{
      station_id: String(preset).padStart(8, '0'),
      date,
      discharge_cfs: q,
      rain: precip,
      status: isFlood ? 'Flood Alert' : 'Normal',
    }, ...prev]);
  };

  const generate7Day = () => {
    const rows = [];
    const rain = [10, 35, 68, 85, 40, 15, 5];
    const base = new Date(date);
    rain.forEach((r, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const s = Math.min(0.92, soil + r * 0.004);
      const dq = computeDischarge(r, s, area, slope, forest, tmax);
      rows.push({
        station_id: String(preset).padStart(8, '0'),
        date: d.toISOString().split('T')[0],
        discharge_cfs: dq,
        rain: r,
        status: (meta ? dq >= meta.threshold90 : dq > 10000) ? 'Flood Alert' : 'Normal',
      });
    });
    setQueue(prev => [...rows, ...prev]);
  };

  const exportCSV = () => {
    const csv = 'station_id,date,discharge_cfs\n'
      + queue.map(p => `${p.station_id},${p.date},${p.discharge_cfs.toFixed(2)}`).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = `predictions_${Date.now()}.csv`;
    a.click();
  };

  return (
    <>
      <div className="page-header">
        <div className="page-title">Discharge Calculator</div>
      </div>

      {/* Top section: inputs + result */}
      <div className="calculator-layout">

        {/* Input card */}
        <div className="card">
          <div className="card-title">
            <span className="icon-wrap"><CloudRain size={15} /></span>
            Parameters
            <span className="badge badge-blue" style={{ marginLeft: 'auto' }}>Live Model</span>
          </div>

          <Field label="Station Preset">
            <select className="field-input" value={preset} onChange={e => handlePreset(e.target.value)}>
              {STATIONS.map(s => (
                <option key={s.id} value={s.id}>{s.id} — {s.name} ({s.state})</option>
              ))}
            </select>
          </Field>

          <div style={{ height: 14 }} />

          <div className="grid-2">
            <Field label="Station ID">
              <input className="field-input mono" type="text" value={preset} onChange={e => setPreset(e.target.value)} />
            </Field>
            <Field label="Date">
              <input className="field-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </Field>
            <Field label="Precipitation (mm)">
              <input className="field-input mono" type="number" step="0.5" min="0" value={precip}
                onChange={e => setPrecip(parseFloat(e.target.value) || 0)} />
            </Field>
            <Field label="Soil Moisture (0–1)">
              <input className="field-input mono" type="number" step="0.01" min="0.05" max="0.95" value={soil}
                onChange={e => setSoil(parseFloat(e.target.value) || 0)} />
            </Field>
            <Field label="Temp Max (°C)">
              <input className="field-input" type="number" step="0.5" value={tmax}
                onChange={e => setTmax(parseFloat(e.target.value) || 0)} />
            </Field>
            <Field label="Temp Min (°C)">
              <input className="field-input" type="number" step="0.5" value={tmin}
                onChange={e => setTmin(parseFloat(e.target.value) || 0)} />
            </Field>
            <Field label="Drainage Area (sq mi)">
              <input className="field-input mono" type="number" value={area}
                onChange={e => setArea(parseFloat(e.target.value) || 1)} />
            </Field>
            <Field label="Slope (%)">
              <input className="field-input mono" type="number" step="0.1" value={slope}
                onChange={e => setSlope(parseFloat(e.target.value) || 0.1)} />
            </Field>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={addRow}>
              <Plus size={15} /> Add to Batch
            </button>
            <button className="btn btn-ghost" onClick={generate7Day}>
              <Activity size={15} /> 7-Day Scenario
            </button>
          </div>
        </div>

        {/* Result + export column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Discharge result */}
          <div className="card" style={{
            flex: 1,
            borderLeft: `3px solid ${isFlood ? 'var(--red)' : 'var(--cyan)'}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <span className="field-label">Estimated Discharge</span>
              <span className={`badge ${isFlood ? 'badge-red' : 'badge-green'}`}>
                {isFlood ? '⚠ Flood Peak' : '✓ Normal'}
              </span>
            </div>

            <div className="discharge-readout" style={{ color: isFlood ? 'var(--red)' : 'var(--cyan)' }}>
              {fmt(q)}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-3)', marginTop: '4px' }}>cfs</div>

            <div style={{
              marginTop: '16px',
              padding: '12px',
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              fontSize: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '7px',
            }}>
              {[
                ['Station', <span className="text-mono">{preset}</span>],
                ['Date', date],
                ['Runoff', `${(q / Math.max(1, area)).toFixed(2)} cfs/sq mi`],
                meta && ['90th Pct Threshold', `${fmt(meta.threshold90)} cfs`],
              ].filter(Boolean).map(([k, v], i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-3)' }}>{k}</span>
                  <strong style={{ color: 'var(--text-1)' }}>{v}</strong>
                </div>
              ))}
            </div>
          </div>

          {/* Export card */}
          <div className="card" style={{ background: '#F0FDFF', borderColor: 'rgba(6,182,212,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', fontWeight: 600 }}>
                <FileSpreadsheet size={15} color="var(--cyan)" />
                Submission CSV
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                {queue.length} rows
              </span>
            </div>
            <button className="btn btn-cyan btn-block" onClick={exportCSV}>
              <Download size={15} /> Download predictions.csv
            </button>
          </div>
        </div>
      </div>

      {/* Batch table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div className="card-title" style={{ marginBottom: 0 }}>
            <span className="icon-wrap"><BarChart3 size={15} /></span>
            Prediction Batch
            <span className="badge badge-cyan" style={{ marginLeft: '6px' }}>{queue.length}</span>
          </div>
          {queue.length > 0 && (
            <button className="btn btn-danger btn-sm" onClick={() => setQueue([])}>
              <Trash2 size={13} /> Clear All
            </button>
          )}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Station ID</th>
                <th>Date</th>
                <th>Discharge (cfs)</th>
                <th>Rain (mm)</th>
                <th>Alert</th>
                <th style={{ textAlign: 'right' }}></th>
              </tr>
            </thead>
            <tbody>
              {queue.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-3)', padding: '32px' }}>
                    No records yet — add predictions above.
                  </td>
                </tr>
              )}
              {queue.map((row, i) => (
                <tr key={i}>
                  <td><span className="text-mono" style={{ color: 'var(--cyan)' }}>{row.station_id}</span></td>
                  <td className="text-mono" style={{ color: 'var(--text-2)' }}>{row.date}</td>
                  <td className="text-mono" style={{ fontWeight: 700, color: row.status === 'Flood Alert' ? 'var(--red)' : 'var(--text-1)' }}>
                    {fmt2(row.discharge_cfs)}
                  </td>
                  <td style={{ color: 'var(--text-2)' }}>{row.rain} mm</td>
                  <td>
                    <span className={`badge ${row.status === 'Flood Alert' ? 'badge-red' : 'badge-green'}`}>
                      {row.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-danger btn-sm"
                      onClick={() => setQueue(prev => prev.filter((_, j) => j !== i))}>
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ─── TAB: Hydrograph ───────────────────────────── */
function HydrographTab({ selectedId, onSelectStation }) {
  const [currentId, setCurrentId] = useState(selectedId || '01646500');
  const [surge, setSurge] = useState(0);

  useEffect(() => {
    if (selectedId && selectedId !== currentId) {
      setCurrentId(selectedId);
    }
  }, [selectedId]);

  const station = STATIONS.find(s => s.id === currentId) || STATIONS[0];

  const data = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => {
      const day = i + 1;
      const rain = (day >= 8 && day <= 11) ? 25 : day === 20 ? 40 : 2;
      const eff = rain + surge;
      const mult = eff * (station.drainageArea / 10000) * (station.slope / 4);
      const q = Math.round(station.baseFlow + mult * 12 + Math.sin(day / 3) * station.baseFlow * 0.1);
      return { day: `Jan ${String(day).padStart(2, '0')}`, q, rain: eff, peak: q >= station.threshold90 };
    });
  }, [station, surge]);

  const maxQ = Math.max(...data.map(d => d.q), station.threshold90 * 1.1);
  const hasAlert = data.some(d => d.peak);

  const W = 1000, H = 260, PL = 50, PR = 20, PT = 20, PB = 10;
  const cW = W - PL - PR;
  const cH = H - PT - PB;
  const toX = i => PL + (i / (data.length - 1)) * cW;
  const toY = v => PT + cH - (v / maxQ) * cH;

  const linePts = data.map((d, i) => `${toX(i)},${toY(d.q)}`).join(' ');
  const areaPts = `${PL},${PT + cH} ${linePts} ${PL + cW},${PT + cH}`;
  const threshY = toY(station.threshold90);

  const peakDays = data.filter(d => d.peak).length;

  return (
    <>
      <div className="page-header">
        <div className="page-title">Hydrograph</div>
      </div>

      {/* Controls row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '16px' }}>
        <div className="card" style={{ gridColumn: 'span 1' }}>
          <div className="field-label" style={{ marginBottom: '8px' }}>Station</div>
          <select
            className="field-input"
            value={currentId}
            onChange={e => {
              setCurrentId(e.target.value);
              if (onSelectStation) onSelectStation(e.target.value);
            }}
          >
            {STATIONS.map(s => (
              <option key={s.id} value={s.id}>{s.id} — {s.name}</option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: '12px', marginTop: '12px', fontSize: '12px', color: 'var(--text-3)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <MapPin size={12} style={{ color: 'var(--blue)' }} /> {station.river}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Trees size={12} style={{ color: 'var(--green)' }} /> {station.forestCover}% Forest
            </span>
          </div>
        </div>

        <StatTile
          label="90th Pct Threshold"
          value={fmt(station.threshold90)}
          unit="cfs"
          color="var(--yellow)"
        />
        <StatTile
          label="Alert Days"
          value={peakDays}
          unit={`/ 30`}
          color={hasAlert ? 'var(--red)' : 'var(--green)'}
        />
      </div>

      {/* Slider */}
      <div className="card" style={{ marginBottom: '16px', borderLeft: '3px solid var(--cyan)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600 }}>
            <CloudRain size={15} style={{ color: 'var(--cyan)' }} />
            What-If Rainfall Shock
            <span className="badge badge-cyan">+{surge} mm</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setSurge(0)}>Reset</button>
        </div>
        <input type="range" min={0} max={100} step={5} value={surge}
          onChange={e => setSurge(Number(e.target.value))}
          style={{ accentColor: 'var(--cyan)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-3)', marginTop: '6px' }}>
          <span>0 mm</span>
          <span>+25 mm</span>
          <span>+50 mm</span>
          <span>+100 mm</span>
        </div>
      </div>

      {/* Chart */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div className="card-title" style={{ marginBottom: 0 }}>
            <span className="icon-wrap"><BarChart3 size={15} /></span>
            Predicted Daily Discharge vs 90th-Percentile Threshold
          </div>
          <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'var(--text-3)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: 20, height: 3, background: 'var(--cyan)', display: 'inline-block', borderRadius: 2 }} />
              Discharge
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: 20, height: 2, borderTop: '2px dashed var(--yellow)', display: 'inline-block' }} />
              Flood Threshold
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: 8, height: 8, background: 'var(--red)', borderRadius: '50%', display: 'inline-block' }} />
              Alert Day
            </span>
          </div>
        </div>

        <div style={{ width: '100%', height: 280 }}>
          <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.24" />
                <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="alertGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            {[0.25, 0.5, 0.75, 1].map(r => (
              <line key={r}
                x1={PL} y1={PT + cH * (1 - r)}
                x2={PL + cW} y2={PT + cH * (1 - r)}
                stroke="#E2EAF4" strokeWidth="1"
              />
            ))}

            {/* Alert fill above threshold */}
            {hasAlert && (
              <polygon
                points={`${PL},${threshY} ${data.map((_, i) => `${toX(i)},${Math.min(toY(data[i].q), threshY)}`).join(' ')} ${PL + cW},${threshY}`}
                fill="url(#alertGrad)"
              />
            )}

            {/* Area fill */}
            <polygon points={areaPts} fill="url(#areaGrad)" />

            {/* Line */}
            <polyline points={linePts} fill="none" stroke="var(--blue)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

            {/* Threshold */}
            <line x1={PL} y1={threshY} x2={PL + cW} y2={threshY}
              stroke="var(--yellow)" strokeDasharray="8 5" strokeWidth="1.5" />

            {/* Dots */}
            {data.map((d, i) => (
              <circle key={i} cx={toX(i)} cy={toY(d.q)}
                r={d.peak ? 5 : 3}
                fill={d.peak ? 'var(--red)' : 'var(--blue)'}
                stroke="var(--bg-base)" strokeWidth="1.5"
              />
            ))}
          </svg>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: PL, paddingRight: PR, fontSize: '11px', color: 'var(--text-3)', marginTop: '6px' }}>
          <span>Jan 01</span><span>Jan 08</span><span>Jan 15</span><span>Jan 22</span><span>Jan 30</span>
        </div>
      </div>
    </>
  );
}

/* ─── TAB: Stations ──────────────── */
function StationsTab({ selectedId, onSelect, onOpenGlobe }) {
  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="page-title">Catchment Attributes</div>
        {onOpenGlobe && (
          <button className="btn btn-cyan btn-sm" onClick={() => onOpenGlobe(selectedId)}>
            <Globe size={13} /> View on 3D Globe
          </button>
        )}
      </div>

      <div className="grid-auto">
        {STATIONS.map(s => (
          <div key={s.id}
            className={`station-card${selectedId === s.id ? ' selected' : ''}`}
            onClick={() => onSelect(s.id)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="badge badge-blue">{s.id}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>{s.state}</span>
            </div>
            <div style={{ marginTop: '12px', fontSize: '15px', fontWeight: 700 }}>{s.name}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '3px', marginBottom: '2px' }}>{s.river}</div>

            <div className="attr-grid">
              <div className="attr-item">Drainage: <strong>{s.drainageArea.toLocaleString()} sq mi</strong></div>
              <div className="attr-item">Elevation: <strong>{s.elevation} ft</strong></div>
              <div className="attr-item">Slope: <strong>{s.slope}%</strong></div>
              <div className="attr-item">Forest: <strong>{s.forestCover}%</strong></div>
              <div className="attr-item">Base Flow: <strong>{fmt(s.baseFlow)} cfs</strong></div>
              <div className="attr-item">Peak Flow: <strong>{fmt(s.peakFlow)} cfs</strong></div>
            </div>

            <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>90th Pct Threshold</span>
              <span className="badge badge-yellow">{fmt(s.threshold90)} cfs</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ─── TAB: Benchmarks ────────────────────────────────────────────── */
function BenchmarkTab() {
  const metrics = [
    { name: 'Overall RMSE', weight: 40, dir: 'Lower ↓', color: 'var(--cyan)', desc: 'Prediction accuracy across all test dates' },
    { name: 'RMSE on Top-10% Events', weight: 30, dir: 'Lower ↓', color: 'var(--yellow)', desc: 'Extreme flood-surge accuracy per station' },
    { name: 'MAE', weight: 20, dir: 'Lower ↓', color: 'var(--blue)', desc: 'Baseline reliability on typical flow days' },
    { name: 'R-Squared (R²)', weight: 10, dir: 'Higher ↑', color: 'var(--green)', desc: 'Proportion of flow variance explained' },
  ];

  return (
    <>
      <div className="page-header">
        <div className="page-title">Benchmarks</div>
      </div>

      <div className="card">
        <div className="card-title">
          <span className="icon-wrap"><Activity size={15} /></span>
          Competition Scoring Breakdown
        </div>

        {metrics.map((m, i) => (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '16px 0',
            borderBottom: i < metrics.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: '15px', fontWeight: 800, color: m.color }}>{m.weight}%</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>{m.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>{m.desc}</div>
              <div style={{ marginTop: '8px', height: 4, background: 'var(--bg-elevated)', borderRadius: 9999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${m.weight * 2.5}%`, background: m.color, borderRadius: 9999, opacity: 0.8 }} />
              </div>
            </div>
            <span className="badge badge-cyan">{m.dir}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        {metrics.map((m, i) => (
          <StatTile key={i} label="Weight" value={`${m.weight}%`} color={m.color} />
        ))}
      </div>
    </>
  );
}


export default function App() {
  const [tab, setTab] = useState('globe');
  const [selectedId, setSelectedId] = useState('01646500');

  const station = STATIONS.find(s => s.id === selectedId) || STATIONS[0];

  // Global alert derived from first station synthetic data
  const hasAlert = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => {
      const day = i + 1;
      const rain = (day >= 8 && day <= 11) ? 25 : day === 20 ? 40 : 2;
      const mult = rain * (station.drainageArea / 10000) * (station.slope / 4);
      return Math.round(station.baseFlow + mult * 12 + Math.sin(day / 3) * station.baseFlow * 0.1) >= station.threshold90;
    }).some(Boolean);
  }, [station]);

  const navItems = [
    { id: 'globe', icon: <Globe size={16} />, label: 'Globe Map' },
    { id: 'calculator', icon: <Calculator size={16} />, label: 'Calculator' },
    { id: 'forecast', icon: <BarChart3 size={16} />, label: 'Hydrograph' },
    { id: 'stations', icon: <MapPin size={16} />, label: 'Stations' },
    { id: 'benchmark', icon: <Activity size={16} />, label: 'Benchmarks' },
  ];

  return (
    <div className="app-shell">
      {/* Top bar */}
      <header className="topbar">
        <div className="topbar-brand">
          <div className="topbar-logo">
            <Waves size={20} color="#fff" />
          </div>
          <div className="topbar-title">
            FLOODCAST
          </div>
        </div>

        <div className="topbar-right">
          <span className={`badge ${hasAlert ? 'badge-red' : 'badge-green'}`}>
            {hasAlert ? <AlertTriangle size={12} /> : <ShieldCheck size={12} />}
            {hasAlert ? 'Flood Surge' : 'All Normal'}
          </span>
        </div>
      </header>

      {/* Sidebar */}
      <nav className="sidebar">
        {navItems.map(item => (
          <button
            key={item.id}
            className={`nav-btn${tab === item.id ? ' active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Main */}
      <main className="main-content">
        {tab === 'globe' && (
          <GlobeView
            stations={STATIONS}
            selectedId={selectedId}
            onSelectStation={setSelectedId}
            onNavigateToTab={(targetTab, stationId) => {
              if (stationId) setSelectedId(stationId);
              setTab(targetTab);
            }}
          />
        )}
        {tab === 'calculator' && (
          <CalculatorTab
            selectedId={selectedId}
            onSelectStation={setSelectedId}
          />
        )}
        {tab === 'forecast' && (
          <HydrographTab
            selectedId={selectedId}
            onSelectStation={setSelectedId}
          />
        )}
        {tab === 'stations' && (
          <StationsTab
            selectedId={selectedId}
            onSelect={setSelectedId}
            onOpenGlobe={(stationId) => {
              if (stationId) setSelectedId(stationId);
              setTab('globe');
            }}
          />
        )}
        {tab === 'benchmark' && <BenchmarkTab />}
      </main>
    </div>
  );
}
