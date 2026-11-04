"""Feature engineering (owner: P2).

Rules enforced by design:
* Only WEATHER_COLS and STATIC_COLS (inputs) are used. TARGET is never read.
* Every window ends at the current day and looks BACKWARD only (no centred or
  forward windows, no shift(-n)).
* The input frame may be train+test weather concatenated, so the first test
  days still get a look-back. That is legal: weather is an input, not a label.

Assumptions you must verify on the real files:
* Rows are daily and contiguous per station. `check_daily_continuity` tells you
  if not; row-count windows are wrong when days are missing.
* Windows are truncated (min_periods=1) at the start of each station's record.
  Consider dropping the first N days per station from training.
* NaN rain is treated as 0 inside the API recursion. Check how many NaNs exist.
"""
import numpy as np
import pandas as pd

from config import DATE_COL, STATIC_COLS, STATION_COL, TARGET, WEATHER_COLS

RAIN_WINDOWS = (1, 3, 7, 14, 30, 60, 90)
API_DECAYS = (0.85, 0.90, 0.95)          # starting range from the plan; tune on CV
SOIL_LAGS = (1, 3, 7)
SOIL_WINDOWS = (7, 30)
RAIN_EVENT_THRESHOLD_MM = 5.0            # starting value, tune on CV


def _sorted(df):
    d = df.copy()
    d["_dt"] = pd.to_datetime(d[DATE_COL])
    return d.sort_values([STATION_COL, "_dt"]).reset_index(drop=True)


def check_daily_continuity(df):
    """Return {station: n_gaps} for stations whose dates are not 1-day apart."""
    d = _sorted(df)
    bad = {}
    for st, g in d.groupby(STATION_COL):
        gaps = int((g["_dt"].diff().dropna() != pd.Timedelta(days=1)).sum())
        if gaps:
            bad[st] = gaps
    return bad


def add_rolling_rain(d, windows=RAIN_WINDOWS):
    g = d.groupby(STATION_COL)["precipitation_mm"]
    for w in windows:
        d[f"rain_sum_{w}d"] = g.transform(lambda s: s.rolling(w, min_periods=1).sum())
    d["rain_max_7d"] = g.transform(lambda s: s.rolling(7, min_periods=1).max())
    return d


def _api(values, k):
    out = np.empty(len(values), dtype=float)
    prev = 0.0
    for i, v in enumerate(values):
        v = 0.0 if np.isnan(v) else v
        prev = v + k * prev
        out[i] = prev
    return out


def add_antecedent_precip_index(d, decays=API_DECAYS):
    """API_t = rain_t + k * API_{t-1}  (per station)."""
    g = d.groupby(STATION_COL)["precipitation_mm"]
    for k in decays:
        d[f"api_k{int(round(k * 100))}"] = g.transform(lambda s, k=k: _api(s.to_numpy(float), k))
    return d


def add_days_since_rain(d, thr=RAIN_EVENT_THRESHOLD_MM):
    def f(s):
        n = len(s)
        idx = np.where(s.to_numpy(float) > thr, np.arange(n), np.nan)
        last = pd.Series(idx).ffill().to_numpy()
        return pd.Series(np.arange(n) - last, index=s.index)
    d["days_since_rain"] = (
        d.groupby(STATION_COL)["precipitation_mm"].transform(f).fillna(99.0)
    )
    return d


def add_soil_features(d, lags=SOIL_LAGS, windows=SOIL_WINDOWS):
    g = d.groupby(STATION_COL)["soil_moisture"]
    for l in lags:
        # Fill beginning-of-record lags with current-day soil (no future lookahead)
        d[f"soil_lag_{l}d"] = g.shift(l).fillna(d["soil_moisture"])
    for w in windows:
        d[f"soil_mean_{w}d"] = g.transform(lambda s: s.rolling(w, min_periods=1).mean())
    d["rain_x_soil"] = d["precipitation_mm"] * d["soil_moisture"]
    d["rain3_x_soil"] = d["rain_sum_3d"] * d["soil_moisture"] if "rain_sum_3d" in d else np.nan
    return d


def add_temperature_features(d):
    """Simple temperature/snow-melt PROXIES (not a physical snow model)."""
    d["temp_mean_c"] = (d["temp_max_c"] + d["temp_min_c"]) / 2.0
    d["temp_range_c"] = d["temp_max_c"] - d["temp_min_c"]
    d["pos_deg_day"] = d["temp_mean_c"].clip(lower=0)
    d["cold_deg_day"] = (-d["temp_mean_c"]).clip(lower=0)
    g_pos = d.groupby(STATION_COL)["pos_deg_day"]
    g_cold = d.groupby(STATION_COL)["cold_deg_day"]
    d["pos_deg_sum_7d"] = g_pos.transform(lambda s: s.rolling(7, min_periods=1).sum())
    d["cold_deg_sum_30d"] = g_cold.transform(lambda s: s.rolling(30, min_periods=1).sum())
    return d


