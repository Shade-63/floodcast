import os
from pathlib import Path

# Base directory for artifacts
BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_ARTIFACTS_DIR = BASE_DIR / "artifacts"

ARTIFACTS_DIR = Path(os.getenv("ARTIFACTS_DIR", str(DEFAULT_ARTIFACTS_DIR))).resolve()

# Model and artifact filenames
MODEL_CHECKPOINT_PATH = ARTIFACTS_DIR / "basinshift_multitask_best.pt"
SCALERS_PATH = ARTIFACTS_DIR / "basinshift_scalers.npz"
CALIBRATION_PATH = ARTIFACTS_DIR / "basinshift_calibration.joblib"
FEATURE_CONFIG_PATH = ARTIFACTS_DIR / "feature_config.json"
TIMESERIES_PATH = ARTIFACTS_DIR / "basinshift_timeseries.parquet"
STATIC_FEATURES_PATH = ARTIFACTS_DIR / "basinshift_static_features.parquet"
STATIC_SCALED_PATH = ARTIFACTS_DIR / "basinshift_static_scaled.npy"
BASIN_INDEX_MAP_PATH = ARTIFACTS_DIR / "basin_index_map.csv"
BASIN_METADATA_PATH = ARTIFACTS_DIR / "basin_metadata.csv"
THRESHOLDS_PATH = ARTIFACTS_DIR / "catchment_flow_thresholds.csv"
SPATIAL_SPLIT_PATH = ARTIFACTS_DIR / "spatial_split_manifest.csv"
FINAL_TEST_PRED_PATH = ARTIFACTS_DIR / "basinshift_final_test_predictions.npz"
FINAL_TEST_REG_PATH = ARTIFACTS_DIR / "final_test_regression.csv"
FINAL_TEST_EVENTS_PATH = ARTIFACTS_DIR / "final_test_events.csv"
FINAL_TEST_MACRO_PATH = ARTIFACTS_DIR / "final_test_macro.csv"

DEVICE = os.getenv("DEVICE", "cpu")
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))

WINDOW = 30
HORIZONS = [1, 3, 7]
EVENT_NAMES = [
    "P95 +1d", "P99 +1d",
    "P95 +3d", "P99 +3d",
    "P95 +7d", "P99 +7d"
]

