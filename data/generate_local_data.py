"""Generate local starter dataset in data/raw for local development and benchmarking.

This creates the 5 stations from the FLOODCAST problem brief:
- 01646500 (Potomac River near Washington DC)
- 07010000 (Mississippi River at St. Louis MO)
- 08158000 (Colorado River at Austin TX)
- 02087500 (Neuse River near Clayton NC)
- 11447650 (Sacramento River at Freeport CA)

Train period: 2018-01-01 to 2022-12-31
Test period:  2023-01-01 to 2023-12-31
"""
import sys
from pathlib import Path
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from config import DATA_RAW, SEED, WEATHER_COLS, STATIC_COLS

DATA_RAW.mkdir(parents=True, exist_ok=True)

STATIONS = [
    {
        "station_id": "01646500",
        "station_name": "POTOMAC RIVER NEAR WASH, DC LITTLE FALLS PUMP STA",
        "state": "DC",
        "river_name": "Potomac River",
        "latitude": 38.9497,
        "longitude": -77.1275,
        "drainage_area_sqmi": 11560.0,
        "mean_elevation_ft": 1180.0,
        "slope_pct": 5.4,
        "forest_cover_pct": 58.0,
        "base_flow": 3000.0,
        "runoff_coeff": 180.0,
    },
    {
        "station_id": "07010000",
        "station_name": "MISSISSIPPI RIVER AT ST. LOUIS, MO",
        "state": "MO",
        "river_name": "Mississippi River",
        "latitude": 38.6253,
        "longitude": -90.1794,
        "drainage_area_sqmi": 697000.0,
        "mean_elevation_ft": 820.0,
        "slope_pct": 2.1,
        "forest_cover_pct": 22.0,
        "base_flow": 120000.0,
        "runoff_coeff": 1200.0,
    },
    {
        "station_id": "08158000",
        "station_name": "COLORADO RV AT AUSTIN, TX",
        "state": "TX",
        "river_name": "Colorado River",
        "latitude": 30.2458,
        "longitude": -97.6994,
        "drainage_area_sqmi": 38200.0,
        "mean_elevation_ft": 1450.0,
        "slope_pct": 3.8,
        "forest_cover_pct": 28.5,
        "base_flow": 1500.0,
        "runoff_coeff": 250.0,
    },
    {
        "station_id": "02087500",
        "station_name": "NEUSE RIVER NEAR CLAYTON, NC",
        "state": "NC",
        "river_name": "Neuse River",
        "latitude": 35.6511,
        "longitude": -78.4717,
        "drainage_area_sqmi": 1140.0,
        "mean_elevation_ft": 290.0,
        "slope_pct": 2.4,
        "forest_cover_pct": 48.0,
        "base_flow": 800.0,
        "runoff_coeff": 80.0,
    },
    {
        "station_id": "11447650",
        "station_name": "SACRAMENTO R A FREEPORT CA",
        "state": "CA",
        "river_name": "Sacramento River",
        "latitude": 38.4558,
        "longitude": -121.5011,
        "drainage_area_sqmi": 23500.0,
        "mean_elevation_ft": 2200.0,
        "slope_pct": 8.2,
        "forest_cover_pct": 42.0,
        "base_flow": 14000.0,
        "runoff_coeff": 450.0,
    },
]


