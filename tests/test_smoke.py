"""Smoke tests on SYNTHETIC data (generated here, not real river data).
They check the plumbing and the no-leakage property, NOT model quality.

Run:  python tests/test_smoke.py
"""
import sys, tempfile
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import solution
from features import build_features
from validate_submission import validate
from config import STATIC_COLS, WEATHER_COLS


def make_synthetic(seed=0):
    rng = np.random.default_rng(seed)
    dates = pd.date_range("2015-01-01", "2016-12-31", freq="D")
    rows = []
    for i, st in enumerate(["00000001", "00000002", "00000003"]):   # fake IDs
        area = [200.0, 2000.0, 20000.0][i]
        rain = rng.gamma(0.5, 6.0, len(dates))
        tmax = 15 + 10 * np.sin(np.arange(len(dates)) * 2 * np.pi / 365) + rng.normal(0, 2, len(dates))
        soil = np.clip(0.25 + 0.002 * pd.Series(rain).rolling(14, min_periods=1).sum() + rng.normal(0, .01, len(dates)), 0, 1)
        q = area * 0.01 * (1 + pd.Series(rain).rolling(7, min_periods=1).sum()) + rng.normal(0, 1, len(dates))
        rows.append(pd.DataFrame({
            "station_id": st, "date": dates.strftime("%Y-%m-%d"), "discharge_cfs": np.clip(q, 0, None),
            "precipitation_mm": rain, "temp_max_c": tmax, "temp_min_c": tmax - 8, "soil_moisture": soil,
            "drainage_area_sqmi": area, "mean_elevation_ft": 500.0 + 100 * i,
            "slope_pct": 3.0 + i, "forest_cover_pct": 40.0 + 5 * i}))
    df = pd.concat(rows, ignore_index=True)
    train = df[df["date"] < "2016-07-01"].reset_index(drop=True)
    test = df[df["date"] >= "2016-07-01"].drop(columns=["discharge_cfs"]).reset_index(drop=True)
    return train, test


def test_end_to_end_and_validator(tmp):
    train, test = make_synthetic()
    train.to_csv(tmp / "train.csv", index=False)
    test.to_csv(tmp / "test.csv", index=False)
    out = tmp / "predictions.csv"
    solution.main(tmp / "train.csv", tmp / "test.csv", out, cv=True)
    assert validate(out, tmp / "test.csv") == []
    pred = pd.read_csv(out, dtype={"station_id": str})
    assert pred["station_id"].iloc[0].startswith("0"), "leading zeros lost"
    assert len(pred) == len(test)

    bad = pred.copy(); bad.loc[0, "discharge_cfs"] = -1.0
    bad.to_csv(tmp / "bad_neg.csv", index=False)
    assert any("negative" in e for e in validate(tmp / "bad_neg.csv", tmp / "test.csv"))
    pred.rename(columns={"date": "day"}).to_csv(tmp / "bad_cols.csv", index=False)
    assert any("columns" in e for e in validate(tmp / "bad_cols.csv", tmp / "test.csv"))
    pred.iloc[:-1].to_csv(tmp / "bad_rows.csv", index=False)
    assert any("row count" in e for e in validate(tmp / "bad_rows.csv", tmp / "test.csv"))


def test_features_use_only_past():
    """Changing weather AFTER a cutoff must not change any feature on or before it."""
    train, test = make_synthetic()
    cols = ["station_id", "date"] + WEATHER_COLS + STATIC_COLS
    full = pd.concat([train[cols], test[cols]], ignore_index=True)
    a, feat_cols = build_features(full)
    altered = full.copy()
    future = altered["date"] > "2016-03-01"
    altered.loc[future, "precipitation_mm"] += 100.0
    altered.loc[future, "soil_moisture"] = 0.99
    b, _ = build_features(altered)
    past = a["date"] <= "2016-03-01"
    pd.testing.assert_frame_equal(a.loc[past, feat_cols].reset_index(drop=True),
                                  b.loc[past, feat_cols].reset_index(drop=True))


if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as d:
        test_end_to_end_and_validator(Path(d))
    test_features_use_only_past()
    print("ALL SMOKE TESTS PASSED")
