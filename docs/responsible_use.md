# FLOODCAST — Responsible AI & Operational Safety Statement

**System Name:** FLOODCAST (Integrated BASINSHIFT Streamflow & Flood Hazard Platform)  
**Model:** `BasinShiftMultiTask` (PyTorch)  
**Scope:** Research prototype and scientific benchmarking platform for 897 monitored river basins in Brazil (CAMELS-BR v1.2).  
**Effective Date:** November 5, 2026  

---

## 1. Operational Mandate & Core Disclosures

> [!CAUTION]
> **NOT A REAL-TIME OPERATIONAL EMERGENCY WARNING SYSTEM**
> FLOODCAST is an academic and research engineering benchmark. It is designed to evaluate deep learning rainfall-runoff residual forecasting and statistical exceedance calibration under out-of-cluster spatial transfer.
> **Under no circumstances should FLOODCAST predictions be used as the sole or primary basis for civil defense evacuations, emergency response deployments, dam operations, or life-critical decisions.**

---

## 2. Specific Functional Boundaries: What the System Does NOT Do

1. **No Inundation Mapping or Water Depth Computation:**
   FLOODCAST predicts river volume runoff rate (specific discharge in millimeters per day, $\text{mm}/\text{day}$) at the gauge cross-section. It does **not** solve 2D shallow water equations, hydrodynamics, flood extent boundaries, or street-level water depths.
2. **No Street-Level / Asset Risk Assessment:**
   The model does not incorporate urban topography, culverts, drainage systems, or building footprints. It cannot predict neighborhood-level basement flooding or road overtopping.
3. **Not a Weather Simulator:**
   The model conditions exclusively on antecedent (past 30 days) observed streamflow, precipitation, and temperature. It does not predict future meteorological storm tracks or atmospheric convective systems.
4. **Statistical Percentiles vs Legal Flood Stages:**
   The predicted P95 and P99 event probabilities represent historical statistical percentiles derived from the 1980–2000 climatological reference period. They do not correlate automatically with local civil protection "alert", "warning", or "evacuation" river stages established by municipal authorities.
5. **No Universal Mathematical Guarantees:**
   While validation-derived empirical error quantiles achieve nominal ~90% and ~95% coverage on average, individual catchment coverage varies from 68% to 100% due to hydrological spatial heterogeneity across biomes.

---

## 3. Lead-Time Uncertainty Advisory

- **+1 Day Horizon (24 hours):**
  - Continuous streamflow Macro MAE = $0.105\text{ mm/day}$ (NSE = $0.840$).
  - High-flow P95 detection AUPRC = $0.584$ (Recall = $68.8\%$).
  - **Operational Status:** High statistical confidence for near-term hydrological monitoring.
- **+3 Day Horizon (72 hours):**
  - Continuous streamflow Macro MAE = $0.185\text{ mm/day}$ (NSE = $0.654$).
  - High-flow P95 detection AUPRC = $0.420$ (Recall = $61.4\%$).
  - **Operational Status:** Moderate statistical confidence; suitable for situational awareness.
- **+7 Day Horizon (168 hours):**
  - Rare P99 extreme event detection yields **AUPRC = 0.066** and **Recall = 10.4%**.
  - **Operational Status: HIGH UNCERTAINTY — ADVISORY ONLY.** Due to precipitation decay and hydrological memory limits, 7-day rare event forecasts carry high false alarm rates and must be treated purely as speculative hydrological projections.

---

## 4. Policy on Missing and Degraded Inputs

1. **Zero Hallucination Tolerance:**
   If any day in the 30-day antecedent sequence is missing or non-finite, the API rejects the request with HTTP 400.
2. **No Silent Synthetic Filling:**
   The system will not silently fabricate or forward-fill missing historical telemetry.
3. **Gauge Latency Degradation:**
   If telemetry is delayed by 24–48 hours, forecast error increases by $+19\%$ to $+38\%$. Telemetry latency must be explicitly logged in batch metadata.

