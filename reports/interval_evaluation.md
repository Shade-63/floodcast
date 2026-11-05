# FLOODCAST — Empirical Prediction Interval Evaluation Report

**Evaluation Framework:** Post-Hoc Validation Residual Error Quantiles  
**Calibration Split:** Validation Geographic Clusters (118 catchments, 5,941 samples)  
**Evaluation Split:** Untouched Test Geographic Clusters (115 catchments, 725,921 test origins)  
**Report Date:** November 5, 2026  
**Auditor:** ML Evaluation Researcher & Hydrological Modeling Lead  

---

## 1. Executive Summary & Purpose

The authoritative **BasinShiftMultiTask** model outputs deterministic expected discharge point estimates ($\widehat{Q}_{t+h}$) and calibrated exceedance probabilities for P95 and P99 flood hazard thresholds.

To close the uncertainty gap without retraining the core neural architecture, this investigation derives and evaluates **empirical post-hoc prediction intervals** calibrated strictly on out-of-cluster validation residuals:
$$\widehat{Q}_{t+h}^{\text{lower}} = \max(\widehat{Q}_{t+h} - q_{\alpha, h}, 0), \quad \widehat{Q}_{t+h}^{\text{upper}} = \widehat{Q}_{t+h} + q_{\alpha, h}$$
where $q_{\alpha, h}$ is the validation absolute error quantile for nominal coverage $(1 - \alpha)$ at lead time $h$.

---

## 2. Validation Calibration Quantiles

Quantiles were computed strictly on validation residuals ($| \widehat{Q} - Q_{\text{true}} |$) without using test set data:

| Horizon | Nominal 90% Error Margin ($q_{0.10}$) | Nominal 95% Error Margin ($q_{0.05}$) | Validation Sample Size |
| :---: | :---: | :---: | :---: |
| **+1 Day** | **$0.1676\text{ mm/day}$** | **$0.3624\text{ mm/day}$** | 5,941 |
| **+3 Days** | **$0.3787\text{ mm/day}$** | **$0.7503\text{ mm/day}$** | 5,937 |
| **+7 Days** | **$0.6228\text{ mm/day}$** | **$1.2296\text{ mm/day}$** | 5,932 |

---

## 3. Out-of-Sample Test Evaluation (725,921 Forecast Origins)

| Horizon | Nominal Coverage | Observed Test Coverage (Pooled) | Macro Catchment Coverage | Min Catchment Coverage | Max Catchment Coverage | Mean Interval Width | Status |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **+1 Day** | 90.0% | **89.06%** | **88.96%** | 68.20% | 100.0% | $0.313\text{ mm/day}$ | **VALIDATED** |
| **+1 Day** | 95.0% | **94.69%** | **94.62%** | 76.95% | 100.0% | $0.634\text{ mm/day}$ | **VALIDATED** |
| **+3 Days** | 90.0% | **90.02%** | **89.89%** | 68.46% | 100.0% | $0.664\text{ mm/day}$ | **VALIDATED** |
| **+3 Days** | 95.0% | **95.37%** | **95.29%** | 78.86% | 100.0% | $1.185\text{ mm/day}$ | **VALIDATED** |
| **+7 Days** | 90.0% | **91.08%** | **90.95%** | 70.46% | 100.0% | $1.022\text{ mm/day}$ | **VALIDATED** |
| **+7 Days** | 95.0% | **96.25%** | **96.18%** | 82.96% | 100.0% | $1.770\text{ mm/day}$ | **VALIDATED** |

---

## 4. Key Scientific Disclosures & Limitations

> [!WARNING]
> **No Guaranteed Conformal Coverage Under Spatial Heterogeneity:**
> 1. While overall pooled coverage closely tracks the nominal targets ($89.1\%$ vs $90.0\%$, $94.7\%$ vs $95.0\%$), **catchment-level coverage varies widely from 68.2% to 100.0%**.
> 2. Flash-flood prone mountain catchments with high streamflow variance experience severe under-coverage ($\sim 68\% - 76\%$), while low-gradient lowland rivers with damp hydrographs achieve $> 98\%$ coverage.
> 3. Standard split-conformal prediction theorems assume **exchangeability** ($IID$). Hydrological time series exhibit both temporal autocorrelation and spatial domain shift across Brazilian biomes, violating exchangeability.
> 4. Consequently, these empirical bands are designated as **"Experimental Post-Hoc Error Margins"** rather than certified mathematical prediction intervals.

---

## 5. Deployment Recommendation

- In the interactive dashboard and API, these empirical intervals may be exposed under an expandable **Experimental Uncertainty** toggle, accompanied by clear visual disclosure of lead-time width ($0.31\text{ mm/day}$ at +1d to $1.77\text{ mm/day}$ at +7d) and regional variation warnings.

