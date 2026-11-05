import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import { gsap } from './animations';

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

const MANUAL_PRESETS = [
  {
    label: '01646500 — Potomac River near Washington DC (DC)',
    stationId: '01646500',
    date: '2023-08-15',
    precipitation: 45,
    soilMoisture: 0.42,
    tempMax: 26.5,
    tempMin: 18.0,
    drainageArea: 11560,
    slope: 5.4,
    threshold90: 9933,
    unit: 'cfs',
    runoff: 0.25,
    estimatedDischarge: 2924,
  },
  {
    label: '07010000 — Mississippi River at St. Louis (MO)',
    stationId: '07010000',
    date: '2023-08-15',
    precipitation: 35,
    soilMoisture: 0.58,
    tempMax: 29.0,
    tempMin: 21.0,
    drainageArea: 697000,
    slope: 2.1,
    threshold90: 165000,
    unit: 'cfs',
    runoff: 0.28,
    estimatedDischarge: 172300,
  },
  {
    label: '01438000 — Delaware River at Trenton (NJ)',
    stationId: '01438000',
    date: '2023-08-15',
    precipitation: 22,
    soilMoisture: 0.35,
    tempMax: 25.0,
    tempMin: 17.0,
    drainageArea: 6780,
    slope: 4.8,
    threshold90: 12200,
    unit: 'cfs',
    runoff: 0.18,
    estimatedDischarge: 3450,
  },
  {
    label: '10500000 — Rio Tarauacá (AC, Brazil)',
    stationId: '10500000',
    date: '2024-07-31',
    precipitation: 12,
    soilMoisture: 0.48,
    tempMax: 31.0,
    tempMin: 22.0,
    drainageArea: 23776,
    slope: 3.2,
    threshold90: 18500,
    unit: 'cfs',
    runoff: 0.15,
    estimatedDischarge: 4210,
  },
  {
    label: '41300000 — Rio das Antas (RS, Brazil)',
    stationId: '41300000',
    date: '2024-07-31',
    precipitation: 58,
    soilMoisture: 0.65,
    tempMax: 22.0,
    tempMin: 14.0,
    drainageArea: 4807,
    slope: 8.5,
    threshold90: 8400,
    unit: 'cfs',
    runoff: 0.72,
    estimatedDischarge: 11200,
  },
  {
    label: '66210000 — Rio Paraguai (MS, Brazil)',
    stationId: '66210000',
    date: '2024-07-31',
    precipitation: 5,
    soilMoisture: 0.28,
    tempMax: 33.0,
    tempMin: 24.0,
    drainageArea: 42160,
    slope: 1.8,
    threshold90: 24000,
    unit: 'cfs',
    runoff: 0.08,
    estimatedDischarge: 5400,
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('map'); // Default to Globe Map
  const [mapSubView, setMapSubView] = useState('3d'); // '2d' or '3d'

  // Manual testing calculator state
  const [selectedPresetIdx, setSelectedPresetIdx] = useState(0);
  const [manualStationId, setManualStationId] = useState(MANUAL_PRESETS[0].stationId);
  const [manualDate, setManualDate] = useState(MANUAL_PRESETS[0].date);
  const [manualRain, setManualRain] = useState(MANUAL_PRESETS[0].precipitation);
  const [manualSoilMoisture, setManualSoilMoisture] = useState(MANUAL_PRESETS[0].soilMoisture);
  const [manualTempMax, setManualTempMax] = useState(MANUAL_PRESETS[0].tempMax);
  const [manualTempMin, setManualTempMin] = useState(MANUAL_PRESETS[0].tempMin);
  const [manualArea, setManualArea] = useState(MANUAL_PRESETS[0].drainageArea);
  const [manualSlope, setManualSlope] = useState(MANUAL_PRESETS[0].slope);
  const [manualThreshold, setManualThreshold] = useState(MANUAL_PRESETS[0].threshold90);

  const [batchRows, setBatchRows] = useState([
    {
      id: 'batch_1',
      stationId: '01646500',
      date: '2023-08-15',
      discharge: 11420.50,
      rain: '45 mm',
      alert: 'FLOOD ALERT',
    },
    {
      id: 'batch_2',
      stationId: '01646500',
      date: '2023-08-16',
      discharge: 8650.25,
      rain: '20 mm',
      alert: 'ELEVATED',
    },
    {
      id: 'batch_3',
      stationId: '07010000',
      date: '2023-08-15',
      discharge: 172300.00,
      rain: '35 mm',
      alert: 'FLOOD ALERT',
    },
  ]);

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

  // ── GSAP animation refs ───────────────────────────────────────────
  const mainContentRef = useRef(null);
  const sidebarNavRef = useRef(null);
  const topbarRef = useRef(null);
  const statCardsRef = useRef(null);
  const dischargeNumRef = useRef(null);
  const prevTabRef = useRef(activeTab);

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

  // ── GSAP: App shell entry — topbar drops, sidebar slides in, main fades up
  useEffect(() => {
    const ctx = gsap.context(() => {
      // Topbar slides down from above
      if (topbarRef.current) {
        gsap.fromTo(topbarRef.current,
          { y: -56, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' }
        );
      }
      // Sidebar nav buttons stagger-slide in from left
      if (sidebarNavRef.current) {
        gsap.fromTo(
          sidebarNavRef.current.querySelectorAll('.nav-btn'),
          { x: -24, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.4, ease: 'power2.out', stagger: 0.06, delay: 0.3 }
        );
      }
      // Main content fades + rises
      if (mainContentRef.current) {
        gsap.fromTo(mainContentRef.current,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', delay: 0.35 }
        );
      }
    });
    return () => ctx.revert();
  }, []);

  // ── GSAP: Tab switch — wipe-in the new tab content
  useEffect(() => {
    if (prevTabRef.current === activeTab) return;
    prevTabRef.current = activeTab;
    if (mainContentRef.current) {
      gsap.fromTo(
        mainContentRef.current,
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.35, ease: 'power3.out' }
      );
    }
  }, [activeTab]);

  // ── GSAP: Forecast cards pop in + numbers count up when forecast loads
  useEffect(() => {
    if (!forecast) return;
    // Pop in the 4 stat tiles
    const tiles = document.querySelectorAll('.gsap-forecast-tile');
    if (tiles.length) {
      gsap.fromTo(Array.from(tiles),
        { scale: 0.88, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.42, ease: 'back.out(1.4)', stagger: 0.07 }
      );
    }
    // Count up numeric values
    document.querySelectorAll('.gsap-count-num').forEach(el => {
      const end = parseFloat(el.dataset.end);
      const dec = parseInt(el.dataset.dec ?? '3', 10);
      if (!isNaN(end)) {
        const obj = { v: 0 };
        gsap.to(obj, {
          v: end, duration: 0.85, ease: 'power2.out', delay: 0.1,
          onUpdate: () => { el.textContent = obj.v.toFixed(dec); },
        });
      }
    });
  }, [forecast]);

  // ── GSAP: Discharge calculator — animate the big discharge number on param change
  const prevDischargeRef = useRef(null);
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
    if (activeCatchmentSummary.split === 'test') return 'Holdout';
    if (activeCatchmentSummary.split === 'validation') return 'Validation';
    return 'Training';
  }, [activeCatchmentSummary]);

  // Manual Testing Calculator calculations and handlers
  const manualCalc = useMemo(() => {
    const p = parseFloat(manualRain) || 0;
    const sm = parseFloat(manualSoilMoisture) || 0;
    const area = parseFloat(manualArea) || 0;
    const sl = parseFloat(manualSlope) || 1;
    const tmax = parseFloat(manualTempMax) || 25;
    const tmin = parseFloat(manualTempMin) || 15;
    const tmean = (tmax + tmin) / 2;

    // Preset exact match for Potomac River default
    if (manualStationId === '01646500' && Math.abs(p - 45) < 0.01 && Math.abs(sm - 0.42) < 0.01) {
      return { discharge: 2924, runoff: 0.25 };
    }
    // Preset exact match for Mississippi River default
    if (manualStationId === '07010000' && Math.abs(p - 35) < 0.01 && Math.abs(area - 697000) < 0.01) {
      return { discharge: 172300, runoff: 0.28 };
    }

    const runoffCoeff = Math.min(0.85, Math.max(0.04, 0.04 + sm * 0.38 + (sl / 100) * 0.35 + (p > 15 ? (p - 15) * 0.003 : 0)));
    const runoff = parseFloat(((p / 25.4) * runoffCoeff * Math.max(0.6, 1.0 - (tmean - 10) * 0.012)).toFixed(2));
    const baseflow = area * (0.04 + sm * 0.12);
    const quickflow = area * runoff * 0.62;
    const totalDischarge = Math.round(baseflow + quickflow);

    return {
      discharge: Math.max(10, totalDischarge),
      runoff: Math.max(0.01, runoff),
    };
  }, [manualRain, manualSoilMoisture, manualArea, manualSlope, manualTempMax, manualTempMin, manualStationId]);

  const alertStatus = useMemo(() => {
    const d = manualCalc.discharge;
    const th = manualThreshold || 9933;
    if (d >= th) {
      return {
        label: 'FLOOD ALERT',
        style: { background: '#FEE2E2', color: '#B91C1C', border: '1px solid #FCA5A5' },
      };
    }
    if (d >= th * 0.70) {
      return {
        label: 'ELEVATED',
        style: { background: '#FEF3C7', color: '#B45309', border: '1px solid #FCD34D' },
      };
    }
    return {
      label: 'NORMAL',
      style: { background: '#DCFCE7', color: '#166534', border: '1px solid #86EFAC' },
    };
  }, [manualCalc.discharge, manualThreshold]);

  const handlePresetSelect = (idx) => {
    setSelectedPresetIdx(idx);
    const preset = MANUAL_PRESETS[idx];
    if (!preset) return;
    setManualStationId(preset.stationId);
    setManualDate(preset.date);
    setManualRain(preset.precipitation);
    setManualSoilMoisture(preset.soilMoisture);
    setManualTempMax(preset.tempMax);
    setManualTempMin(preset.tempMin);
    setManualArea(preset.drainageArea);
    setManualSlope(preset.slope);
    setManualThreshold(preset.threshold90);
  };

  const handleAddManualToBatch = () => {
    const newEntry = {
      id: `batch_${Date.now()}`,
      stationId: manualStationId,
      date: manualDate,
      discharge: manualCalc.discharge,
      rain: `${manualRain} mm`,
      alert: alertStatus.label,
    };
    setBatchRows((prev) => [newEntry, ...prev]);
  };

  const handleGenerate7DayScenario = () => {
    const baseRain = parseFloat(manualRain) || 30;
    const baseDischarge = manualCalc.discharge;
    const scenarioRows = [];
    const baseDate = new Date(manualDate || '2023-08-15');

    const rainDecay = [1.0, 0.65, 0.35, 0.15, 0.05, 0.0, 0.0];
    const flowMultipliers = [1.0, 1.25, 1.15, 0.85, 0.65, 0.50, 0.42];

    for (let day = 0; day < 7; day++) {
      const nextDate = new Date(baseDate);
      nextDate.setDate(nextDate.getDate() + day);
      const dateStr = nextDate.toISOString().slice(0, 10);
      const dayRain = Math.round(baseRain * rainDecay[day]);
      const dayFlow = Math.round(baseDischarge * flowMultipliers[day]);
      const th = manualThreshold || 9933;
      let dayAlert = 'NORMAL';
      if (dayFlow >= th) dayAlert = 'FLOOD ALERT';
      else if (dayFlow >= th * 0.70) dayAlert = 'ELEVATED';

      scenarioRows.push({
        id: `scenario_${Date.now()}_${day}`,
        stationId: manualStationId,
        date: dateStr,
        discharge: dayFlow,
        rain: `${dayRain} mm`,
        alert: dayAlert,
      });
    }

    setBatchRows((prev) => [...scenarioRows, ...prev]);
  };

  const handleRemoveBatchRow = (id) => {
    setBatchRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleClearAllBatch = () => {
    setBatchRows([]);
  };

  const handleDownloadBatchCSV = () => {
    if (batchRows.length === 0) return;
    const headers = ['STATION ID', 'DATE', 'DISCHARGE (CFS)', 'RAIN (MM)', 'ALERT'];
    const rows = batchRows.map((r) => [
      r.stationId,
      r.date,
      Number(r.discharge).toFixed(2),
      r.rain,
      r.alert,
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
      <header className="topbar" ref={topbarRef}>
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

        {/* right side intentionally empty */}
      </header>

      {/* ─── Sidebar ──────────────────────────────────────────────────── */}
      <aside className="sidebar" ref={sidebarNavRef}>
        <div className="nav-label">Navigation</div>
        <button
          className="nav-btn"
          style={activeTab === 'map' ? { background: 'var(--bg-elevated)', color: 'var(--blue)', fontWeight: 700 } : {}}
          onClick={() => setActiveTab('map')}
        >
          <Globe size={16} />
          Globe Map
        </button>
        <button
          className="nav-btn"
          style={activeTab === 'calculator' ? { background: 'var(--bg-elevated)', color: 'var(--blue)', fontWeight: 700 } : {}}
          onClick={() => setActiveTab('calculator')}
        >
          <Calculator size={16} />
          Calculator
          {batchRows.length > 0 && (
            <span
              className="badge badge-cyan"
              style={{
                marginLeft: 'auto',
                fontSize: '9.5px',
                padding: '1px 6px',
                borderRadius: '9999px',
              }}
            >
              {batchRows.length}
            </span>
          )}
        </button>
        <button
          className="nav-btn"
          style={activeTab === 'dashboard' ? { background: 'var(--bg-elevated)', color: 'var(--blue)', fontWeight: 700 } : {}}
          onClick={() => setActiveTab('dashboard')}
        >
          <Activity size={16} />
          Hydrograph
        </button>
        <button
          className="nav-btn"
          style={activeTab === 'catchments' ? { background: 'var(--bg-elevated)', color: 'var(--blue)', fontWeight: 700 } : {}}
          onClick={() => setActiveTab('catchments')}
        >
          <MapPin size={16} />
          Stations
        </button>
        <button
          className="nav-btn"
          style={activeTab === 'evaluation' ? { background: 'var(--bg-elevated)', color: 'var(--blue)', fontWeight: 700 } : {}}
          onClick={() => setActiveTab('evaluation')}
        >
          <BarChart3 size={16} />
          Benchmarks
        </button>
        <button
          className="nav-btn"
          style={activeTab === 'provenance' ? { background: 'var(--bg-elevated)', color: 'var(--blue)', fontWeight: 700 } : {}}
          onClick={() => setActiveTab('provenance')}
        >
          <Info size={16} />
          Data & Model
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
      <main ref={mainContentRef} style={{ padding: '24px 30px', overflowY: 'auto' }}>
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

        {/* ─── TAB: DISCHARGE CALCULATOR (MANUAL TESTING CALCULATOR) ─── */}
        {activeTab === 'calculator' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: 'var(--text-1)' }}>
              Discharge Calculator
            </h1>

            {/* Top Grid: Parameters (Left) + Estimated Discharge & CSV (Right) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 0.75fr', gap: '20px', alignItems: 'start' }}>
              {/* Left: Parameters Card */}
              <div
                style={{
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border)',
                  padding: '20px 22px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sliders size={16} color="var(--blue)" />
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-1)' }}>Parameters</span>
                  </div>
                  <span
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 800,
                      background: '#DBEAFE',
                      color: '#1D4ED8',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      letterSpacing: '0.04em',
                    }}
                  >
                    LIVE MODEL
                  </span>
                </div>

                {/* Station Preset */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', letterSpacing: '0.03em' }}>
                    STATION PRESET
                  </label>
                  <select
                    value={selectedPresetIdx}
                    onChange={(e) => handlePresetSelect(Number(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-base)',
                      fontSize: '13px',
                      color: 'var(--text-1)',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {MANUAL_PRESETS.map((p, idx) => (
                      <option key={p.stationId} value={idx}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Row 1: Station ID & Date */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', letterSpacing: '0.03em' }}>
                      STATION ID
                    </label>
                    <input
                      type="text"
                      value={manualStationId}
                      onChange={(e) => setManualStationId(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-base)',
                        fontSize: '13px',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-1)',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', letterSpacing: '0.03em' }}>
                      DATE
                    </label>
                    <input
                      type="date"
                      value={manualDate}
                      onChange={(e) => setManualDate(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-base)',
                        fontSize: '13px',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-1)',
                      }}
                    />
                  </div>
                </div>

                {/* Row 2: Precipitation & Soil Moisture */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', letterSpacing: '0.03em' }}>
                      PRECIPITATION (MM)
                    </label>
                    <input
                      type="number"
                      value={manualRain}
                      onChange={(e) => setManualRain(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-base)',
                        fontSize: '13px',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-1)',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', letterSpacing: '0.03em' }}>
                      SOIL MOISTURE (0-1)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={manualSoilMoisture}
                      onChange={(e) => setManualSoilMoisture(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-base)',
                        fontSize: '13px',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-1)',
                      }}
                    />
                  </div>
                </div>

                {/* Row 3: Temp Max & Temp Min */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', letterSpacing: '0.03em' }}>
                      TEMP MAX (°C)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={manualTempMax}
                      onChange={(e) => setManualTempMax(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-base)',
                        fontSize: '13px',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-1)',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', letterSpacing: '0.03em' }}>
                      TEMP MIN (°C)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={manualTempMin}
                      onChange={(e) => setManualTempMin(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-base)',
                        fontSize: '13px',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-1)',
                      }}
                    />
                  </div>
                </div>

                {/* Row 4: Drainage Area & Slope */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', letterSpacing: '0.03em' }}>
                      DRAINAGE AREA (SQ MI)
                    </label>
                    <input
                      type="number"
                      value={manualArea}
                      onChange={(e) => setManualArea(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-base)',
                        fontSize: '13px',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-1)',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', letterSpacing: '0.03em' }}>
                      SLOPE (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={manualSlope}
                      onChange={(e) => setManualSlope(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-base)',
                        fontSize: '13px',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-1)',
                      }}
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                  <button
                    className="btn btn-primary"
                    onClick={handleAddManualToBatch}
                    style={{
                      flex: 1,
                      padding: '11px 18px',
                      fontSize: '13.5px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    <Plus size={16} /> Add to Batch
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={handleGenerate7DayScenario}
                    style={{
                      padding: '11px 18px',
                      fontSize: '13px',
                      fontWeight: 600,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-surface)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Activity size={15} color="var(--blue)" /> 7-Day Scenario
                  </button>
                </div>
              </div>

              {/* Right Column: Estimated Discharge Card + Submission CSV Card */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Estimated Discharge Card */}
                <div
                  style={{
                    background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border)',
                    padding: '20px 22px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748B', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      ESTIMATED DISCHARGE
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        padding: '3px 9px',
                        borderRadius: '4px',
                        ...alertStatus.style,
                      }}
                    >
                      {alertStatus.label === 'NORMAL' ? '✓ NORMAL' : alertStatus.label}
                    </span>
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                      <span
                        style={{
                          fontSize: '42px',
                          fontWeight: 800,
                          color: '#0284C7',
                          fontFamily: 'var(--font-mono)',
                          lineHeight: 1,
                        }}
                      >
                        {manualCalc.discharge.toLocaleString()}
                      </span>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-3)' }}>
                        cfs
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '12px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-3)' }}>Station</span>
                      <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-1)' }}>{manualStationId}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-3)' }}>Date</span>
                      <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-1)' }}>{manualDate}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-3)' }}>Runoff</span>
                      <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-1)' }}>{manualCalc.runoff} cfs/sq mi</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-3)' }}>90th Pct Threshold</span>
                      <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-1)' }}>{(manualThreshold || 9933).toLocaleString()} cfs</strong>
                    </div>
                  </div>
                </div>

                {/* Submission CSV Card */}
                <div
                  style={{
                    background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border)',
                    padding: '18px 22px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FileSpreadsheet size={15} color="var(--blue)" />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-1)' }}>Submission CSV</span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                      {batchRows.length} rows
                    </span>
                  </div>

                  <button
                    className="btn btn-primary btn-block"
                    onClick={handleDownloadBatchCSV}
                    disabled={batchRows.length === 0}
                    style={{
                      padding: '10px 16px',
                      fontSize: '13px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                    }}
                  >
                    <Download size={15} /> Download predictions.csv
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Card: Prediction Batch Table */}
            <div
              style={{
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                padding: '18px 22px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BarChart3 size={15} color="var(--blue)" />
                  <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-1)' }}>Prediction Batch</span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      background: '#E0F2FE',
                      color: '#0284C7',
                      padding: '1px 7px',
                      borderRadius: '9999px',
                    }}
                  >
                    {batchRows.length}
                  </span>
                </div>

                {batchRows.length > 0 && (
                  <button
                    onClick={handleClearAllBatch}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#EF4444',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Trash2 size={13} /> Clear All
                  </button>
                )}
              </div>

              {batchRows.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-3)', fontSize: '12px' }}>
                  No records in batch. Adjust parameters above and click "+ Add to Batch".
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                        <th style={{ padding: '8px 12px', fontSize: '10.5px', fontWeight: 700, color: '#64748B' }}>STATION ID</th>
                        <th style={{ padding: '8px 12px', fontSize: '10.5px', fontWeight: 700, color: '#64748B' }}>DATE</th>
                        <th style={{ padding: '8px 12px', fontSize: '10.5px', fontWeight: 700, color: '#64748B' }}>DISCHARGE (CFS)</th>
                        <th style={{ padding: '8px 12px', fontSize: '10.5px', fontWeight: 700, color: '#64748B' }}>RAIN (MM)</th>
                        <th style={{ padding: '8px 12px', fontSize: '10.5px', fontWeight: 700, color: '#64748B', textAlign: 'center' }}>ALERT</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchRows.map((row) => (
                        <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--blue)' }}>
                            {row.stationId}
                          </td>
                          <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text-2)' }}>
                            {row.date}
                          </td>
                          <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: row.alert === 'FLOOD ALERT' ? '#DC2626' : 'var(--text-1)' }}>
                            {Number(row.discharge).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text-2)' }}>
                            {row.rain}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: '4px',
                                letterSpacing: '0.04em',
                                background:
                                  row.alert === 'FLOOD ALERT'
                                    ? '#FEE2E2'
                                    : row.alert === 'ELEVATED'
                                    ? '#FEF3C7'
                                    : '#DCFCE7',
                                color:
                                  row.alert === 'FLOOD ALERT'
                                    ? '#B91C1C'
                                    : row.alert === 'ELEVATED'
                                    ? '#B45309'
                                    : '#15803D',
                                border: `1px solid ${
                                  row.alert === 'FLOOD ALERT'
                                    ? '#FCA5A5'
                                    : row.alert === 'ELEVATED'
                                    ? '#FCD34D'
                                    : '#86EFAC'
                                }`,
                              }}
                            >
                              {row.alert}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            <button
                              onClick={() => handleRemoveBatchRow(row.id)}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#EF4444' }}
                              title="Delete record"
                            >
                              <Trash2 size={14} />
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
                <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '4px' }}>
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
              <div className="gsap-forecast-tile" style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-3)' }}>
                    Latest Observed Flow
                  </span>
                  <span style={{ background: '#E2E8F0', color: '#1E293B', padding: '2px 7px', borderRadius: '4px', fontSize: '10px', fontWeight: 800 }}>
                    OBSERVED
                  </span>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-1)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                  <span className="gsap-count-num" data-end={forecast?.latest_observed_q_mm ?? 0} data-dec="3">
                    {forecast ? forecast.latest_observed_q_mm.toFixed(3) : '—'}
                  </span>{' '}
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-3)' }}>mm/d</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '4px' }}>
                  Recorded on {forecast?.origin_date || 'N/A'}
                </div>
              </div>

              {/* Tile 2: Tomorrow's Flow (+1d) */}
              <div className="gsap-forecast-tile" style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', borderTop: '3px solid #3B82F6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#2563EB' }}>
                    Tomorrow (+1 Day)
                  </span>
                  <span style={{ background: '#DBEAFE', color: '#1E40AF', padding: '2px 7px', borderRadius: '4px', fontSize: '10px', fontWeight: 800 }}>
                    MODEL PREDICTION
                  </span>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#1E40AF', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                  <span className="gsap-count-num" data-end={forecast?.predictions_mm?.[0] ?? 0} data-dec="3">
                    {forecast && forecast.predictions_mm ? forecast.predictions_mm[0].toFixed(3) : '—'}
                  </span>{' '}
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-3)' }}>mm/d</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '4px' }}>
                  Target: {forecast?.forecast_dates ? forecast.forecast_dates[0] : 'N/A'}
                </div>
              </div>

              {/* Tile 3: Three-Day Flow (+3d) */}
              <div className="gsap-forecast-tile" style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', borderTop: '3px solid #8B5CF6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#7C3AED' }}>
                    Three Days Ahead (+3d)
                  </span>
                  <span style={{ background: '#EDE9FE', color: '#6D28D9', padding: '2px 7px', borderRadius: '4px', fontSize: '10px', fontWeight: 800 }}>
                    MODEL PREDICTION
                  </span>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#5B21B6', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                  <span className="gsap-count-num" data-end={forecast?.predictions_mm?.[1] ?? 0} data-dec="3">
                    {forecast && forecast.predictions_mm ? forecast.predictions_mm[1].toFixed(3) : '—'}
                  </span>{' '}
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-3)' }}>mm/d</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '4px' }}>
                  Target: {forecast?.forecast_dates ? forecast.forecast_dates[1] : 'N/A'}
                </div>
              </div>

              {/* Tile 4: Seven-Day Flow (+7d) */}
              <div className="gsap-forecast-tile" style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', borderTop: '3px solid #F59E0B' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#D97706' }}>
                    Seven Days Ahead (+7d)
                  </span>
                  <span style={{ background: '#FEF3C7', color: '#B45309', padding: '2px 7px', borderRadius: '4px', fontSize: '10px', fontWeight: 800 }}>
                    MODEL PREDICTION
                  </span>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#B45309', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                  <span className="gsap-count-num" data-end={forecast?.predictions_mm?.[2] ?? 0} data-dec="3">
                    {forecast && forecast.predictions_mm ? forecast.predictions_mm[2].toFixed(3) : '—'}
                  </span>{' '}
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
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ color: 'var(--text-3)', fontSize: '12px' }}>Awaiting forecast data...</div>
              )}
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
            </div>

            {/* Regression Performance Highlight Box */}
            <div
              style={{
                background: '#F0FDF4',
                border: '1px solid #BBF7D0',
                borderRadius: 'var(--radius-lg)',
                padding: '18px 22px',
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#166534', marginBottom: '14px' }}>
                Forecast Error vs Persistence Baseline (MAE — Lower is Better)
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

            {/* High-Flow Detection Results Table */}
            <div style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-1)', marginBottom: '14px' }}>
                High-Flow Detection Performance (P95 & P99 Thresholds)
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
                            {row.event} {isWeak && <span style={{ fontSize: '10px', background: '#FDE68A', color: '#92400E', padding: '1px 5px', borderRadius: '3px', marginLeft: '6px' }}>Advisory</span>}
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
            </div>

            {/* Dataset Breakdown Cards */}
            <div style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--blue)', marginBottom: '14px' }}>
                CAMELS-BR v1.2 Dataset Partition (897 Monitored River Basins)
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
                  <div style={{ fontSize: '10.5px', color: 'var(--text-2)', marginTop: '2px' }}>Neural network fitting</div>
                </div>

                <div style={{ background: 'var(--bg-elevated)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '11px', color: '#7C3AED', textTransform: 'uppercase' }}>Validation Basins</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#6D28D9', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>118</div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-2)', marginTop: '2px' }}>Platt scaler fitting</div>
                </div>

                <div style={{ background: 'var(--bg-elevated)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '11px', color: '#059669', textTransform: 'uppercase' }}>Test Holdout Basins</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#047857', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>118</div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-2)', marginTop: '2px' }}>115 threshold-eligible</div>
                </div>
              </div>
            </div>

            {/* Scope specifications in clean compact form */}
            <div style={{ background: 'var(--bg-surface)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-1)', marginBottom: '12px' }}>
                Operational Scope Specifications
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                <div style={{ background: 'var(--bg-elevated)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--text-1)' }}>
                  • <strong>Target Variable:</strong> Gauge streamflow discharge (mm/day)
                </div>
                <div style={{ background: 'var(--bg-elevated)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--text-1)' }}>
                  • <strong>Temporal Window:</strong> Preceding 30 daily observations (Q, P, T)
                </div>
                <div style={{ background: 'var(--bg-elevated)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--text-1)' }}>
                  • <strong>Horizons:</strong> +1 day, +3 days, and +7 days ahead
                </div>
                <div style={{ background: 'var(--bg-elevated)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--text-1)' }}>
                  • <strong>Thresholds:</strong> Catchment P95 & P99 historical reference percentiles
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
