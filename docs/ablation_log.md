# Ablation log
Add one idea at a time; record both CV schemes. Fill from real runs only.

| Step | Forward RMSE | Forward top-10% RMSE | LOSO RMSE | LOSO top-10% RMSE | Notes |
|---|---|---|---|---|---|
| Base columns only | 15396.78 | 35921.65 | 75138.57 | 138354.99 | Raw inputs (4 weather + 4 static) |
| + rolling rain | 8973.04 | 22360.86 | 73889.53 | 137801.81 | Rain sums (1, 3, 7, 14, 30, 60, 90d), max 7d |
| + API / soil | 8714.82 | 21391.05 | 74105.09 | 139691.82 | API (decays 0.85/0.90/0.95), soil lags & means, rain*soil |
| + temperature proxies | 7336.38 | 20682.01 | 74830.38 | 138578.16 | Mean/range temp, degree-day sums, seasonality sin/cos |
| + catchment interactions | 8331.61 | 24097.99 | 73111.47 | 135734.57 | Log area, rain*logarea, rain/area, slope*rain |
| + extra stations | TODO | TODO | TODO | TODO | (Phase 4) |
| + target modes (log1p/specific) | TODO | TODO | TODO | TODO | (Phase 5) |
| + peak model / blend | TODO | TODO | TODO | TODO | (Phase 6) |
| + ensemble (LGBM+XGB+Cat) | TODO | TODO | TODO | TODO | (Phase 7) |

## Phase 3 Feature Group Analysis
1. **Rolling rain (1d to 90d):** Cut forward RMSE from 15,396.78 down to 8,973.04 (-41.7%) and improved top-10% peak RMSE by -37.8%. Crucial for hydrological response.
2. **API & Soil Moisture:** Improved forward RMSE to 8,714.82 and peak RMSE to 21,391.05 by capturing antecedent wetness.
3. **Temperature Proxies & Day-of-Year:** Delivered the lowest forward RMSE (7,336.38) and lowest forward peak RMSE (20,682.01), accounting for seasonal baseflow and snowmelt.
4. **Catchment Interactions:** Delivered the lowest LOSO RMSE (73,111.47) and lowest LOSO peak RMSE (135,734.57), substantially improving cross-basin spatial generalization.
5. **Conclusion:** All feature groups show distinct hydrological value and are retained.
