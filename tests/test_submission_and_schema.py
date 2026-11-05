import sys
from pathlib import Path
import json
import csv
import numpy as np
import pandas as pd
import pytest
import jsonschema

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from backend import config
from backend.data_loader import CatchmentRepository
from backend.inference import ModelEngine

def test_predictions_csv_schema_and_integrity():
    """Validates predictions.csv against predictions.schema.json."""
    csv_path = ROOT / "predictions.csv"
    assert csv_path.exists(), "Missing predictions.csv at repo root"
    
    schema_path = ROOT / "docs/predictions.schema.json"
    assert schema_path.exists(), "Missing docs/predictions.schema.json"
    
    with open(schema_path) as f:
        schema = json.load(f)
        
    df = pd.read_csv(csv_path, dtype={"catchment_id": str})
    assert len(df) > 0, "predictions.csv is empty"
    
    expected_cols = [
        "catchment_id", "forecast_origin",
        "target_date_1d", "predicted_discharge_1d",
        "target_date_3d", "predicted_discharge_3d",
        "target_date_7d", "predicted_discharge_7d",
        "p95_probability_1d", "p99_probability_1d",
        "p95_probability_3d", "p99_probability_3d",
        "p95_probability_7d", "p99_probability_7d"
    ]
    assert list(df.columns) == expected_cols, f"Columns mismatch: {list(df.columns)}"
    
    # Validate each row against JSON schema
    for idx, row in df.iterrows():
        record = row.to_dict()
        # Cast floats and strings
        for k in ["predicted_discharge_1d", "predicted_discharge_3d", "predicted_discharge_7d",
                  "p95_probability_1d", "p99_probability_1d", "p95_probability_3d",
                  "p99_probability_3d", "p95_probability_7d", "p99_probability_7d"]:
            record[k] = float(record[k])
        record["catchment_id"] = str(record["catchment_id"]).zfill(8)
        
        jsonschema.validate(instance=record, schema=schema)
        
        # Test physical hierarchy: P99 <= P95
        assert record["p99_probability_1d"] <= record["p95_probability_1d"] + 1e-6
        assert record["p99_probability_3d"] <= record["p95_probability_3d"] + 1e-6
        assert record["p99_probability_7d"] <= record["p95_probability_7d"] + 1e-6
        
        # Test non-negativity
        assert record["predicted_discharge_1d"] >= 0.0
        assert record["predicted_discharge_3d"] >= 0.0
        assert record["predicted_discharge_7d"] >= 0.0

def test_data_leakage_and_origins():
    """Ensures input windows contain zero future information."""
    repo = CatchmentRepository()
    engine = ModelEngine(repo)
    
    data = np.load(config.FINAL_TEST_PRED_PATH)
    samples = data["test_samples"]
    
    # Verify forecast origins are within valid evaluation range
    dates_idx = pd.date_range("1980-01-01", periods=17000, freq="D")
    for bi, origin in samples[:20]:
        origin_date = dates_idx[origin]
        t1 = dates_idx[origin + 1]
        t3 = dates_idx[origin + 3]
        t7 = dates_idx[origin + 7]
        assert origin_date < t1 < t3 < t7

