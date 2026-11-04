"""FLOODCAST entry point: produces predictions.csv by running code (required by the rules).

Current state: BASELINE ONLY (raw-target LightGBM on the engineered features).
The planned improvements are TODO markers below; do not describe them in the
model card until they are implemented and validated.

Usage:
    python solution.py                  # train on data/raw/train.csv, write predictions.csv
    python solution.py --cv             # also print forward-split and leave-one-station-out CV
"""
import argparse

import numpy as np
import pandas as pd

from config import (DATE_COL, PREDICTIONS_PATH, SEED, STATION_COL, TARGET,
                    TEST_PATH, TRAIN_PATH, SUBMISSION_COLS)
from cv import evaluate, forward_split, loso_splits
from features import build_features, check_daily_continuity
from models import fit_predict
from validate_submission import validate


def load(train_path, test_path):
    dt = {STATION_COL: str, DATE_COL: str}      # strings keep leading zeros in IDs
    return pd.read_csv(train_path, dtype=dt), pd.read_csv(test_path, dtype=dt)


def prepare(train, test):
    """Build features on train+test INPUT columns together; split back afterwards."""
    train, test = train.copy(), test.copy()
    train["_is_test"], test["_is_test"] = False, True
    train["_row"], test["_row"] = np.arange(len(train)), np.arange(len(test))
    combined = pd.concat([train, test], ignore_index=True)   # TARGET is NaN on test rows
    if combined.duplicated([STATION_COL, DATE_COL]).any():
        raise ValueError("duplicate (station_id, date) across train/test")
    gaps = check_daily_continuity(combined)
    if gaps:
        print("WARNING: non-daily gaps (station: n_gaps):", gaps)
    feats, feature_cols = build_features(combined)
    tr = feats[~feats["_is_test"]].sort_values("_row").reset_index(drop=True)
    te = feats[feats["_is_test"]].sort_values("_row").reset_index(drop=True)
    return tr, te, feature_cols


def baseline_predict(train_df, test_df, feature_cols):
    # TODO(P3): compare target modes (raw / log1p / specific), add peak-weighted
    # model + blend (models.peak_weights, models.blend_peak), XGB/CatBoost ensemble.
    return fit_predict(train_df, test_df, feature_cols, target_mode="raw", seed=SEED)


def run_cv(train_f, feature_cols):
    fn = lambda tr, va: baseline_predict(tr, va, feature_cols)
    for name, splits in (("forward", forward_split(train_f)), ("loso", loso_splits(train_f))):
        folds, pooled, per_station = evaluate(train_f, fn, splits, label=name)
        print(f"\n== {name} ==")
        print(folds.to_string(index=False))
        print("pooled:", {k: round(v, 3) for k, v in pooled.items()})
        print("per-station RMSE:\n", per_station.round(2).to_string())


def main(train_path=TRAIN_PATH, test_path=TEST_PATH, out_path=PREDICTIONS_PATH, cv=False):
    train, test = load(train_path, test_path)
    train_f, test_f, feature_cols = prepare(train, test)
    if cv:
        run_cv(train_f, feature_cols)
    pred = baseline_predict(train_f, test_f, feature_cols)
    out = pd.DataFrame({STATION_COL: test_f[STATION_COL], DATE_COL: test_f[DATE_COL],
                        TARGET: np.clip(pred, 0.0, None)})[SUBMISSION_COLS]
    out.to_csv(out_path, index=False, encoding="utf-8")
    errs = validate(out_path, test_path)
    if errs:
        raise SystemExit("Submission INVALID: " + "; ".join(errs))
    print(f"Wrote {out_path} ({len(out)} rows) - passes validate_submission checks.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--cv", action="store_true")
    a = ap.parse_args()
    main(cv=a.cv)
