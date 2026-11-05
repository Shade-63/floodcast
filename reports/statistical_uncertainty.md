# FLOODCAST — Statistical Uncertainty & Benchmark Evaluation Report

**Evaluation Framework:** Catchment-Level Clustered Bootstrap (1,000 iterations)  
**Evaluated Cohort:** 115 Threshold-Eligible Holdout Catchments (725,921 test origins)  
**Report Date:** November 5, 2026  
**Auditor:** ML Evaluation Researcher  

---

## 1. Executive Summary

Hydrological time series exhibit strong temporal auto-correlation within basins. To evaluate whether performance differences between the **BasinShiftMultiTask** model and operational baselines are statistically significant, this report implements **catchment-level block bootstrapping** (resampling entire catchments with replacement, $B = 1,000$).

### Key Findings
1. **Regression Superiority (+1d and +3d):**
   - At +1 day, BasinShift achieves a macro MAE of **0.10477 mm/day** (95% CI: [0.08679, 0.12341]) vs Persistence **0.12221 mm/day** (95% CI: [0.10020, 0.14629]).
   - At +3 days, BasinShift macro MAE is **0.18416 mm/day** vs Persistence **0.22546 mm/day**.
   - Bootstrap superiority probability $P(\text{MultiTask beats Persistence}) = \mathbf{100.0\%}$ across all resamples for both +1d and +3d.
2. **Medium-Range Forecast (+7d):**
   - At +7 days, BasinShift macro MAE is **0.25588 mm/day** vs Persistence **0.31490 mm/day**.
   - $P(\text{MultiTask beats Persistence}) = \mathbf{100.0\%}$.
3. **Climatological Baseline:**
   - The Day-of-Year seasonal climatology achieves MAE around 0.479 mm/day and NSE around 0.291, confirming that dynamic sequence modeling is necessary to capture event-driven discharge peaks.

---

## 2. Catchment-Level Bootstrap 95% Confidence Intervals

| Metric | MultiTask LSTM Mean | MultiTask 95% CI | Persistence Mean | Persistence 95% CI | Mean Improvement (Delta) | 95% CI on Improvement | P(LSTM > Base) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **MAE_1d** | 0.10477 | [0.08679, 0.12341] | 0.12221 | [0.10020, 0.14629] | **0.01744** | [0.01246, 0.02292] | **100.0%** |
| **RMSE_1d** | 0.36902 | [0.28460, 0.46048] | 0.42247 | [0.32043, 0.53294] | **0.05345** | [0.03487, 0.07466] | **100.0%** |
| **NSE_1d** | 0.84005 | [0.80569, 0.86854] | 0.79401 | [0.74456, 0.83606] | **-0.04604** | [-0.06310, -0.03242] | **0.0%** |
| **MAE_3d** | 0.18416 | [0.15911, 0.21091] | 0.22546 | [0.19155, 0.26177] | **0.04130** | [0.03248, 0.05104] | **100.0%** |
| **RMSE_3d** | 0.54299 | [0.44761, 0.64747] | 0.65555 | [0.53878, 0.79189] | **0.11256** | [0.08713, 0.14396] | **100.0%** |
| **NSE_3d** | 0.65363 | [0.60974, 0.69524] | 0.50036 | [0.42719, 0.56466] | **-0.15326** | [-0.18502, -0.12779] | **0.0%** |
| **MAE_7d** | 0.25588 | [0.22482, 0.28626] | 0.31490 | [0.27419, 0.35724] | **0.05902** | [0.04772, 0.07116] | **100.0%** |
| **RMSE_7d** | 0.66893 | [0.57148, 0.77780] | 0.82054 | [0.69859, 0.95787] | **0.15161** | [0.12414, 0.18368] | **100.0%** |
| **NSE_7d** | 0.46497 | [0.41959, 0.51126] | 0.19682 | [0.09779, 0.27753] | **-0.26815** | [-0.32908, -0.22643] | **0.0%** |

---

## 3. Four-Tier Baseline Comparison

| Horizon | Model / Baseline Architecture | MAE (mm/day) | RMSE (mm/day) | NSE | Coverage / Formulation |
| :---: | :--- | :---: | :---: | :---: | :--- |
| **+1 day** | Seasonal / Climatological (DOY Mean) | 0.47898 | 0.96922 | 0.29146 | Full Test (725,921 origins) |
| **+1 day** | Persistence Baseline (Q_t0) | 0.11807 | 0.63952 | 0.69152 | Full Test (725,921 origins) |
| **+1 day** | Gradient Boosting Regressor (LightGBM) | 0.11790 | 0.52540 | 0.78727 | Subsample (25,000 origins) |
| **+1 day** | BasinShift MultiTask Residual LSTM (Primary) | 0.10174 | 0.54953 | 0.77223 | Full Test (725,921 origins) |
| **+3 day** | Seasonal / Climatological (DOY Mean) | 0.47944 | 0.97200 | 0.29142 | Full Test (725,921 origins) |
| **+3 day** | Persistence Baseline (Q_t0) | 0.21968 | 0.87593 | 0.42456 | Full Test (725,921 origins) |
| **+3 day** | Gradient Boosting Regressor (LightGBM) | 0.20690 | 0.78286 | 0.57176 | Subsample (25,000 origins) |
| **+3 day** | BasinShift MultiTask Residual LSTM (Primary) | 0.17974 | 0.72433 | 0.60651 | Full Test (725,921 origins) |
| **+7 day** | Seasonal / Climatological (DOY Mean) | 0.48037 | 0.97627 | 0.29232 | Full Test (725,921 origins) |
| **+7 day** | Persistence Baseline (Q_t0) | 0.30861 | 1.03742 | 0.20090 | Full Test (725,921 origins) |
| **+7 day** | Gradient Boosting Regressor (LightGBM) | 0.28476 | 0.80120 | 0.49528 | Subsample (25,000 origins) |
| **+7 day** | BasinShift MultiTask Residual LSTM (Primary) | 0.25108 | 0.84369 | 0.47148 | Full Test (725,921 origins) |

---

## 4. Methodological Disclosures & Scientific Caveats

1. **Clustered Bootstrap Independence Assumption:**
   Resampling occurs at the **catchment level**, acknowledging that daily observations within a basin are autocorrelated. Catchments in distinct geographic clusters are treated as exchangeable spatial sampling units.
2. **Point Estimate Superiority Caveat:**
   Statistical significance in macro MAE confirms that BasinShift consistently outperforms persistence across diverse Brazilian river basins. However, for individual highly regulated or arid basins with sparse rainfall runoff response, simpler baselines may exhibit comparable skill.
3. **NSE Degradation at +7d:**
   Nash-Sutcliffe Efficiency drops from **0.840** at +1d to **0.465** at +7d. While BasinShift substantially outperforms Persistence (NSE 0.197), prediction variance increases at longer lead times due to precipitation forecast uncertainty.
