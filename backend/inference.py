import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
import numpy as np
import pandas as pd
import torch
if hasattr(torch.backends, "mkldnn"):
    torch.backends.mkldnn.enabled = False
import joblib

from backend import config
from backend.model import BasinShiftMultiTask
from backend.data_loader import CatchmentRepository

class ModelEngine:
    """
    Inference engine for BasinShiftMultiTask model.
    Encapsulates checkpoint loading, input preprocessing, forward execution,
    residual reconstruction, probability calibration, and hierarchy enforcement.
    """
    def __init__(self, repo: CatchmentRepository):
        self.repo = repo
        self.device = torch.device(config.DEVICE)
        self._load_scalers()
        self._load_calibration()
        self._load_model()

    def _load_scalers(self):
        if not config.SCALERS_PATH.exists():
            raise FileNotFoundError(f"Missing scalers file: {config.SCALERS_PATH}")
        scalers = np.load(config.SCALERS_PATH)
        self.dyn_mean = scalers["dyn_mean"].astype(np.float32)
        self.dyn_std = scalers["dyn_std"].astype(np.float32)
        self.target_std = float(scalers["target_std"])

    def _load_calibration(self):
        if not config.CALIBRATION_PATH.exists():
            raise FileNotFoundError(f"Missing calibration file: {config.CALIBRATION_PATH}")
        calib_dict = joblib.load(config.CALIBRATION_PATH)
        self.calibrators = calib_dict["calibrators"]
        self.decision_thresholds = calib_dict["decision_thresholds"]
        self.event_names = calib_dict["event_names"]

    def _load_model(self):
        if not config.MODEL_CHECKPOINT_PATH.exists():
            raise FileNotFoundError(f"Missing model checkpoint: {config.MODEL_CHECKPOINT_PATH}")
        self.model = BasinShiftMultiTask(
            dynamic_features=3,
            static_features=29,
            hidden_size=64,
            num_layers=2
        ).to(self.device)
        
        checkpoint = torch.load(
            config.MODEL_CHECKPOINT_PATH,
            map_location=self.device,
            weights_only=False
        )
        self.model.load_state_dict(checkpoint["model_state_dict"])
        self.model.eval()

    def validate_historical_window(
        self,
        streamflow: np.ndarray,
        precipitation: np.ndarray,
        temperature: np.ndarray
    ) -> Tuple[np.ndarray, float]:
        """
        Validates the 30-day historical window.
        Rejects sequences with missing values, NaNs, infinite values, or negative values.
        """
        if len(streamflow) != config.WINDOW or len(precipitation) != config.WINDOW or len(temperature) != config.WINDOW:
            raise ValueError(
                f"Historical window must be exactly {config.WINDOW} days. "
                f"Received streamflow={len(streamflow)}, precip={len(precipitation)}, temp={len(temperature)}."
            )
        
        if not np.isfinite(streamflow).all():
            raise ValueError("Streamflow sequence contains missing, NaN, or non-finite values.")
        if not np.isfinite(precipitation).all():
            raise ValueError("Precipitation sequence contains missing, NaN, or non-finite values.")
        if not np.isfinite(temperature).all():
            raise ValueError("Temperature sequence contains missing, NaN, or non-finite values.")
        
        if (streamflow < 0).any():
            raise ValueError("Streamflow sequence contains invalid negative values.")
        if (precipitation < 0).any():
            raise ValueError("Precipitation sequence contains invalid negative precipitation values.")
            
        latest_q = float(streamflow[-1])
        
        # Build 30x3 dynamic array
        x = np.column_stack([streamflow, precipitation, temperature]).astype(np.float32)
        
        # Exact preprocessing:
        # discharge -> log1p
        # precipitation -> log1p
        # temperature -> untransformed
        x[:, 0] = np.log1p(np.maximum(x[:, 0], 0.0))
        x[:, 1] = np.log1p(np.maximum(x[:, 1], 0.0))
        
        # Dynamic normalization using training parameters
        x = (x - self.dyn_mean) / self.dyn_std
        
        return x, latest_q

    def predict(
        self,
        gauge_id: str,
        x_norm: np.ndarray,
        latest_q: float
    ) -> Dict[str, Any]:
        """
        Runs model inference, target reconstruction, calibration, and hierarchy enforcement.
        """
        s_norm = self.repo.get_scaled_static_vector(gauge_id)
        
        xb = torch.from_numpy(x_norm).unsqueeze(0).to(self.device)  # (1, 30, 3)
        sb = torch.from_numpy(s_norm).unsqueeze(0).to(self.device)  # (1, 29)
        
        with torch.no_grad():
            delta, logits = self.model(xb, sb)
            
        delta = delta.squeeze(0).cpu().numpy()    # shape (3,)
        logits = logits.squeeze(0).cpu().numpy()  # shape (6,)
        
        # Exact residual discharge reconstruction:
        # latest_log = log1p(latest_q)
        # future_log = latest_log + delta * target_std (clipped to [-20, 20])
        # predicted = max(expm1(future_log), 0)
        latest_log = np.log1p(max(latest_q, 0.0))
        future_log = latest_log + delta * self.target_std
        predicted_q = np.maximum(
            np.expm1(np.clip(future_log, -20.0, 20.0)),
            0.0
        ).tolist()
        
        # Raw sigmoid event probabilities
        raw_probs = (1.0 / (1.0 + np.exp(-np.clip(logits, -50.0, 50.0)))).tolist()
        
        # Calibrated probabilities using fitted Platt scalers
        calib_probs = []
        for j in range(6):
            calibrator = self.calibrators[j]
            p = float(calibrator.predict_proba(logits[j].reshape(1, -1))[0, 1])
            calib_probs.append(p)
            
        # Physical hierarchy enforcement: P99 probability must never exceed P95 probability
        # Horizon indices: +1d is (0, 1), +3d is (2, 3), +7d is (4, 5)
        for p95_idx, p99_idx in [(0, 1), (2, 3), (4, 5)]:
            calib_probs[p99_idx] = min(calib_probs[p99_idx], calib_probs[p95_idx])
            
        # Catchment thresholds
        thresh_info = self.repo.thresholds_dict.get(gauge_id, {})
        p95_thresh = thresh_info.get("P95_mm_day")
        p99_thresh = thresh_info.get("P99_mm_day")
        threshold_eligible = bool(thresh_info.get("threshold_eligible", False))
        
        # Event alerts based on validated decision thresholds
        events = {}
        for idx, horizon in enumerate(config.HORIZONS):
            h_str = f"+{horizon}d"
            p95_name = f"P95 {h_str}"
            p99_name = f"P99 {h_str}"
            
            p95_col = idx * 2
            p99_col = idx * 2 + 1
            
            p95_prob = float(calib_probs[p95_col])
            p99_prob = float(calib_probs[p99_col])
            
            p95_dec_thresh = float(self.decision_thresholds.get(p95_name, 0.5))
            p99_dec_thresh = float(self.decision_thresholds.get(p99_name, 0.5))
            
            events[h_str] = {
                "P95": {
                    "raw_probability": float(raw_probs[p95_col]),
                    "calibrated_probability": p95_prob,
                    "decision_threshold": p95_dec_thresh,
                    "event_detected": bool(p95_prob >= p95_dec_thresh) if threshold_eligible else None,
                    "flow_threshold_mm": float(p95_thresh) if pd.notna(p95_thresh) else None,
                },
                "P99": {
                    "raw_probability": float(raw_probs[p99_col]),
                    "calibrated_probability": p99_prob,
                    "decision_threshold": p99_dec_thresh,
                    "event_detected": bool(p99_prob >= p99_dec_thresh) if threshold_eligible else None,
                    "flow_threshold_mm": float(p99_thresh) if pd.notna(p99_thresh) else None,
                }
            }
            
        return {
            "predictions_mm": predicted_q,
            "residuals_standardized": delta.tolist(),
            "latest_observed_q_mm": float(latest_q),
            "threshold_eligible": threshold_eligible,
            "thresholds": {
                "P95_mm_day": float(p95_thresh) if pd.notna(p95_thresh) else None,
                "P99_mm_day": float(p99_thresh) if pd.notna(p99_thresh) else None,
            },
            "events": events,
            "hierarchy_enforced": True,
            "operational_notes": {
                "+7d_P99": "P99 event forecasting skill at +7 days has high uncertainty (AUPRC 0.066, recall 10.4%). Do not rely on it as a sole operational warning."
            }
        }

    def generate_forecast_from_dataset(
        self,
        gauge_id: str,
        origin_date_str: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Extracts 30 continuous historical observations from the parquet dataset
        ending on origin_date (or the latest available valid date) and runs forecast.
        """
        df = self.repo.get_timeseries_df(gauge_id)
        
        if origin_date_str:
            origin_dt = pd.to_datetime(origin_date_str)
            if origin_dt not in df.index:
                raise ValueError(f"Date {origin_date_str} is outside the recorded period for catchment {gauge_id}.")
            loc = df.index.get_loc(origin_dt)
        else:
            # Find the latest date with 30 preceding continuous days
            loc = len(df) - 1
            while loc >= config.WINDOW - 1:
                window_df = df.iloc[loc - config.WINDOW + 1 : loc + 1]
                q_vals = pd.to_numeric(window_df["streamflow_mm_raw"], errors="coerce")
                p_vals = pd.to_numeric(window_df["precipitation_mm"], errors="coerce")
                t_vals = pd.to_numeric(window_df["temperature_c"], errors="coerce")
                if (
                    q_vals.notna().all() and (q_vals >= 0).all() and
                    p_vals.notna().all() and (p_vals >= 0).all() and
                    t_vals.notna().all()
                ):
                    break
                loc -= 1
            if loc < config.WINDOW - 1:
                raise ValueError(f"No continuous 30-day valid window found for catchment {gauge_id}.")
                
        if loc < config.WINDOW - 1:
            raise ValueError(
                f"Insufficient historical data before {df.index[loc].strftime('%Y-%m-%d')} for catchment {gauge_id}. "
                f"Requires at least {config.WINDOW} continuous historical days."
            )
            
        window_df = df.iloc[loc - config.WINDOW + 1 : loc + 1]
        origin_dt = df.index[loc]
        
        q = pd.to_numeric(window_df["streamflow_mm_raw"], errors="coerce").to_numpy(dtype=np.float32)
        p = pd.to_numeric(window_df["precipitation_mm"], errors="coerce").to_numpy(dtype=np.float32)
        t = pd.to_numeric(window_df["temperature_c"], errors="coerce").to_numpy(dtype=np.float32)
        
        x_norm, latest_q = self.validate_historical_window(q, p, t)
        
        forecast_result = self.predict(gauge_id, x_norm, latest_q)
        
        # Calculate future calendar dates
        forecast_dates = [
            (origin_dt + pd.Timedelta(days=h)).strftime("%Y-%m-%d")
            for h in config.HORIZONS
        ]
        
        # Check if actual future ground truth exists in the dataset
        actual_future_q = []
        for h in config.HORIZONS:
            f_dt = origin_dt + pd.Timedelta(days=h)
            if f_dt in df.index:
                actual_val = df.loc[f_dt, "target_streamflow_mm"]
                actual_future_q.append(float(actual_val) if pd.notna(actual_val) else None)
            else:
                actual_future_q.append(None)
                
        forecast_result.update({
            "gauge_id": gauge_id,
            "origin_date": origin_dt.strftime("%Y-%m-%d"),
            "horizons": config.HORIZONS,
            "forecast_dates": forecast_dates,
            "actual_ground_truth_mm": actual_future_q,
            "historical_window_dates": [d.strftime("%Y-%m-%d") for d in window_df.index],
            "historical_window_streamflow": q.tolist(),
            "historical_window_precipitation": p.tolist(),
            "historical_window_temperature": t.tolist(),
        })
        return forecast_result
