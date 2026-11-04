import sys
sys.path.insert(0, ".")
import time
import numpy as np
from backend import main
from backend.schemas import ForecastRequest, CustomWindowInput

# Initialize backend repo and engine directly
print("Initializing repository and model engine directly...")
main.repo = main.CatchmentRepository()
main.engine = main.ModelEngine(main.repo)
print("Initialization successful.")

# 1. Health
print("\n--- Testing Health ---")
health = main.get_health()
print("Health result:", health.status, "Catchments:", health.total_catchments, "Device:", health.device)
assert health.status == "healthy"
assert health.total_catchments == 897

# 2. Catchments List
print("\n--- Testing Catchments List ---")
catchments = main.get_catchments()
print(f"Total catchments returned: {len(catchments)}")
assert len(catchments) == 897
c0 = catchments[0]
print(f"First catchment: {c0['gauge_id']}, lat={c0['lat']}, lon={c0['lon']}, split={c0['split']}, eligible={c0['threshold_eligible']}")
assert c0["gauge_id"] == "10500000"
assert c0["lat"] != 0.0 and c0["lon"] != 0.0

# 3. Catchment Details
print("\n--- Testing Catchment Details ---")
detail = main.get_catchment("10500000")
print(f"Catchment 10500000 attributes count: {len(detail['attributes'])}")
print(f"Sample attributes: area={detail['attributes']['area']}, elev_mean={detail['attributes']['elev_mean']}, bedrock_depth={detail['attributes']['bedrock_depth']}")
assert len(detail["attributes"]) == 29

# 4. Historical Observations
print("\n--- Testing Observations ---")
obs = main.get_observations("10500000", limit=30)
print(f"Observations count: {len(obs)}")
print(f"Latest observation: date={obs[-1]['date']}, streamflow={obs[-1]['streamflow_mm']}, precip={obs[-1]['precipitation_mm']}, temp={obs[-1]['temperature_c']}")
assert len(obs) == 30
assert obs[-1]["streamflow_mm"] is not None

# 5. Forecast Generation (from parquet dataset)
print("\n--- Testing Forecast Generation ---")
req = ForecastRequest(gauge_id="10500000")
fc = main.post_forecast(req)
print(f"Forecast for {fc['gauge_id']} from origin {fc['origin_date']}:")
print(f"  Horizons: {fc['horizons']}")
print(f"  Forecast dates: {fc['forecast_dates']}")
print(f"  Predicted Q (mm/day): {fc['predictions_mm']}")
print(f"  Latest observed Q: {fc['latest_observed_q_mm']}")
print(f"  Ground truth Q: {fc['actual_ground_truth_mm']}")
print(f"  Thresholds: {fc['thresholds']}")
for h_key in ["+1d", "+3d", "+7d"]:
    p95 = fc["events"][h_key]["P95"]
    p99 = fc["events"][h_key]["P99"]
    print(f"  {h_key} -> P95 calib_prob={p95['calibrated_probability']:.4f} (alert={p95['event_detected']}), P99 calib_prob={p99['calibrated_probability']:.4f} (alert={p99['event_detected']})")
    assert p99["calibrated_probability"] <= p95["calibrated_probability"] + 1e-7

# 6. Rejection of invalid inputs
print("\n--- Testing Validation & Error Handling ---")
try:
    invalid_req = ForecastRequest(
        gauge_id="10500000",
        custom_window=CustomWindowInput(
            streamflow=[1.0] * 10,
            precipitation=[0.5] * 10,
            temperature=[20.0] * 10
        )
    )
    main.post_forecast(invalid_req)
    assert False, "Should have rejected 10-day window"
except Exception as e:
    print(f"Properly rejected 10-day window: {e.detail}")

# 7. Metrics
print("\n--- Testing Metrics Endpoint ---")
metrics = main.get_metrics()
print(f"Macro regression records: {len(metrics.macro_regression)}")
print(f"Sample regression records: {len(metrics.sample_regression)}")
print(f"Event classification records: {len(metrics.event_classification)}")
print("Provenance architecture:", metrics.model_provenance["model_architecture"])
assert len(metrics.macro_regression) == 6
assert len(metrics.event_classification) == 6

print("\n==========================================")
print(">>> ALL BACKEND ENDPOINTS PASSED DIRECTLY! <<<")
print("==========================================")
