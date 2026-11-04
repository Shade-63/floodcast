# BASINSHIFT Model Integration Guide

This document specifies the exact model architecture, training transformations, feature orderings, target reconstruction, and probability calibration protocols implemented in FLOODCAST.

---

## 1. Multi-Task Architecture (`BasinShiftMultiTask`)

The architecture integrates recurrent temporal sequence processing with non-linear static catchment representations:

```python
class BasinShiftMultiTask(nn.Module):
    def __init__(self, dynamic_features=3, static_features=29, hidden_size=64, num_layers=2):
        super().__init__()
        # Temporal Encoder
        self.lstm = nn.LSTM(
            input_size=dynamic_features,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=0.15
        )
        # Static Catchment Encoder
        self.static_encoder = nn.Sequential(
            nn.Linear(static_features, 64),
            nn.ReLU(),
            nn.LayerNorm(64),
            nn.Dropout(0.10),
            nn.Linear(64, 64),
            nn.ReLU()
        )
        # Regression Fusion Head
        self.fusion = nn.Sequential(
            nn.Linear(hidden_size + 64, 128),
            nn.ReLU(),
            nn.Dropout(0.15),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Linear(64, 3) # Residuals for +1d, +3d, +7d
        )
        # Event Head
        self.event_head = nn.Sequential(
            nn.Linear(hidden_size + 64, 64),
            nn.ReLU(),
            nn.Dropout(0.15),
            nn.Linear(64, 6) # Logits: P95/P99 at +1d, +3d, +7d
        )
```

---

## 2. Feature Definitions & Normalization

### 2.1 Dynamic Channels (3 channels x 30 days)
1. `streamflow` ($q$ in mm/day):
   $$q_{\text{trans}} = \log(1 + \max(q, 0))$$
2. `precipitation` ($p$ in mm/day):
   $$p_{\text{trans}} = \log(1 + \max(p, 0))$$
3. `temperature` ($T$ in $^\circ\text{C}$):
   $$T_{\text{trans}} = T$$

Normalization parameters from training split (`basinshift_scalers.npz`):
- $\mu_{\text{dyn}} = [0.80632004, 1.0480738, 21.0137414]$
- $\sigma_{\text{dyn}} = [0.55170768, 1.07088513, 4.20596198]$
- Formula: $x_{\text{norm}} = (x - \mu_{\text{dyn}}) / \sigma_{\text{dyn}}$

### 2.2 Static Catchment Features (29 attributes)
The 29 features must follow the exact order:
1. Topography: `elev_gauge`, `elev_mean`, `slope_mean`, `area`
2. Soil: `sand_perc`, `silt_perc`, `clay_perc`, `org_carbon_content`, `bedrock_depth`, `water_table_depth`
3. Geology: `geol_class_1st_perc`, `geol_class_2nd_perc`, `carb_rocks_perc`, `geol_porosity`, `geol_permeability`
4. Land cover: `crop_perc`, `crop_mosaic_perc`, `forest_perc`, `shrub_perc`, `grass_perc`, `barren_perc`, `imperv_perc`, `wet_perc`, `snow_perc`, `dom_land_cover_perc`
5. Human intervention: `consumptive_use`, `consumptive_use_perc`, `reservoirs_vol`, `regulation_degree`

Transformations:
- `area` and `reservoirs_vol`: $\log(1 + \text{val})$
- Missing values: Imputed with training set medians (`static_medians`)
- Standardization: $(s - \mu_{\text{static}}) / \sigma_{\text{static}}$
- In production, static scaled vectors are loaded directly from `basinshift_static_scaled.npy` (index-matched to `basin_idx`).

---

## 3. Residual Streamflow Target Reconstruction

The neural network predicts standardized log-residual increments $\delta_h$ for each horizon $h \in \{+1, +3, +7\}$:
$$z_0 = \log(1 + \max(q_{\text{latest}}, 0))$$
$$z_h = z_0 + \delta_h \cdot \sigma_{\text{target}} \quad (\text{clipped to } [-20, 20])$$
$$\hat{q}_h = \max(\exp(z_h) - 1, 0)$$
where $\sigma_{\text{target}} = 0.55170768$.

---

## 4. Platt Calibration & Hierarchy Enforcement

1. **Platt Scaling:**
   Fitted on validation split logits using Scikit-Learn `Pipeline(StandardScaler(), LogisticRegression(C=10.0))` for each of the 6 event targets.
2. **Physical Hierarchy Constraint:**
   The occurrence probability of exceeding the 99th percentile flow threshold must mathematically never exceed the probability of exceeding the 95th percentile flow threshold:
   $$P_{\text{calib}}(\text{P99}_{+h}) \leftarrow \min(P_{\text{calib}}(\text{P99}_{+h}), P_{\text{calib}}(\text{P95}_{+h}))$$
   for each horizon $h \in \{+1, +3, +7\}$.
3. **Decision Thresholds:**
   - P95 +1d: `0.237221`
   - P99 +1d: `0.137087`
   - P95 +3d: `0.165968`
   - P99 +3d: `0.093761`
   - P95 +7d: `0.119219`
   - P99 +7d: `0.071246`

