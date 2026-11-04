from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field

class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    device: str
    total_catchments: int
    artifacts_dir: str
    version: str = "2.0.0"

class CatchmentSummary(BaseModel):
    gauge_id: str
    basin_idx: int
    lat: float
    lon: float
    elev_mean: Optional[float] = None
    area: Optional[float] = None
    split: str
    start_date: str
    end_date: str
    valid_windows: int
    threshold_eligible: bool
    P95_mm_day: Optional[float] = None
    P99_mm_day: Optional[float] = None

class CatchmentDetail(BaseModel):
    gauge_id: str
    basin_idx: int
    lat: float
    lon: float
    split: str
    start_date: str
    end_date: str
    valid_windows: int
    threshold_eligible: bool
    P95_mm_day: Optional[float] = None
    P99_mm_day: Optional[float] = None
    reference_coverage_pct: Optional[float] = None
    attributes: Dict[str, Optional[float]]

class ObservationPoint(BaseModel):
    date: str
    streamflow_mm: Optional[float] = None
    precipitation_mm: Optional[float] = None
    temperature_c: Optional[float] = None
    target_streamflow_mm: Optional[float] = None
    is_primary: bool
    met_complete: bool

class CustomWindowInput(BaseModel):
    streamflow: List[float] = Field(..., description="Exactly 30 daily streamflow observations (mm/day)")
    precipitation: List[float] = Field(..., description="Exactly 30 daily precipitation observations (mm/day)")
    temperature: List[float] = Field(..., description="Exactly 30 daily temperature observations (deg C)")

class ForecastRequest(BaseModel):
    gauge_id: str = Field(..., description="CAMELS-BR 8-digit gauge identifier")
    date: Optional[str] = Field(None, description="Forecast origin date (YYYY-MM-DD). If omitted, uses latest valid date.")
    custom_window: Optional[CustomWindowInput] = Field(None, description="Optional custom 30-day sequence for inference")

class EventDetail(BaseModel):
    raw_probability: float
    calibrated_probability: float
    decision_threshold: float
    event_detected: Optional[bool] = None
    flow_threshold_mm: Optional[float] = None

class HorizonEvent(BaseModel):
    P95: EventDetail
    P99: EventDetail

class ForecastResponse(BaseModel):
    gauge_id: str
    origin_date: Optional[str] = None
    horizons: List[int]
    forecast_dates: Optional[List[str]] = None
    predictions_mm: List[float]
    residuals_standardized: List[float]
    latest_observed_q_mm: float
    actual_ground_truth_mm: Optional[List[Optional[float]]] = None
    threshold_eligible: bool
    thresholds: Dict[str, Optional[float]]
    events: Dict[str, HorizonEvent]
    hierarchy_enforced: bool
    operational_notes: Dict[str, str]
    historical_window_dates: Optional[List[str]] = None
    historical_window_streamflow: Optional[List[float]] = None
    historical_window_precipitation: Optional[List[float]] = None
    historical_window_temperature: Optional[List[float]] = None

class MetricsResponse(BaseModel):
    macro_regression: List[Dict[str, Any]]
    sample_regression: List[Dict[str, Any]]
    event_classification: List[Dict[str, Any]]
    model_provenance: Dict[str, Any]