def generate_station_series(st, dates, rng):
    n = len(dates)
    doy = dates.dayofyear.values

    # Weather simulation
    # Seasonal temperature
    temp_mid = 18.0 - (st["mean_elevation_ft"] / 1000.0) * 1.5
    temp_annual = 12.0 * np.sin((doy - 105) * 2 * np.pi / 365)
    noise_temp = rng.normal(0, 3.0, n)
    tmax = temp_mid + temp_annual + noise_temp + 5.0
    tmin = tmax - rng.uniform(6.0, 14.0, n)

    # Precipitation: sporadic events via Gamma distribution
    rain_prob = 0.22
    rain_occurs = rng.random(n) < rain_prob
    rain_amount = np.zeros(n)
    rain_amount[rain_occurs] = rng.gamma(shape=1.2, scale=12.0, size=rain_occurs.sum())

    # Occasional extreme storm system (flood triggers)
    storm_occurs = rng.random(n) < 0.015
    rain_amount[storm_occurs] += rng.uniform(40.0, 110.0, size=storm_occurs.sum())

    # Soil moisture: autoregressive process driven by rain and drying with temperature
    soil = np.zeros(n)
    curr_soil = 0.28
    for t in range(n):
        evap = max(0.001, tmax[t] * 0.0008)
        infil = rain_amount[t] * 0.006
        curr_soil = np.clip(curr_soil * 0.96 - evap + infil + rng.normal(0, 0.003), 0.05, 0.95)
        soil[t] = curr_soil

    # Hydrological discharge response
    # Rain rolling response
    rain_s = pd.Series(rain_amount)
    r1 = rain_s.values
    r3 = rain_s.rolling(3, min_periods=1).sum().values
    r7 = rain_s.rolling(7, min_periods=1).sum().values
    r30 = rain_s.rolling(30, min_periods=1).mean().values

    # Snowmelt proxy for high elevations in spring (doy 80-160)
    snowmelt = np.maximum(0.0, tmax - 2.0) * (st["mean_elevation_ft"] > 1000) * ((doy >= 80) & (doy <= 160)) * 0.5

    # Runoff calculation
    runoff = (
        r1 * 0.4 +
        r3 * 0.35 +
        r7 * 0.2 +
        r30 * 1.5 +
        snowmelt * 2.0
    ) * (soil / 0.3) * (st["slope_pct"] / 3.0)

    discharge = st["base_flow"] + st["runoff_coeff"] * runoff + rng.normal(0, st["base_flow"] * 0.04, n)
    discharge = np.maximum(5.0, discharge)

    df = pd.DataFrame({
        "station_id": st["station_id"],
        "date": dates.strftime("%Y-%m-%d"),
        "discharge_cfs": np.round(discharge, 2),
        "precipitation_mm": np.round(rain_amount, 2),
        "temp_max_c": np.round(tmax, 2),
        "temp_min_c": np.round(tmin, 2),
        "soil_moisture": np.round(soil, 4),
        "drainage_area_sqmi": st["drainage_area_sqmi"],
        "mean_elevation_ft": st["mean_elevation_ft"],
        "slope_pct": st["slope_pct"],
        "forest_cover_pct": st["forest_cover_pct"],
    })
    return df


def main():
    rng = np.random.default_rng(SEED)

    train_dates = pd.date_range("2018-01-01", "2022-12-31", freq="D")
    test_dates = pd.date_range("2023-01-01", "2023-12-31", freq="D")

    train_rows = []
    test_rows = []
    meta_rows = []

    for st in STATIONS:
        meta_rows.append({
            "station_id": st["station_id"],
            "station_name": st["station_name"],
            "latitude": st["latitude"],
            "longitude": st["longitude"],
            "state": st["state"],
            "river_name": st["river_name"],
        })
        # Generate full continuous sequence to ensure natural transitions
        full_dates = pd.date_range("2018-01-01", "2023-12-31", freq="D")
        full_df = generate_station_series(st, full_dates, rng)

        tr = full_df[full_df["date"] <= "2022-12-31"].copy()
        te = full_df[full_df["date"] > "2022-12-31"].drop(columns=["discharge_cfs"]).copy()

        train_rows.append(tr)
        test_rows.append(te)

    train_df = pd.concat(train_rows, ignore_index=True)
    test_df = pd.concat(test_rows, ignore_index=True)
    meta_df = pd.DataFrame(meta_rows)

    sample_sub = test_df[["station_id", "date"]].copy()
    sample_sub["discharge_cfs"] = 0.0

    train_df.to_csv(DATA_RAW / "train.csv", index=False)
    test_df.to_csv(DATA_RAW / "test.csv", index=False)
    sample_sub.to_csv(DATA_RAW / "sample_submission.csv", index=False)
    meta_df.to_csv(DATA_RAW / "station_metadata.csv", index=False)

    print(f"Generated train.csv: {len(train_df)} rows")
    print(f"Generated test.csv: {len(test_df)} rows")
    print(f"Generated sample_submission.csv: {len(sample_sub)} rows")
    print(f"Generated station_metadata.csv: {len(meta_df)} rows")


if __name__ == "__main__":
    main()

