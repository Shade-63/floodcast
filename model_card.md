# Model Card - FLOODCAST

Fill every TODO from real results. Delete nothing that the brief requires.

## Model
- Type: TODO (currently the code implements a raw-target LightGBM baseline only)
- Pre-trained models used: TODO (write "none" if none; the rules require declaring them)
- Random seed(s): TODO

## Data
- Starter data: organizers' train.csv / test.csv (stations: TODO)
- Extra stations added: TODO (list IDs, or "none"); cutoff date used: TODO (must equal train end date)

## Features used
TODO: list from features.py after the final run (rolling rain windows, API, soil lags, temperature proxies, seasonality, catchment interactions - keep only those actually in the final model).

## Validation (required: train/validation RMSE)
| Scheme | Overall RMSE | Extreme (top-10%) RMSE | MAE | R2 |
|---|---|---|---|---|
| Train (in-sample) | TODO | TODO | TODO | TODO |
| Forward-in-time split | TODO | TODO | TODO | TODO |
| Leave-one-station-out | TODO | TODO | TODO | TODO |

## Known limitations
Hypotheses to CONFIRM with evidence before keeping them here:
- Large basins may depend on upstream rainfall that local weather does not capture.
- Dam-regulated rivers may break the rainfall-to-discharge relationship.
- Extreme floods are rare in training data.
- TODO: add what the per-station error table actually shows.
