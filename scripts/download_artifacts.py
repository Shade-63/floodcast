#!/usr/bin/env python3
"""
Download FLOODCAST artifacts from Hugging Face Hub.
Called during Render build: python scripts/download_artifacts.py
"""
import os
import sys
from pathlib import Path

ARTIFACTS_DIR = Path(os.getenv("ARTIFACTS_DIR", "./artifacts"))
HF_REPO       = os.getenv("HF_REPO",  "Shade-63/floodcast-artifacts")
HF_TOKEN      = os.getenv("HF_TOKEN", None)

# Every file the backend needs to start
REQUIRED_FILES = [
    "basinshift_multitask_best.pt",
    "basinshift_timeseries.parquet",
    "basinshift_scalers.npz",
    "basinshift_calibration.joblib",
    "basinshift_static_features.parquet",
    "basinshift_static_scaled.npy",
    "feature_config.json",
    "basin_index_map.csv",
    "basin_metadata.csv",
    "catchment_manifest.csv",
    "catchment_flow_thresholds.csv",
    "spatial_split_manifest.csv",
    "final_test_regression.csv",
    "final_test_events.csv",
    "final_test_macro.csv",
    "basinshift_final_test_predictions.npz",
]


def main():
    try:
        from huggingface_hub import hf_hub_download
    except ImportError:
        print("ERROR: huggingface_hub not installed. Run: pip install huggingface_hub")
        sys.exit(1)

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    missing = [f for f in REQUIRED_FILES if not (ARTIFACTS_DIR / f).exists()]

    if not missing:
        print(f"✓ All {len(REQUIRED_FILES)} artifacts already present in {ARTIFACTS_DIR}")
        return

    if not HF_TOKEN and HF_REPO.split("/")[0] != "public":
        print(f"WARNING: HF_TOKEN not set — repo {HF_REPO} must be public or download will fail.")

    print(f"Downloading {len(missing)} missing artifact(s) from {HF_REPO} → {ARTIFACTS_DIR}")
    errors = []
    for fname in missing:
        try:
            print(f"  ↓ {fname} ...", end="", flush=True)
            hf_hub_download(
                repo_id=HF_REPO,
                filename=fname,
                repo_type="dataset",
                token=HF_TOKEN,
                local_dir=str(ARTIFACTS_DIR),
                local_dir_use_symlinks=False,
            )
            print(" done")
        except Exception as e:
            print(f" FAILED: {e}")
            errors.append(fname)

    if errors:
        print(f"\nERROR: Failed to download: {errors}")
        sys.exit(1)

    print(f"\n✓ All artifacts ready in {ARTIFACTS_DIR}")


if __name__ == "__main__":
    main()
