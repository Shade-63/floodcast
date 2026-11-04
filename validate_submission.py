"""Submission checker (owner: P4). Mirrors the validation rules in the brief.

Usage:  python validate_submission.py predictions.csv data/raw/test.csv

Checks (all taken from the brief unless marked):
  - UTF-8 CSV
  - columns exactly: station_id, date, discharge_cfs (this order)
  - same number of rows as test.csv
  - every (station_id, date) in test.csv is present
  - no NaN / blank, no negative discharge_cfs
  - no duplicate (station_id, date)   [brief: 'exactly one prediction per row']
  - no extra (station_id, date) keys not in test.csv   [implied by row-count rule]
IDs are read as strings so leading zeros (e.g. 01646500) are preserved.
"""
import sys
import numpy as np
import pandas as pd

EXPECTED = ["station_id", "date", "discharge_cfs"]


def validate(pred_path, test_path):
    errors = []
    try:
        with open(pred_path, "rb") as f:
            f.read().decode("utf-8")
    except UnicodeDecodeError:
        errors.append("predictions file is not valid UTF-8")
    pred = pd.read_csv(pred_path, dtype={"station_id": str, "date": str})
    test = pd.read_csv(test_path, dtype={"station_id": str, "date": str})

    if list(pred.columns) != EXPECTED:
        errors.append(f"columns {list(pred.columns)} != {EXPECTED}")
        return errors   # later checks need the right columns
    if len(pred) != len(test):
        errors.append(f"row count {len(pred)} != test.csv rows {len(test)}")
    if pred["discharge_cfs"].isna().any():
        errors.append(f"{int(pred['discharge_cfs'].isna().sum())} NaN/blank discharge_cfs")
    vals = pd.to_numeric(pred["discharge_cfs"], errors="coerce")
    if (vals.notna() & (vals < 0)).any():
        errors.append(f"{int((vals < 0).sum())} negative discharge_cfs")
    if vals.isna().sum() > pred["discharge_cfs"].isna().sum():
        errors.append("non-numeric discharge_cfs values present")
    if pred.duplicated(["station_id", "date"]).any():
        errors.append("duplicate (station_id, date) rows")
    pk = set(zip(pred["station_id"], pred["date"]))
    tk = set(zip(test["station_id"], test["date"]))
    if tk - pk:
        errors.append(f"{len(tk - pk)} test keys missing from predictions")
    if pk - tk:
        errors.append(f"{len(pk - tk)} prediction keys not in test.csv")
    return errors


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(2)
    errs = validate(sys.argv[1], sys.argv[2])
    if errs:
        print("INVALID:")
        for e in errs:
            print(" -", e)
        sys.exit(1)
    print("OK: submission passes all checks.")
