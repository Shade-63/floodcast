import React, { useState, useMemo } from 'react';
import {
  Waves, CloudRain, AlertTriangle, ShieldCheck, Activity, BarChart3,
  MapPin, Droplets, Mountain, Trees, Calculator, Download, Plus, Trash2,
  FileSpreadsheet, ArrowRight, CheckCircle2
} from 'lucide-react';

const STATIONS = [
  {
    id: "01646500",
    name: "Potomac River near Washington DC",
    state: "DC",
    river: "Potomac River",
    drainageArea: 11560,
    elevation: 1180,
    slope: 5.4,
    forestCover: 58.0,
    baseFlow: 3000,
    peakFlow: 36493,
    threshold90: 9933,
    lat: 38.9497,
    lon: -77.1275,
  },
  {
    id: "07010000",
    name: "Mississippi River at St. Louis MO",
    state: "MO",
    river: "Mississippi River",
    drainageArea: 697000,
    elevation: 820,
    slope: 2.1,
    forestCover: 22.0,
    baseFlow: 120000,
    peakFlow: 358011,
    threshold90: 166414,
    lat: 38.6253,
    lon: -90.1794,
  },
  {
    id: "08158000",
    name: "Colorado River at Austin TX",
    state: "TX",
    river: "Colorado River",
    drainageArea: 38200,
    elevation: 1450,
    slope: 3.8,
    forestCover: 28.5,
    baseFlow: 1500,
    peakFlow: 27249,
    threshold90: 5888,
    lat: 30.2458,
    lon: -97.6994,
  },
  {
    id: "02087500",
    name: "Neuse River near Clayton NC",
    state: "NC",
    river: "Neuse River",
    drainageArea: 1140,
    elevation: 290,
    slope: 2.4,
    forestCover: 48.0,
    baseFlow: 800,
    peakFlow: 9620,
    threshold90: 2610,
    lat: 35.6511,
    lon: -78.4717,
  },
  {
    id: "11447650",
    name: "Sacramento River at Freeport CA",
    state: "CA",
    river: "Sacramento River",
    drainageArea: 23500,
    elevation: 2200,
    slope: 8.2,
    forestCover: 42.0,
    baseFlow: 14000,
    peakFlow: 74320,
    threshold90: 29388,
    lat: 38.4558,
    lon: -121.5011,
  },
];

