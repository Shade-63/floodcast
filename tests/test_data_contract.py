"""Data contract tests asserting requirements on data/raw/train.csv and data/raw/test.csv.

Asserts:
- test has no discharge_cfs
- no duplicate (station_id, date) across train+test
- every test date is after the train end date
- station_id strings keep leading zeros
"""
import sys
from pathlib import Path
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config import TRAIN_PATH, TEST_PATH, STATION_COL, DATE_COL, TARGET


def test_data_contract():
    assert TRAIN_PATH.exists(), f"Train file missing at {TRAIN_PATH}"
    assert TEST_PATH.exists(), f"Test file missing at {TEST_PATH}"

    # station_id must be read as string to preserve leading zeros
    train = pd.read_csv(TRAIN_PATH, dtype={STATION_COL: str, DATE_COL: str})
    test = pd.read_csv(TEST_PATH, dtype={STATION_COL: str, DATE_COL: str})

    # Assert 1: test has no discharge_cfs
    assert TARGET not in test.columns, f"Target '{TARGET}' must not be present in test set"
    assert TARGET in train.columns, f"Target '{TARGET}' must be present in train set"

    # Assert 2: no duplicate (station_id, date) across train+test
    combined = pd.concat([train[[STATION_COL, DATE_COL]], test[[STATION_COL, DATE_COL]]], ignore_index=True)
    dups = combined.duplicated(subset=[STATION_COL, DATE_COL])
    assert not dups.any(), f"Found {dups.sum()} duplicate (station_id, date) pairs across train+test"

    # Assert 3: every test date is after the train end date
    train_end_date = train[DATE_COL].max()
    test_min_date = test[DATE_COL].min()
    assert (test[DATE_COL] > train_end_date).all(), (
        f"Every test date must be strictly after train end date ({train_end_date}), but test min date is {test_min_date}"
    )

    # Assert 4: station_id strings keep leading zeros
    assert pd.api.types.is_string_dtype(train[STATION_COL]), "Train station_id is not string dtype"
    assert pd.api.types.is_string_dtype(test[STATION_COL]), "Test station_id is not string dtype"
    for df, name in [(train, "train"), (test, "test")]:
        sample_ids = df[STATION_COL].dropna().unique()
        assert all(isinstance(s, str) for s in sample_ids), f"Non-string station_id in {name}"
        # USGS IDs are typically 8 digits, often starting with '0'
        has_leading_zero = any(s.startswith("0") for s in sample_ids)
        if has_leading_zero:
            assert all(len(s) >= 8 for s in sample_ids), f"Station IDs in {name} appear truncated"


if __name__ == "__main__":
    test_data_contract()
    print("ALL DATA CONTRACT TESTS PASSED")

