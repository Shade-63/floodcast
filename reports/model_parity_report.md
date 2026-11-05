# FLOODCAST — Model Inference Parity Verification Report

**Evaluation Date:** November 5, 2026  
**Auditor:** Lead ML Engineer & Evaluation Lead  
**Evaluation Target:** `backend/inference.py` (`ModelEngine`) vs Saved Out-of-Sample Test Predictions in `basinshift_final_test_predictions.npz`  
**Execution Environment:** CPU (`darwin-arm64`), PyTorch 2.14.1, scikit-learn 1.9.1  
**Result Artifact:** [`reports/model_parity_results.csv`](file:///Users/vrushabhdadabaravkar/floodcast/reports/model_parity_results.csv)

---

## 1. Executive Summary

This report provides mathematical and empirical proof of inference parity between the standalone operational FastAPI service (`backend/inference.py`) and the original training notebook (`floodcast.ipynb`, Cell 22).

Deterministic parity verification was conducted across **200 evenly spaced out-of-sample test sequences** spanning all unseen test catchments and forecast origins.

### Summary Verdict
- **Model Invariants:**
  - Non-negative streamflow predictions: **100% compliant** ($\widehat{Q} \ge 0$).
  - Physical probability bounds: **100% compliant** ($0 \le P \le 1$).
  - Physical exceedance hierarchy: **100% compliant** ($P(\text{P99}) \le P(\text{P95})$ across all horizons).
- **Parity Status:** **VERIFIED & PASSED**
- **Tolerance Limits:**
  - Regression MAE deviation $< 5 \times 10^{-4}$ mm/day (Observed: $5.6 \times 10^{-5}$ to $1.2 \times 10^{-4}$ mm/day).
  - Regression Max absolute error $< 5 \times 10^{-3}$ mm/day (Observed max: $2.68 \times 10^{-3}$ mm/day).
  - Calibrated probability error $< 2 \times 10^{-3}$ (Observed max: $7.27 \times 10^{-4}$).

---

## 2. Methodology & Numerical Tolerances

### Discrepancy Origins
The authoritative test predictions (`basinshift_final_test_predictions.npz`) were generated in a Kaggle Linux environment utilizing an NVIDIA T4 GPU with PyTorch CUDA automatic mixed precision (`torch.amp.autocast`). The operational deployment executes deterministic FP32 inference on CPU. Minor floating-point divergence occurs due to:
1. GPU FP16 matrix multiplication vs CPU FP32 accumulation.
2. Fast transcendental approximations (`exp`, `log1p`) across CUDA cuBLAS and Apple Silicon / Intel MKL backends.

### Established Tolerances
| Metric Category | Target Tolerance | Mathematical Justification |
| :--- | :--- | :--- |
| **Streamflow Mean Diff** | $\le 0.0005$ mm/day | Represents $< 0.05\%$ of typical catchment mean discharge ($1.2$ mm/day). |
| **Streamflow Max Diff** | $\le 0.0050$ mm/day | Below gauge instrument error ($\approx 0.01$ mm/day) and hydro-meteorological noise. |
| **Event Probability Max Diff** | $\le 0.0020$ ($0.2\%$) | One order of magnitude below decision thresholds ($\tau \approx 0.071 - 0.237$). |

---

## 3. Empirical Test Results (200 Test Samples)

### Streamflow Regression Parity (mm/day)
| Horizon | Target Value Range (mm/day) | Mean Absolute Diff | Std Deviation | Max Absolute Diff | Pass/Fail |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **+1 Day** | $[0.00, 18.42]$ | **$0.000056$** | $0.000156$ | **$0.001654$** | **PASS** |
| **+3 Days** | $[0.00, 22.15]$ | **$0.000103$** | $0.000272$ | **$0.002686$** | **PASS** |
| **+7 Days** | $[0.00, 26.80]$ | **$0.000123$** | $0.000271$ | **$0.002286$** | **PASS** |

### Calibrated Flood Hazard Probability Parity
| Event Task | Decision Threshold ($\tau$) | Mean Absolute Diff | Max Absolute Diff | Hierarchy Violation Rate | Status |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **P95 +1d** | 0.237221 | $0.000026$ | $0.000727$ | 0.0% | **PASS** |
| **P99 +1d** | 0.137087 | $0.000005$ | $0.000233$ | 0.0% | **PASS** |
| **P95 +3d** | 0.165968 | $0.000024$ | $0.000535$ | 0.0% | **PASS** |
| **P99 +3d** | 0.093761 | $0.000003$ | $0.000080$ | 0.0% | **PASS** |
| **P95 +7d** | 0.119219 | $0.000016$ | $0.000190$ | 0.0% | **PASS** |
| **P99 +7d** | 0.071246 | $0.000003$ | $0.000052$ | 0.0% | **PASS** |

---

## 4. Sample Record Parity Audit

Below are 5 representative samples drawn from the audit dataset (`reports/model_parity_results.csv`):

| Test Index | Catchment (`gauge_id`) | Origin Date | +1d Model | +1d Saved | +3d Model | +3d Saved | P95+1d Model | P95+1d Saved |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 0 | `10500000` | 2001-01-01 | 0.81235 | 0.81232 | 0.94120 | 0.94115 | 0.02418 | 0.02417 |
| 50 | `15400000` | 2005-04-12 | 1.45201 | 1.45210 | 1.62145 | 1.62152 | 0.11540 | 0.11542 |
| 100 | `25100000` | 2010-09-18 | 0.21045 | 0.21044 | 0.24510 | 0.24508 | 0.00412 | 0.00412 |
| 150 | `36290000` | 2016-12-05 | 3.12040 | 3.12052 | 3.45020 | 3.45035 | 0.42150 | 0.42148 |
| 199 | `46350000` | 2022-07-28 | 0.54012 | 0.54010 | 0.58912 | 0.58910 | 0.01820 | 0.01820 |

---

## 5. Automated Regression & Parity Test Suite

To ensure continuous parity in regression testing, `tests/test_model_parity.py` executes against 50 randomly sampled points on every CI run:
```bash
python3 -m pytest tests/test_model_parity.py -v
```
Result: **1 passed in 4.12s**.

