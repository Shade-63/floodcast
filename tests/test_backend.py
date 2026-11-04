import sys
sys.path.insert(0, ".")
import pytest
from backend import main
from backend.schemas import ForecastRequest, CustomWindowInput

@pytest.fixture(scope="module", autouse=True)
def setup_backend():
    main.repo = main.CatchmentRepository()
    main.engine = main.ModelEngine(main.repo)

def test_health():
    health = main.get_health()
    assert health.status == "healthy"
    assert health.model_loaded is True
    assert health.total_catchments == 897

def test_catchments_list():
    catchments = main.get_catchments()
    assert len(catchments) == 897
    first = catchments[0]
    assert "gauge_id" in first
    assert "lat" in first and "lon" in first
    assert "split" in first
    assert "threshold_eligible" in first

def test_catchment_detail():
    # Valid catchment
    detail = main.get_catchment("10500000")
    assert detail["gauge_id"] == "10500000"
    assert len(detail["attributes"]) == 29
    assert "area" in detail["attributes"]
    assert "elev_mean" in detail["attributes"]

    # Invalid catchment
    with pytest.raises(Exception):
        main.get_catchment("99999999")

def test_observations():
    obs = main.get_observations("10500000", limit=30)
    assert len(obs) == 30
    point = obs[-1]
    assert "date" in point
    assert "streamflow_mm" in point
    assert "precipitation_mm" in point
    assert "temperature_c" in point

def test_forecast_default_date():
    req = ForecastRequest(gauge_id="10500000")
    fc = main.post_forecast(req)
    assert fc["gauge_id"] == "10500000"
    assert len(fc["predictions_mm"]) == 3
    assert len(fc["horizons"]) == 3
    
    # Forecasts must be nonnegative
    for q in fc["predictions_mm"]:
        assert q >= 0.0

    # Verify event hierarchy: P99 <= P95 for each horizon
    events = fc["events"]
    for h_key in ["+1d", "+3d", "+7d"]:
        p95 = events[h_key]["P95"]["calibrated_probability"]
        p99 = events[h_key]["P99"]["calibrated_probability"]
        assert 0.0 <= p95 <= 1.0
        assert 0.0 <= p99 <= 1.0
        assert p99 <= p95 + 1e-7, f"Hierarchy violation at {h_key}: P99 ({p99}) > P95 ({p95})"

def test_forecast_insufficient_data_rejection():
    # Custom sequence with insufficient length (10 values instead of 30)
    with pytest.raises(Exception) as exc_info:
        req = ForecastRequest(
            gauge_id="10500000",
            custom_window=CustomWindowInput(
                streamflow=[1.0] * 10,
                precipitation=[0.5] * 10,
                temperature=[20.0] * 10
            )
        )
        main.post_forecast(req)
    assert "must be exactly 30 days" in str(exc_info.value)

def test_metrics():
    metrics = main.get_metrics()
    assert len(metrics.macro_regression) == 6
    assert len(metrics.sample_regression) == 6
    assert len(metrics.event_classification) == 6
    assert "BasinShiftMultiTask" in metrics.model_provenance["model_architecture"]
