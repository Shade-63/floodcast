"""Extra-station data pulls (owner: P1).

STATUS: written from the URLs/field names in the FLOODCAST brief only.
NOT run against the live APIs while building this skeleton. Verify each
response by hand before trusting it.

Hard rule from our plan: extra-station data must stop at the train end date.
Use enforce_cutoff() on everything you add.
"""
import pandas as pd
import requests

USGS_DV_URL = "https://waterservices.usgs.gov/nwis/dv/"
OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
USGS_DISCHARGE_PARAM = "00060"

# The brief's own suggested starter stations (already in the starter CSV per the brief)
BRIEF_SUGGESTED_STATIONS = {
    "01646500": "Potomac, DC",
    "07010000": "Mississippi, St. Louis",
    "08158000": "Colorado, Austin TX",
    "02087500": "Neuse River, NC",
    "11447650": "Sacramento River, CA",
}

# Brief names -> starter-CSV names. The right-hand names come from the brief's
# train.csv column list; the pairing itself is our reading (verify).
OPEN_METEO_RENAME = {
    "precipitation_sum": "precipitation_mm",
    "temperature_2m_max": "temp_max_c",
    "temperature_2m_min": "temp_min_c",
    "soil_moisture_0_to_7cm": "soil_moisture",
}
STREAMSTATS_RENAME = {   # brief key columns -> starter names (CHECK UNITS vs starter)
    "DRNAREA": "drainage_area_sqmi",
    "ELEV": "mean_elevation_ft",
    "FOREST": "forest_cover_pct",
    "SLOPE_PCT": "slope_pct",
}


def fetch_usgs_daily_discharge(site_no, start_date, end_date):
    """Request daily discharge JSON for one site. Returns raw payload (dict).

    TODO(P1): parse payload into DataFrame[station_id, date, discharge_cfs].
    Inspect a real response first (the brief lists 00060_Mean as the key column
    and quality_cd for quality flags). Keep station_id as a STRING.
    """
    params = {"format": "json", "sites": site_no, "startDT": start_date,
              "endDT": end_date, "parameterCd": USGS_DISCHARGE_PARAM}
    r = requests.get(USGS_DV_URL, params=params, timeout=60)
    r.raise_for_status()
    return r.json()


def fetch_open_meteo_daily(lat, lon, start_date, end_date, timezone):
    """Daily weather for one coordinate. Pass the STATION's timezone (plan: avoids
    a one-day shift in daily rain). Returns DataFrame[date + starter weather cols]."""
    params = {
        "latitude": lat, "longitude": lon,
        "start_date": start_date, "end_date": end_date,
        "daily": ",".join(OPEN_METEO_RENAME.keys()),
        "timezone": timezone,
    }
    r = requests.get(OPEN_METEO_ARCHIVE_URL, params=params, timeout=60)
    r.raise_for_status()
    daily = r.json()["daily"]
    df = pd.DataFrame(daily).rename(columns={"time": "date", **OPEN_METEO_RENAME})
    return df


def fetch_streamstats_characteristics(station_id):
    """TODO(P1): the brief gives only the endpoint family
    (streamstats.usgs.gov/streamstatsservices/characteristics.json with rcode and
    workspaceID) and key names (see STREAMSTATS_RENAME). Work out the exact call
    on the live site, then return a one-row DataFrame with starter column names."""
    raise NotImplementedError("StreamStats call not implemented - see docstring")


def enforce_cutoff(df, train_end_date, date_col="date"):
    """Drop every row after the train end date (leakage safeguard for extra stations)."""
    d = pd.to_datetime(df[date_col])
    return df[d <= pd.to_datetime(train_end_date)].copy()
