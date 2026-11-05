# FLOODCAST — Model Card: BasinShiftMultiTask

**Model Name:** `BasinShiftMultiTask`  
**Checkpoint File:** `basinshift_multitask_best.pt`  
**Checkpoint SHA-256:** `73e8de64ee3e9714f3c8a8057467c534b988ca51b790bd38022579e6a8c56c4e`  
**Model Architecture:** Multi-Task Recurrent Neural Network (LSTM + Static Catchment MLP + Residual Regression Head + Calibrated Event Head)  
**Primary Author/Lead:** FLOODCAST Technical Engineering Team  
**Evaluation Framework:** Out-of-Cluster Geographic Holdout (KMeans $k=20$)  
**Version:** 2.0.0  

---

## 1. Model Details

### Architecture & Topology
- **Temporal Recurrent Encoder:** 2-layer LSTM with hidden size 64, dropout 0.15, ingesting 3 dynamic features across a 30-day antecedent sequence.
- **Static Catchment Encoder:** 2-layer MLP (`Linear(29, 64) -> ReLU -> LayerNorm(64) -> Dropout(0.10) -> Linear(64, 64) -> ReLU`) encoding 29 physical catchment attributes into a 64-dimensional embedding.
- **Shared Representation:** 128-dimensional concatenated state $[h_{\text{LSTM}}, s_{\text{catchment}}]$.
- **Residual Regression Output Head:** 3-layer MLP predicting standardized residual log-flow shifts $\boldsymbol{\delta} = [\delta_1, \delta_3, \delta_7]$ for $+1$, $+3$, and $+7$ day forecast horizons.
- **Event Exceedance Classification Head:** 2-layer MLP predicting 6 uncalibrated event logits, post-processed via horizon-specific Platt calibrators and physical hierarchy enforcement ($P(\text{P99}) \le P(\text{P95})$).

### Parameter Count & Compute
- Total Trainable Parameters: **94,409**
- Inference Latency: $\approx 1.2\text{ ms}$ per 30-day sequence on CPU; batch throughput $> 35,000$ sequences/sec.
- Training Loss: Combined SmoothL1 regression loss ($\beta = 0.5$) + Weighted BCE event classification loss ($\lambda_{\text{event}} = 0.10$).

---

## 2. Intended Use & Target Tasks

### Intended Tasks
1. **Residual Streamflow Forecasting:** Predict expected daily specific discharge ($Q$, mm/day) at $+1$, $+3$, and $+7$ days ahead for monitored river gauges.
2. **Flood Hazard Exceedance Probability Estimation:** Estimate calibrated probabilities of daily discharge exceeding catchment-specific historical P95 (major high flow) and P99 (extreme flood hazard) thresholds.

### Out-of-Scope / Non-Supported Tasks
- **Not an Inundation / Flood-Plain Simulator:** Does not predict water depth, flood extents, street inundation, or infrastructure damage.
- **Not a Scenario Sensitivity Toy:** Does not support single-day arbitrary rainfall sliders; requires a continuous physical 30-day history.
- **Not for Autonomous Emergency Alerting:** Experimental research system; must not be used as an unvetted early warning siren.

---

## 3. Training & Validation Data

- **Primary Hydrometeorological Dataset:** CAMELS-BR v1.2 (788 continuous catchments spanning all Brazilian biomes).
- **Spatial Grouping:** KMeans clustering ($k=20$) on coordinate space:
  - **Training:** 14 clusters (552 catchments, 1980–2024).
  - **Validation:** 3 clusters (118 catchments, 1980–2024).
  - **Testing:** 3 clusters (118 catchments; 115 threshold-eligible, 725,921 test origins from 2001–2024).
- **Temporal Baseline Reference Period:** 1980-01-01 through 2000-12-31 used exclusively for historical P95 and P99 threshold calculations and feature normalizers.

---

## 4. Input Features Contract

