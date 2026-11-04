import os
import json
from contextlib import asynccontextmanager
from typing import Annotated, Dict, List, Optional, Any
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware

from backend import config
from backend.data_loader import CatchmentRepository
from backend.inference import ModelEngine
from backend.schemas import (
    HealthResponse,
    CatchmentSummary,
    CatchmentDetail,
    ObservationPoint,
    ForecastRequest,
    ForecastResponse,
    MetricsResponse
)

repo: Optional[CatchmentRepository] = None
engine: Optional[ModelEngine] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global repo, engine
    print(f"Initializing FLOODCAST BASINSHIFT Backend with artifacts from: {config.ARTIFACTS_DIR}")
    try:
        repo = CatchmentRepository()
        engine = ModelEngine(repo)
        print("Backend model and datasets successfully initialized.")
    except Exception as e:
        print(f"Error initializing backend: {e}")
        raise e
    yield
    print("Shutting down backend.")

app = FastAPI(
    title="FLOODCAST BASINSHIFT Model Service",
    description="Operational Flood Forecasting Backend powered by the BasinShiftMultiTask Deep Hydrology Model.",
    version="2.0.0",
    lifespan=lifespan
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health", response_model=HealthResponse)
def get_health():
    """Health check endpoint providing model, device, and catchment availability status."""
    if repo is None or engine is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model service initializing or failed to load."
        )
    return HealthResponse(
        status="healthy",
        model_loaded=True,
        device=str(engine.device),
        total_catchments=len(repo.basin_to_idx),
        artifacts_dir=str(config.ARTIFACTS_DIR),
        version="2.0.0"
    )

@app.get("/api/catchments", response_model=List[CatchmentSummary])
def get_catchments():
    """Returns the list of all CAMELS-BR catchments with coordinates, splits, and thresholds."""
    if repo is None:
        raise HTTPException(status_code=503, detail="Repository not initialized.")
    return repo.list_catchments()

@app.get("/api/catchments/{gauge_id}", response_model=CatchmentDetail)
def get_catchment(gauge_id: str):
    """Returns full metadata, split, thresholds, and all 29 static attributes for a catchment."""
    if repo is None:
        raise HTTPException(status_code=503, detail="Repository not initialized.")
    details = repo.get_catchment_details(gauge_id)
    if details is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Catchment gauge_id '{gauge_id}' not found in CAMELS-BR dataset."
        )
    return details

@app.get("/api/catchments/{gauge_id}/observations", response_model=List[ObservationPoint])
def get_observations(
    gauge_id: str,
    start_date: Annotated[Optional[str], Query(description="Start date filter (YYYY-MM-DD)")] = None,
    end_date: Annotated[Optional[str], Query(description="End date filter (YYYY-MM-DD)")] = None,
    limit: Annotated[int, Query(ge=1, le=1000, description="Max observations to return (default 90)")] = 90
):
    """Returns historical daily observations (streamflow, precipitation, temperature) for a catchment."""
    if repo is None:
        raise HTTPException(status_code=503, detail="Repository not initialized.")
    if gauge_id not in repo.basin_to_idx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Catchment gauge_id '{gauge_id}' not found."
        )
    try:
        # Normalize in case Query object passed
        s_date = str(start_date) if start_date is not None and not hasattr(start_date, 'default') else None
        e_date = str(end_date) if end_date is not None and not hasattr(end_date, 'default') else None
        lim = int(limit) if not hasattr(limit, 'default') else 90
        return repo.get_observations(gauge_id, start_date=s_date, end_date=e_date, limit=lim)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch observations: {str(e)}")

@app.post("/api/forecast", response_model=ForecastResponse)
def post_forecast(request: ForecastRequest):
    """
    Generates +1d, +3d, +7d flood forecasts and P95/P99 calibrated probabilities
    using the trained BasinShiftMultiTask model.
    
    Rejects invalid sequences or insufficient historical data.
    """
    if repo is None or engine is None:
        raise HTTPException(status_code=503, detail="Model engine not initialized.")
    if request.gauge_id not in repo.basin_to_idx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Catchment gauge_id '{request.gauge_id}' not found."
        )
    
    try:
        if request.custom_window is not None:
            # Inference from custom 30-day inputs
            q = np.array(request.custom_window.streamflow, dtype=np.float32)
            p = np.array(request.custom_window.precipitation, dtype=np.float32)
            t = np.array(request.custom_window.temperature, dtype=np.float32)
            
            x_norm, latest_q = engine.validate_historical_window(q, p, t)
            res = engine.predict(request.gauge_id, x_norm, latest_q)
            res.update({
                "gauge_id": request.gauge_id,
                "origin_date": request.date or "custom_window",
                "horizons": config.HORIZONS,
                "forecast_dates": None,
                "actual_ground_truth_mm": None,
                "historical_window_dates": None,
                "historical_window_streamflow": q.tolist(),
                "historical_window_precipitation": p.tolist(),
                "historical_window_temperature": t.tolist(),
            })
            return res
        else:
            # Inference from parquet dataset
            return engine.generate_forecast_from_dataset(request.gauge_id, origin_date_str=request.date)
            
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference error: {str(e)}"
        )

@app.get("/api/metrics", response_model=MetricsResponse)
def get_metrics():
    """Returns official final evaluation metrics for regression and event detection."""
    macro_reg = []
    if config.FINAL_TEST_MACRO_PATH.exists():
        macro_df = pd.read_csv(config.FINAL_TEST_MACRO_PATH)
        macro_reg = macro_df.to_dict(orient="records")

    sample_reg = []
    if config.FINAL_TEST_REG_PATH.exists():
        sample_df = pd.read_csv(config.FINAL_TEST_REG_PATH)
        sample_reg = sample_df.to_dict(orient="records")

    event_class = []
    if config.FINAL_TEST_EVENTS_PATH.exists():
        events_df = pd.read_csv(config.FINAL_TEST_EVENTS_PATH)
        event_class = events_df.to_dict(orient="records")

    model_provenance = {
        "model_architecture": "BasinShiftMultiTask (2-Layer LSTM + Static Catchment Encoder + Multi-Task Heads)",
        "dataset": "CAMELS-BR v1.2 (Brazilian Catchment Hydrology and Meteorology)",
        "temporal_window": "30 continuous daily observations (discharge_log1p, precipitation_log1p, temperature)",
        "static_attributes_count": 29,
        "forecast_horizons": [1, 3, 7],
        "calibration_method": "Platt Scaling (StandardScaler + LogisticRegression C=10.0) with Physical Hierarchy Enforcement (P99 <= P95)",
        "spatial_evaluation_split": "115 unseen test catchments in 3 disjoint spatial clusters",
        "known_operational_limitations": [
            "P99 extreme event skill at +7 day horizon is low (AUPRC 0.066, recall 10.4%); operational decisions at +7d should emphasize P95 and regression trajectories.",
            "Requires exactly 30 continuous daily observations without missing values; intermittent gauges cannot generate forecasts without gap-filling."
        ]
    }

    return MetricsResponse(
        macro_regression=macro_reg,
        sample_regression=sample_reg,
        event_classification=event_class,
        model_provenance=model_provenance
    )
