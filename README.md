# FLOODCAST — Integrated BASINSHIFT Streamflow & Flood Forecasting System

FLOODCAST is an operational deep hydrology forecasting platform powered by the trained **BasinShiftMultiTask** model. The system predicts residual daily streamflow for +1, +3, and +7 day forecast horizons across 897 monitored CAMELS-BR catchments in Brazil, simultaneously evaluating calibrated P95 and P99 flood hazard probabilities with physical hierarchy enforcement.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      React / Vite UI                        │
│   (Option A Precision Hydrology Dashboard • 2D Map & 3D)    │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / JSON REST API
┌──────────────────────────────▼──────────────────────────────┐
│                    FastAPI Model Service                    │
│                  (backend/main.py :8000)                    │
├─────────────────────────────────────────────────────────────┤
│  BasinShiftMultiTask Engine (PyTorch)                       │
│  • 3 Dynamic Channels: Q (log1p), P (log1p), Temp           │
│  • 29 Static Catchment Attributes (Topography, Soil, etc.)   │
│  • 30-Day Antecedent Input Sequence                         │
│  • Residual Reconstruction: z_future = z_0 + delta * sigma   │
│  • Platt Calibration Pipelines + Physical Hierarchy         │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                   Authoritative Artifacts                   │
│   basinshift_multitask_best.pt • basinshift_scalers.npz     │
│   basinshift_calibration.joblib • basinshift_timeseries      │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Directory Structure

```
floodcast/
├── backend/                        # FastAPI Backend Service
│   ├── __init__.py
│   ├── config.py                   # Environment configuration & artifact paths
│   ├── data_loader.py              # CAMELS-BR Parquet & attribute loader
│   ├── inference.py                # Model engine, preprocessing, residual reconstruction
│   ├── model.py                    # BasinShiftMultiTask PyTorch neural architecture
│   ├── schemas.py                  # Pydantic request / response contracts
│   └── main.py                     # FastAPI application router & endpoints
├── app/
│   └── frontend/                   # React 19 + Vite Dashboard
│       ├── src/
│       │   ├── api.js              # Backend REST API client
│       │   ├── App.jsx             # Main dashboard, tab navigation, KPI cards
│       │   ├── CatchmentMap2D.jsx  # Interactive 2D Brazil catchment map
│       │   ├── GlobeView.jsx       # Interactive 3D WebGL globe (cobe)
│       │   ├── Hydrograph.jsx      # High-precision SVG hydrograph & hyetograph
│       │   ├── index.css           # Option A design tokens & styling
│       │   └── main.jsx
│       ├── package.json
│       └── vite.config.js          # Vite config with /api proxy to :8000
├── docs/
│   ├── API_DOCUMENTATION.md        # Detailed REST API specification
│   ├── MODEL_INTEGRATION.md        # Mathematical formulation & preprocessing
│   └── VALIDATION_REPORT.md        # Model parity & browser testing report
├── tests/
│   ├── test_backend.py             # FastAPI unit & integration tests
│   ├── test_model_parity.py        # Numerical parity verification against notebook
│   └── test_direct.py              # Direct model & repository tests
├── .env.example                    # Environment variable template
├── requirements.txt                # Python backend dependencies
└── README.md                       # This document
```

---

## 2. Artifact Placement Instructions

The application requires the 16 model and dataset artifacts extracted from `BASINSHIFT_APP_BUNDLE.zip`.

By default, place these artifacts into the `artifacts/` folder at the repository root:

```
artifacts/
├── basinshift_multitask_best.pt
├── basinshift_scalers.npz
├── basinshift_calibration.joblib
├── feature_config.json
├── basinshift_timeseries.parquet
├── basinshift_static_features.parquet
├── basinshift_static_scaled.npy
├── basin_index_map.csv
├── basin_metadata.csv
├── catchment_flow_thresholds.csv
├── catchment_manifest.csv
├── spatial_split_manifest.csv
├── final_test_regression.csv
├── final_test_events.csv
├── final_test_macro.csv
└── basinshift_final_test_predictions.npz
```

*Note:* You can configure a custom location by setting the `ARTIFACTS_DIR` environment variable in `.env`.

---

## 3. Exact Windows Setup & Execution Commands

### Prerequisites
- Python 3.10+ (tested on Python 3.10, 3.11, 3.12, 3.14)
- Node.js 18+ and npm

### Step 1: Create Virtual Environment and Install Backend Dependencies

Open **PowerShell** in the repository root (`floodcast/`):

```powershell
# 1. Create a virtual environment
python -m venv .venv

# 2. Activate the virtual environment
.\.venv\Scripts\Activate.ps1

# 3. Upgrade pip and install backend dependencies
pip install -r requirements.txt
```

### Step 2: Install Frontend Dependencies and Build

```powershell
# 1. Change to the frontend directory
cd app\frontend

# 2. Install NPM packages
npm install

# 3. Build production bundle (or run 'npm run dev' for development)
npm run build

# Return to root directory
cd ..\..
```

### Step 3: Run Automated Test Suites

```powershell
# Run the FastAPI test suite and model parity verification
.\.venv\Scripts\pytest tests/ -v
```

Expected output:
```
======================== 8 passed in 10.95s ========================
```

### Step 4: Launch the Complete Application

Open two PowerShell windows:

**Terminal 1 — Backend (FastAPI on Port 8000):**
```powershell
.\.venv\Scripts\Activate.ps1
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```
*Health check URL:* http://127.0.0.1:8000/api/health  
*Interactive Swagger docs:* http://127.0.0.1:8000/docs

**Terminal 2 — Frontend (Vite on Port 3000):**
```powershell
cd app\frontend
npm run preview -- --host 127.0.0.1 --port 3000
```

Open your browser to:
**http://127.0.0.1:3000**

---

## 4. Key Scientific and Operational Guidelines

1. **Not a Rainfall Scenario Simulator:**
   The model predicts streamflow from 30 continuous antecedent daily observations (streamflow, precipitation, temperature). It does not simulate hypothetical rainfall adjustment sliders.
2. **Strict Data Completeness:**
   If the 30-day window contains missing, NaN, or non-finite values, the API rejects the request with HTTP 400. The system never silently fabricates or hallucinates observations.
3. **P99 +7d Uncertainty Notice:**
   Skill for rare P99 extreme event detection at +7 days has high uncertainty (AUPRC = 0.066, recall = 10.4%). The dashboard flags this with an explicit operational notice; do not use it as a standalone emergency warning.
4. **Physical Hierarchy:**
   The probability of exceeding the 99th percentile flow is mathematically and physically constrained never to exceed the probability of exceeding the 95th percentile flow ($P(\text{P99}) \le P(\text{P95})$).
