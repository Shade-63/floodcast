# FLOODCAST REST API Documentation

The FLOODCAST backend provides an operational REST API serving streamflow predictions, extreme event probabilities, historical observations, and catchment metadata.

Base URL (default): `http://127.0.0.1:8000`

---

## 1. Health & Status

### `GET /api/health`
Verifies backend operational status, loaded model checkpoint, compute device, and catchment availability.

**Response `200 OK`:**
```json
{
  "status": "healthy",
  "model_loaded": true,
  "device": "cpu",
  "total_catchments": 897,
  "artifacts_dir": "D:\\floodcast-1\\artifacts",
  "version": "2.0.0"
}
```

---

## 2. Catchment Metadata

### `GET /api/catchments`
Returns a list of all 897 CAMELS-BR catchments with coordinates, spatial split assignment, and threshold eligibility.

**Response `200 OK`:**
```json
[
  {
    "gauge_id": "10500000",
    "basin_idx": 0,
    "lat": -4.3408,
    "lon": -70.9056,
    "elev_mean": 154.41,
    "area": 61581.51,
    "split": "train",
    "start_date": "1980-01-01",
    "end_date": "2024-07-31",
    "valid_windows": 14090,
    "threshold_eligible": true,
    "P95_mm_day": 6.3445,
    "P99_mm_day": 6.8208
  }
]
```

### `GET /api/catchments/{gauge_id}`
Returns comprehensive metadata, flow thresholds, and all 29 static physical attributes for a specific gauge.

**Response `200 OK`:**
```json
{
  "gauge_id": "10500000",
  "basin_idx": 0,
  "lat": -4.3408,
  "lon": -70.9056,
  "split": "train",
  "start_date": "1980-01-01",
  "end_date": "2024-07-31",
  "valid_windows": 14090,
  "threshold_eligible": true,
  "P95_mm_day": 6.3445,
  "P99_mm_day": 6.8208,
  "reference_coverage_pct": 100.0,
  "attributes": {
    "elev_gauge": 70.0,
    "elev_mean": 154.41,
    "slope_mean": 10.5,
    "area": 61581.51,
    "sand_perc": 42.0,
    "silt_perc": 25.0,
    "clay_perc": 33.0,
    "org_carbon_content": 14.2,
    "bedrock_depth": 1876.13,
    "water_table_depth": 4.5,
    "geol_class_1st_perc": 80.0,
    "geol_class_2nd_perc": 20.0,
    "carb_rocks_perc": 0.0,
    "geol_porosity": 0.18,
    "geol_permeability": 1e-12,
    "crop_perc": 5.0,
    "crop_mosaic_perc": 2.0,
    "forest_perc": 78.0,
    "shrub_perc": 5.0,
    "grass_perc": 8.0,
    "barren_perc": 0.0,
    "imperv_perc": 0.5,
    "wet_perc": 1.5,
    "snow_perc": 0.0,
    "dom_land_cover_perc": 78.0,
    "consumptive_use": 1.2,
    "consumptive_use_perc": 0.1,
    "reservoirs_vol": 0.0,
    "regulation_degree": 0.0
  }
}
```

---

## 3. Historical Observations

### `GET /api/catchments/{gauge_id}/observations`
Retrieves daily time-series records for streamflow, precipitation, and temperature.

**Query Parameters:**
- `start_date` (optional): Filter start date (`YYYY-MM-DD`).
- `end_date` (optional): Filter end date (`YYYY-MM-DD`).
- `limit` (optional, default `90`, max `1000`): Maximum daily points to return.

**Response `200 OK`:**
```json
[
  {
    "date": "2024-07-31",
    "streamflow_mm": 0.4318,
    "precipitation_mm": 0.506,
    "temperature_c": 27.27,
    "target_streamflow_mm": null,
    "is_primary": false,
    "met_complete": true
  }
]
```

---

## 4. Operational Streamflow Forecast

### `POST /api/forecast`
Generates streamflow forecasts for horizons +1d, +3d, and +7d, accompanied by calibrated P95/P99 event probabilities.

**Request Body (Option A — Historical Origin Date):**
```json
{
  "gauge_id": "10500000",
  "date": "2024-07-31"
}
```

**Request Body (Option B — Custom 30-Day Window):**
```json
{
  "gauge_id": "10500000",
  "custom_window": {
    "streamflow": [0.45, 0.44, 0.43, "... (exactly 30 numbers)"],
    "precipitation": [0.0, 1.2, 0.5, "... (exactly 30 numbers)"],
    "temperature": [26.5, 27.1, 26.8, "... (exactly 30 numbers)"]
  }
}
```

**Response `200 OK`:**
```json
{
  "gauge_id": "10500000",
  "origin_date": "2024-07-31",
  "horizons": [1, 3, 7],
  "forecast_dates": ["2024-08-01", "2024-08-03", "2024-08-07"],
  "predictions_mm": [0.4142, 0.3725, 0.3331],
  "residuals_standardized": [-0.0381, -0.1264, -0.2198],
  "latest_observed_q_mm": 0.4318,
  "actual_ground_truth_mm": [null, null, null],
  "threshold_eligible": true,
  "thresholds": {
    "P95_mm_day": 6.3445,
    "P99_mm_day": 6.8208
  },
  "events": {
    "+1d": {
      "P95": {
        "raw_probability": 0.0001,
        "calibrated_probability": 0.00002,
        "decision_threshold": 0.2372,
        "event_detected": false,
        "flow_threshold_mm": 6.3445
      },
      "P99": {
        "raw_probability": 0.00005,
        "calibrated_probability": 0.00001,
        "decision_threshold": 0.1371,
        "event_detected": false,
        "flow_threshold_mm": 6.8208
      }
    },
    "+3d": { "P95": {}, "P99": {} },
    "+7d": { "P95": {}, "P99": {} }
  },
  "hierarchy_enforced": true,
  "operational_notes": {
    "+7d_P99": "P99 event forecasting skill at +7 days has high uncertainty (AUPRC 0.066, recall 10.4%). Do not rely on it as a sole operational warning."
  }
}
```

**Error Handling:**
- `400 Bad Request`: If window is incomplete, contains NaNs, or is non-finite.
- `404 Not Found`: If gauge ID does not exist in CAMELS-BR.

---

## 5. Scientific Benchmark Metrics

### `GET /api/metrics`
Returns official final evaluation tables from out-of-sample testing across 115 test catchments.

**Response `200 OK`:**
- `macro_regression`: Macro MAE, RMSE, NSE for +1d, +3d, +7d comparing MultiTask_LSTM to Persistence.
- `sample_regression`: Aggregate sample metrics.
- `event_classification`: Prevalence, AUPRC, ROC AUC, Brier score, ECE, decision threshold, F1, and recall for all 6 targets.
- `model_provenance`: Architecture summary and operational boundaries.

