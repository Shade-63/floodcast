"""Local re-implementation of the metrics described in the brief.

KNOWN LIMITS (do not hide these in the model card):
* The official final score min-max normalises each metric using the best and
  worst scores across ALL submissions, computed after the window closes. We
  cannot reproduce that. `proxy_composite` therefore needs reference
  best/worst values that YOU supply (e.g. from your own baseline vs best model).
* The brief gives the normalisation formula only for RMSE. The R2 version in
  `proxy_composite` is the same min-max idea mirrored for 'higher is better';
  that is an ASSUMPTION.
* "Top 10% per station" tie handling is not specified. Here: rows where actual
  discharge >= the station's 90th percentile of actual discharge.
"""
import numpy as np
import pandas as pd

from config import EXTREME_QUANTILE, SCORE_WEIGHTS


def rmse(y_true, y_pred):
    y_true, y_pred = np.asarray(y_true, float), np.asarray(y_pred, float)
    return float(np.sqrt(np.mean((y_pred - y_true) ** 2)))


def mae(y_true, y_pred):
    y_true, y_pred = np.asarray(y_true, float), np.asarray(y_pred, float)
    return float(np.mean(np.abs(y_pred - y_true)))


def r2(y_true, y_pred):
    y_true, y_pred = np.asarray(y_true, float), np.asarray(y_pred, float)
    ss_res = np.sum((y_true - y_pred) ** 2)
    ss_tot = np.sum((y_true - y_true.mean()) ** 2)
    return float(1.0 - ss_res / ss_tot) if ss_tot > 0 else float("nan")


def extreme_mask(y_true, stations, q=EXTREME_QUANTILE):
    df = pd.DataFrame({"y": np.asarray(y_true, float), "s": np.asarray(stations)})
    thr = df.groupby("s")["y"].transform(lambda s: s.quantile(q))
    return (df["y"] >= thr).to_numpy()


def extreme_rmse(y_true, y_pred, stations, q=EXTREME_QUANTILE):
    m = extreme_mask(y_true, stations, q)
    return rmse(np.asarray(y_true, float)[m], np.asarray(y_pred, float)[m])


def compute_metrics(y_true, y_pred, stations):
    return {
        "rmse": rmse(y_true, y_pred),
        "extreme_rmse": extreme_rmse(y_true, y_pred, stations),
        "mae": mae(y_true, y_pred),
        "r2": r2(y_true, y_pred),
    }


def per_station_rmse(y_true, y_pred, stations):
    df = pd.DataFrame({"y": np.asarray(y_true, float), "p": np.asarray(y_pred, float),
                       "s": np.asarray(stations)})
    return df.groupby("s").apply(lambda g: rmse(g["y"], g["p"]), include_groups=False)


def proxy_composite(metrics, best, worst):
    """Weighted 0-100 score using SUPPLIED best/worst reference metrics.

    best / worst: dicts with keys rmse, extreme_rmse, mae, r2.
    Lower-is-better metrics use the brief's formula:
        100 * (worst - yours) / (worst - best)
    r2 (higher is better) uses the mirrored form (ASSUMPTION).
    """
    total = 0.0
    for k, w in SCORE_WEIGHTS.items():
        if k == "r2":
            denom = best[k] - worst[k]
            norm = 100.0 * (metrics[k] - worst[k]) / denom if denom != 0 else 0.0
        else:
            denom = worst[k] - best[k]
            norm = 100.0 * (worst[k] - metrics[k]) / denom if denom != 0 else 0.0
        total += w * norm
    return total
