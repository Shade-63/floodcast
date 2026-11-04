"""Unit tests for fetch_data.py parsing and cutoff enforcement."""
import sys
from pathlib import Path
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fetch_data import parse_usgs_discharge, enforce_cutoff


def test_parse_usgs_discharge():
    # Synthetic USGS payload mirroring real USGS NWIS JSON schema
    mock_payload = {
        "value": {
            "timeSeries": [
                {
                    "sourceInfo": {
                        "siteCode": [{"value": "01646500"}]
                    },
                    "variable": {
                        "variableCode": [{"value": "00060"}]
                    },
                    "values": [
                        {
                            "value": [
                                {"value": "5420.0", "dateTime": "2022-04-10T00:00:00.000", "qualifiers": ["A"]},
                                {"value": "6100.0", "dateTime": "2022-04-11T00:00:00.000", "qualifiers": ["A", "e"]}, # estimated/ice
                                {"value": "-999999", "dateTime": "2022-04-12T00:00:00.000", "qualifiers": ["P"]}, # missing
                                {"value": "5800.0", "dateTime": "2022-04-13T00:00:00.000", "qualifiers": ["P"]}, # provisional
                            ]
                        }
                    ]
                }
            ]
        }
    }

    # Test 1: drop ice/estimated
    df = parse_usgs_discharge(mock_payload, drop_ice=True, approved_only=False)
    assert len(df) == 2, f"Expected 2 rows, got {len(df)}"
    assert df["station_id"].iloc[0] == "01646500", "Station ID leading zero lost"
    assert "2022-04-11" not in df["date"].values, "Ice-affected estimated value was not dropped"
    assert "2022-04-12" not in df["date"].values, "Missing -999999 value was not dropped"

    # Test 2: approved only
    df_app = parse_usgs_discharge(mock_payload, drop_ice=True, approved_only=True)
    assert len(df_app) == 1, f"Expected 1 approved row, got {len(df_app)}"
    assert df_app["date"].iloc[0] == "2022-04-10"


def test_enforce_cutoff():
    df = pd.DataFrame({
        "station_id": ["01646500", "01646500", "01646500"],
        "date": ["2022-12-30", "2022-12-31", "2023-01-01"],
        "discharge_cfs": [100.0, 110.0, 120.0]
    })
    cutoff = "2022-12-31"
    res = enforce_cutoff(df, cutoff)
    assert len(res) == 2
    assert (pd.to_datetime(res["date"]) <= pd.to_datetime(cutoff)).all()
    assert res["date"].max() == cutoff


if __name__ == "__main__":
    test_parse_usgs_discharge()
    test_enforce_cutoff()
    print("ALL FETCH_DATA TESTS PASSED")
