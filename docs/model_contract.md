# BASINSHIFT Model Contract & Specification

**Model Architecture:** `BasinShiftMultiTask` (PyTorch)  
**Checkpoint:** `basinshift_multitask_best.pt` (`SHA-256: 73e8de64ee3e9714f3c8a8057467c534b988ca51b790bd38022579e6a8c56c4e`)  
**Calibration Artifact:** `basinshift_calibration.joblib` (`SHA-256: ea32632e9ad4146ffa44d298ba48bae1a948ad8a373dd10adacab5222d57f990`)  
**Scaler Artifact:** `basinshift_scalers.npz` (`SHA-256: 84eb7f16481e5a2c5dc2e086ec77a2b96a5dfad6dd048c1bbf2d0e3b9c6f15d5`)  
**Feature Config:** `feature_config.json` (`SHA-256: 088a17a1e14f958f94deaf48172d5e9e03a8eb703c724f90cfcb36bab5575f75`)

---

## 1. Mathematical Formulation & Architecture

The **BasinShiftMultiTask** neural network predicts future daily streamflow residuals and calibrated flood hazard exceedance probabilities simultaneously from 30 continuous antecedent daily observations and 29 static catchment characteristics.

### Neural Topology
- **Temporal LSTM Encoder:**
  - Input dimension: 3 (daily streamflow, precipitation, temperature)
  - Hidden dimension: 64
  - Layers: 2
  - Dropout: 0.15
  - Output: Hidden state of last layer at terminal step: $h_T \in \mathbb{R}^{64}$
- **Static Catchment Encoder:**
  - Input dimension: 29 physical descriptors
  - Layer 1: $\text{Linear}(29 \to 64) \to \text{ReLU} \to \text{LayerNorm}(64) \to \text{Dropout}(0.10)$
  - Layer 2: $\text{Linear}(64 \to 64) \to \text{ReLU}$
  - Output: Catchment embedding $s \in \mathbb{R}^{64}$
- **Feature Fusion:**
  - Concatenation: $z = [h_T, s] \in \mathbb{R}^{128}$
- **Residual Regression Head:**
  - $\text{Linear}(128 \to 128) \to \text{ReLU} \to \text{Dropout}(0.15) \to \text{Linear}(128 \to 64) \to \text{ReLU} \to \text{Linear}(64 \to 3)$
  - Output: $\boldsymbol{\delta} = [\delta_1, \delta_3, \delta_7] \in \mathbb{R}^3$ (standardized residual log-flow shifts)
- **Extreme Event Classification Head:**
  - $\text{Linear}(128 \to 64) \to \text{ReLU} \to \text{Dropout}(0.15) \to \text{Linear}(64 \to 6)$
  - Output: $\mathbf{l} \in \mathbb{R}^6$ (uncalibrated logits for 6 event tasks)

---

## 2. Dynamic Input Contract

The model requires exactly **30 continuous daily observations** ending at forecast origin date $t_0$.

### Variables, Channels, and Units
| Channel Index | Variable Name | Physical Unit | Valid Range | Missing Policy |
| :---: | :--- | :--- | :--- | :--- |
| `0` | Daily Streamflow ($Q$) | mm/day | $[0.0, \infty)$ | No missing values allowed |
| `1` | Daily Precipitation ($P$) | mm/day | $[0.0, \infty)$ | No missing values allowed |
| `2` | Mean Daily Temperature ($T$) | °C | $[-40.0, 55.0]$ | No missing values allowed |

### Dynamic Feature Preprocessing
1. **Physical Boundary Floor:**
   $$Q = \max(Q, 0.0), \quad P = \max(P, 0.0)$$
2. **Log-Transform:**
   $$Q_{\log} = \ln(1 + Q), \quad P_{\log} = \ln(1 + P)$$
