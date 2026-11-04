# FLOODCAST - <TEAM NAME>

**Team members:** <name 1>, <name 2>, <name 3>, <name 4>

## Approach (3-5 sentences)
TODO: write this AFTER the final model is frozen. Describe only what is actually implemented
and validated (data used, features, model type, how peaks are handled).

## How to run
```bash
pip install -r requirements.txt
# put the organizers' starter files in data/raw/:
#   train.csv  test.csv  sample_submission.csv  station_metadata.csv
python solution.py            # writes predictions.csv at the repo root
python solution.py --cv       # also prints forward-split and leave-one-station-out CV
python validate_submission.py predictions.csv data/raw/test.csv
python tests/test_smoke.py    # plumbing + no-leakage tests on synthetic data
```

## Repo layout
| Path | Purpose | Owner |
|---|---|---|
| `solution.py` | Entry point, writes `predictions.csv` | P3 |
| `features.py` | Past-only weather/catchment features | P2 |
| `models.py`, `cv.py`, `scoring.py` | Models, validation schemes, local metrics | P3 |
| `fetch_data.py` | Extra-station pulls (USGS, Open-Meteo, StreamStats) | P1 |
| `validate_submission.py` | Format checker for predictions.csv | P4 |
| `explain.py`, `app/frontend/` | SHAP / React JS interactive dashboard (stretch) | P4 |
| `model_card.md`, `docs/` | Model card, slides outline, ablation log, task board | P4 |
| `config.py` | Paths and column names (from the brief) | all |

## Rules reminder
No test targets as input, no negative/NaN/missing rows, predictions.csv must come from running
this code, no pre-built model from before the event, declare any pre-trained model in model_card.md.
