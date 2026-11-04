import React, { useState, useEffect, useMemo } from 'react';
import {
  Waves, CloudRain, AlertTriangle, ShieldCheck, Activity, BarChart3,
  MapPin, Droplets, Mountain, Trees, Compass, Globe, Info, Search,
  RefreshCw, CheckCircle2, XCircle, ArrowUpRight, ArrowRight,
  Database, Cpu, Sliders, ExternalLink, Calendar, Layers, ChevronDown,
  Calculator, Download, Plus, Trash2, FileSpreadsheet, Zap, Play
} from 'lucide-react';

import * as api from './api';
import Hydrograph from './Hydrograph';
import CatchmentMap2D from './CatchmentMap2D';
import GlobeView from './GlobeView';

const STATIC_ATTR_METADATA = {
  elev_gauge: { label: 'Gauge Elevation', unit: 'm', decimals: 0, tooltip: 'Elevation of streamflow gauge above mean sea level' },
  elev_mean: { label: 'Mean Basin Elevation', unit: 'm', decimals: 0, tooltip: 'Catchment mean topographic elevation' },
  slope_mean: { label: 'Mean Basin Slope', unit: 'm/km', decimals: 1, tooltip: 'Average terrain slope across the catchment area' },
  area: { label: 'Drainage Basin Area', unit: 'km²', decimals: 1, tooltip: 'Total upstream contributing catchment area' },

  sand_perc: { label: 'Topsoil Sand Fraction', unit: '%', decimals: 1, tooltip: 'Sand content percentage in topsoil layer' },
  silt_perc: { label: 'Topsoil Silt Fraction', unit: '%', decimals: 1, tooltip: 'Silt content percentage in topsoil layer' },
  clay_perc: { label: 'Topsoil Clay Fraction', unit: '%', decimals: 1, tooltip: 'Clay content percentage in topsoil layer' },
  org_carbon_content: { label: 'Soil Organic Carbon', unit: 'g/kg', decimals: 1, tooltip: 'Soil organic carbon concentration (SoilGrids)' },
  bedrock_depth: { label: 'Depth to Bedrock', unit: 'cm', decimals: 0, tooltip: 'Estimated soil and regolith depth to bedrock (Pelletier et al.)' },
  water_table_depth: { label: 'Water Table Depth', unit: 'cm', decimals: 0, tooltip: 'Estimated depth to unconfined groundwater table (Fan et al.)' },

  geol_class_1st_perc: { label: 'Dominant Lithology', unit: '%', decimals: 1, tooltip: 'Areal percentage of primary surface geological class' },
  geol_class_2nd_perc: { label: 'Secondary Lithology', unit: '%', decimals: 1, tooltip: 'Areal percentage of secondary geological class' },
  carb_rocks_perc: { label: 'Carbonate Rocks', unit: '%', decimals: 1, tooltip: 'Percentage of karst and carbonate rock formations' },
  geol_porosity: { label: 'Subsurface Porosity', unit: 'ratio', decimals: 3, tooltip: 'Volumetric porosity fraction of near-surface geology (GLHYMPS database)' },
  geol_permeability: { label: 'Subsurface Permeability', unit: 'log₁₀(m²)', decimals: 2, tooltip: 'Logarithmic intrinsic permeability log10(k / m²) from GLHYMPS global database. Negative values represent powers of 10 (e.g., -13.25 corresponds to 10⁻¹³·²⁵ m²)' },

  forest_perc: { label: 'Forest Coverage', unit: '%', decimals: 1, tooltip: 'Dense and open tree canopy vegetation coverage' },
  crop_perc: { label: 'Cropland', unit: '%', decimals: 1, tooltip: 'Annual and perennial agricultural cropland' },
  crop_mosaic_perc: { label: 'Cropland Mosaic', unit: '%', decimals: 1, tooltip: 'Mixed cropland and natural vegetation mosaic' },
  shrub_perc: { label: 'Shrubland', unit: '%', decimals: 1, tooltip: 'Woody shrub and scrub vegetation' },
  grass_perc: { label: 'Grassland', unit: '%', decimals: 1, tooltip: 'Natural herbaceous and pasture grasslands' },
  barren_perc: { label: 'Barren Land', unit: '%', decimals: 1, tooltip: 'Bare soil and non-vegetated terrain' },
  imperv_perc: { label: 'Impervious / Urban', unit: '%', decimals: 1, tooltip: 'Urban infrastructure, pavement, and artificial surfaces' },
  wet_perc: { label: 'Wetlands & Water', unit: '%', decimals: 1, tooltip: 'Permanent and seasonal wetlands and open water' },
  snow_perc: { label: 'Snow & Ice', unit: '%', decimals: 2, tooltip: 'Persistent montane snow and ice' },
  dom_land_cover_perc: { label: 'Dominant Cover Share', unit: '%', decimals: 1, tooltip: 'Spatial percentage of the predominant land cover class' },

  consumptive_use: { label: 'Consumptive Water Withdrawal', unit: 'm³/s', decimals: 3, tooltip: 'Estimated human consumptive water extraction rate (ANA)' },
  consumptive_use_perc: { label: 'Consumptive Extraction Ratio', unit: '%', decimals: 2, tooltip: 'Consumptive extraction rate relative to long-term mean flow' },
  reservoirs_vol: { label: 'Reservoir Storage Capacity', unit: 'hm³', decimals: 1, tooltip: 'Total upstream reservoir storage volume in million cubic meters (1 hm³ = 10⁶ m³)' },
  regulation_degree: { label: 'Degree of Flow Regulation', unit: '%', decimals: 1, tooltip: 'Upstream storage volume relative to annual discharge volume (ANA)' },
};

