"""Validation (owner: P3). Two schemes required by the plan:

1. forward-in-time split (mirrors 'test dates are after train dates')
2. leave-one-station-out (tests generalisation to unseen stations)

A random split is NOT provided on purpose.
"""
import numpy as np
import pandas as pd

from config import DATE_COL, STATION_COL, TARGET
from scoring import compute_metrics, per_station_rmse


def forward_split(df, valid_frac=0.2):
    """Return [(train_idx, valid_idx)] with all valid dates >= a cut date.
    Uses the last `valid_frac` of unique dates."""
    dates = pd.to_datetime(df[DATE_COL])
    uniq = np.sort(dates.unique())
    cut = uniq[int(len(uniq) * (1 - valid_frac))]
    tr = np.where(dates < cut)[0]
    va = np.where(dates >= cut)[0]
    return [(tr, va)]


def loso_splits(df):
    """One fold per station."""
    out = []
    for st in df[STATION_COL].unique():
        va = np.where(df[STATION_COL] == st)[0]
        tr = np.where(df[STATION_COL] != st)[0]
        out.append((tr, va))
    return out


def evaluate(df, predict_fn, splits, label=""):
    """predict_fn(train_df, valid_df) -> predictions for valid_df.
    Returns (fold_metrics DataFrame, pooled_metrics dict, per_station_rmse Series).
    Pooled metrics are computed over all validation rows of all folds together."""
    rows, ys, ps, ss = [], [], [], []
    for i, (tr, va) in enumerate(splits):
        tr_df, va_df = df.iloc[tr], df.iloc[va]
        pred = predict_fn(tr_df, va_df)
        m = compute_metrics(va_df[TARGET], pred, va_df[STATION_COL])
        m.update(scheme=label, fold=i, n_valid=len(va_df))
        rows.append(m)
        ys.append(va_df[TARGET].to_numpy()); ps.append(np.asarray(pred))
        ss.append(va_df[STATION_COL].to_numpy())
    y, p, s = np.concatenate(ys), np.concatenate(ps), np.concatenate(ss)
    return pd.DataFrame(rows), compute_metrics(y, p, s), per_station_rmse(y, p, s)