3. **Training-Fitted Standardization:**
   $$x_t = \frac{[Q_{\log}, P_{\log}, T] - \boldsymbol{\mu}_{\text{dyn}}}{\boldsymbol{\sigma}_{\text{dyn}}}$$
   Where:
   - $\boldsymbol{\mu}_{\text{dyn}} = [0.80632004, 1.0480738, 21.0137414]$
   - $\boldsymbol{\sigma}_{\text{dyn}} = [0.55170768, 1.07088513, 4.20596198]$

---

## 3. Static Catchment Input Contract

The static branch ingests exactly **29 fixed catchment descriptors**.

### Feature Index and Ordering
| Index | Feature Name | Category | Description | Unit |
| :---: | :--- | :--- | :--- | :--- |
| 0 | `elev_gauge` | Topography | Elevation of streamflow gauge | m |
| 1 | `elev_mean` | Topography | Catchment mean elevation | m |
| 2 | `slope_mean` | Topography | Catchment mean terrain slope | m/km |
| 3 | `area` | Topography | Contributing catchment drainage area | km² |
| 4 | `sand_perc` | Soil | Topsoil sand fraction | % |
| 5 | `silt_perc` | Soil | Topsoil silt fraction | % |
| 6 | `clay_perc` | Soil | Topsoil clay fraction | % |
| 7 | `org_carbon_content`| Soil | Soil organic carbon concentration | g/kg |
| 8 | `bedrock_depth` | Soil | Depth to unweathered bedrock | cm |
| 9 | `water_table_depth` | Soil | Estimated unconfined water table depth | cm |
| 10 | `geol_class_1st_perc`| Geology | Percentage of dominant surface lithology class | % |
| 11 | `geol_class_2nd_perc`| Geology | Percentage of secondary surface lithology class| % |
| 12 | `carb_rocks_perc` | Geology | Karst and carbonate rock fraction | % |
| 13 | `geol_porosity` | Geology | Volumetric porosity fraction | ratio |
| 14 | `geol_permeability` | Geology | Intrinsic rock permeability $\log_{10}(k / \text{m}^2)$ | $\log_{10}(\text{m}^2)$ |
| 15 | `crop_perc` | Land Cover | Annual & perennial cropland | % |
| 16 | `crop_mosaic_perc` | Land Cover | Cropland and natural vegetation mosaic | % |
| 17 | `forest_perc` | Land Cover | Closed and open tree canopy forest | % |
| 18 | `shrub_perc` | Land Cover | Woody shrubland | % |
| 19 | `grass_perc` | Land Cover | Grassland and pasture | % |
| 20 | `barren_perc` | Land Cover | Sparsely vegetated / bare soil | % |
| 21 | `imperv_perc` | Land Cover | Artificial impervious surfaces | % |
| 22 | `wet_perc` | Land Cover | Open water bodies and wetlands | % |
| 23 | `snow_perc` | Land Cover | Permanent / seasonal snow & ice cover | % |
| 24 | `dom_land_cover_perc`| Land Cover| Percentage of predominant land cover class | % |
| 25 | `consumptive_use` | Human Influence| Consumptive water extraction rate | m³/s |
| 26 | `consumptive_use_perc`| Human Influence| Extraction rate relative to long-term mean flow| % |
| 27 | `reservoirs_vol` | Human Influence| Upstream reservoir storage volume | hm³ |
| 28 | `regulation_degree` | Human Influence| Storage volume relative to annual flow volume | % |

### Missing-Value Imputation and Standardization
- Any missing or NaN static value is imputed with the **training set median** vector ($\mathbf{M}_{\text{static}}$).
- Standardized via training parameters:
  $$\mathbf{s} = \frac{\mathbf{S} - \boldsymbol{\mu}_{\text{static}}}{\boldsymbol{\sigma}_{\text{static}}}$$
  Parameters stored in `basinshift_scalers.npz`.

---

## 4. Prediction Reconstruction (Residual Formulation)

The model predicts future streamflow not as raw unbounded values, but as normalized residual deviations from the latest observed flow at forecast origin $t_0$:

