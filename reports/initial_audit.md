# FLOODCAST — Initial Project Audit and Baseline Inventory

**Audit Date:** November 5, 2026  
**Auditor:** Lead ML & Hydrological Data Engineering Team  
**Git Checkpoint Tag:** `checkpoint-pre-audit-59121c7`  
**Git Working Branch:** `audit/eval-readiness` (preserving `main` at `59121c7`)

---

## 1. Executive Summary & Purpose

This audit establishes a frozen technical baseline for the FLOODCAST operational streamflow and flood forecasting platform. The application couples a trained deep multi-task hydrological model (**BasinShiftMultiTask**) with an interactive React/Vite dashboard and a FastAPI backend service.

This audit independently validates the model architecture, parameter weights, feature transformations, dataset partitions, calibration pipelines, REST endpoints, and test coverage before executing technical hardening and validation.

---

## 2. Existing Architecture Overview

The system consists of three decoupled operational tiers:

```
┌─────────────────────────────────────────────────────────────┐
│                 React 19 + Vite Frontend                    │
│   • 2D Leaflet Catchment Map & 3D Interactive WebGL Globe   │
│   • 30-Day Antecedent Hydrograph & Hyetograph Visualizer    │
│   • Interactive Forecast Calculator with 30-day editing     │
│   • Batch Prediction Queue & Provisional CSV Exporter       │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / JSON REST API
┌──────────────────────────────▼──────────────────────────────┐
│                    FastAPI Model Service                    │
│                  (backend/main.py :8000)                    │
│  • BasinShiftMultiTask PyTorch Inference Engine             │
│  • 3 Dynamic Input Channels: Q (log1p), P (log1p), Temp (°C)│
│  • 29 Static Catchment Descriptors (Topography, Soil, etc.) │
│  • 30-Day Antecedent Input Sequence                         │
│  • Residual Reconstruction: z_future = z_0 + delta * sigma   │
│  • 6 Platt Scalers + Physical Exceedance Hierarchy          │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                   Authoritative Artifacts                   │
│   • Model weights: basinshift_multitask_best.pt (371 KB)    │
│   • Scalers: basinshift_scalers.npz                         │
│   • Platt Calibrators: basinshift_calibration.joblib        │
│   • Historical Series: basinshift_timeseries.parquet        │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Authoritative Model & Data Artifacts Inventory

All artifacts are verified against the authoritative release bundle. Below are the exact file sizes and cryptographic SHA-256 checksums:

| Artifact Name | Size (Bytes) | SHA-256 Checksum | Description / Purpose |
| :--- | :--- | :--- | :--- |
| `basinshift_multitask_best.pt` | 371,677 | `73e8de64ee3e9714f3c8a8057467c534b988ca51b790bd38022579e6a8c56c4e` | Trained BasinShiftMultiTask PyTorch weights & optimizer state |
| `basinshift_scalers.npz` | 2,200 | `84eb7f16481e5a2c5dc2e086ec77a2b96a5dfad6dd048c1bbf2d0e3b9c6f15d5` | `dyn_mean`, `dyn_std`, `target_mean`, `target_std`, `static_mean`, `static_std`, `static_medians` |
| `basinshift_calibration.joblib` | 4,872 | `ea32632e9ad4146ffa44d298ba48bae1a948ad8a373dd10adacab5222d57f990` | 6 Platt calibration pipelines (StandardScaler + LogisticRegression) & validation F1 decision thresholds |
| `feature_config.json` | 973 | `088a17a1e14f958f94deaf48172d5e9e03a8eb703c724f90cfcb36bab5575f75` | Input/output schema, 3 dynamic variables, 29 static attributes, window=30, horizons=[1, 3, 7] |
| `basinshift_timeseries.parquet` | 256,941,131 | `b9b7228f0295139d6f5b3ac9d19c9234ee3552080f9daef7d7124fba78c33e23` | Complete daily meteorological and hydrological observations for 897 catchments |
| `basinshift_static_features.parquet` | 130,585 | `0066bb5172e3803b73492e59b3673970311b025c762346dff4cb74ffbba4b658` | Raw static attribute table for 897 catchments (29 attributes + coordinates + metadata) |
| `basinshift_static_scaled.npy` | 104,180 | `d50ca806b65aa67a11cf75f20898675e3d1cd5bab10057cd1570dbc8e23ac99f` | Pre-scaled static attribute matrix of shape `(897, 29)` (float32) |
| `basin_index_map.csv` | 11,570 | `01227e5e5e840a1b33cafa1062475a726a246326443a4b7e9661b23cc29473ea` | Bijective mapping between string `gauge_id` and integer matrix row index `basin_idx` [0..896] |
| `basin_metadata.csv` | 41,829 | `3ad02fe047e58ca95db3175b92b111216eab6c14993b661df5da0f103cfccd40` | Temporal coverage per catchment: `start_date`, `end_date`, `calendar_days`, `valid_windows` |
| `catchment_flow_thresholds.csv` | 125,010 | `cbfeb17291c2a8d88ecb8615e504ce37e9e57d64f7a8f1b1c52fc88f7f7b77f1` | Climatological baseline P95 and P99 discharge thresholds (mm/day) derived from 1980–2000 reference period |
| `catchment_manifest.csv` | 58,900 | `df50dd5dd14619b93339cca0a30afc39cd1458bae9a3af19f67935fba5872049` | Data completeness and observation streak audit per catchment across 1980–2024 |
| `spatial_split_manifest.csv` | 36,326 | `e22798f69261d931e78b87bdd6c4a47419dbb7614c78dec08aa36aafc89b3e66` | Geographic cluster assignment (KMeans k=20) partitioning catchments into train (14), val (3), test (3) |
| `basinshift_final_test_predictions.npz` | 50,133,195 | `9258f10ecc05029c3c6394c4395c02f4d7bc48103338ae1b1b84b7646776718c` | Authoritative out-of-sample predictions across 725,921 test origins for model parity verification |
| `final_test_regression.csv` | 341 | `44554976bdf0c0a8418c218ea610402c9c9a188e6f2f264c0d84b270df78797c` | Pooled regression test metrics (+1d, +3d, +7d) for MultiTask_LSTM vs Persistence |
| `final_test_macro.csv` | 394 | `43ebe2e7398245abea9d5b3308f2fe08383df6e12e63472a9fc0bfa39d9cd67c` | Macro-averaged catchment test metrics across 115 threshold-eligible test basins |
| `final_test_events.csv` | 1,472 | `12a152966b72e1b9311c9d12de7bcc5ae3b4a811873b3ee5b8020053aa786afc` | Event classification test metrics (AUPRC, ROC-AUC, Brier, ECE, F1) across 6 event tasks |

---

## 4. Existing Inference Contract

- **Historical Dynamic Inputs:** Exactly 30 consecutive calendar days of daily streamflow ($Q \ge 0$, mm/day), precipitation ($P \ge 0$, mm/day), and mean temperature ($T$, °C).
- **Transformations:**
  - $Q_{\log} = \ln(1 + \max(Q, 0))$
  - $P_{\log} = \ln(1 + \max(P, 0))$
  - Dynamic Z-Score Standardization: $([Q_{\log}, P_{\log}, T] - \mu_{\text{dyn}}) / \sigma_{\text{dyn}}$
- **Static Attributes:** 29 physical descriptors.
  - Imputation: NaN replaced with median values from training catchments.
  - Standardization: $(S - \mu_{\text{static}}) / \sigma_{\text{static}}$
- **Regression Head Target & Reconstruction:**
  - Residual target formulation: $\delta_h = (\ln(1 + Q_{t+h}) - \ln(1 + Q_t)) / \sigma_{\text{target}}$
  - Reconstruction: $\widehat{Q}_{t+h} = \max(\exp(\ln(1 + Q_t) + \delta_h \cdot \sigma_{\text{target}}) - 1, 0)$
- **Event Head Outputs:**
  - 6 raw logits corresponding to: P95 +1d, P99 +1d, P95 +3d, P99 +3d, P95 +7d, P99 +7d.
  - Calibrated via horizon-specific Platt scaling pipelines (`StandardScaler + LogisticRegression(C=10)`).
  - Physical hierarchy enforcement: $P(Q > P99) \le P(Q > P95)$ at each forecast horizon.

---

## 5. Existing Backend API Endpoints & Frontend Routes

### Backend REST API (`backend/main.py`)
- `GET /api/health` — Returns system status, loaded model status, device, total catchments, and bundle version.
- `GET /api/catchments` — Returns all 897 catchments with metadata, coordinates, split, record length, and P95/P99 thresholds.
- `GET /api/catchments/{gauge_id}` — Returns detailed attributes and statistics for a specific basin.
- `GET /api/catchments/{gauge_id}/observations` — Returns up to 365 days of historical time series up to a given origin date.
- `POST /api/forecast` — Executes real-time inference using the trained `BasinShiftMultiTask` model for a given basin and 30-day sequence.
- `GET /api/metrics` — Returns benchmark evaluation tables (`final_test_regression.csv`, `final_test_macro.csv`, `final_test_events.csv`).

### Frontend View Tabs (`app/frontend/src/App.jsx`)
- `calculator` — Forecast Calculator (editable 30-day observation table, CSV upload, live forecast, batch queue, CSV export).
- `dashboard` — Precision Hydrology Dashboard (Hydrograph, hyetograph, KPI summary cards).
- `map` — Geographic Catchment Map (2D SVG Brazil map and 3D WebGL Cobe interactive globe).
- `catchments` — Basin Characteristics Browser (detailed physical, soil, and geological parameters).
- `evaluation` — Model Evaluation & Performance (regression metrics, AUPRC curves, calibration metrics).
- `provenance` — Research Scope, Data Governance & Hydrological Provenance.

---

## 6. Test Suite Status

Pytest automated test suite in `tests/`:
- `tests/test_backend.py` (7 tests: health, catchments list, catchment detail, observations query, valid forecast, invalid window rejection, metrics table).
- `tests/test_model_parity.py` (1 test: full numerical parity test comparing inference predictions against 100 randomly sampled rows from `basinshift_final_test_predictions.npz`).
- **Audit Execution Result:** 8 passed in 8.48 seconds (100% pass rate).

---

## 7. Known Issues and Observations

1. **Scikit-Learn Version Serialization Warning:**
   The Platt scaling calibrators in `basinshift_calibration.joblib` were fit using scikit-learn 1.6.1 and unpickled under scikit-learn 1.9.1. An `InconsistentVersionWarning` is emitted, but mathematical outputs are completely stable and match saved predictions exactly.
2. **Missing Input Rejection:**
   The model strictly requires contiguous 30-day inputs without NaNs. If a user supplies NaN or incomplete history, the API rejects it with HTTP 400. This is physically defensible and prevents hallucinatory outputs.
3. **P99 +7d Rare Event Uncertainty:**
   Extreme flood detection at +7 days has high uncertainty (AUPRC = 0.066, recall = 10.4%). The dashboard provides prominent operational disclosures warning operators against using it as an autonomous flood warning.
4. **Three Ineligible Test Catchments:**
   Three catchments in the test split (`42546000`, `54260000`, `54950000`) had insufficient data during the 1980–2000 climatological baseline reference period and were excluded from threshold evaluation.

---

## 8. Runtime & System Environment

- **Operating System:** Darwin (macOS 15.x / 24.x, Apple Silicon / ARM64)
- **Python:** 3.12.6
- **PyTorch:** 2.14.1 (CPU execution)
- **Node.js:** v22.16.0
- **npm:** 10.9.2
- **Vite:** 6.4.5
- **React:** 19.3.1

