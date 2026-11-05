# FLOODCAST — Spatial Split and Geographic Holdout Audit

**Benchmarking Formulation:** Geographic Cluster Holdout (KMeans $k=20$)  
**Dataset:** CAMELS-BR v1.2 (788 eligible catchments)  
**Audit Date:** November 5, 2026  
**Auditor:** ML Evaluation Researcher & Hydrological Data Engineer  

---

## 1. Executive Summary & Formulation Defense

The benchmarking experiment is strictly formulated as:
> **"Geographic cluster holdout across Brazilian catchments, with historical observations available for forecast context."**

It is **NOT**:
- A global hydrological generalization test (the model is trained exclusively on Brazilian biomes).
- A zero-shot data-free ungauged basin transfer (the model requires 30 days of continuous antecedent streamflow, rainfall, and temperature at the target gauge).
- A completely unseen hydrological history test (the model uses recent antecedent context at the test station to establish initial hydrologic state $z_0$).

---

## 2. Spatial Clustering Methodology

1. **Feature Space for Spatial Partitioning:**
   Clustering was conducted on latitude and longitude coordinates corrected for latitudinal convergence:
   $$\mathbf{x}_{\text{geo}} = [\text{lat}, \text{lon} \cdot \cos(\bar{\phi})]$$
   where $\bar{\phi}$ is the mean latitude of eligible Brazilian catchments.
2. **KMeans Configuration:**
   - Number of clusters: $k = 20$.
   - Clusters assigned to **Training:** 14 clusters (Clusters 1, 2, 3, 4, 6, 9, 10, 11, 13, 14, 15, 16, 17, 18) $\to 552$ catchments (70.05%).
   - Clusters assigned to **Validation:** 3 clusters (Clusters 5, 7, 12) $\to 118$ catchments (14.97%).
   - Clusters assigned to **Testing:** 3 clusters (Clusters 0, 8, 19) $\to 118$ catchments (14.97%).
3. **Identity Disjointness:**
   $$\text{Train} \cap \text{Val} = \emptyset, \quad \text{Train} \cap \text{Test} = \emptyset, \quad \text{Val} \cap \text{Test} = \emptyset$$
   Zero catchment overlap across any split.

---

## 3. Nearest Station Distance Audit

To assess spatial autocorrelation and spillover between splits, geodesic (Haversine) distances were computed between all stations:

| Distance Metric | Minimum (km) | 25th Pct (km) | Median (km) | Mean (km) | Maximum (km) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Test Station to Nearest Train Station** | **9.2 km** | 114.2 km | **196.1 km** | **201.9 km** | 452.4 km |
| **Val Station to Nearest Train Station** | **26.9 km** | 128.5 km | **196.4 km** | **217.9 km** | 567.4 km |
| **Test Station to Nearest Val Station** | **40.5 km** | 280.1 km | **502.1 km** | **469.0 km** | 872.0 km |

### Critical Scientific Disclosure: KMeans Cluster Holdout vs Geographic Buffers
> [!IMPORTANT]
> A KMeans spatial cluster holdout groups spatially proximate stations into contiguous regional blocks. However, **it does not enforce a strict zero-mile spatial buffer zone**.
> As shown in the distance audit, while the **median distance from a test station to the nearest training station is 196.1 km**, catchments situated near cluster boundaries can be as close as **9.2 km** to a training catchment.
> This disclosure is technically vital: spatial correlation in regional meteorological forcings (e.g., mesoscale convective storms) can span $50 - 200\text{ km}$, meaning cluster holdout represents regional transfer rather than isolated continental out-of-domain generalization.

---

## 4. Catchment Characteristic Distributions Across Splits

Below is the verified distribution of physical and hydrological characteristics across splits:

| Split | Catchments | Threshold Eligible | Mean Area ($\text{km}^2$) | Median Area ($\text{km}^2$) | Mean Elevation (m) | Median Elevation (m) | Mean Record Length (Years) | Mean Valid Windows |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Train** | 552 | 541 | 55,472 | 2,372 | 674.8 | 692.9 | 43.5 | 12,298 |
| **Validation** | 118 | 118 | 16,299 | 2,861 | 628.7 | 645.2 | 42.1 | 11,444 |
| **Test** | 118 | 115 | 40,559 | 5,230 | 646.2 | 701.6 | 42.5 | 12,028 |

### Distribution Observations
1. **Topography and Elevation:** Mean catchment elevation is well-balanced across all splits ($628\text{ m} - 675\text{ m}$), indicating similar mountain and plateau representations.
2. **Basin Scale:** Median basin sizes range from $2,372\text{ km}^2$ in training to $5,230\text{ km}^2$ in testing, reflecting a slight shift toward larger drainage basins in test clusters 0, 8, and 19.
3. **Record Length:** All three partitions average over $42$ years of daily records spanning 1980 through 2024.

---

## 5. Temporal Leakage Audit

1. **Forecast Horizon Construction:**
   - For every origin timestamp $t_0$, the input window strictly covers $[t_0 - 29, t_0]$.
   - Targets are future values at $t_0 + 1$, $t_0 + 3$, and $t_0 + 7$.
   - **Zero Future Leakage:** No observations from $t > t_0$ are included in input tensors $X$ or static embeddings $S$.
2. **Evaluation Period:**
   - Out-of-sample evaluation period strictly spans **2001-01-01 to 2024-07-31**.
   - Climatological threshold estimation period strictly spans **1980-01-01 to 2000-12-31** (clean historical baseline).
   - This temporal separation prevents target threshold overfitting.