### Dynamic Inputs (30-day historical sequence)
1. `streamflow_mm`: Daily specific discharge ($Q$, mm/day $\ge 0$). Log-transformed $\ln(1 + Q)$ and standardized.
2. `precipitation_mm`: Daily areal mean precipitation ($P$, mm/day $\ge 0$). Log-transformed $\ln(1 + P)$ and standardized.
3. `temperature_c`: Daily mean 2m air temperature ($T$, °C). Standardized.

### Static Inputs (29 physical attributes)
- Topography (4): `elev_gauge`, `elev_mean`, `slope_mean`, `area`
- Soil & Geology (11): `sand_perc`, `silt_perc`, `clay_perc`, `org_carbon_content`, `bedrock_depth`, `water_table_depth`, `geol_class_1st_perc`, `geol_class_2nd_perc`, `carb_rocks_perc`, `geol_porosity`, `geol_permeability`
- Land Cover (9): `crop_perc`, `crop_mosaic_perc`, `forest_perc`, `shrub_perc`, `grass_perc`, `barren_perc`, `imperv_perc`, `wet_perc`, `snow_perc`, `dom_land_cover_perc`
- Human Influence (4): `consumptive_use`, `consumptive_use_perc`, `reservoirs_vol`, `regulation_degree`

---

## 5. Quantitative Evaluation Summary

### Out-of-Cluster Test Regression Performance (725,921 origins)
| Horizon | Model | Macro MAE (mm/day) | Macro RMSE (mm/day) | Macro NSE | Improvement over Persistence |
| :---: | :--- | :---: | :---: | :---: | :---: |
| **+1 Day** | **BasinShiftMultiTask** | **0.10511** | **0.37013** | **0.83995** | **+14.3% MAE** |
| | Persistence Baseline | 0.12262 | 0.42366 | 0.79406 | Baseline |
| **+3 Days** | **BasinShiftMultiTask** | **0.18464** | **0.54435** | **0.65363** | **+18.4% MAE** |
| | Persistence Baseline | 0.22614 | 0.65718 | 0.50051 | Baseline |
| **+7 Days** | **BasinShiftMultiTask** | **0.25650** | **0.67043** | **0.46499** | **+18.8% MAE** |
| | Persistence Baseline | 0.31581 | 0.82260 | 0.19654 | Baseline |

### Flood Hazard Classification Performance (115 Test Catchments)
| Event Task | Prevalence | AUPRC | ROC-AUC | Brier Score | ECE | F1 Score | Decision Threshold ($\tau$) |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **P95 +1d** | 3.02% | **0.5844** | 0.9691 | 0.0181 | 0.0042 | **0.5530** | 0.2372 |
| **P99 +1d** | 0.60% | **0.2988** | 0.9765 | 0.0048 | 0.0005 | **0.3732** | 0.1371 |
| **P95 +3d** | 3.03% | **0.4203** | 0.9485 | 0.0217 | 0.0028 | **0.4425** | 0.1660 |
| **P99 +3d** | 0.60% | **0.1512** | 0.9578 | 0.0055 | 0.0011 | **0.2481** | 0.0938 |
| **P95 +7d** | 3.06% | **0.2491** | 0.9082 | 0.0256 | 0.0028 | **0.3121** | 0.1192 |
| **P99 +7d** | 0.62% | **0.0664** | 0.9186 | 0.0060 | 0.0011 | **0.1133** | 0.0712 |

---

## 6. Known Scientific Limitations & Failure Modes

1. **Rare Event Skill Degradation at +7 Days:**
   Extreme P99 flood hazard detection at +7 days has high uncertainty (AUPRC = 0.066, recall = 10.4%). It must not be relied upon as an autonomous warning.
2. **Strict Complete History Requirement:**
   The model requires exactly 30 contiguous days of observations without NaNs. Missing sequences are rejected with HTTP 400.
3. **Static Characteristic Temporal Drift:**
   Static land cover and human water usage reflect pre-2017 baselines; recent dam commissionings or localized deforestation post-2017 are not captured in static embeddings.
4. **No Formal Conformal Guarantee:**
   While validation-derived empirical prediction intervals achieve nominal ~90% and ~95% coverage globally, coverage varies from 68% to 100% across individual catchments due to hydrological spatial heterogeneity.

