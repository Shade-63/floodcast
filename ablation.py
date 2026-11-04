"""Ablation study for FLOODCAST feature groups (owner: P2).

Evaluates feature groups incrementally on both Forward-Split CV and
Leave-One-Station-Out (LOSO) CV using the baseline LightGBM model.
"""
import sys
from pathlib import Path
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from config import (
    DATE_COL, SEED, STATION_COL, TARGET, TEST_PATH, TRAIN_PATH,
    WEATHER_COLS, STATIC_COLS
)
from cv import evaluate, forward_split, loso_splits
from features import (
    _sorted, add_rolling_rain, add_antecedent_precip_index,
    add_days_since_rain, add_soil_features, add_temperature_features,
    add_seasonality, add_catchment_interactions
)
from models import fit_predict


def prepare_full_dataset():
    """Load and merge train and test to build past-only features correctly."""
    dt = {STATION_COL: str, DATE_COL: str}
    train = pd.read_csv(TRAIN_PATH, dtype=dt)
    test = pd.read_csv(TEST_PATH, dtype=dt)

    train["_is_test"] = False
    train["_row"] = np.arange(len(train))
    test["_is_test"] = True
    test["_row"] = np.arange(len(test))

    combined = pd.concat([train, test], ignore_index=True)
    d = _sorted(combined)

    # Base columns
    base_cols = list(WEATHER_COLS + STATIC_COLS)

    # 1. Rolling rain
    d = add_rolling_rain(d)
    rolling_rain_cols = [
        "rain_sum_1d", "rain_sum_3d", "rain_sum_7d", "rain_sum_14d",
        "rain_sum_30d", "rain_sum_60d", "rain_sum_90d", "rain_max_7d"
    ]

    # 2. API + Soil
    d = add_antecedent_precip_index(d)
    d = add_days_since_rain(d)
    d = add_soil_features(d)
    api_soil_cols = [
        "api_k85", "api_k90", "api_k95", "days_since_rain",
        "soil_lag_1d", "soil_lag_3d", "soil_lag_7d",
        "soil_mean_7d", "soil_mean_30d", "rain_x_soil", "rain3_x_soil"
    ]

    # 3. Temperature proxies + seasonality
    d = add_temperature_features(d)
    d = add_seasonality(d)
    temp_cols = [
        "temp_mean_c", "temp_range_c", "pos_deg_day", "cold_deg_day",
        "pos_deg_sum_7d", "cold_deg_sum_30d", "doy_sin", "doy_cos"
    ]

    # 4. Catchment interactions
    d = add_catchment_interactions(d)
    catchment_cols = [
        "log_drainage_area", "rain30_x_logarea", "rain7_per_area", "slope_x_rain3"
    ]

    return d, {
        "Base columns only": base_cols,
        "+ rolling rain": base_cols + rolling_rain_cols,
        "+ API / soil": base_cols + rolling_rain_cols + api_soil_cols,
        "+ temperature proxies": base_cols + rolling_rain_cols + api_soil_cols + temp_cols,
        "+ catchment interactions": base_cols + rolling_rain_cols + api_soil_cols + temp_cols + catchment_cols,
    }


def run_ablation():
    data, feature_groups = prepare_full_dataset()
    train_df = data[~data["_is_test"]].sort_values("_row").reset_index(drop=True)

    results = []

    print("=" * 80)
    print("FLOODCAST FEATURE ABLATION STUDY")
    print("=" * 80)

    for step_name, cols in feature_groups.items():
        print(f"\nEvaluating: {step_name} ({len(cols)} features)...")

        predict_fn = lambda tr, va, c=cols: fit_predict(tr, va, c, target_mode="raw", seed=SEED)

        # Forward split CV
        _, fwd_pooled, _ = evaluate(train_df, predict_fn, forward_split(train_df), label="forward")

        # LOSO CV
        _, loso_pooled, _ = evaluate(train_df, predict_fn, loso_splits(train_df), label="loso")

        row = {
            "Step": step_name,
            "N_Feats": len(cols),
            "Fwd_RMSE": fwd_pooled["rmse"],
            "Fwd_Top10_RMSE": fwd_pooled["extreme_rmse"],
            "Fwd_MAE": fwd_pooled["mae"],
            "Fwd_R2": fwd_pooled["r2"],
            "LOSO_RMSE": loso_pooled["rmse"],
            "LOSO_Top10_RMSE": loso_pooled["extreme_rmse"],
            "LOSO_MAE": loso_pooled["mae"],
            "LOSO_R2": loso_pooled["r2"],
        }
        results.append(row)

        print(f"  Forward  -> RMSE: {row['Fwd_RMSE']:10.2f} | Top10 RMSE: {row['Fwd_Top10_RMSE']:10.2f} | R2: {row['Fwd_R2']:.4f}")
        print(f"  LOSO     -> RMSE: {row['LOSO_RMSE']:10.2f} | Top10 RMSE: {row['LOSO_Top10_RMSE']:10.2f} | R2: {row['LOSO_R2']:.4f}")

    res_df = pd.DataFrame(results)
    print("\n" + "=" * 80)
    print("SUMMARY ABLATION TABLE")
    print("=" * 80)
    print(res_df.to_string(index=False))

    return res_df


if __name__ == "__main__":
    run_ablation()

