const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
  return res.json();
}

export async function fetchCatchments() {
  const res = await fetch(`${API_BASE}/api/catchments`);
  if (!res.ok) throw new Error(`Failed to load catchments: ${res.statusText}`);
  return res.json();
}

export async function fetchCatchmentDetail(gaugeId) {
  const res = await fetch(`${API_BASE}/api/catchments/${gaugeId}`);
  if (!res.ok) throw new Error(`Failed to load catchment ${gaugeId}: ${res.statusText}`);
  return res.json();
}

export async function fetchObservations(gaugeId, { startDate, endDate, limit = 90 } = {}) {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);
  if (limit) params.append('limit', limit.toString());
  
  const res = await fetch(`${API_BASE}/api/catchments/${gaugeId}/observations?${params}`);
  if (!res.ok) throw new Error(`Failed to load observations for ${gaugeId}: ${res.statusText}`);
  return res.json();
}

export async function generateForecast(gaugeId, date = null, customWindow = null) {
  const payload = { gauge_id: gaugeId };
  if (date) payload.date = date;
  if (customWindow) payload.custom_window = customWindow;

  const res = await fetch(`${API_BASE}/api/forecast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Forecast generation failed: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchMetrics() {
  const res = await fetch(`${API_BASE}/api/metrics`);
  if (!res.ok) throw new Error(`Failed to load metrics: ${res.statusText}`);
  return res.json();
}

