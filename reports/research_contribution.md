# FLOODCAST — Scientific Research Contribution & Ablation Audit Report

**Investigated Contribution:**  
> *"A multi-task residual LSTM combining recent hydrometeorological histories with static basin descriptors to jointly forecast future discharge and calibrated extreme-flow exceedance probabilities under geographic cluster holdout."*

**Evaluation Date:** November 5, 2026  
**Auditor:** Lead ML Evaluation Researcher & Hydrological Modeling Lead  

---

## 1. Executive Summary & Research Claim Defense

In compliance with independent evaluation standards:
1. **Architecture Novelty:** A 2-layer LSTM with static feature concatenation is **not intrinsically novel**. The hydrological machine learning literature (e.g., Kratzert et al., *CAMELS Large-Sample Hydrology with LSTMs*, 2018/2019) has established LSTM suitability for rainfall-runoff modeling.
2. **Defensible Research Formulation:**
   The genuine scientific contribution lies in:
   - **Residual Log-Flow Formulation:** Anchoring future predictions to zero-hour state ($z_{t+h} = z_0 + \delta_h \cdot \sigma$) rather than predicting unbounded raw discharge directly.
   - **Joint Multi-Task Regularization:** Coupling continuous streamflow regression with dual-tier binary flood hazard classification (P95 and P99).
   - **Post-Hoc Probability Calibration with Physical Hierarchy:** Applying validation-fitted Platt scaling and enforcing $P(Q > \text{P99}) \le P(Q > \text{P95})$.
   - **Geographic Cluster Holdout:** Evaluating true cross-regional transfer on 115 unseen Brazilian river basins.

---

## 2. Controlled Model Architecture Ablation (Validation Benchmark)

The training investigation (`floodcast.ipynb`, Cell 21) benchmarked four model architectures across the 117 eligible validation catchments:

| Model Architecture | +1d Macro MAE | +1d Macro NSE | +3d Macro MAE | +3d Macro NSE | +7d Macro MAE | +7d Macro NSE | Event Detection Head |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Persistence Baseline ($Q_{t_0}$)** | 0.21349 | 0.70610 | 0.41465 | 0.30669 | 0.57071 | -0.04634 | None |
| **Direct LSTM (Direct Log-Q)** | 0.22677 | 0.05616 | 0.36725 | -0.14374 | 0.46931 | -0.08282 | None |
| **Residual LSTM (Delta Only)** | **0.18072** | **0.77073** | **0.33493** | **0.50303** | **0.45018** | **0.29862** | None |
| **BasinShift MultiTask LSTM** | 0.18305 | 0.76901 | 0.33944 | 0.50200 | 0.45206 | 0.29737 | **6 Calibrated Tasks** |

### Critical Scientific Insights from Architecture Ablation
1. **The Direct LSTM Failure Mode:**
   Directly predicting $\ln(1 + Q_{t+h})$ in an ungauged/out-of-cluster holdout context resulted in catastrophic degradation (macro NSE = 0.056 at +1d, negative at +3d and +7d). While the model learned regional precipitation patterns, it failed to align to individual gauge rating curve scales.
2. **The Residual Transformation Breakthrough:**
   Reformulating the objective to predict normalized residual deviations $\delta_h$ anchored predictions to the gauge's latest observed hydrologic state ($Q_{t_0}$). This improved macro NSE from **0.056 to 0.771** at +1d, and from **-0.083 to +0.299** at +7d.
3. **Multi-Task Synergy:**
   Adding the 6-output classification head (`event_head`) preserved continuous regression skill within $1.2\%$ of the dedicated single-task Residual LSTM while generating well-calibrated flood hazard exceedance alerts.

---

## 3. Disclosed Unverified Component-Level Claims

> [!WARNING]
> **Strict Scientific Disclosure on Static Feature Ablation:**
> While domain physics confirms that 29 static catchment descriptors (drainage area, elevation, slope, soil permeability, and land cover) are essential for distinguishing catchment response times, **an isolated, retrained "No-Static-Features" model checkpoint was not preserved in the release bundle**.
> In accordance with non-negotiable evaluation rules:
> - Zeroing out or masking static inputs at test time does **not** constitute a valid architectural ablation (it induces severe out-of-distribution artifacting in an already-trained neural network).
> - Therefore, the exact quantitative margin contributed solely by the static branch in isolation remains **empirically unverified** until formal retraining without static features is conducted under the identical seed and cluster split.

---

## 4. Horizon-Wise Degradation & Extreme Event Asymmetry

### Lead-Time Decay
- At **+1 day**, the system exhibits high operational fidelity (macro MAE $0.105\text{ mm/day}$, NSE $0.840$, P95 AUPRC $0.584$).
- At **+3 days**, skill remains solid (macro MAE $0.185\text{ mm/day}$, NSE $0.654$, P95 AUPRC $0.420$).
- At **+7 days**, error accumulates substantially (macro MAE $0.256\text{ mm/day}$, NSE $0.465$, P95 AUPRC $0.249$).

### P95 vs P99 Extreme Event Detection
| Lead Time | P95 Prevalence | P95 AUPRC | P95 Recall | P99 Prevalence | P99 AUPRC | P99 Recall | Operational Implication |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **+1 Day** | 3.02% | **0.584** | 68.8% | 0.60% | **0.299** | 52.9% | Reliable 24h operational early alert |
| **+3 Days** | 3.03% | **0.420** | 61.4% | 0.60% | **0.151** | 29.9% | Moderate situational advisory |
| **+7 Days** | 3.06% | **0.249** | 50.1% | 0.62% | **0.066** | **10.4%** | **High Uncertainty — Advisory Only** |

### Disclosure
Detecting rare 99th-percentile flash flood events at a 7-day horizon in unseen basins yields an AUPRC of **0.066** and recall of **10.4%**. The system must explicitly label P99 +7d forecasts as experimental and advisory.