export default function App() {
  const [selectedId, setSelectedId] = useState("01646500");
  const [rainSurge, setRainSurge] = useState(0);
  const [activeTab, setActiveTab] = useState("calculator");

  // Input section states for custom discharge prediction
  const [calcStationId, setCalcStationId] = useState("01646500");
  const [calcDate, setCalcDate] = useState("2023-08-15");
  const [calcPrecip, setCalcPrecip] = useState(45.0);
  const [calcTempMax, setCalcTempMax] = useState(26.5);
  const [calcTempMin, setCalcTempMin] = useState(18.0);
  const [calcSoil, setCalcSoil] = useState(0.42);
  const [calcArea, setCalcArea] = useState(11560.0);
  const [calcElev, setCalcElev] = useState(1180.0);
  const [calcSlope, setCalcSlope] = useState(5.4);
  const [calcForest, setCalcForest] = useState(58.0);

  // Queue of generated predictions for CSV export
  const [predictionQueue, setPredictionQueue] = useState([
    { station_id: "01646500", date: "2023-08-15", discharge_cfs: 11420.50, rain: 45.0, status: "Flood Alert" },
    { station_id: "01646500", date: "2023-08-16", discharge_cfs: 8650.25, rain: 20.0, status: "Elevated" },
    { station_id: "07010000", date: "2023-08-15", discharge_cfs: 172300.00, rain: 35.0, status: "Flood Alert" },
    { station_id: "02087500", date: "2023-08-15", discharge_cfs: 2840.10, rain: 52.0, status: "Flood Alert" },
  ]);

  const station = useMemo(() => {
    return STATIONS.find(s => s.id === selectedId) || STATIONS[0];
  }, [selectedId]);

  // When changing preset in the calculator, auto-populate catchment attributes
  const handlePresetChange = (stId) => {
    setCalcStationId(stId);
    const target = STATIONS.find(s => s.id === stId);
    if (target) {
      setCalcArea(target.drainageArea);
      setCalcElev(target.elevation);
      setCalcSlope(target.slope);
      setCalcForest(target.forestCover);
    }
  };

  // Hydrological discharge regression calculator function
  const computeDischarge = (precip, soil, area, slope, forest, elev, tmax, tmin) => {
    // Non-negative discharge logic based on physical catchment scaling
    const baseFlow = Math.max(50.0, area * 0.22);
    const saturationFactor = Math.min(2.5, Math.max(0.2, soil / 0.3));
    const slopeMultiplier = Math.max(0.5, slope / 3.5);
    const vegetationBuffering = Math.max(0.65, 1.0 - (forest / 250.0));
    const runoffIntensity = precip * saturationFactor * slopeMultiplier * vegetationBuffering;
    const discharge = baseFlow + (runoffIntensity * (area / 100.0) * 0.16);
    return Math.max(5.0, Math.round(discharge * 100) / 100);
  };

  const calculatedDischarge = useMemo(() => {
    return computeDischarge(
      calcPrecip, calcSoil, calcArea, calcSlope, calcForest, calcElev, calcTempMax, calcTempMin
    );
  }, [calcPrecip, calcSoil, calcArea, calcSlope, calcForest, calcElev, calcTempMax, calcTempMin]);

  // Alert check against station threshold
  const calcStationMeta = STATIONS.find(s => s.id === calcStationId);
  const isFloodSurge = calcStationMeta ? calculatedDischarge >= calcStationMeta.threshold90 : calculatedDischarge > 10000;

  // Add current calculated row to prediction list
  const handleAddPrediction = () => {
    const newEntry = {
      station_id: String(calcStationId).padStart(8, '0'),
      date: calcDate,
      discharge_cfs: calculatedDischarge,
      rain: calcPrecip,
      status: isFloodSurge ? "Flood Alert" : "Normal",
    };
    setPredictionQueue(prev => [newEntry, ...prev]);
  };

  // Generate 7-day scenario
  const handleGenerateScenario = () => {
    const newRows = [];
    const baseDate = new Date(calcDate);
    const rainPattern = [10, 35, 68, 85, 40, 15, 5];

    for (let i = 0; i < 7; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const r = rainPattern[i];
      const s = Math.min(0.92, calcSoil + (r * 0.004));
      const q = computeDischarge(r, s, calcArea, calcSlope, calcForest, calcElev, calcTempMax, calcTempMin);
      const isPeak = calcStationMeta ? q >= calcStationMeta.threshold90 : q > 10000;
      newRows.push({
        station_id: String(calcStationId).padStart(8, '0'),
        date: dateStr,
        discharge_cfs: q,
        rain: r,
        status: isPeak ? "Flood Alert" : "Normal",
      });
    }
    setPredictionQueue(prev => [...newRows, ...prev]);
  };

  // Export strictly compliant CSV: station_id,date,discharge_cfs
  const handleExportCSV = () => {
    const headers = "station_id,date,discharge_cfs\n";
    const rows = predictionQueue.map(p => `${p.station_id},${p.date},${p.discharge_cfs.toFixed(2)}`).join('\n');
    const csvContent = headers + rows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `predictions_custom_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Remove single row
  const handleRemoveRow = (idx) => {
    setPredictionQueue(prev => prev.filter((_, i) => i !== idx));
  };

  // Synthetic 30-day forecast series with slider impact
  const forecastData = useMemo(() => {
    const data = [];
    const base = station.baseFlow;
    for (let day = 1; day <= 30; day++) {
      const rainEvent = (day >= 8 && day <= 11) ? 25 : (day === 20 ? 40 : 2);
      const effectiveRain = rainEvent + rainSurge;
      const surgeMultiplier = effectiveRain * (station.drainageArea / 10000) * (station.slope / 4.0);
      const discharge = Math.round(base + surgeMultiplier * 12 + Math.sin(day / 3) * (base * 0.1));
      const isPeak = discharge >= station.threshold90;
      data.push({
        day: `2023-01-${day < 10 ? '0' + day : day}`,
        discharge,
        rain: effectiveRain,
        isPeak,
      });
    }
    return data;
  }, [station, rainSurge]);

  const maxDischarge = useMemo(() => {
    return Math.max(...forecastData.map(d => d.discharge), station.threshold90 * 1.1);
  }, [forecastData, station]);

  const currentAlert = forecastData.some(d => d.isPeak);

  return (
    <div className="container">
      {/* Header */}
      <header className="header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ background: 'linear-gradient(135deg, #0284c7, #2563eb)', padding: '10px', borderRadius: '10px' }}>
            <Waves size={28} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em' }}>
              FLOODCAST <span style={{ color: 'var(--accent-cyan)', fontSize: '16px', fontWeight: 600 }}>v2.0 React Dashboard</span>
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              Interactive Basin Discharge Calculator, Scenario Simulation & CSV Generator
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className={currentAlert ? "badge badge-red" : "badge badge-green"}>
            {currentAlert ? <AlertTriangle size={14} /> : <ShieldCheck size={14} />}
            {currentAlert ? "Flood Surge Alert" : "System Normal"}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-dim)', borderLeft: '1px solid var(--border-color)', paddingLeft: '12px' }}>
            Strict Submission Contract
          </span>
        </div>
      </header>

      {/* Navigation tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          className={`tab-btn ${activeTab === 'calculator' ? 'active' : ''}`}
          onClick={() => setActiveTab('calculator')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Calculator size={16} /> Interactive Calculator & CSV Export
        </button>
        <button
          className={`tab-btn ${activeTab === 'forecast' ? 'active' : ''}`}
          onClick={() => setActiveTab('forecast')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <BarChart3 size={16} /> Hydrograph Visualization
        </button>
        <button
          className={`tab-btn ${activeTab === 'stations' ? 'active' : ''}`}
          onClick={() => setActiveTab('stations')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <MapPin size={16} /> Catchment Attributes
        </button>
        <button
          className={`tab-btn ${activeTab === 'benchmark' ? 'active' : ''}`}
          onClick={() => setActiveTab('benchmark')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Activity size={16} /> Ablation Benchmarks
        </button>
      </div>

      {/* TAB 1: INTERACTIVE CALCULATOR & CSV EXPORT */}
      {activeTab === 'calculator' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px', marginBottom: '24px' }}>
            {/* Input Form Card */}
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CloudRain size={18} color="var(--accent-cyan)" />
                  Catchment & Weather Parameter Inputs
                </h2>
                <span className="badge badge-blue">Real-Time Model</span>
              </div>

              {/* Station selector preset */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                  SELECT STATION PRESET
                </label>
                <select
                  value={calcStationId}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  style={{
                    width: '100%',
                    marginTop: '6px',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border-color)',
                    padding: '10px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                >
                  {STATIONS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.id} — {s.name} ({s.state})
                    </option>
                  ))}
                </select>
              </div>

              {/* Input grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Station ID (String, with leading zeros)</label>
                  <input
                    type="text"
                    value={calcStationId}
                    onChange={(e) => setCalcStationId(e.target.value)}
                    style={{
                      width: '100%',
                      marginTop: '4px',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-main)',
                      border: '1px solid var(--border-color)',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontFamily: 'var(--font-mono)',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Date (YYYY-MM-DD)</label>
                  <input
                    type="date"
                    value={calcDate}
                    onChange={(e) => setCalcDate(e.target.value)}
                    style={{
                      width: '100%',
                      marginTop: '4px',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-main)',
                      border: '1px solid var(--border-color)',
                      padding: '8px 12px',
                      borderRadius: '6px',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Precipitation (mm)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={calcPrecip}
                    onChange={(e) => setCalcPrecip(parseFloat(e.target.value) || 0)}
                    style={{
                      width: '100%',
                      marginTop: '4px',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-main)',
                      border: '1px solid var(--border-color)',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontFamily: 'var(--font-mono)',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Soil Moisture Fraction (0.05 - 0.95)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.05"
                    max="0.95"
                    value={calcSoil}
                    onChange={(e) => setCalcSoil(parseFloat(e.target.value) || 0)}
                    style={{
                      width: '100%',
                      marginTop: '4px',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-main)',
                      border: '1px solid var(--border-color)',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontFamily: 'var(--font-mono)',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Temp Max (°C)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={calcTempMax}
                    onChange={(e) => setCalcTempMax(parseFloat(e.target.value) || 0)}
                    style={{
                      width: '100%',
                      marginTop: '4px',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-main)',
                      border: '1px solid var(--border-color)',
                      padding: '8px 12px',
                      borderRadius: '6px',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Temp Min (°C)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={calcTempMin}
                    onChange={(e) => setCalcTempMin(parseFloat(e.target.value) || 0)}
                    style={{
                      width: '100%',
                      marginTop: '4px',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-main)',
                      border: '1px solid var(--border-color)',
                      padding: '8px 12px',
                      borderRadius: '6px',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Drainage Area (sq mi)</label>
                  <input
                    type="number"
                    value={calcArea}
                    onChange={(e) => setCalcArea(parseFloat(e.target.value) || 1)}
                    style={{
                      width: '100%',
                      marginTop: '4px',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-main)',
                      border: '1px solid var(--border-color)',
                      padding: '8px 12px',
                      borderRadius: '6px',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Slope (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={calcSlope}
                    onChange={(e) => setCalcSlope(parseFloat(e.target.value) || 0.1)}
                    style={{
                      width: '100%',
                      marginTop: '4px',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-main)',
                      border: '1px solid var(--border-color)',
                      padding: '8px 12px',
                      borderRadius: '6px',
                    }}
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button
                  onClick={handleAddPrediction}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    background: 'var(--accent-blue)',
                    color: '#fff',
                    border: 'none',
                    padding: '12px 18px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={16} /> Add to Prediction Batch
                </button>
                <button
                  onClick={handleGenerateScenario}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'var(--bg-secondary)',
                    color: 'var(--accent-cyan)',
                    border: '1px solid var(--border-color)',
                    padding: '12px 18px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Activity size={16} /> +7-Day Rain Wave
                </button>
              </div>
            </div>

            {/* Real-time Calculation Result Card */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                className="glass-card"
                style={{
                  borderLeft: `5px solid ${isFloodSurge ? 'var(--accent-red)' : 'var(--accent-cyan)'}`,
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Estimated River Discharge</span>
                  <div className={isFloodSurge ? "badge badge-red" : "badge badge-green"}>
                    {isFloodSurge ? "Top-10% Flood Peak" : "Normal Runoff"}
                  </div>
                </div>

                <div style={{ margin: '18px 0' }}>
                  <span style={{ fontSize: '42px', fontWeight: 800, color: isFloodSurge ? 'var(--accent-red)' : 'var(--text-main)', letterSpacing: '-0.03em' }}>
                    {calculatedDischarge.toLocaleString()}
                  </span>
                  <span style={{ fontSize: '18px', color: 'var(--text-muted)', marginLeft: '8px' }}>cfs</span>
                </div>

                <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span>Target Station:</span>
                    <strong style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{calcStationId}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span>Prediction Date:</span>
                    <strong style={{ color: 'var(--text-main)' }}>{calcDate}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Runoff Response:</span>
                    <strong style={{ color: 'var(--accent-cyan)' }}>{(calculatedDischarge / Math.max(1, calcArea)).toFixed(2)} cfs / sq mi</strong>
                  </div>
                </div>
              </div>

              {/* CSV Download Trigger Box */}
              <div className="glass-card" style={{ background: 'rgba(6, 182, 212, 0.05)', border: '1px solid rgba(6, 182, 212, 0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileSpreadsheet size={18} color="var(--accent-cyan)" />
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>Submission CSV Ready</span>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                    {predictionQueue.length} records
                  </span>
                </div>
                <button
                  onClick={handleExportCSV}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    background: 'var(--accent-cyan)',
                    color: '#0a0f1d',
                    border: 'none',
                    padding: '12px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Download size={16} /> Download predictions.csv
                </button>
                <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '8px', textAlign: 'center' }}>
                  Exact Contract: station_id, date, discharge_cfs (UTF-8, non-negative)
                </p>
              </div>
            </div>
          </div>

          {/* Predictions Batch Table */}
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart3 size={16} color="var(--accent-blue)" />
                Current Batch for predictions.csv ({predictionQueue.length} Rows)
              </h3>
              {predictionQueue.length > 0 && (
                <button
                  onClick={() => setPredictionQueue([])}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-red)',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Trash2 size={12} /> Clear Queue
                </button>
              )}
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', textAlign: 'left' }}>
                    <th style={{ padding: '8px 10px' }}>station_id</th>
                    <th style={{ padding: '8px 10px' }}>date</th>
                    <th style={{ padding: '8px 10px' }}>discharge_cfs</th>
                    <th style={{ padding: '8px 10px' }}>Rain (mm)</th>
                    <th style={{ padding: '8px 10px' }}>Alert Level</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {predictionQueue.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', fontFamily: 'var(--font-mono)' }}>
                      <td style={{ padding: '10px', fontWeight: 600, color: 'var(--accent-cyan)' }}>{item.station_id}</td>
                      <td style={{ padding: '10px' }}>{item.date}</td>
                      <td style={{ padding: '10px', fontWeight: 700, color: item.status === 'Flood Alert' ? 'var(--accent-red)' : 'var(--text-main)' }}>
                        {item.discharge_cfs.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '10px', color: 'var(--text-muted)' }}>{item.rain} mm</td>
                      <td style={{ padding: '10px' }}>
                        <span className={item.status === 'Flood Alert' ? 'badge badge-red' : 'badge badge-green'}>
                          {item.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleRemoveRow(idx)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {predictionQueue.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No records in batch. Use "Add to Prediction Batch" above to populate rows.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: HYDROGRAPH */}
      {activeTab === 'forecast' && (
        <>
          <div className="grid-cols-4">
            <div className="glass-card" style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Monitored Station
              </label>
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border-color)',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    outline: 'none',
                  }}
                >
                  {STATIONS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.id} - {s.name} ({s.state})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '16px', marginTop: '14px', fontSize: '13px', color: 'var(--text-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MapPin size={14} color="var(--accent-blue)" /> {station.river}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Mountain size={14} color="var(--accent-cyan)" /> {station.drainageArea.toLocaleString()} sq mi
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Trees size={14} color="var(--accent-green)" /> {station.forestCover}% Forest
                </span>
              </div>
            </div>

            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Top-10% Peak Threshold</span>
                <Droplets size={16} color="var(--accent-yellow)" />
              </div>
              <p style={{ fontSize: '24px', fontWeight: 700, marginTop: '8px', color: 'var(--accent-yellow)' }}>
                {station.threshold90.toLocaleString()} <span style={{ fontSize: '14px', fontWeight: 400 }}>cfs</span>
              </p>
              <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                Official Top-10% Extreme Evaluation (30% weight)
              </span>
            </div>

            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Catchment Response Slope</span>
                <Activity size={16} color="var(--accent-cyan)" />
              </div>
              <p style={{ fontSize: '24px', fontWeight: 700, marginTop: '8px', color: 'var(--accent-cyan)' }}>
                {station.slope}%
              </p>
              <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                Mean basin elev: {station.elevation.toLocaleString()} ft
              </span>
            </div>
          </div>

          {/* Interactive What-If Slider */}
          <div className="glass-card" style={{ marginBottom: '24px', borderLeft: '4px solid var(--accent-cyan)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CloudRain size={18} color="var(--accent-cyan)" />
                <span style={{ fontWeight: 600, fontSize: '14px' }}>
                  What-If Rainfall Shock Simulator: +{rainSurge} mm
                </span>
              </div>
              <button
                onClick={() => setRainSurge(0)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-cyan)',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                Reset to 0 mm
              </button>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={rainSurge}
              onChange={(e) => setRainSurge(Number(e.target.value))}
              style={{
                width: '100%',
                accentColor: 'var(--accent-cyan)',
                cursor: 'pointer',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
              <span>Baseline Forecast (+0 mm)</span>
              <span>Moderate Storm (+25 mm)</span>
              <span>Severe Cloudburst (+50 mm)</span>
              <span>Extreme Deluge (+100 mm)</span>
            </div>
          </div>

          {/* SVG Hydrograph */}
          <div className="glass-card" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart3 size={18} color="var(--accent-blue)" />
                Predicted Daily Discharge (cfs) vs 90th-Percentile Flood Threshold
              </h2>
              <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '12px', height: '3px', background: 'var(--accent-cyan)' }} /> Predicted Discharge
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '12px', height: '2px', background: 'var(--accent-yellow)', borderTop: '2px dashed var(--accent-yellow)' }} /> Flood Threshold (90th Pct)
                </span>
              </div>
            </div>

            <div style={{ width: '100%', height: '320px', position: 'relative' }}>
              <svg width="100%" height="100%" viewBox="0 0 1000 300" preserveAspectRatio="none">
                {[0.25, 0.5, 0.75].map((ratio, idx) => (
                  <line
                    key={idx}
                    x1="40"
                    y1={300 - ratio * 260}
                    x2="980"
                    y2={300 - ratio * 260}
                    stroke="#243256"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                ))}

                {(() => {
                  const yThresh = 280 - (station.threshold90 / maxDischarge) * 250;
                  return (
                    <line
                      x1="40"
                      y1={yThresh}
                      x2="980"
                      y2={yThresh}
                      stroke="var(--accent-yellow)"
                      strokeDasharray="6 6"
                      strokeWidth="2"
                    />
                  );
                })()}

                {(() => {
                  const points = forecastData.map((d, i) => {
                    const x = 40 + (i / (forecastData.length - 1)) * 940;
                    const y = 280 - (d.discharge / maxDischarge) * 250;
                    return `${x},${y}`;
                  }).join(' ');

                  const areaPoints = `40,280 ${points} 980,280`;

                  return (
                    <>
                      <defs>
                        <linearGradient id="hydroGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <polygon points={areaPoints} fill="url(#hydroGrad)" />
                      <polyline
                        points={points}
                        fill="none"
                        stroke="var(--accent-cyan)"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    </>
                  );
                })()}

                {forecastData.map((d, i) => {
                  const x = 40 + (i / (forecastData.length - 1)) * 940;
                  const y = 280 - (d.discharge / maxDischarge) * 250;
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r={d.isPeak ? 5 : 3}
                      fill={d.isPeak ? "var(--accent-red)" : "var(--accent-cyan)"}
                      stroke="#0a0f1d"
                      strokeWidth="1.5"
                    />
                  );
                })}
              </svg>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 40px', fontSize: '11px', color: 'var(--text-dim)' }}>
              <span>2023-01-01</span>
              <span>2023-01-10</span>
              <span>2023-01-20</span>
              <span>2023-01-30</span>
            </div>
          </div>
        </>
      )}

      {/* TAB 3: STATIONS */}
      {activeTab === 'stations' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
          {STATIONS.map((s) => (
            <div
              key={s.id}
              className="glass-card"
              style={{
                cursor: 'pointer',
                border: s.id === selectedId ? '2px solid var(--accent-cyan)' : '1px solid var(--border-color)',
              }}
              onClick={() => setSelectedId(s.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="badge badge-blue">ID: {s.id}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s.state}</span>
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '10px 0 6px 0' }}>{s.name}</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px' }}>{s.river}</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', background: 'var(--bg-secondary)', padding: '10px', borderRadius: '8px' }}>
                <div>Drainage Area: <strong>{s.drainageArea.toLocaleString()} sq mi</strong></div>
                <div>Elevation: <strong>{s.elevation} ft</strong></div>
                <div>Slope: <strong>{s.slope}%</strong></div>
                <div>Forest Cover: <strong>{s.forestCover}%</strong></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 4: BENCHMARK */}
      {activeTab === 'benchmark' && (
        <div className="glass-card">
          <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '14px' }}>
            Official Competition Scoring Breakdown
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '10px' }}>Evaluation Metric</th>
                <th style={{ padding: '10px' }}>Weight</th>
                <th style={{ padding: '10px' }}>Direction</th>
                <th style={{ padding: '10px' }}>What It Measures</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '12px 10px', fontWeight: 600 }}>Overall RMSE</td>
                <td style={{ padding: '12px 10px', color: 'var(--accent-cyan)' }}>40%</td>
                <td style={{ padding: '12px 10px' }}>Lower is better</td>
                <td style={{ padding: '12px 10px', color: 'var(--text-muted)' }}>Overall prediction accuracy across all test dates</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '12px 10px', fontWeight: 600 }}>RMSE on Top-10% Extreme Events</td>
                <td style={{ padding: '12px 10px', color: 'var(--accent-yellow)' }}>30%</td>
                <td style={{ padding: '12px 10px' }}>Lower is better</td>
                <td style={{ padding: '12px 10px', color: 'var(--text-muted)' }}>High-discharge flood surge accuracy per station</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '12px 10px', fontWeight: 600 }}>MAE (Mean Absolute Error)</td>
                <td style={{ padding: '12px 10px', color: 'var(--accent-blue)' }}>20%</td>
                <td style={{ padding: '12px 10px' }}>Lower is better</td>
                <td style={{ padding: '12px 10px', color: 'var(--text-muted)' }}>General baseline reliability across typical flow days</td>
              </tr>
              <tr>
                <td style={{ padding: '12px 10px', fontWeight: 600 }}>R-Squared (R²)</td>
                <td style={{ padding: '12px 10px', color: 'var(--accent-green)' }}>10%</td>
                <td style={{ padding: '12px 10px' }}>Higher is better</td>
                <td style={{ padding: '12px 10px', color: 'var(--text-muted)' }}>Proportion of flow variance explained</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <footer style={{ marginTop: '32px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '12px' }}>
        FLOODCAST Hackathon Project • Built with React JS + LightGBM / XGBoost / CatBoost Ensemble
      </footer>
    </div>
  );
}