export default function App() {
  const [activeTab, setActiveTab] = useState('calculator'); // Default to Forecast Calculator
  const [mapSubView, setMapSubView] = useState('2d'); // '2d' or '3d'

  // Backend state
  const [health, setHealth] = useState(null);
  const [catchments, setCatchments] = useState([]);
  const [selectedGaugeId, setSelectedGaugeId] = useState('10500000');
  const [catchmentDetail, setCatchmentDetail] = useState(null);
  const [observations, setObservations] = useState([]);
  const [forecast, setForecast] = useState(null);
  const [metrics, setMetrics] = useState(null);

  // Batch queue state for multi-basin / multi-date evaluation
  const [batchQueue, setBatchQueue] = useState([]);
  const [batchSuccessMsg, setBatchSuccessMsg] = useState(null);

  // UI state
  const [originDate, setOriginDate] = useState('');
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // 1. Initial health and catchment list check
  useEffect(() => {
    async function init() {
      try {
        const h = await api.fetchHealth();
        setHealth(h);
      } catch (e) {
        console.warn('Backend offline or health check failed:', e);
        setHealth({ status: 'offline' });
      }

      try {
        const list = await api.fetchCatchments();
        setCatchments(list);
        if (list.length > 0 && !selectedGaugeId) {
          setSelectedGaugeId(list[0].gauge_id);
        }
      } catch (e) {
        console.error('Failed to load catchments:', e);
        setErrorMessage(`Could not load catchment list: ${e.message}`);
      }

      try {
        const m = await api.fetchMetrics();
        setMetrics(m);
      } catch (e) {
        console.warn('Metrics failed to load:', e);
      }
    }
    init();
  }, []);

  // 2. Load catchment details and forecast whenever selectedGaugeId changes
  useEffect(() => {
    if (!selectedGaugeId) return;

    let isMounted = true;
    async function loadCatchmentData() {
      setLoadingDetail(true);
      setLoadingForecast(true);
      setErrorMessage(null);

      try {
        const detail = await api.fetchCatchmentDetail(selectedGaugeId);
        if (isMounted) {
          setCatchmentDetail(detail);
          setOriginDate(detail.end_date || '');
        }

        const obs = await api.fetchObservations(selectedGaugeId, { limit: 90 });
        if (isMounted) {
          setObservations(obs);
        }

        const fc = await api.generateForecast(selectedGaugeId);
        if (isMounted) {
          setForecast(fc);
          if (fc.origin_date) setOriginDate(fc.origin_date);

          // Auto-seed initial batch row with verified real model prediction if queue is empty
          setBatchQueue((prev) => {
            if (prev.length === 0 && fc && fc.predictions_mm && fc.predictions_mm.length >= 3) {
              return [{
                id: `${fc.gauge_id}_${fc.origin_date}`,
                catchment_id: String(fc.gauge_id),
                forecast_origin: fc.origin_date,
                target_date_1d: fc.forecast_dates[0],
                predicted_discharge_1d: Number(fc.predictions_mm[0]),
                target_date_3d: fc.forecast_dates[1],
                predicted_discharge_3d: Number(fc.predictions_mm[1]),
                target_date_7d: fc.forecast_dates[2],
                predicted_discharge_7d: Number(fc.predictions_mm[2]),
                p95_probability_1d: Number(fc.events['+1d'].P95.calibrated_probability),
                p99_probability_1d: Number(fc.events['+1d'].P99.calibrated_probability),
                p95_probability_3d: Number(fc.events['+3d'].P95.calibrated_probability),
                p99_probability_3d: Number(fc.events['+3d'].P99.calibrated_probability),
                p95_probability_7d: Number(fc.events['+7d'].P95.calibrated_probability),
                p99_probability_7d: Number(fc.events['+7d'].P99.calibrated_probability),
                split: detail.split || 'train',
                p95_alert_1d: Boolean(fc.events['+1d'].P95.event_detected),
                p95_alert_3d: Boolean(fc.events['+3d'].P95.event_detected),
                p95_alert_7d: Boolean(fc.events['+7d'].P95.event_detected),
                addedAt: new Date().toLocaleTimeString(),
              }];
            }
            return prev;
          });
        }
      } catch (err) {
        if (isMounted) {
          console.error(`Error loading data for ${selectedGaugeId}:`, err);
          setErrorMessage(err.message || 'Error communicating with backend.');
        }
      } finally {
        if (isMounted) {
          setLoadingDetail(false);
          setLoadingForecast(false);
        }
      }
    }

    loadCatchmentData();
    return () => { isMounted = false; };
  }, [selectedGaugeId]);

  // Handle manual forecast generation from user-specified origin date
  const handleGenerateForecast = async () => {
    if (!selectedGaugeId) return;
    setLoadingForecast(true);
    setErrorMessage(null);
    try {
      const fc = await api.generateForecast(selectedGaugeId, originDate || null);
      setForecast(fc);
    } catch (err) {
      setErrorMessage(`Forecast generation failed: ${err.message}`);
    } finally {
      setLoadingForecast(false);
    }
  };

  const activeCatchmentSummary = useMemo(() => {
    return catchments.find((c) => c.gauge_id === selectedGaugeId) || null;
  }, [catchments, selectedGaugeId]);

  // Split label display
  const splitLabel = useMemo(() => {
    if (!activeCatchmentSummary) return '';
    if (activeCatchmentSummary.split === 'test') return 'Geographic Holdout (Test)';
    if (activeCatchmentSummary.split === 'validation') return 'Validation Group';
    return 'Training Group';
  }, [activeCatchmentSummary]);

  // Batch Prediction Handlers
  const addToBatch = () => {
    if (!forecast || !forecast.predictions_mm || forecast.predictions_mm.length < 3) {
      setErrorMessage("No valid forecast available to add to batch. Please click 'Generate Forecast' first.");
      return;
    }
    const newRow = {
      id: `${forecast.gauge_id}_${forecast.origin_date}_${Date.now()}`,
      catchment_id: String(forecast.gauge_id),
      forecast_origin: forecast.origin_date,
      target_date_1d: forecast.forecast_dates[0],
      predicted_discharge_1d: Number(forecast.predictions_mm[0]),
      target_date_3d: forecast.forecast_dates[1],
      predicted_discharge_3d: Number(forecast.predictions_mm[1]),
      target_date_7d: forecast.forecast_dates[2],
      predicted_discharge_7d: Number(forecast.predictions_mm[2]),
      p95_probability_1d: Number(forecast.events['+1d'].P95.calibrated_probability),
      p99_probability_1d: Number(forecast.events['+1d'].P99.calibrated_probability),
      p95_probability_3d: Number(forecast.events['+3d'].P95.calibrated_probability),
      p99_probability_3d: Number(forecast.events['+3d'].P99.calibrated_probability),
      p95_probability_7d: Number(forecast.events['+7d'].P95.calibrated_probability),
      p99_probability_7d: Number(forecast.events['+7d'].P99.calibrated_probability),
      split: activeCatchmentSummary?.split || 'unknown',
      p95_alert_1d: Boolean(forecast.events['+1d'].P95.event_detected),
      p95_alert_3d: Boolean(forecast.events['+3d'].P95.event_detected),
      p95_alert_7d: Boolean(forecast.events['+7d'].P95.event_detected),
      addedAt: new Date().toLocaleTimeString(),
    };

    setBatchQueue((prev) => {
      // Replace existing entry if same catchment_id and forecast_origin, otherwise prepend
      const filtered = prev.filter(
        (r) => !(r.catchment_id === newRow.catchment_id && r.forecast_origin === newRow.forecast_origin)
      );
      return [newRow, ...filtered];
    });

    setBatchSuccessMsg(`Added Basin ${forecast.gauge_id} (${forecast.origin_date}) to prediction batch.`);
    setTimeout(() => setBatchSuccessMsg(null), 3000);
  };

  const removeFromBatch = (id) => {
    setBatchQueue((prev) => prev.filter((r) => r.id !== id));
  };

  const clearBatch = () => {
    setBatchQueue([]);
  };

  const exportCSV = () => {
    if (!batchQueue || batchQueue.length === 0) return;
    const headers = [
      'catchment_id',
      'forecast_origin',
      'target_date_1d',
      'predicted_discharge_1d',
      'target_date_3d',
      'predicted_discharge_3d',
      'target_date_7d',
      'predicted_discharge_7d',
      'p95_probability_1d',
      'p99_probability_1d',
      'p95_probability_3d',
      'p99_probability_3d',
      'p95_probability_7d',
      'p99_probability_7d',
    ];

    const rows = batchQueue.map((r) => [
      r.catchment_id,
      r.forecast_origin,
      r.target_date_1d,
      r.predicted_discharge_1d.toFixed(6),
      r.target_date_3d,
      r.predicted_discharge_3d.toFixed(6),
      r.target_date_7d,
      r.predicted_discharge_7d.toFixed(6),
      r.p95_probability_1d.toFixed(6),
      r.p99_probability_1d.toFixed(6),
      r.p95_probability_3d.toFixed(6),
      r.p99_probability_3d.toFixed(6),
      r.p95_probability_7d.toFixed(6),
      r.p99_probability_7d.toFixed(6),
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'predictions.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-shell">
      {/* ─── Topbar ────────────────────────────────────────────────────── */}
      <header className="topbar">
        <div className="topbar-brand">
          <div className="topbar-logo">
            <Waves size={18} color="#FFFFFF" />
          </div>
          <div>
            <div className="topbar-title">FLOODCAST</div>
            <div style={{ fontSize: '10px', color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.04em' }}>
              CAMELS-BR HYDROLOGY RESEARCH
            </div>
          </div>
        </div>

        {/* Basin Selector & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-2)', fontWeight: 600 }}>River Basin:</span>
            <select
              id="header-catchment-select"
              name="catchment_id"
              value={selectedGaugeId}
              onChange={(e) => setSelectedGaugeId(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                color: 'var(--text-1)',
                fontSize: '12.5px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {catchments.map((c) => (
                <option key={c.gauge_id} value={c.gauge_id}>
                  {c.gauge_id} ({c.split.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          {/* Evaluation Group Pill */}
          {activeCatchmentSummary && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '4px 9px',
                borderRadius: 'var(--radius-sm)',
                background:
                  activeCatchmentSummary.split === 'test'
                    ? 'rgba(16, 185, 129, 0.15)'
                    : activeCatchmentSummary.split === 'validation'
                    ? 'rgba(139, 92, 246, 0.15)'
                    : 'rgba(59, 130, 246, 0.15)',
                color:
                  activeCatchmentSummary.split === 'test'
                    ? '#059669'
                    : activeCatchmentSummary.split === 'validation'
                    ? '#7C3AED'
                    : '#2563EB',
                border: '1px solid currentColor',
              }}
            >
              {splitLabel}
            </span>
          )}

          {/* Backend Status Pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              background: health?.status === 'healthy' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              color: health?.status === 'healthy' ? '#059669' : '#DC2626',
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: health?.status === 'healthy' ? '#10B981' : '#EF4444',
              }}
            />
            {health?.status === 'healthy' ? 'Model Ready' : 'Backend Offline'}
          </div>
        </div>
      </header>

      {/* ─── Sidebar ──────────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="nav-label">Hydrology Platform</div>
        <button
          className="nav-btn"
          style={activeTab === 'calculator' ? { background: 'var(--bg-elevated)', color: 'var(--blue)', fontWeight: 700 } : {}}
          onClick={() => setActiveTab('calculator')}
        >
          <Calculator size={16} />
          Forecast Calculator
          {batchQueue.length > 0 && (
            <span
              className="badge badge-cyan"
              style={{
                marginLeft: 'auto',
                fontSize: '9.5px',
                padding: '1px 6px',
                borderRadius: '9999px',
              }}
            >
              {batchQueue.length}
            </span>
          )}
        </button>
        <button
          className="nav-btn"
          style={activeTab === 'dashboard' ? { background: 'var(--bg-elevated)', color: 'var(--blue)', fontWeight: 700 } : {}}
          onClick={() => setActiveTab('dashboard')}
        >
          <Activity size={16} />
          River Flow Forecast
        </button>
        <button
          className="nav-btn"
          style={activeTab === 'map' ? { background: 'var(--bg-elevated)', color: 'var(--blue)', fontWeight: 700 } : {}}
          onClick={() => setActiveTab('map')}
        >
          <Globe size={16} />
          River Basin Maps
        </button>
        <button
          className="nav-btn"
          style={activeTab === 'catchments' ? { background: 'var(--bg-elevated)', color: 'var(--blue)', fontWeight: 700 } : {}}
          onClick={() => setActiveTab('catchments')}
        >
          <Database size={16} />
          Basin Characteristics
        </button>

        <div className="nav-label" style={{ marginTop: '14px' }}>Science & Validation</div>
        <button
          className="nav-btn"
          style={activeTab === 'evaluation' ? { background: 'var(--bg-elevated)', color: 'var(--blue)', fontWeight: 700 } : {}}
          onClick={() => setActiveTab('evaluation')}
        >
          <BarChart3 size={16} />
          Model Performance
        </button>
        <button
          className="nav-btn"
          style={activeTab === 'provenance' ? { background: 'var(--bg-elevated)', color: 'var(--blue)', fontWeight: 700 } : {}}
          onClick={() => setActiveTab('provenance')}
        >
          <Info size={16} />
          Research Scope & Data
        </button>

        {/* Sidebar Mini Basin Info */}
        {catchmentDetail && (
          <div
            style={{
              marginTop: 'auto',
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-base)',
              border: '1px solid var(--border)',
              fontSize: '11px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <div style={{ fontWeight: 700, color: 'var(--text-1)', fontSize: '11.5px' }}>
              Active Basin {catchmentDetail.gauge_id}
            </div>
            <div style={{ color: 'var(--text-2)' }}>
              Area: {catchmentDetail.attributes.area ? `${catchmentDetail.attributes.area.toLocaleString()} km²` : 'N/A'}
            </div>
            <div style={{ color: 'var(--text-2)' }}>
              Elevation: {catchmentDetail.attributes.elev_mean ? `${catchmentDetail.attributes.elev_mean.toFixed(0)} m` : 'N/A'}
            </div>
            <div style={{ color: 'var(--text-3)', fontSize: '10px', marginTop: '2px' }}>
              CAMELS-BR Record: {catchmentDetail.start_date.slice(0, 4)}–{catchmentDetail.end_date.slice(0, 4)}
            </div>
          </div>
        )}
      </aside>

      {/* ─── Main Content Body ────────────────────────────────────────── */}
      <main style={{ padding: '24px 30px', overflowY: 'auto' }}>
        {/* Historical Research Demonstration Banner (Part 4 requirement) */}
        <div
          style={{
            background: '#EFF6FF',
            border: '1px solid #BFDBFE',
            borderRadius: 'var(--radius-md)',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span
              style={{
                background: '#1E40AF',
                color: '#FFFFFF',
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: 800,
                letterSpacing: '0.04em',
              }}
            >
              HISTORICAL RESEARCH DEMONSTRATION — NOT A LIVE ALERT
            </span>
            <span style={{ fontSize: '12px', color: '#1E3A8A' }}>
              This system demonstrates the trained BasinShift hydrology model on historical CAMELS-BR observations ending in 2024. It is not an operational real-time flood warning service.
            </span>
          </div>
        </div>

        {/* Error Notification Banner */}
        {errorMessage && (
          <div
            style={{
              marginBottom: '20px',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: '#FEF2F2',
              border: '1px solid #FCA5A5',
              color: '#B91C1C',
              fontSize: '12.5px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              style={{ background: 'transparent', border: 'none', color: '#B91C1C', cursor: 'pointer', fontWeight: 700 }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Batch Success Banner */}
        {batchSuccessMsg && (
          <div
            style={{
              marginBottom: '20px',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: '#F0FDF4',
              border: '1px solid #86EFAC',
              color: '#15803D',
              fontSize: '12.5px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} color="#16A34A" />
              <span>{batchSuccessMsg}</span>
            </div>
            <button
              onClick={() => setBatchSuccessMsg(null)}
              style={{ background: 'transparent', border: 'none', color: '#15803D', cursor: 'pointer', fontWeight: 700 }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ─── TAB: FORECAST CALCULATOR ───────────────────────────────── */}
        {activeTab === 'calculator' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Header: Clean Light Page Header */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '14px',
                padding: '18px 20px',
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text-1)' }}>
                    Forecast Calculator
                  </h1>
                  <span className="badge badge-blue">Trained Model</span>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-2)' }}>
                  Run multi-horizon flood forecasting inference with BasinShiftMultiTask and assemble prediction batches for CSV export.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  className="btn btn-ghost"
                  onClick={() => setActiveTab('dashboard')}
                  style={{ fontSize: '12.5px' }}
                >
                  <Activity size={15} /> Open Hydrograph
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => setActiveTab('map')}
                  style={{ fontSize: '12.5px' }}
                >
                  <Globe size={15} /> Basin Maps
                </button>
              </div>
            </div>

            {/* Top section: Input Panel (left) + Result Panel (right) */}
            <div className="calculator-layout">
              {/* ─── Input Panel (Left) ─── */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="icon-wrap"><Sliders size={15} /></span>
                    <span>Forecast Parameters</span>
                  </div>
                  <span className="badge badge-cyan">CAMELS-BR v1.2</span>
                </div>

                {/* River Basin Selector */}
                <div className="field">
                  <label className="field-label" htmlFor="calc-basin-select">
                    River Basin (CAMELS-BR Gauge)
                  </label>
                  <select
                    id="calc-basin-select"
                    className="field-input"
                    value={selectedGaugeId}
                    onChange={(e) => {
                      setSelectedGaugeId(e.target.value);
                    }}
                  >
                    {catchments.map((c) => (
                      <option key={c.gauge_id} value={c.gauge_id}>
                        {c.gauge_id} — Lat {c.lat.toFixed(2)}, Lon {c.lon.toFixed(2)} ({c.split.toUpperCase()}{c.threshold_eligible ? ', Eligible' : ''})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selected Basin Quick Specs */}
                {catchmentDetail && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '8px',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      fontSize: '11px',
                    }}
                  >
                    <div>
                      <span style={{ color: 'var(--text-3)', display: 'block', fontSize: '10px', fontWeight: 600 }}>DRAINAGE AREA</span>
                      <strong style={{ color: 'var(--text-1)' }}>
                        {catchmentDetail.attributes.area ? `${catchmentDetail.attributes.area.toLocaleString()} km²` : 'N/A'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-3)', display: 'block', fontSize: '10px', fontWeight: 600 }}>ELEVATION</span>
                      <strong style={{ color: 'var(--text-1)' }}>
                        {catchmentDetail.attributes.elev_mean ? `${catchmentDetail.attributes.elev_mean.toFixed(0)} m` : 'N/A'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-3)', display: 'block', fontSize: '10px', fontWeight: 600 }}>EVAL GROUP</span>
                      <span
                        style={{
                          fontWeight: 700,
                          color:
                            catchmentDetail.split === 'test'
                              ? '#059669'
                              : catchmentDetail.split === 'validation'
                              ? '#7C3AED'
                              : '#2563EB',
                        }}
                      >
                        {catchmentDetail.split.toUpperCase()}
                      </span>
                    </div>
                  </div>
                )}

                {/* Forecast Origin Date */}
                <div className="field">
                  <label className="field-label" htmlFor="calc-origin-date">
                    Forecast Origin Date (t₀)
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      id="calc-origin-date"
                      type="date"
                      className="field-input"
                      value={originDate}
                      min={catchmentDetail?.start_date || '1980-01-01'}
                      max={catchmentDetail?.end_date || '2024-07-31'}
                      onChange={(e) => setOriginDate(e.target.value)}
                    />
                    {catchmentDetail?.end_date && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setOriginDate(catchmentDetail.end_date)}
                        title="Set origin to latest recorded date"
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        Latest Date
                      </button>
                    )}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>
                    Valid dataset window: {catchmentDetail?.start_date || '1980-01-01'} to {catchmentDetail?.end_date || '2024-07-31'}. Requires 30 continuous historical days.
                  </span>
                </div>

                {/* Historical Input Coverage Indicator */}
                <div
                  style={{
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    background: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    fontSize: '11.5px',
                    color: '#166534',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                    <CheckCircle2 size={15} color="#16A34A" />
                    <span>Historical Input Coverage (Previous 30 Days)</span>
                  </div>
                  <div style={{ lineHeight: 1.45, color: '#15803D' }}>
                    The trained model requires the continuous preceding 30 days of:
                    <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                      <span>• River Flow (mm/d)</span>
                      <span>• Rainfall (mm)</span>
                      <span>• Mean Temp (°C)</span>
                    </div>
                    and all 29 static catchment attributes. These are loaded directly from the authoritative CAMELS-BR dataset. Incomplete windows are rejected by the backend.
                  </div>
                </div>

                {/* Generate Forecast Button */}
                <button
                  className="btn btn-primary btn-block"
                  onClick={handleGenerateForecast}
                  disabled={loadingForecast}
                  style={{ padding: '10px 18px', fontSize: '13.5px', marginTop: '4px' }}
                >
                  {loadingForecast ? (
                    <>
                      <RefreshCw size={16} className="spin" /> Computing Model Forward Pass...
                    </>
                  ) : (
                    <>
                      <Zap size={16} /> Generate Forecast
                    </>
                  )}
                </button>
              </div>

              {/* ─── Forecast Result Panel (Right) ─── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div
                  className="card"
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    borderLeft: `3px solid ${
                      forecast?.events?.['+1d']?.P95?.event_detected ||
                      forecast?.events?.['+3d']?.P95?.event_detected ||
                      forecast?.events?.['+7d']?.P95?.event_detected
                        ? 'var(--red)'
                        : 'var(--cyan)'
                    }`,
                  }}
                >
                  <div>
                    <div className="card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="icon-wrap"><BarChart3 size={15} /></span>
                        <span>Forecast Result</span>
                      </div>
                      {forecast && (
                        <span className="badge badge-blue">
                          Origin: {forecast.origin_date}
                        </span>
                      )}
                    </div>

                    {loadingForecast ? (
                      <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' }}>
                        <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px auto' }} />
                        <div>Executing BasinShiftMultiTask inference...</div>
                      </div>
                    ) : forecast && forecast.predictions_mm ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Canonical Tomorrow Readout */}
                        <div
                          style={{
                            padding: '14px',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Tomorrow's Flow (+1d: {forecast.forecast_dates[0]})
                            </span>
                            <span className="badge badge-blue">MODEL PREDICTION</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                            <span className="discharge-readout" style={{ color: 'var(--blue)' }}>
                              {forecast.predictions_mm[0].toFixed(3)}
                            </span>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-2)' }}>
                              mm / day
                            </span>
                          </div>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-3)', marginTop: '4px' }}>
                            Latest observed: {forecast.latest_observed_q_mm.toFixed(3)} mm/day ({forecast.predictions_mm[0] >= forecast.latest_observed_q_mm ? '+' : ''}{(forecast.predictions_mm[0] - forecast.latest_observed_q_mm).toFixed(3)} mm/d)
                          </div>
                        </div>

                        {/* Multi-Horizon Breakdown Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                          {/* +1d */}
                          <div style={{ padding: '10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-3)' }}>+1 DAY</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-2)', marginBottom: '4px' }}>{forecast.forecast_dates[0]}</div>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-1)', fontFamily: 'var(--font-mono)' }}>
                              {forecast.predictions_mm[0].toFixed(3)} <span style={{ fontSize: '10px', fontWeight: 500 }}>mm/d</span>
                            </div>
                            <div style={{ fontSize: '10.5px', marginTop: '6px', color: 'var(--text-2)' }}>
                              P95: <strong>{(forecast.events['+1d'].P95.calibrated_probability * 100).toFixed(1)}%</strong>
                            </div>
                            <div style={{ fontSize: '10.5px', color: 'var(--text-3)' }}>
                              P99: <strong>{(forecast.events['+1d'].P99.calibrated_probability * 100).toFixed(2)}%</strong>
                            </div>
                          </div>

                          {/* +3d */}
                          <div style={{ padding: '10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-3)' }}>+3 DAYS</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-2)', marginBottom: '4px' }}>{forecast.forecast_dates[1]}</div>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-1)', fontFamily: 'var(--font-mono)' }}>
                              {forecast.predictions_mm[1].toFixed(3)} <span style={{ fontSize: '10px', fontWeight: 500 }}>mm/d</span>
                            </div>
                            <div style={{ fontSize: '10.5px', marginTop: '6px', color: 'var(--text-2)' }}>
                              P95: <strong>{(forecast.events['+3d'].P95.calibrated_probability * 100).toFixed(1)}%</strong>
                            </div>
                            <div style={{ fontSize: '10.5px', color: 'var(--text-3)' }}>
                              P99: <strong>{(forecast.events['+3d'].P99.calibrated_probability * 100).toFixed(2)}%</strong>
                            </div>
                          </div>

                          {/* +7d */}
                          <div style={{ padding: '10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-3)' }}>+7 DAYS</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-2)', marginBottom: '4px' }}>{forecast.forecast_dates[2]}</div>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-1)', fontFamily: 'var(--font-mono)' }}>
                              {forecast.predictions_mm[2].toFixed(3)} <span style={{ fontSize: '10px', fontWeight: 500 }}>mm/d</span>
                            </div>
                            <div style={{ fontSize: '10.5px', marginTop: '6px', color: 'var(--text-2)' }}>
                              P95: <strong>{(forecast.events['+7d'].P95.calibrated_probability * 100).toFixed(1)}%</strong>
                            </div>
                            <div style={{ fontSize: '10.5px', color: 'var(--text-3)' }}>
                              P99: <strong>{(forecast.events['+7d'].P99.calibrated_probability * 100).toFixed(2)}%</strong>
                            </div>
                          </div>
                        </div>

                        <div style={{ fontSize: '11px', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <ShieldCheck size={14} color="#10B981" />
                          <span>Hierarchy enforced: P(P99) ≤ P(P95) physically maintained at all horizons.</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-3)', fontSize: '12.5px' }}>
                        Select a basin and click "Generate Forecast" to execute inference.
                      </div>
                    )}
                  </div>

                  {/* Add to Batch Action */}
                  <div style={{ marginTop: '16px' }}>
                    <button
                      className="btn btn-primary btn-block"
                      onClick={addToBatch}
                      disabled={!forecast || loadingForecast}
                    >
                      <Plus size={15} /> Add to Prediction Batch
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ─── Batch Results Underneath ─── */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div className="card-title" style={{ marginBottom: 0 }}>
                  <span className="icon-wrap"><FileSpreadsheet size={15} /></span>
                  <span>Prediction Batch</span>
                  <span className="badge badge-cyan" style={{ marginLeft: '8px' }}>
                    {batchQueue.length} {batchQueue.length === 1 ? 'forecast' : 'forecasts'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {batchQueue.length > 0 && (
                    <button className="btn btn-ghost btn-sm" onClick={clearBatch}>
                      <Trash2 size={14} /> Clear Batch
                    </button>
                  )}
                  <button
                    className="btn btn-cyan btn-sm"
                    onClick={exportCSV}
                    disabled={batchQueue.length === 0}
                    title={batchQueue.length === 0 ? 'Batch is empty' : 'Download predictions.csv'}
                  >
                    <Download size={14} /> Download predictions.csv
                  </button>
                </div>
              </div>

              {batchQueue.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', color: 'var(--text-3)', fontSize: '12.5px' }}>
                  No records in batch yet. Select a basin and forecast origin date above, click <strong>"Generate Forecast"</strong>, and then click <strong>"Add to Prediction Batch"</strong>.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Catchment ID</th>
                        <th>Origin Date</th>
                        <th>+1d Flow (mm/d)</th>
                        <th>+3d Flow (mm/d)</th>
                        <th>+7d Flow (mm/d)</th>
                        <th>P95 Exceedance</th>
                        <th>P99 Exceedance</th>
                        <th>Added</th>
                        <th style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchQueue.map((row) => (
                        <tr key={row.id}>
                          <td className="text-mono" style={{ fontWeight: 700, color: 'var(--blue)' }}>
                            {row.catchment_id}
                          </td>
                          <td className="text-mono">{row.forecast_origin}</td>
                          <td className="text-mono">
                            <strong>{row.predicted_discharge_1d.toFixed(3)}</strong>
                            <span style={{ fontSize: '10px', color: 'var(--text-3)', marginLeft: '4px' }}>({row.target_date_1d})</span>
                          </td>
                          <td className="text-mono">
                            <strong>{row.predicted_discharge_3d.toFixed(3)}</strong>
                            <span style={{ fontSize: '10px', color: 'var(--text-3)', marginLeft: '4px' }}>({row.target_date_3d})</span>
                          </td>
                          <td className="text-mono">
                            <strong>{row.predicted_discharge_7d.toFixed(3)}</strong>
                            <span style={{ fontSize: '10px', color: 'var(--text-3)', marginLeft: '4px' }}>({row.target_date_7d})</span>
                          </td>
                          <td style={{ fontSize: '11px' }}>
                            {(row.p95_probability_1d * 100).toFixed(1)}% / {(row.p95_probability_3d * 100).toFixed(1)}% / {(row.p95_probability_7d * 100).toFixed(1)}%
                          </td>
                          <td style={{ fontSize: '11px' }}>
                            {(row.p99_probability_1d * 100).toFixed(2)}% / {(row.p99_probability_3d * 100).toFixed(2)}% / {(row.p99_probability_7d * 100).toFixed(2)}%
                          </td>
                          <td style={{ fontSize: '11px', color: 'var(--text-3)' }}>{row.addedAt}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => removeFromBatch(row.id)}
                              title="Remove record"
                              style={{ padding: '4px 8px' }}
                            >
                              <Trash2 size={13} color="var(--red)" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 1: RIVER FLOW FORECAST ──────────────────────────────── */}
        {activeTab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            {/* Header: Plain Language Title & Subtitle */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '14px',
                padding: '18px 20px',
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
              }}
            >
              <div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-1)' }}>
                  River Flow Forecast
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-2)', marginTop: '2px' }}>
                  See how the model expects river flow to change over the next seven days.
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '6px' }}>
                  Basin: <strong>{selectedGaugeId}</strong> • Lat {activeCatchmentSummary?.lat.toFixed(4)}°, Lon {activeCatchmentSummary?.lon.toFixed(4)}° • Group: <strong>{splitLabel}</strong>
                </div>
              </div>

              {/* Origin Date Picker & Run Forecast Button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-3)', fontWeight: 600, marginBottom: '2px' }}>
                    Forecast Origin Date
                  </div>
                  <input
                    id="origin-date-input"
                    name="origin_date"
                    type="date"
                    value={originDate}
                    onChange={(e) => setOriginDate(e.target.value)}
                    style={{
                      padding: '7px 10px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-base)',
                      color: 'var(--text-1)',
                      fontSize: '12px',
                      fontFamily: 'var(--font-mono)',
                    }}
                  />
                </div>

                <button
                  onClick={handleGenerateForecast}
                  disabled={loadingForecast}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '9px 18px',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    background: 'var(--blue)',
                    color: '#FFFFFF',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: loadingForecast ? 'not-allowed' : 'pointer',
                    opacity: loadingForecast ? 0.7 : 1,
                    marginTop: '14px',
                  }}
                >
                  <RefreshCw size={14} className={loadingForecast ? 'spin' : ''} />
                  {loadingForecast ? 'Computing...' : 'Update Forecast'}
                </button>

                <button
                  onClick={addToBatch}
                  disabled={!forecast || loadingForecast}
                  className="btn btn-ghost"
                  style={{ marginTop: '14px', fontSize: '12.5px' }}
                  title="Add current forecast to prediction batch"
                >
                  <Plus size={14} /> Add to Batch
                </button>
              </div>
            </div>

            {/* Visual Priority Cards: 4 Tiles Explicitly Labeled OBSERVED vs MODEL PREDICTION */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              {/* Tile 1: Latest Observed */}
              <div style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-3)' }}>
                    Latest Observed Flow
                  </span>
                  <span style={{ background: '#E2E8F0', color: '#1E293B', padding: '2px 7px', borderRadius: '4px', fontSize: '10px', fontWeight: 800 }}>
                    OBSERVED
                  </span>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-1)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                  {forecast ? forecast.latest_observed_q_mm.toFixed(3) : '—'}{' '}
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-3)' }}>mm/d</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '4px' }}>
                  Recorded on {forecast?.origin_date || 'N/A'}
                </div>
              </div>

              {/* Tile 2: Tomorrow's Flow (+1d) */}
              <div style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', borderTop: '3px solid #3B82F6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#2563EB' }}>
                    Tomorrow (+1 Day)
                  </span>
                  <span style={{ background: '#DBEAFE', color: '#1E40AF', padding: '2px 7px', borderRadius: '4px', fontSize: '10px', fontWeight: 800 }}>
                    MODEL PREDICTION
                  </span>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#1E40AF', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                  {forecast && forecast.predictions_mm ? forecast.predictions_mm[0].toFixed(3) : '—'}{' '}
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-3)' }}>mm/d</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '4px' }}>
                  Target: {forecast?.forecast_dates ? forecast.forecast_dates[0] : 'N/A'}
                </div>
              </div>

              {/* Tile 3: Three-Day Flow (+3d) */}
              <div style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', borderTop: '3px solid #8B5CF6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#7C3AED' }}>
                    Three Days Ahead (+3d)
                  </span>
                  <span style={{ background: '#EDE9FE', color: '#6D28D9', padding: '2px 7px', borderRadius: '4px', fontSize: '10px', fontWeight: 800 }}>
                    MODEL PREDICTION
                  </span>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#5B21B6', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                  {forecast && forecast.predictions_mm ? forecast.predictions_mm[1].toFixed(3) : '—'}{' '}
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-3)' }}>mm/d</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '4px' }}>
                  Target: {forecast?.forecast_dates ? forecast.forecast_dates[1] : 'N/A'}
                </div>
              </div>

              {/* Tile 4: Seven-Day Flow (+7d) */}
              <div style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', borderTop: '3px solid #F59E0B' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#D97706' }}>
                    Seven Days Ahead (+7d)
                  </span>
                  <span style={{ background: '#FEF3C7', color: '#B45309', padding: '2px 7px', borderRadius: '4px', fontSize: '10px', fontWeight: 800 }}>
                    MODEL PREDICTION
                  </span>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#B45309', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                  {forecast && forecast.predictions_mm ? forecast.predictions_mm[2].toFixed(3) : '—'}{' '}
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-3)' }}>mm/d</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '4px' }}>
                  Target: {forecast?.forecast_dates ? forecast.forecast_dates[2] : 'N/A'}
                </div>
              </div>
            </div>

            {/* Main Visual Element: River Flow History & Forecast Chart */}
            <div
              style={{
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                padding: '20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-1)' }}>
                    River Flow History and Forecast
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '2px' }}>
                    Solid blue line indicates observed river flow; dashed purple trajectory indicates model predictions.
                  </div>
                </div>

                {forecast && (
                  <div style={{ fontSize: '11.5px', color: 'var(--text-2)' }}>
                    Reference Levels:{' '}
                    {forecast.threshold_eligible ? (
                      <span style={{ color: '#059669', fontWeight: 700 }}>Available (P95: {forecast.thresholds.P95_mm_day?.toFixed(2)} mm/d)</span>
                    ) : (
                      <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>Historical Threshold Unavailable</span>
                    )}
                  </div>
                )}
              </div>

              <Hydrograph
                forecastData={forecast}
                observations={observations}
                thresholds={forecast?.thresholds || {}}
                thresholdEligible={forecast?.threshold_eligible}
              />
            </div>

            {/* High-Flow Likelihood Section (Plain Language for P95 & P99) */}
            <div
              style={{
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                padding: '20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-1)' }}>
                      High-Flow Likelihood (Statistical Reference Levels)
                    </span>
                    <span style={{ background: '#EDE9FE', color: '#6D28D9', padding: '2px 7px', borderRadius: '4px', fontSize: '9.5px', fontWeight: 800 }}>
                      MODEL PREDICTION
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '2px' }}>
                    Estimated likelihood of river flow exceeding the basin's historical 95th (unusual) and 99th (rare) percentile levels.
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#059669',
                    background: 'rgba(16, 185, 129, 0.1)',
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <CheckCircle2 size={13} />
                  Calibrated Probabilities
                </div>
              </div>

              {forecast && forecast.events ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  {['+1d', '+3d', '+7d'].map((hKey) => {
                    const ev = forecast.events[hKey];
                    const p95 = ev.P95;
                    const p99 = ev.P99;
                    const dayLabel = hKey === '+1d' ? 'Tomorrow (+1d)' : hKey === '+3d' ? '3 Days Ahead (+3d)' : '7 Days Ahead (+7d)';

                    return (
                      <div
                        key={hKey}
                        style={{
                          background: 'var(--bg-elevated)',
                          borderRadius: 'var(--radius-md)',
                          padding: '14px',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-1)' }}>
                            {dayLabel}
                          </span>
                        </div>

                        {/* P95 Section */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 600, color: '#D97706' }}>Unusual High Flow (P95)</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                              {(p95.calibrated_probability * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div style={{ width: '100%', height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                            <div
                              style={{
                                width: `${Math.min(p95.calibrated_probability * 100, 100)}%`,
                                height: '100%',
                                background: p95.calibrated_probability >= p95.decision_threshold ? '#EF4444' : '#F59E0B',
                              }}
                            />
                            <div
                              style={{
                                position: 'absolute',
                                left: `${p95.decision_threshold * 100}%`,
                                top: 0,
                                bottom: 0,
                                width: '2px',
                                background: '#172B4D',
                              }}
                              title={`Threshold: ${(p95.decision_threshold * 100).toFixed(1)}%`}
                            />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-3)', marginTop: '2px' }}>
                            <span>Alert cutoff: {(p95.decision_threshold * 100).toFixed(1)}%</span>
                            {forecast.threshold_eligible ? (
                              <span style={{ fontWeight: 700, color: p95.event_detected ? '#DC2626' : '#059669' }}>
                                {p95.event_detected ? 'HIGH FLOW ALERT' : 'Normal Flow'}
                              </span>
                            ) : (
                              <span style={{ fontStyle: 'italic' }}>Unavailable</span>
                            )}
                          </div>
                        </div>

                        {/* P99 Section */}
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 700, color: '#DC2626' }}>Rare Severe Flow (P99)</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                              {(p99.calibrated_probability * 100).toFixed(2)}%
                            </span>
                          </div>
                          <div style={{ width: '100%', height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                            <div
                              style={{
                                width: `${Math.min(p99.calibrated_probability * 100, 100)}%`,
                                height: '100%',
                                background: p99.calibrated_probability >= p99.decision_threshold ? '#DC2626' : '#EF4444',
                              }}
                            />
                            <div
                              style={{
                                position: 'absolute',
                                left: `${p99.decision_threshold * 100}%`,
                                top: 0,
                                bottom: 0,
                                width: '2px',
                                background: '#172B4D',
                              }}
                              title={`Threshold: ${(p99.decision_threshold * 100).toFixed(1)}%`}
                            />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-3)', marginTop: '2px' }}>
                            <span>Alert cutoff: {(p99.decision_threshold * 100).toFixed(1)}%</span>
                            {forecast.threshold_eligible ? (
                              <span style={{ fontWeight: 700, color: p99.event_detected ? '#DC2626' : '#059669' }}>
                                {p99.event_detected ? 'SEVERE FLOW ALERT' : 'Normal Flow'}
                              </span>
                            ) : (
                              <span style={{ fontStyle: 'italic' }}>Unavailable</span>
                            )}
                          </div>
                        </div>

                        {/* +7d Operational Caution Note */}
                        {hKey === '+7d' && (
                          <div
                            style={{
                              marginTop: '2px',
                              padding: '6px 8px',
                              borderRadius: 'var(--radius-sm)',
                              background: '#FFFBEB',
                              border: '1px solid #FDE68A',
                              color: '#92400E',
                              fontSize: '10.5px',
                              lineHeight: '1.4',
                            }}
                          >
                            <strong>Operational Notice:</strong> At +7 days, rare high-flow detection (P99) has high uncertainty (recall 10.4%). Informational only; not an operational alert.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ color: 'var(--text-3)', fontSize: '12px' }}>Awaiting forecast data...</div>
              )}
            </div>

            {/* Part 2: "How the Model Works" Pipeline Explanation */}
            <div
              style={{
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                padding: '22px 24px',
              }}
            >
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-1)' }}>
                How the Model Works
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-2)', marginTop: '2px', marginBottom: '18px' }}>
                BasinShift combines historical sensor observations with physical basin characteristics to project future river flow.
              </div>

              {/* 3 Visual Steps */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', position: 'relative' }}>
                <div style={{ background: 'var(--bg-elevated)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#2563EB', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800 }}>1</span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-1)' }}>30 Days of Past Observations</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: '1.5' }}>
                    Reads the previous 30 consecutive days of river flow, rainfall, and air temperature recorded at the basin station.
                  </div>
                </div>

                <div style={{ background: 'var(--bg-elevated)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#7C3AED', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800 }}>2</span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-1)' }}>Basin Integration</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: '1.5' }}>
                    Combines those dynamic observations with 29 fixed physical attributes of the selected river basin (topography, soil, geology, and land cover).
                  </div>
                </div>

                <div style={{ background: 'var(--bg-elevated)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#059669', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800 }}>3</span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-1)' }}>Multi-Horizon Forecasts</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: '1.5' }}>
                    Produces expected river flow predictions and calibrated high-flow exceedance probabilities for one, three, and seven days ahead.
                  </div>
                </div>
              </div>

              {/* Expandable Technical Details */}
              <details style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                <summary style={{ cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: 'var(--blue)', outline: 'none' }}>
                  ▸ Technical details (architecture, features, and calibration)
                </summary>
                <div style={{ marginTop: '12px', padding: '14px', background: 'var(--bg-base)', borderRadius: 'var(--radius-md)', fontSize: '11.5px', color: 'var(--text-2)', lineHeight: '1.6' }}>
                  <div>• <strong>LSTM Temporal Encoder:</strong> 2-layer LSTM (128 hidden units, dropout 0.2) processing the 30-day sequence of log(1 + flow), log(1 + rain), and temperature.</div>
                  <div>• <strong>Static Catchment Encoder:</strong> 2-layer MLP (64 hidden units) encoding 29 physical basin attributes with training median imputation and standard scaling.</div>
                  <div>• <strong>Fusion & Multi-Task Heads:</strong> Shared 192-dimensional representation driving a 3-horizon residual regression head and 6-logit classification head.</div>
                  <div>• <strong>Target Reconstruction:</strong> Residual formulation predicting Δz standardized against target standard deviation σ = 0.5517.</div>
                  <div>• <strong>Event Calibration:</strong> Platt Logistic Regression calibrators fitted on the validation set, enforcing physical hierarchy P(P99) ≤ P(P95).</div>
                  <div>• <strong>Checkpoint:</strong> Model loaded from <code>basinshift_multitask_best.pt</code> with pre-fit scalers in <code>basinshift_scalers.npz</code>.</div>
                </div>
              </details>
            </div>
          </div>
        )}

        {/* ─── TAB 2: RIVER BASIN MAPS (2D & 3D) ────────────────────────── */}
        {activeTab === 'map' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-1)' }}>
                  River Basin Geographical Distribution
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '2px' }}>
                  Explore 897 CAMELS-BR river basins across Brazil, categorized by evaluation group (training, validation, and held-out test).
                </div>
              </div>

              {/* View Switcher Buttons */}
              <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-elevated)', padding: '3px', borderRadius: 'var(--radius-md)' }}>
                <button
                  onClick={() => setMapSubView('2d')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: mapSubView === '2d' ? 'var(--bg-surface)' : 'transparent',
                    color: mapSubView === '2d' ? 'var(--blue)' : 'var(--text-2)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: mapSubView === '2d' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  2D Brazil Map
                </button>
                <button
                  onClick={() => setMapSubView('3d')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: mapSubView === '3d' ? 'var(--bg-surface)' : 'transparent',
                    color: mapSubView === '3d' ? 'var(--blue)' : 'var(--text-2)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: mapSubView === '3d' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  3D Interactive Globe
                </button>
              </div>
            </div>

            {mapSubView === '2d' ? (
              <CatchmentMap2D
                catchments={catchments}
                selectedId={selectedGaugeId}
                onSelectCatchment={(id) => {
                  setSelectedGaugeId(id);
                }}
                onSwitchTo3D={() => setMapSubView('3d')}
              />
            ) : (
              <GlobeView
                catchments={catchments}
                selectedId={selectedGaugeId}
                onSelectCatchment={(id) => {
                  setSelectedGaugeId(id);
                }}
                onSwitchTo2D={() => setMapSubView('2d')}
              />
            )}
          </div>
        )}

        {/* ─── TAB 3: BASIN CHARACTERISTICS (29 ATTRIBUTES) ────────────── */}
        {activeTab === 'catchments' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-1)' }}>
                Basin Characteristics (Static Physical Attributes)
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '2px' }}>
                The BasinShift model conditions river flow forecasts on these 29 physical characteristics of the river basin.
              </div>
            </div>

            {/* Informational Callout: Physical Attributes vs Model Inputs */}
            <div
              style={{
                background: '#EFF6FF',
                border: '1px solid #BFDBFE',
                borderRadius: 'var(--radius-md)',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                fontSize: '12px',
                color: '#1E3A8A',
                lineHeight: '1.5',
              }}
            >
              <Info size={18} color="#2563EB" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Physical Attributes vs. Transformed Model Inputs:</strong> The metrics below are raw, physically interpretable measurements from the CAMELS-BR hydro-meteorological benchmark (e.g. depths in cm, permeability in log₁₀(m²), area in km²). During inference, the BasinShift pipeline imputes missing values using training set medians, applies log1p transformations to Drainage Area and Reservoir Volume, and normalizes all 29 features with standard scaling (z = (x − μ) / σ) before passing them to the 64-dimensional static encoder.
              </div>
            </div>

            {catchmentDetail ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* Categorized Attributes Grid */}
                {[
                  {
                    category: 'Topography (Elevation, Slope, Area)',
                    icon: Mountain,
                    color: '#2563EB',
                    keys: ['elev_gauge', 'elev_mean', 'slope_mean', 'area'],
                  },
                  {
                    category: 'Soil Characteristics (Texture & Depths)',
                    icon: Droplets,
                    color: '#D97706',
                    keys: ['sand_perc', 'silt_perc', 'clay_perc', 'org_carbon_content', 'bedrock_depth', 'water_table_depth'],
                  },
                  {
                    category: 'Geology & Hydrogeological Permeability',
                    icon: Layers,
                    color: '#7C3AED',
                    keys: ['geol_class_1st_perc', 'geol_class_2nd_perc', 'carb_rocks_perc', 'geol_porosity', 'geol_permeability'],
                  },
                  {
                    category: 'Land Cover & Vegetation Types',
                    icon: Trees,
                    color: '#059669',
                    keys: ['forest_perc', 'crop_perc', 'crop_mosaic_perc', 'shrub_perc', 'grass_perc', 'barren_perc', 'imperv_perc', 'wet_perc', 'snow_perc', 'dom_land_cover_perc'],
                  },
                  {
                    category: 'Human Intervention & Regulation',
                    icon: Sliders,
                    color: '#DC2626',
                    keys: ['consumptive_use', 'consumptive_use_perc', 'reservoirs_vol', 'regulation_degree'],
                  },
                ].map((group) => {
                  const Icon = group.icon;
                  return (
                    <div
                      key={group.category}
                      style={{
                        background: 'var(--bg-surface)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border)',
                        padding: '18px 20px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                        <Icon size={16} color={group.color} />
                        <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-1)' }}>
                          {group.category}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '12px' }}>
                        {group.keys.map((k) => {
                          const val = catchmentDetail.attributes[k];
                          const meta = STATIC_ATTR_METADATA[k] || { label: k, unit: '', decimals: 2, tooltip: '' };
                          const isPercent = meta.unit === '%';

                          let formattedVal = 'N/A';
                          if (val !== null && val !== undefined) {
                            if (meta.decimals === 0) {
                              formattedVal = Math.round(val).toLocaleString();
                            } else {
                              formattedVal = val.toLocaleString(undefined, {
                                minimumFractionDigits: meta.decimals,
                                maximumFractionDigits: meta.decimals,
                              });
                            }
                          }

                          return (
                            <div
                              key={k}
                              title={meta.tooltip}
                              style={{
                                background: 'var(--bg-elevated)',
                                padding: '12px 14px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border)',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                              }}
                            >
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-1)' }}>
                                    {meta.label}
                                  </span>
                                  <span style={{ fontSize: '9.5px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                                    {k}
                                  </span>
                                </div>
                                <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-1)', marginTop: '4px' }}>
                                  {formattedVal}{' '}
                                  <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-2)' }}>
                                    {meta.unit}
                                  </span>
                                </div>
                              </div>

                              {isPercent && val !== null && val !== undefined && (
                                <div style={{ width: '100%', height: '4px', background: 'var(--border)', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' }}>
                                  <div style={{ width: `${Math.min(val, 100)}%`, height: '100%', background: group.color }} />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ color: 'var(--text-3)', fontSize: '12px' }}>Loading basin characteristics...</div>
            )}
          </div>
        )}

        {/* ─── TAB 4: MODEL PERFORMANCE ─────────────────────────────────── */}
        {activeTab === 'evaluation' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-1)' }}>
                Model Performance
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '2px' }}>
                Independent benchmark evaluation on 115 eligible geographically held-out test river basins across Brazil (725,921 daily evaluation dates).
              </div>
            </div>

            {/* Regression Performance Highlight Box (Part 3 requirement) */}
            <div
              style={{
                background: '#F0FDF4',
                border: '1px solid #BBF7D0',
                borderRadius: 'var(--radius-lg)',
                padding: '18px 22px',
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#166534', marginBottom: '6px' }}>
                Forecast Error vs Persistence Baseline (Lower is Better)
              </div>
              <div style={{ fontSize: '12.5px', color: '#14532D', lineHeight: '1.5', marginBottom: '14px' }}>
                <strong>The model achieved lower average forecast error than the persistence baseline at all three tested horizons.</strong>
                <br />
                These are results across 115 eligible geographically held-out test catchments, not performance for every basin worldwide.
              </div>

              {/* Prominent MAE Comparison Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                <div style={{ background: '#FFFFFF', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid #86EFAC' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                    +1 Day Horizon
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
                    <span style={{ fontSize: '20px', fontWeight: 800, color: '#15803D', fontFamily: 'var(--font-mono)' }}>0.1051</span>
                    <span style={{ fontSize: '11px', color: '#166534' }}>mm/d BasinShift</span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                    vs. <strong>0.1226 mm/d</strong> (Persistence baseline)
                  </div>
                  <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#15803D', marginTop: '4px' }}>
                    ✓ 14.3% lower error
                  </div>
                </div>

                <div style={{ background: '#FFFFFF', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid #86EFAC' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                    +3 Day Horizon
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
                    <span style={{ fontSize: '20px', fontWeight: 800, color: '#15803D', fontFamily: 'var(--font-mono)' }}>0.1846</span>
                    <span style={{ fontSize: '11px', color: '#166534' }}>mm/d BasinShift</span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                    vs. <strong>0.2261 mm/d</strong> (Persistence baseline)
                  </div>
                  <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#15803D', marginTop: '4px' }}>
                    ✓ 18.4% lower error
                  </div>
                </div>

                <div style={{ background: '#FFFFFF', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid #86EFAC' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                    +7 Day Horizon
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
                    <span style={{ fontSize: '20px', fontWeight: 800, color: '#15803D', fontFamily: 'var(--font-mono)' }}>0.2565</span>
                    <span style={{ fontSize: '11px', color: '#166534' }}>mm/d BasinShift</span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                    vs. <strong>0.3158 mm/d</strong> (Persistence baseline)
                  </div>
                  <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#15803D', marginTop: '4px' }}>
                    ✓ 18.8% lower error
                  </div>
                </div>
              </div>
            </div>

            {/* High-Flow Detection Results Table (Separate Section) */}
            <div style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-1)', marginBottom: '4px' }}>
                High-Flow Detection Performance (P95 & P99 Thresholds)
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: '14px' }}>
                Evaluated on actual historical threshold exceedances across all 115 test basins using Platt-calibrated probabilities.
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px' }}>Event Threshold</th>
                      <th style={{ padding: '8px 12px' }}>Historical Prevalence</th>
                      <th style={{ padding: '8px 12px' }}>AUPRC (Precision-Recall)</th>
                      <th style={{ padding: '8px 12px' }}>ROC AUC</th>
                      <th style={{ padding: '8px 12px' }}>Recall (% detected)</th>
                      <th style={{ padding: '8px 12px' }}>False alerts per 1,000 forecast dates</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics?.event_classification?.map((row, idx) => {
                      const isWeak = row.event.includes('+7d P99');
                      return (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: '1px solid var(--border)',
                            background: isWeak ? '#FFFBEB' : 'transparent',
                          }}
                        >
                          <td style={{ padding: '8px 12px', fontWeight: 700, color: row.event.includes('P99') ? '#DC2626' : '#D97706' }}>
                            {row.event} {isWeak && <span style={{ fontSize: '10px', background: '#FDE68A', color: '#92400E', padding: '1px 5px', borderRadius: '3px', marginLeft: '6px' }}>Weak / Experimental</span>}
                          </td>
                          <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)' }}>{row.prevalence_pct.toFixed(2)}%</td>
                          <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{row.AUPRC.toFixed(4)}</td>
                          <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)' }}>{row.ROC_AUC.toFixed(4)}</td>
                          <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)' }}>{(row.recall * 100).toFixed(1)}%</td>
                          <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)' }}>{row.false_alarms_per_1000.toFixed(1)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Visible Callout for +7d P99 Weak Performance */}
              <div
                style={{
                  marginTop: '16px',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  color: '#991B1B',
                  fontSize: '11.5px',
                  lineHeight: '1.5',
                }}
              >
                <strong>P99 +7-Day Performance Limitation:</strong> Detecting rare 99th-percentile events 7 days in advance has high uncertainty (AUPRC 0.066, recall 10.4%). It should not be used as an automated flood evacuation trigger without hydrologist verification.
              </div>
            </div>

            {/* Expandable Section: Detailed Hydrological Metrics */}
            <details
              style={{
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                padding: '16px 20px',
              }}
            >
              <summary style={{ cursor: 'pointer', fontSize: '13px', fontWeight: 700, color: 'var(--blue)', outline: 'none' }}>
                ▸ Detailed benchmark tables (RMSE, NSE, Brier score, and calibration ECE)
              </summary>
              <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '6px' }}>
                    Catchment-Macro Regression Performance (MultiTask_LSTM vs Persistence)
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                        <th style={{ padding: '6px 10px' }}>Horizon</th>
                        <th style={{ padding: '6px 10px' }}>Model</th>
                        <th style={{ padding: '6px 10px' }}>Basins</th>
                        <th style={{ padding: '6px 10px' }}>Average Error MAE (mm/d)</th>
                        <th style={{ padding: '6px 10px' }}>RMSE (mm/d)</th>
                        <th style={{ padding: '6px 10px' }}>Macro NSE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics?.macro_regression?.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '6px 10px', fontWeight: 700 }}>{row.horizon}</td>
                          <td style={{ padding: '6px 10px', color: row.model === 'MultiTask_LSTM' ? 'var(--blue)' : 'var(--text-2)', fontWeight: row.model === 'MultiTask_LSTM' ? 700 : 400 }}>{row.model}</td>
                          <td style={{ padding: '6px 10px', fontFamily: 'var(--font-mono)' }}>{row.catchments}</td>
                          <td style={{ padding: '6px 10px', fontFamily: 'var(--font-mono)' }}>{row.macro_MAE.toFixed(4)}</td>
                          <td style={{ padding: '6px 10px', fontFamily: 'var(--font-mono)' }}>{row.macro_RMSE.toFixed(4)}</td>
                          <td style={{ padding: '6px 10px', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{row.macro_NSE.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </details>
          </div>
        )}

        {/* ─── TAB 5: RESEARCH SCOPE & DATA ──────────────────────────── */}
        {activeTab === 'provenance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-1)' }}>
                Research Scope & Data Provenance
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '2px' }}>
                Complete specifications of the CAMELS-BR dataset, evaluation methodology, and operational boundaries.
              </div>
            </div>

            {/* Dataset Breakdown Cards (Part 4 requirement) */}
            <div style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--blue)', marginBottom: '4px' }}>
                CAMELS-BR v1.2 Dataset Partition (897 Monitored River Basins)
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-2)', marginBottom: '14px' }}>
                Evaluation group strategy: <strong>Geographic cluster holdout</strong> (spatially separated test basins).
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div style={{ background: 'var(--bg-elevated)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase' }}>Total Basins</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-1)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>897</div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-2)', marginTop: '2px' }}>Full CAMELS-BR network</div>
                </div>

                <div style={{ background: 'var(--bg-elevated)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '11px', color: '#2563EB', textTransform: 'uppercase' }}>Training Basins</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#1D4ED8', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>552</div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-2)', marginTop: '2px' }}>Used for neural network fitting</div>
                </div>

                <div style={{ background: 'var(--bg-elevated)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '11px', color: '#7C3AED', textTransform: 'uppercase' }}>Validation Basins</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#6D28D9', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>118</div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-2)', marginTop: '2px' }}>Platt scaler fitting & tuning</div>
                </div>

                <div style={{ background: 'var(--bg-elevated)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '11px', color: '#059669', textTransform: 'uppercase' }}>Test Holdout Basins</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#047857', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>118</div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-2)', marginTop: '2px' }}>115 threshold-eligible basins</div>
                </div>
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: '1.5', marginTop: '14px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                <strong>Test Basin Evaluation Protocol:</strong> During out-of-sample evaluation on test basins, the previous 30 days of observed historical data are provided as inputs to project future flow, even though the basin itself was strictly withheld during model parameter training.
              </div>
            </div>

            {/* Scientific Claims and Operational Boundaries (Part 5 requirement) */}
            <div style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#DC2626', marginBottom: '8px' }}>
                Scientific Operational Boundaries & What the Model Does Not Do
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }}>
                <div style={{ background: 'var(--bg-elevated)', padding: '12px 14px', borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--text-2)', lineHeight: '1.5' }}>
                  <strong style={{ color: 'var(--text-1)' }}>1. No Flood Inundation or Depth Prediction:</strong> The model projects river flow volume (discharge in mm/day at the gauge). It does not compute water surface elevations or inundation depths.
                </div>

                <div style={{ background: 'var(--bg-elevated)', padding: '12px 14px', borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--text-2)', lineHeight: '1.5' }}>
                  <strong style={{ color: 'var(--text-1)' }}>2. No Street-Level Flood Mapping:</strong> The model cannot simulate urban street flooding, storm drain backups, or localized levee failures.
                </div>

                <div style={{ background: 'var(--bg-elevated)', padding: '12px 14px', borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--text-2)', lineHeight: '1.5' }}>
                  <strong style={{ color: 'var(--text-1)' }}>3. Not a Future Weather Model:</strong> The architecture conditions purely on past 30-day observations of flow, rainfall, and temperature; it does not forecast future precipitation.
                </div>

                <div style={{ background: 'var(--bg-elevated)', padding: '12px 14px', borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--text-2)', lineHeight: '1.5' }}>
                  <strong style={{ color: 'var(--text-1)' }}>4. Statistical Reference Levels, Not Flood Warnings:</strong> P95 and P99 represent historical statistical percentiles for each gauge, not certified public evacuation alarms.
                </div>

                <div style={{ background: 'var(--bg-elevated)', padding: '12px 14px', borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--text-2)', lineHeight: '1.5' }}>
                  <strong style={{ color: 'var(--text-1)' }}>5. No Formal Prediction Intervals:</strong> The model generates point forecasts and calibrated exceedance probabilities, but formal statistical confidence intervals are not yet available.
                </div>

                <div style={{ background: 'var(--bg-elevated)', padding: '12px 14px', borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--text-2)', lineHeight: '1.5' }}>
                  <strong style={{ color: 'var(--text-1)' }}>6. Regional Evaluation, Not Global Validation:</strong> The model was trained and evaluated strictly on Brazilian river basins in CAMELS-BR; it is not globally validated.
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
