# FLOODCAST — Model Card: BasinShiftMultiTask

See the authoritative model specification and evaluation card at:
[`docs/model_card.md`](file:///Users/vrushabhdadabaravkar/floodcast/docs/model_card.md)

**Model:** `BasinShiftMultiTask` (PyTorch)  
**Checkpoint:** `basinshift_multitask_best.pt` (`SHA-256: 73e8de64ee3e9714f3c8a8057467c534b988ca51b790bd38022579e6a8c56c4e`)  
**Dataset:** CAMELS-BR v1.2 (897 Brazilian Catchments, 788 benchmark-eligible)  
**Evaluation Scheme:** Out-of-Cluster Geographic Holdout (14 train clusters, 3 val clusters, 3 test clusters)  

## Key Out-of-Sample Test Results (115 Test Basins, 725,921 origins)
- **+1 Day Streamflow:** Macro MAE = 0.10511 mm/day, Macro NSE = 0.83995 (vs Persistence 0.12262 mm/day, NSE 0.79406)
- **+3 Day Streamflow:** Macro MAE = 0.18464 mm/day, Macro NSE = 0.65363 (vs Persistence 0.22614 mm/day, NSE 0.50051)
- **+7 Day Streamflow:** Macro MAE = 0.25650 mm/day, Macro NSE = 0.46499 (vs Persistence 0.31581 mm/day, NSE 0.19654)
- **P95 High Flow Exceedance:** AUPRC = 0.584 (+1d), 0.420 (+3d), 0.249 (+7d)
- **P99 Extreme Flood Exceedance:** AUPRC = 0.299 (+1d), 0.151 (+3d), 0.066 (+7d)

Full technical documentation and validation reports are located in `docs/` and `reports/`.
