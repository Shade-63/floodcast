import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
import numpy as np
import pandas as pd
import pyarrow.parquet as pq

from backend import config

class CatchmentRepository:
    """
    Manages access to CAMELS-BR catchments, metadata, static attributes,
    thresholds, and Parquet time series.
    """
    def __init__(self):
        self.artifacts_dir = config.ARTIFACTS_DIR
        self._load_metadata()
        self._load_static_features()
        self._load_thresholds()
        self._init_parquet_reader()

    def _load_metadata(self):
        if not config.BASIN_INDEX_MAP_PATH.exists():
            raise FileNotFoundError(f"Missing basin index map: {config.BASIN_INDEX_MAP_PATH}")
        self.index_map = pd.read_csv(config.BASIN_INDEX_MAP_PATH, dtype={"gauge_id": str})
        self.basin_to_idx: Dict[str, int] = dict(zip(self.index_map["gauge_id"], self.index_map["basin_idx"]))
        self.idx_to_basin: Dict[int, str] = dict(zip(self.index_map["basin_idx"], self.index_map["gauge_id"]))

        if config.BASIN_METADATA_PATH.exists():
            self.metadata = pd.read_csv(config.BASIN_METADATA_PATH, dtype={"gauge_id": str})
        else:
            self.metadata = self.index_map.copy()

        if config.SPATIAL_SPLIT_PATH.exists():
            self.splits = pd.read_csv(config.SPATIAL_SPLIT_PATH, dtype={"gauge_id": str})
            self.split_map = dict(zip(self.splits["gauge_id"], self.splits["split"]))
        else:
            self.split_map = {}

    def _load_static_features(self):
        if not config.STATIC_FEATURES_PATH.exists():
            raise FileNotFoundError(f"Missing static features: {config.STATIC_FEATURES_PATH}")
        self.static_df = pd.read_parquet(config.STATIC_FEATURES_PATH)
        self.static_df["gauge_id"] = self.static_df["gauge_id"].astype(str)
        self.static_dict = self.static_df.set_index("gauge_id").to_dict(orient="index")

        if config.STATIC_SCALED_PATH.exists():
            self.static_scaled = np.load(config.STATIC_SCALED_PATH)
        else:
            self.static_scaled = None

    def _load_thresholds(self):
        if not config.THRESHOLDS_PATH.exists():
            raise FileNotFoundError(f"Missing thresholds: {config.THRESHOLDS_PATH}")
        self.thresholds_df = pd.read_csv(config.THRESHOLDS_PATH, dtype={"gauge_id": str})
        self.thresholds_dict = self.thresholds_df.set_index("gauge_id").to_dict(orient="index")

    def _init_parquet_reader(self):
        if not config.TIMESERIES_PATH.exists():
            raise FileNotFoundError(f"Missing time series parquet: {config.TIMESERIES_PATH}")
        self.pq_file = pq.ParquetFile(config.TIMESERIES_PATH)

    def list_catchments(self) -> List[Dict[str, Any]]:
        """Returns consolidated list of all catchments with essential metadata."""
        results = []
        for _, row in self.index_map.iterrows():
            gid = str(row["gauge_id"])
            b_idx = int(row["basin_idx"])
            
            static_info = self.static_dict.get(gid, {})
            thresh_info = self.thresholds_dict.get(gid, {})
            
            # Find metadata record if available
            meta_rec = self.metadata[self.metadata["gauge_id"] == gid]
            start_date = meta_rec["start_date"].values[0] if len(meta_rec) else "1980-01-01"
            end_date = meta_rec["end_date"].values[0] if len(meta_rec) else "2024-07-31"
            valid_windows = int(meta_rec["valid_windows"].values[0]) if len(meta_rec) else 0

            p95 = thresh_info.get("P95_mm_day")
            p99 = thresh_info.get("P99_mm_day")
            eligible = bool(thresh_info.get("threshold_eligible", False))

            results.append({
                "gauge_id": gid,
                "basin_idx": b_idx,
                "lat": float(static_info.get("gauge_lat", 0.0)),
                "lon": float(static_info.get("gauge_lon", 0.0)),
                "elev_mean": float(static_info.get("elev_mean", 0.0)) if pd.notna(static_info.get("elev_mean")) else None,
                "area": float(static_info.get("area", 0.0)) if pd.notna(static_info.get("area")) else None,
                "split": self.split_map.get(gid, "unassigned"),
                "start_date": str(start_date),
                "end_date": str(end_date),
                "valid_windows": valid_windows,
                "threshold_eligible": eligible,
                "P95_mm_day": float(p95) if pd.notna(p95) else None,
                "P99_mm_day": float(p99) if pd.notna(p99) else None,
            })
        return results

    def get_catchment_details(self, gauge_id: str) -> Optional[Dict[str, Any]]:
        """Returns full catchment metadata, attributes, and thresholds."""
        if gauge_id not in self.basin_to_idx:
            return None
        
        b_idx = self.basin_to_idx[gauge_id]
        static_info = self.static_dict.get(gauge_id, {})
        thresh_info = self.thresholds_dict.get(gauge_id, {})
        meta_rec = self.metadata[self.metadata["gauge_id"] == gauge_id]

        start_date = meta_rec["start_date"].values[0] if len(meta_rec) else "1980-01-01"
        end_date = meta_rec["end_date"].values[0] if len(meta_rec) else "2024-07-31"
        valid_windows = int(meta_rec["valid_windows"].values[0]) if len(meta_rec) else 0

        # Extract all 29 static attributes
        attributes = {}
        for k, v in static_info.items():
            if k not in ["gauge_id", "gauge_lat", "gauge_lon"]:
                attributes[k] = float(v) if pd.notna(v) else None

        p95 = thresh_info.get("P95_mm_day")
        p99 = thresh_info.get("P99_mm_day")

        return {
            "gauge_id": gauge_id,
            "basin_idx": b_idx,
            "lat": float(static_info.get("gauge_lat", 0.0)),
            "lon": float(static_info.get("gauge_lon", 0.0)),
            "split": self.split_map.get(gauge_id, "unassigned"),
            "start_date": str(start_date),
            "end_date": str(end_date),
            "valid_windows": valid_windows,
            "threshold_eligible": bool(thresh_info.get("threshold_eligible", False)),
            "P95_mm_day": float(p95) if pd.notna(p95) else None,
            "P99_mm_day": float(p99) if pd.notna(p99) else None,
            "reference_coverage_pct": float(thresh_info.get("reference_coverage_pct", 0.0)) if pd.notna(thresh_info.get("reference_coverage_pct")) else None,
            "attributes": attributes
        }

    def get_timeseries_df(self, gauge_id: str) -> pd.DataFrame:
        """Reads and reindexes the full continuous daily calendar time series for a catchment."""
        if gauge_id not in self.basin_to_idx:
            raise KeyError(f"Unknown catchment ID: {gauge_id}")
        b_idx = self.basin_to_idx[gauge_id]
        
        # Read the row group corresponding to this basin_idx
        df = self.pq_file.read_row_group(
            b_idx,
            columns=[
                "gauge_id", "date", "streamflow_mm_raw", "precipitation_mm",
                "temperature_c", "target_streamflow_mm", "label_class", "met_complete"
            ]
        ).to_pandas()
        
        df["date"] = pd.to_datetime(df["date"])
        df = df.set_index("date").sort_index()
        dates = pd.date_range(df.index.min(), df.index.max(), freq="D")
        df = df.reindex(dates)
        return df

    def get_observations(
        self,
        gauge_id: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 90
    ) -> List[Dict[str, Any]]:
        """Returns historical daily observations for the catchment."""
        df = self.get_timeseries_df(gauge_id)
        
        if start_date:
            df = df[df.index >= pd.to_datetime(start_date)]
        if end_date:
            df = df[df.index <= pd.to_datetime(end_date)]
        
        if limit and limit > 0 and len(df) > limit:
            df = df.iloc[-limit:]
            
        records = []
        for dt, row in df.iterrows():
            q_raw = row["streamflow_mm_raw"]
            p_raw = row["precipitation_mm"]
            t_raw = row["temperature_c"]
            y_raw = row["target_streamflow_mm"]
            
            records.append({
                "date": dt.strftime("%Y-%m-%d"),
                "streamflow_mm": float(q_raw) if pd.notna(q_raw) else None,
                "precipitation_mm": float(p_raw) if pd.notna(p_raw) else None,
                "temperature_c": float(t_raw) if pd.notna(t_raw) else None,
                "target_streamflow_mm": float(y_raw) if pd.notna(y_raw) else None,
                "is_primary": bool(row["label_class"] == 1) if pd.notna(row["label_class"]) else False,
                "met_complete": bool(row["met_complete"] == 1) if pd.notna(row["met_complete"]) else False,
            })
        return records

    def get_scaled_static_vector(self, gauge_id: str) -> np.ndarray:
        """Returns the pre-scaled 29-element static vector for a catchment."""
        if gauge_id not in self.basin_to_idx:
            raise KeyError(f"Unknown catchment ID: {gauge_id}")
        b_idx = self.basin_to_idx[gauge_id]
        if self.static_scaled is not None:
            return self.static_scaled[b_idx].astype(np.float32)
        raise RuntimeError("Pre-scaled static array not loaded.")

