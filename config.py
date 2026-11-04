"""Central place for paths and column names.

Column names below are copied from the FLOODCAST brief (train.csv / test.csv
contract). Nothing here is learned from data. If the starter files differ from
the brief, fix them HERE once.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA_RAW = ROOT / "data" / "raw"
DATA_EXTERNAL = ROOT / "data" / "external"
DATA_PROCESSED = ROOT / "data" / "processed"

TRAIN_PATH = DATA_RAW / "train.csv"
TEST_PATH = DATA_RAW / "test.csv"
SAMPLE_SUBMISSION_PATH = DATA_RAW / "sample_submission.csv"
STATION_META_PATH = DATA_RAW / "station_metadata.csv"
PREDICTIONS_PATH = ROOT / "predictions.csv"   # required at repo root

STATION_COL = "station_id"
DATE_COL = "date"
TARGET = "discharge_cfs"

# From the brief: train.csv columns
WEATHER_COLS = ["precipitation_mm", "temp_max_c", "temp_min_c", "soil_moisture"]
STATIC_COLS = ["drainage_area_sqmi", "mean_elevation_ft", "slope_pct", "forest_cover_pct"]
SUBMISSION_COLS = [STATION_COL, DATE_COL, TARGET]   # exact order required

SEED = 42

# Scoring weights from the brief (overall RMSE, extreme RMSE, MAE, R2)
SCORE_WEIGHTS = {"rmse": 0.40, "extreme_rmse": 0.30, "mae": 0.20, "r2": 0.10}
EXTREME_QUANTILE = 0.90   # "top 10% discharge days" per station
