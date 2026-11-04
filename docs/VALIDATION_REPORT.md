# BASINSHIFT Model Validation & System Test Report

## Executive Summary
This report documents the verification, parity testing, and live integration validation of the **BasinShiftMultiTask** model integrated into the FLOODCAST application.

All tests passed successfully with zero regressions. The new inference implementation matches the original notebook's saved test predictions within expected CPU vs. GPU mixed-precision numerical tolerances.

---

## 1. Automated Test Suite Results

```
============================= test session starts =============================
platform win32 -- Python 3.14.3, pytest-9.2.0, pluggy-1.7.0
rootdir: D:\floodcast-1
collected 8 items

tests/test_backend.py::test_health PASSED                                [ 12%]
tests/test_backend.py::test_catchments_list PASSED                       [ 25%]
tests/test_backend.py::test_catchment_detail PASSED                      [ 37%]
tests/test_backend.py::test_observations PASSED                          [ 50%]
tests/test_backend.py::test_forecast_default_date PASSED                 [ 62%]
tests/test_backend.py::test_forecast_insufficient_data_rejection PASSED  [ 75%]
tests/test_backend.py::test_metrics PASSED                               [ 87%]
tests/test_model_parity.py::test_inference_parity_against_notebook_artifacts PASSED [100%]

======================== 8 passed in 10.95s ========================
```

---

## 2. Model Numerical Parity Verification

### 2.1 Benchmark Against `basinshift_final_test_predictions.npz`
The original evaluation in the Kaggle notebook executed inference on 725,921 test samples across 115 unseen test catchments using an NVIDIA GPU with PyTorch CUDA automatic mixed precision (`torch.amp.autocast`).

The new inference engine was evaluated on deterministic samples selected across the entire test set. Predictions were compared directly against the saved test predictions:

| Metric | Measured Maximum Abs Diff | Measured Mean Abs Diff | Tolerance Limit | Result |
|---|---|---|---|---|
| **Discharge Regression (mm/d)** | $2.68 \times 10^{-3}$ | $9.38 \times 10^{-5}$ | $5.0 \times 10^{-3}$ | **PASS** |
| **Regression Relative Diff** | $7.24 \times 10^{-4}$ | $5.79 \times 10^{-5}$ | $1.0 \times 10^{-3}$ | **PASS** |
| **Raw Sigmoid Event Probabilities** | $9.89 \times 10^{-4}$ | $6.97 \times 10^{-5}$ | $2.0 \times 10^{-3}$ | **PASS** |
| **Calibrated Event Probabilities** | $7.27 \times 10^{-4}$ | $1.27 \times 10^{-5}$ | $2.0 \times 10^{-3}$ | **PASS** |

### 2.2 Physical Invariants Verification
1. **Non-negativity:** All predicted streamflow values are finite and $\ge 0.0$ mm/day.
2. **Probability Boundedness:** All calibrated probabilities are strictly within $[0.0, 1.0]$.
3. **Hierarchy Enforcement:** $P(\text{P99}) \le P(\text{P95})$ had **0 violations across all evaluated test samples**.

---

## 3. End-to-End Live HTTP & Browser Inspection

### 3.1 Live FastAPI Uvicorn Server Probe
The live server running at `http://127.0.0.1:8000` was probed over HTTP:
- `GET /api/health`: 200 OK (`status: healthy`, `total_catchments: 897`)
- `GET /api/catchments`: 200 OK (897 items)
- `GET /api/catchments/10500000`: 200 OK (29 attributes present)
- `GET /api/catchments/10500000/observations?limit=10`: 200 OK
- `POST /api/forecast`: 200 OK (predictions: `[0.414, 0.373, 0.333]`, hierarchy enforced)
- `GET /api/metrics`: 200 OK (Macro table, sample table, event classification table)

### 3.2 Chrome DevTools Browser Testing
Using Chrome DevTools via Puppeteer (`chrome-devtools-mcp`):
- Navigation to `http://127.0.0.1:3000`: Loaded successfully with zero unhandled client exceptions.
- Network log: Confirmed all `/api/*` calls resolved with status 200.
- Interactive Tab Inspection:
  1. **Forecast Dashboard:** Verified live hydrograph rendering, +1d/+3d/+7d KPI cards, P95/P99 probability bars, and +7d P99 warning banner.
  2. **2D Brazil Map:** Verified equirectangular projection of all 897 catchments, search filter, and split coloring.
  3. **3D WebGL Globe:** Verified `cobe` rendering, marker projection, rotation controls, and smooth basin centering.
  4. **Catchment Attributes:** Verified 29 static physical attributes categorized into Topography, Soil, Geology, Land Cover, and Human Regulation.
  5. **Model Evaluation:** Verified display of official out-of-sample macro regression metrics and event classification statistics.
  6. **Provenance & Scope:** Verified display of model contract, calibration rules, and misuse prevention guidelines.

---

## 4. Known Scientific Limitations & Operational Guidance

1. **Antecedent History Requirement:** Exactly 30 continuous daily observations without missing values are mandatory. Incomplete windows are rejected with HTTP 400.
2. **No Rainfall Slider Scenario Simulation:** The model was trained on observed historical meteorology and streamflow; it is not a hypothetical rainfall scenario simulator.
3. **+7d P99 Uncertainty:** The 99th percentile flow event detection at +7 days exhibits high uncertainty (AUPRC 0.066, recall 10.4%). The dashboard flags this with an explicit warning banner.

