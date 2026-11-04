"""Models (owner: P3).

Tested in this skeleton: LightGBM path only (see tests/test_smoke.py).
UNTESTED: the xgboost / catboost builders (imported lazily; install them first).

Target modes (compare all three on CV with the real composite metric, per plan):
  raw      : fit discharge_cfs directly
  log1p    : fit log1p(cfs), back-transform with expm1 (no bias correction here)
  specific : fit cfs / drainage_area_sqmi, multiply back by area
"""
import numpy as np
import pandas as pd

from config import EXTREME_QUANTILE, SEED, STATION_COL, TARGET


def _lgbm(params=None, seed=SEED):
    from lightgbm import LGBMRegressor
    p = dict(n_estimators=500, learning_rate=0.05, num_leaves=31,
             subsample=0.8, subsample_freq=1, colsample_bytree=0.8,
             random_state=seed, verbose=-1)
    if params:
        p.update(params)
    return LGBMRegressor(**p)


def _xgb(params=None, seed=SEED):          # UNTESTED
    from xgboost import XGBRegressor
    p = dict(n_estimators=500, learning_rate=0.05, max_depth=6,
             subsample=0.8, colsample_bytree=0.8, random_state=seed)
    if params:
        p.update(params)
    return XGBRegressor(**p)


def _cat(params=None, seed=SEED):          # UNTESTED
    from catboost import CatBoostRegressor
    p = dict(iterations=500, learning_rate=0.05, depth=6,
             random_seed=seed, verbose=False)
    if params:
        p.update(params)
    return CatBoostRegressor(**p)


BUILDERS = {"lgbm": _lgbm, "xgb": _xgb, "cat": _cat}


def _forward_target(y, area, mode):
    if mode == "raw":
        return y
    if mode == "log1p":
        return np.log1p(y)
    if mode == "specific":
        return y / area
    raise ValueError(mode)


def _inverse_target(p, area, mode):
    if mode == "raw":
        return p
    if mode == "log1p":
        return np.expm1(p)
    if mode == "specific":
        return p * area
    raise ValueError(mode)


def peak_weights(train_df, alpha=4.0, quantile=EXTREME_QUANTILE):
    """Sample weights: 1 normally, 1+alpha on each station's top (1-quantile) days.
    alpha is a starting guess, tune on CV top-10% RMSE vs overall RMSE."""
    thr = train_df.groupby(STATION_COL)[TARGET].transform(lambda s: s.quantile(quantile))
    return np.where(train_df[TARGET] >= thr, 1.0 + alpha, 1.0)


def fit_predict(train_df, test_df, feature_cols, target_mode="raw",
                model="lgbm", params=None, sample_weight=None, seed=SEED):
    """Fit on train_df, predict test_df. Returns non-negative numpy array."""
    area_tr = train_df["drainage_area_sqmi"].to_numpy(float)
    area_te = test_df["drainage_area_sqmi"].to_numpy(float)
    if target_mode == "specific" and (np.nanmin(area_tr) <= 0 or np.nanmin(area_te) <= 0):
        raise ValueError("specific mode needs drainage_area_sqmi > 0 everywhere")
    y = _forward_target(train_df[TARGET].to_numpy(float), area_tr, target_mode)
    m = BUILDERS[model](params, seed)
    if sample_weight is not None:
        m.fit(train_df[feature_cols], y, sample_weight=sample_weight)
    else:
        m.fit(train_df[feature_cols], y)
    pred = _inverse_target(m.predict(test_df[feature_cols]), area_te, target_mode)
    return np.clip(pred, 0.0, None)


def station_thresholds(train_df, quantile=0.80):
    """Per-station discharge threshold from TRAIN targets (for gating the blend).
    Stations absent from train get no threshold (blend skips them)."""
    return train_df.groupby(STATION_COL)[TARGET].quantile(quantile).to_dict()


def blend_peak(test_df, base_pred, peak_pred, thresholds, w_peak=0.5):
    """Where base_pred >= station threshold, mix in the peak model."""
    thr = test_df[STATION_COL].map(thresholds).to_numpy(float)
    gate = np.where(np.isnan(thr), False, base_pred >= thr)
    out = np.where(gate, w_peak * peak_pred + (1 - w_peak) * base_pred, base_pred)
    return np.clip(out, 0.0, None)


def average_predictions(preds):
    """Simple mean ensemble, clipped at 0."""
    return np.clip(np.mean(np.vstack(preds), axis=0), 0.0, None)
