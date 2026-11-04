import subprocess
import time
import sys
import json
import urllib.request

print("Starting Uvicorn server in background process...")
proc = subprocess.Popen(
    [sys.executable, "-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", "8008"],
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True
)

try:
    # Wait for server to start
    started = False
    for _ in range(30):
        time.sleep(0.5)
        try:
            with urllib.request.urlopen("http://127.0.0.1:8008/api/health", timeout=2) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode())
                    print("Health check response:", data)
                    started = True
                    break
        except Exception:
            pass

    if not started:
        stdout, stderr = proc.communicate(timeout=2)
        print("Server failed to start:\nSTDOUT:", stdout, "\nSTDERR:", stderr)
        sys.exit(1)

    print("\n1. Testing GET /api/catchments...")
    with urllib.request.urlopen("http://127.0.0.1:8008/api/catchments", timeout=5) as resp:
        catchments = json.loads(resp.read().decode())
        print(f"Total catchments: {len(catchments)}")
        assert len(catchments) == 897

    print("\n2. Testing GET /api/catchments/10500000...")
    with urllib.request.urlopen("http://127.0.0.1:8008/api/catchments/10500000", timeout=5) as resp:
        detail = json.loads(resp.read().decode())
        print(f"Gauge: {detail['gauge_id']}, Lat: {detail['lat']}, Lon: {detail['lon']}, Attributes: {len(detail['attributes'])}")
        assert len(detail["attributes"]) == 29

    print("\n3. Testing GET /api/catchments/10500000/observations?limit=10...")
    with urllib.request.urlopen("http://127.0.0.1:8008/api/catchments/10500000/observations?limit=10", timeout=5) as resp:
        obs = json.loads(resp.read().decode())
        print(f"Returned {len(obs)} observations. Sample: {obs[-1]}")
        assert len(obs) == 10

    print("\n4. Testing POST /api/forecast...")
    req_body = json.dumps({"gauge_id": "10500000"}).encode()
    req = urllib.request.Request("http://127.0.0.1:8008/api/forecast", data=req_body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        fc = json.loads(resp.read().decode())
        print(f"Forecast generated: origin={fc['origin_date']}, predictions={fc['predictions_mm']}")
        assert len(fc["predictions_mm"]) == 3
        assert fc["hierarchy_enforced"] is True

    print("\n5. Testing GET /api/metrics...")
    with urllib.request.urlopen("http://127.0.0.1:8008/api/metrics", timeout=5) as resp:
        m = json.loads(resp.read().decode())
        print(f"Macro metrics rows: {len(m['macro_regression'])}, Event classification rows: {len(m['event_classification'])}")
        assert len(m["macro_regression"]) == 6

    print("\n>>> ALL LIVE FASTAPI ENDPOINTS PROBED SUCCESSFULLY OVER HTTP! <<<")

finally:
    print("Terminating test Uvicorn server...")
    proc.terminate()
    try:
        proc.wait(timeout=3)
    except Exception:
        proc.kill()
    print("Server terminated cleanly.")