def add_physical_snow_and_effective_water(d, k_melt=2.5):
    """Physical snowpack accumulation & degree-day melt tracking:
    P_snow = precip if Tmax <= 0 else 0
    P_rain = precip if Tmax > 0 else 0
    Melt_t = min(Snowpack_{t-1}, K_melt * max(0, Tmax))
    Snowpack_t = Snowpack_{t-1} + P_snow - Melt_t
    Effective_Water = P_rain + Melt_t
    """
    def calc_snow_melt(group):
        precip = group["precipitation_mm"].to_numpy(float)
        tmax = group["temp_max_c"].to_numpy(float)
        n = len(precip)
        p_snow = np.where(tmax <= 0.0, precip, 0.0)
        p_rain = np.where(tmax > 0.0, precip, 0.0)
        melt = np.zeros(n, dtype=float)
        snowpack = np.zeros(n, dtype=float)
        eff_water = np.zeros(n, dtype=float)
        s = 0.0
        for t in range(n):
            m = min(s, k_melt * max(0.0, tmax[t]))
            melt[t] = m
            s = s + p_snow[t] - m
            snowpack[t] = s
            eff_water[t] = p_rain[t] + m
        return pd.DataFrame({
            "snowpack_mm": snowpack,
            "snow_melt_mm": melt,
            "effective_water_mm": eff_water
        }, index=group.index)

    snow_df = d.groupby(STATION_COL, group_keys=False).apply(calc_snow_melt)
    d["snowpack_mm"] = snow_df["snowpack_mm"]
    d["snow_melt_mm"] = snow_df["snow_melt_mm"]
    d["effective_water_mm"] = snow_df["effective_water_mm"]

    # A. Soil-Saturation Runoff Potential
    d["runoff_potential"] = d["effective_water_mm"] * d["soil_moisture"]

    # B. Catchment-Scaled Dynamic API
    def calc_dynamic_api(group):
        eff = group["effective_water_mm"].to_numpy(float)
        slope = group["slope_pct"].iloc[0]
        gamma = 0.85 - (0.3 * (slope / 100.0))
        n = len(eff)
        api = np.zeros(n, dtype=float)
        prev = 0.0
        for t in range(n):
            prev = eff[t] + gamma * prev
            api[t] = prev
        return pd.Series(api, index=group.index)

    d["api_decay"] = d.groupby(STATION_COL, group_keys=False).apply(calc_dynamic_api)

    # C. Drainage-Normalized Runoff Volume
    d["runoff_volume_cfs_est"] = (d["effective_water_mm"] * d["drainage_area_sqmi"]) / 100.0
    return d


def add_seasonality(d):
    doy = d["_dt"].dt.dayofyear
    d["doy_sin"] = np.sin(2 * np.pi * doy / 365.25)
    d["doy_cos"] = np.cos(2 * np.pi * doy / 365.25)
    return d


def add_catchment_interactions(d):
    area = d["drainage_area_sqmi"].where(d["drainage_area_sqmi"] > 0)
    d["log_drainage_area"] = np.log(area)
    d["rain30_x_logarea"] = d.get("rain_sum_30d", np.nan) * d["log_drainage_area"]
    d["rain7_per_area"] = d.get("rain_sum_7d", np.nan) / area
    d["slope_x_rain3"] = d["slope_pct"] * d.get("rain_sum_3d", np.nan)
    return d


def build_features(df):
    """df needs STATION_COL, DATE_COL, WEATHER_COLS, STATIC_COLS.
    Returns (features_df sorted by station/date, list_of_feature_columns)."""
    needed = [STATION_COL, DATE_COL] + WEATHER_COLS + STATIC_COLS
    missing = [c for c in needed if c not in df.columns]
    if missing:
        raise ValueError(f"build_features: missing columns {missing}")
    d = _sorted(df)
    for fn in (add_rolling_rain, add_antecedent_precip_index, add_days_since_rain,
               add_soil_features, add_temperature_features,
               add_physical_snow_and_effective_water, add_seasonality,
               add_catchment_interactions):
        d = fn(d)
    base = WEATHER_COLS + STATIC_COLS
    engineered = [c for c in d.columns
                  if c not in set(df.columns) | {"_dt"} and c != TARGET]
    feature_cols = base + engineered
    assert TARGET not in feature_cols
    return d, feature_cols
