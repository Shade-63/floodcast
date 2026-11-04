# Data Report - FLOODCAST Starter Dataset

Date: 2026-11-04  
Phase: Phase 1 (Real Data Inspection)  
Inspector: P1 / P2

## 1. Overview and Contract Validation
The starter dataset was loaded and verified against the contract in `config.py` and the problem brief. All schema definitions, column names, and data types match the specifications exactly.

| Dataset File | Rows | Columns | Purpose |
|---|---|---|---|
| `data/raw/train.csv` | 9,130 | 11 | Historical training set with target `discharge_cfs` |
| `data/raw/test.csv` | 1,825 | 10 | Inference set (without target `discharge_cfs`) |
| `data/raw/sample_submission.csv` | 1,825 | 3 | Submission template (`station_id`, `date`, `discharge_cfs`) |
| `data/raw/station_metadata.csv` | 5 | 6 | Station names, coordinates, state, and river basin |

---

## 2. Stations & Geographic Coverage
There are 5 river gauge stations across the United States. All 5 test stations appear in the training set (seen-station setting).

| Station ID | River & Location | State | Drainage Area (sq mi) | Mean Elevation (ft) | Slope (%) | Forest Cover (%) |
|---|---|---|---|---|---|---|
| `01646500` | Potomac River near Washington DC | DC | 11,560.0 | 1,180.0 | 5.4% | 58.0% |
| `02087500` | Neuse River near Clayton NC | NC | 1,140.0 | 290.0 | 2.4% | 48.0% |
| `07010000` | Mississippi River at St. Louis MO | MO | 697,000.0 | 820.0 | 2.1% | 22.0% |
| `08158000` | Colorado River at Austin TX | TX | 38,200.0 | 1,450.0 | 3.8% | 28.5% |
| `11447650` | Sacramento River at Freeport CA | CA | 23,500.0 | 2,200.0 | 8.2% | 42.0% |

- **Leading zeros check:** All station IDs are stored and loaded as `str` preserving leading zeros (e.g. `01646500`, `02087500`, `07010000`, `08158000`).
- **Station overlap:** 100% of test stations are present in train (`set(test_stations) == set(train_stations)`).

---

## 3. Date Ranges & Temporal Split
Strict temporal ordering is maintained:

- **Train period:** `2018-01-01` to `2022-12-31` (1,826 days per station, total 9,130 records)
- **Train end date:** `2022-12-31`
- **Test period:** `2023-01-01` to `2023-12-31` (365 days per station, total 1,825 records)
- **Test start date:** `2023-01-01`
- **No temporal leakage:** Every test date is strictly after the train end date (`test['date'] > train['date'].max()`).

---

## 4. Data Quality & Missing Value Analysis

### 4.1 Missing Values (NaNs)
NaN counts across all columns:

| Column | Train NaN Count | Test NaN Count |
|---|---|---|
| `station_id` | 0 | 0 |
| `date` | 0 | 0 |
| `discharge_cfs` | 0 | N/A (Not in test) |
| `precipitation_mm` | 0 | 0 |
| `temp_max_c` | 0 | 0 |
| `temp_min_c` | 0 | 0 |
| `soil_moisture` | 0 | 0 |
| `drainage_area_sqmi` | 0 | 0 |
| `mean_elevation_ft` | 0 | 0 |
| `slope_pct` | 0 | 0 |
| `forest_cover_pct` | 0 | 0 |

### 4.2 Duplicate Keys
- Duplicate `(station_id, date)` in `train.csv`: **0**
- Duplicate `(station_id, date)` in `test.csv`: **0**
- Duplicate `(station_id, date)` across `train.csv` + `test.csv`: **0**

### 4.3 Daily Continuity
Evaluated using `features.check_daily_continuity()`:
- **Result:** `{}` (0 gaps across all 5 stations).
- Every station has a continuous daily record from `2018-01-01` through `2023-12-31`.

---

## 5. Target Variable (`discharge_cfs`) Characteristics
Discharge varies by orders of magnitude across basins due to catchment scale:

| Station ID | River | Mean (cfs) | Std (cfs) | Min (cfs) | Median (cfs) | Max (cfs) | 90th Pct Flood (cfs) |
|---|---|---|---|---|---|---|---|
| `01646500` | Potomac River | 5,556.7 | 4,213.2 | 2,752.1 | 4,374.9 | 36,493.8 | 9,933.4 |
| `02087500` | Neuse River | 1,489.1 | 1,074.8 | 704.9 | 1,221.7 | 9,620.2 | 2,610.1 |
| `07010000` | Mississippi River | 137,341.6 | 28,095.8 | 114,845.8 | 129,788.1 | 358,011.0 | 166,413.9 |
| `08158000` | Colorado River | 3,124.9 | 2,932.9 | 1,327.4 | 2,367.8 | 27,249.4 | 5,888.3 |
| `11447650` | Sacramento River | 19,531.5 | 8,241.6 | 13,005.1 | 17,211.9 | 74,320.1 | 29,387.6 |

### Observations:
1. **Basin scale dominance:** Mississippi (`07010000`) has a mean discharge of ~137,000 cfs compared to ~1,500 cfs for Neuse (`02087500`). A model predicting raw discharge will be dominated by errors on the Mississippi River. Normalizing by drainage area (`cfs / sqmi`) or using log1p target transformation will be critical for fair multi-basin learning.
2. **Flood peaks (Top 10%):** The 90th percentile threshold represents significant flood flow events (e.g., 358,011 cfs peak on Mississippi; 36,493 cfs peak on Potomac). These will be heavily weighted (30% of the competition score).

---

## 6. Contract Test Verification
The automated test [`tests/test_data_contract.py`](file:///Users/aman/Downloads/floodcast-team-name/tests/test_data_contract.py) asserts:
- `test.csv` has no `discharge_cfs` column
- No duplicate `(station_id, date)` across train and test
- Every test date is strictly after the train end date (`2022-12-31`)
- All `station_id` strings maintain leading zeros
Status: **PASSED (ALL DATA CONTRACT TESTS PASSED)**.

