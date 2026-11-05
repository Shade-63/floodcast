# FLOODCAST — Data Quality & Integrity Report

**Dataset:** CAMELS-BR v1.2 (Hydrometeorological dataset for 897 Brazilian catchments)  
**Evaluation Scope:** 1980-01-01 through 2024-07-31  
**Audit Date:** November 5, 2026  
**Auditor:** Hydrological Data Engineering Lead  

---

## 1. Executive Summary

This report establishes the data quality, temporal continuity, and record integrity across all 897 catchments in CAMELS-BR v1.2. The benchmark targets daily streamflow ($Q$, mm/day), daily precipitation ($P$, mm/day), and daily mean temperature ($T$, °C).

### Key Findings
- **Total Monitored Catchments:** 897 catchments across all major Brazilian hydrological macro-regions.
- **Continuous 3-Year Quality Gate:** 788 catchments ($\ge 1,095$ continuous days of joint streamflow and meteorological records) qualified for the spatial benchmarking partition.
- **Filtered Out (109 catchments):** 109 catchments exhibited highly fragmented time series, severe gauge downtime, or gaps preventing minimum 30-day antecedent sequence construction.
- **Threshold Climatological Reference Baseline (1980–2000):** 
  - 115 of 118 test catchments had sufficient continuous historical daily records during 1980–2000 to define statistically robust P95 and P99 flood hazard thresholds.
  - 3 test catchments were excluded from threshold evaluation due to severe pre-2001 missingness.

---

## 2. Catchment Filtering & Quality Gates

The dataset pipeline enforced strict data completeness gates before sample generation:

```
Total CAMELS-BR v1.2 Catchments: 897
       │
       ├─► Failed 3-Year Continuous Joint Streak (< 1,095 days): 109 catchments (12.15%)
       │
       ▼
Benchmark-Eligible Catchments: 788 (87.85%)
       │
       ├─► Training Split (14 geographic clusters): 552 catchments
       ├─► Validation Split (3 geographic clusters): 118 catchments
       └─► Test Split (3 geographic clusters): 118 catchments
             │
             ├─► Threshold-Eligible Test Catchments: 115 catchments
             └─► Ineligible Test Catchments (Insufficient 1980–2000 data): 3 catchments
```

---

## 3. Disclosed Ineligible Test Catchments

In the test holdout (Clusters 0, 8, 19), three catchments were flagged as **threshold-ineligible** and excluded from extreme event metric evaluation:

| Gauge ID | Basin Index | Geo Cluster | Reference Obs (1980–2000) | Reference Coverage | Reason for Exclusion |
| :---: | :---: | :---: | :---: | :---: | :--- |
| `42546000` | 245 | 8 | 0 | 0.00% | Streamflow gauge established post-2000. Zero historical observations in reference baseline. |
| `54260000` | 363 | 8 | 2,311 | 30.13% | Excessive sensor downtime ($< 50\%$ required reference coverage). |
| `54950000` | 374 | 8 | 3,332 | 43.44% | Missing early operational records ($< 50\%$ required reference coverage). |

*Technical note:* These catchments remain fully evaluated for continuous daily streamflow regression metrics (MAE, RMSE, NSE), but cannot be scored for P95/P99 binary event metrics because their historical climatological percentiles cannot be reliably determined.

---

## 4. Physical Plausibility and Invariant Audit

All time series records were audited for physical anomalies:
1. **Streamflow:** No negative discharge values ($Q \ge 0$). Sensor dropouts represented as explicit NaNs, which are rejected at inference time.
2. **Precipitation:** No negative precipitation ($P \ge 0$). Zero-precipitation days preserved without artificial noise injection.
3. **Temperature:** Plausible tropical and subtropical ranges ($[-2.5^\circ\text{C}, 42.1^\circ\text{C}]$).
4. **Static Basin Characteristics:**
   - Catchment area: $10.8\text{ km}^2$ to $4,720,020\text{ km}^2$ (Amazon basin outlet).
   - Mean basin elevation: $15\text{ m}$ to $1,842\text{ m}$.
   - Soil fractions: Sand, silt, and clay sum to $100\%$ within SoilGrids measurement tolerances.
   - Land cover fractions: Derived from MapBiomas land cover classification.

---

## 5. Non-Fabrication & Non-Imputation Rule

In compliance with hydrological modeling standards and competition rules:
- **No silent forward-fill:** The inference service strictly rejects sequences containing missing days or NaNs.
- **Strict 30-day window:** Every prediction origin must have 30 strictly contiguous, consecutive daily timestamps. If any day is missing, the model returns HTTP 400.

