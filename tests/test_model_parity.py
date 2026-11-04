import sys
sys.path.insert(0, ".")
import numpy as np
import pandas as pd
import pyarrow.parquet as pq
import pytest
from backend import config
from backend.model import BasinShiftMultiTask
from backend.data_loader import CatchmentRepository
from backend.inference import ModelEngine

def test_inference_parity_against_notebook_artifacts():
    """
    Mandatory Phase 3 test:
    Validates that the inference pipeline reproduces the original test predictions
    stored in basinshift_final_test_predictions.npz within CPU/GPU fp32 numerical tolerance.
    """
    repo = CatchmentRepository()
    engine = ModelEngine(repo)

    test_preds = np.load(config.FINAL_TEST_PRED_PATH)
    test_samples = test_preds["test_samples"]
    saved_reg = test_preds["regression"]
    saved_raw_prob = test_preds["raw_event_probabilities"]
    saved_calib_prob = test_preds["calibrated_event_probabilities"]

    # Select 50 deterministic samples across the test set
    test_indices = np.linspace(0, len(test_samples) - 1, 50, dtype=int)
    sample_subset = test_samples[test_indices]
    saved_reg_sub = saved_reg[test_indices]
    saved_raw_prob_sub = saved_raw_prob[test_indices]
    saved_calib_prob_sub = saved_calib_prob[test_indices]

    preds_reg = []
    preds_raw_prob = []
    preds_calib_prob = []

    for orig_i in test_indices:
        bi, origin = int(test_samples[orig_i, 0]), int(test_samples[orig_i, 1])
        gid = repo.idx_to_basin[bi]
        df = repo.get_timeseries_df(gid)
        
        window_df = df.iloc[origin - config.WINDOW + 1 : origin + 1]
        assert len(window_df) == config.WINDOW

        q = window_df["streamflow_mm_raw"].to_numpy(dtype=np.float32)
        p = window_df["precipitation_mm"].to_numpy(dtype=np.float32)
        t = window_df["temperature_c"].to_numpy(dtype=np.float32)

        x_norm, latest_q = engine.validate_historical_window(q, p, t)
        res = engine.predict(gid, x_norm, latest_q)

        preds_reg.append(res["predictions_mm"])
        
        raw_row = []
        calib_row = []
        for h_key in ["+1d", "+3d", "+7d"]:
            raw_row.extend([
                res["events"][h_key]["P95"]["raw_probability"],
                res["events"][h_key]["P99"]["raw_probability"]
            ])
            calib_row.extend([
                res["events"][h_key]["P95"]["calibrated_probability"],
                res["events"][h_key]["P99"]["calibrated_probability"]
            ])
        preds_raw_prob.append(raw_row)
        preds_calib_prob.append(calib_row)

    preds_reg = np.array(preds_reg)
    preds_raw_prob = np.array(preds_raw_prob)
    preds_calib_prob = np.array(preds_calib_prob)

    diff_reg = np.abs(preds_reg - saved_reg_sub)
    diff_raw = np.abs(preds_raw_prob - saved_raw_prob_sub)
    diff_calib = np.abs(preds_calib_prob - saved_calib_prob_sub)

    # Invariants verification
    assert np.isfinite(preds_reg).all()
    assert (preds_reg >= 0).all()
    assert (preds_calib_prob >= 0).all() and (preds_calib_prob <= 1).all()

    # Hierarchy verification: P99 <= P95
    for h_idx in range(3):
        p95_c = h_idx * 2
        p99_c = h_idx * 2 + 1
        violations = (preds_calib_prob[:, p99_c] > preds_calib_prob[:, p95_c]).sum()
        assert violations == 0, f"Hierarchy violation in horizon {h_idx+1}"

    # Numerical tolerance for CPU vs GPU autocast differences (notebook ran with CUDA autocast)
    TOLERANCE_ABS_REG = 5e-3
    TOLERANCE_MEAN_REG = 5e-4
    TOLERANCE_PROB = 2e-3

    assert diff_reg.max() < TOLERANCE_ABS_REG, f"Regression max diff {diff_reg.max()} exceeds {TOLERANCE_ABS_REG}"
    assert diff_reg.mean() < TOLERANCE_MEAN_REG, f"Regression mean diff {diff_reg.mean()} exceeds {TOLERANCE_MEAN_REG}"
    assert diff_raw.max() < TOLERANCE_PROB, f"Raw prob max diff {diff_raw.max()} exceeds {TOLERANCE_PROB}"
    assert diff_calib.max() < TOLERANCE_PROB, f"Calibrated prob max diff {diff_calib.max()} exceeds {TOLERANCE_PROB}"

