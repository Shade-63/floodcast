import os
import zipfile
from pathlib import Path

root_dir = Path(".").resolve()
zip_filename = root_dir / "FLOODCAST_BASINSHIFT_INTEGRATED.zip"

include_prefixes = [
    "backend",
    "app/frontend",
    "docs",
    "tests",
]

include_files = [
    "README.md",
    "requirements.txt",
    ".env.example",
    ".gitignore",
]

exclude_parts = [
    ".git",
    "node_modules",
    ".venv",
    "venv",
    "__pycache__",
    ".pytest_cache",
    "dist",
    "artifacts",
    "BASINSHIFT_APP_BUNDLE.zip",
    "FLOODCAST_BASINSHIFT_INTEGRATED.zip",
]

print(f"Creating standalone archive: {zip_filename.name}...")

if zip_filename.exists():
    zip_filename.unlink()

files_to_zip = []

# Include individual root files
for fname in include_files:
    fpath = root_dir / fname
    if fpath.exists():
        files_to_zip.append((fpath, fname))

# Include directories
for prefix in include_prefixes:
    pdir = root_dir / prefix
    if pdir.exists():
        for root, dirs, files in os.walk(pdir):
            rel_root = Path(root).relative_to(root_dir)
            
            # Filter directories
            dirs[:] = [
                d for d in dirs
                if not any(ex in str(rel_root / d).replace("\\", "/") for ex in exclude_parts)
            ]
            
            for file in files:
                rel_file = rel_root / file
                rel_str = str(rel_file).replace("\\", "/")
                
                # Check exclusions
                if any(ex in rel_str for ex in exclude_parts):
                    continue
                if file.endswith((".pyc", ".DS_Store", ".log")):
                    continue
                    
                files_to_zip.append((root_dir / rel_file, rel_str))

# Create zip with compression
with zipfile.ZipFile(zip_filename, "w", zipfile.ZIP_DEFLATED) as zf:
    for abs_path, arcname in sorted(files_to_zip):
        zf.write(abs_path, arcname)

# Verification
print(f"\n--- ZIP INTEGRITY VERIFICATION ---")
print(f"File size: {os.path.getsize(zip_filename):,d} bytes ({os.path.getsize(zip_filename)/1024:.2f} KB)")

with zipfile.ZipFile(zip_filename, "r") as zf:
    test_res = zf.testzip()
    if test_res is not None:
        raise RuntimeError(f"Zip corrupted at: {test_res}")
    namelist = zf.namelist()
    print(f"Archive contains {len(namelist)} files.")
    print("Archive integrity check: PASSED (CRC-32 verified)")

print("\nSample archived files:")
for name in namelist[:25]:
    print("  ", name)
if len(namelist) > 25:
    print(f"   ... and {len(namelist)-25} more files.")