1. Compute baseline log-streamflow at origin:
   $$z_0 = \ln(1 + \max(Q_{t_0}, 0))$$
2. Predict future log-streamflow:
   $$z_{t_0 + h} = z_0 + \delta_h \cdot \sigma_{\text{target}}$$
   where $\sigma_{\text{target}} = 0.5517076794077588$.
3. Exponentiate with numerical stability bounds:
   $$\widehat{Q}_{t_0 + h} = \max(\exp(\text{clip}(z_{t_0 + h}, -20.0, 20.0)) - 1.0, 0.0)$$

---

## 5. Event Calibration & Physical Hierarchy Enforcement

### Six Event Tasks
1. `P95 +1d`: Streamflow exceeding catchment climatological P95 threshold at $+1$ day.
2. `P99 +1d`: Streamflow exceeding catchment climatological P99 threshold at $+1$ day.
3. `P95 +3d`: Streamflow exceeding catchment climatological P95 threshold at $+3$ days.
4. `P99 +3d`: Streamflow exceeding catchment climatological P99 threshold at $+3$ days.
5. `P95 +7d`: Streamflow exceeding catchment climatological P95 threshold at $+7$ days.
6. `P99 +7d`: Streamflow exceeding catchment climatological P99 threshold at $+7$ days.

### Platt Calibration Pipeline
Each logit $l_j$ is passed through a validation-fitted Platt calibrator:
$$\pi_j = \text{Calibrator}_j(l_j) \in (0, 1)$$
Pipeline: `sklearn.pipeline.make_pipeline(StandardScaler(), LogisticRegression(C=10.0, solver="lbfgs"))`.

### Physical Hierarchy Enforcement
By Kolmogorov axioms and hydrology, the 99th percentile flow is strictly higher than the 95th percentile flow ($Q_{\text{P99}} > Q_{\text{P95}}$). Consequently, the probability of exceeding P99 cannot exceed the probability of exceeding P95:
$$P(Q > Q_{\text{P99}}) \le P(Q > Q_{\text{P95}})$$
The model service enforces this condition across all forecast horizons:
$$p(\text{P99} +h\text{d}) \leftarrow \min(p(\text{P99} +h\text{d}), p(\text{P95} +h\text{d})) \quad \forall h \in \{1, 3, 7\}$$

### Validation-Derived Decision Thresholds (F1-Optimal)
| Event Task | Decision Threshold ($\tau$) | Validation Target |
| :--- | :---: | :--- |
| `P95 +1d` | **0.237221** | Optimal F1 score on validation cluster holdout |
| `P99 +1d` | **0.137087** | Optimal F1 score on validation cluster holdout |
| `P95 +3d` | **0.165968** | Optimal F1 score on validation cluster holdout |
| `P99 +3d` | **0.093761** | Optimal F1 score on validation cluster holdout |
| `P95 +7d` | **0.119219** | Optimal F1 score on validation cluster holdout |
| `P99 +7d` | **0.071246** | Optimal F1 score on validation cluster holdout |

Binary prediction: $\widehat{Y}_j = \mathbb{I}(\pi_j \ge \tau_j)$.

---

## 6. Failure Modes & Contract Validation Rules

The API and inference engine strictly reject requests under any of the following conditions:

1. **Incomplete Dynamic Sequence:** Fewer or more than 30 daily observations. (Rejection: HTTP 400).
2. **Missing Dates / Non-Consecutive Days:** Sequence must be exactly continuous 1-day step. (Rejection: HTTP 400).
3. **Non-Finite Values:** Any NaN, null, `+inf`, or `-inf` in $Q, P,$ or $T$. (Rejection: HTTP 400).
4. **Physical Impossibility:** Negative precipitation ($P < 0$) or negative streamflow ($Q < 0$).
5. **Unknown Catchment:** Catchment `gauge_id` not found in `basin_index_map.csv`. (Rejection: HTTP 404).
6. **No Silent Imputation:** Missing dynamic days are never silently filled by forward-fill or zero-fill.

