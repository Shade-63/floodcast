import React, { useState, useMemo } from 'react';

export default function Hydrograph({
  forecastData,
  observations = [],
  thresholds = {},
  thresholdEligible = true,
  height = 380,
  width = 900
}) {
  const [hoverIndex, setHoverIndex] = useState(null);

  // Parse historical window and forecast data
  const { historicalItems, forecastItems, originItem } = useMemo(() => {
    const hist = [];
    const fc = [];

    // 1. Historical observations (prefer forecastData historical window if present, else fallback)
    if (forecastData && forecastData.historical_window_dates) {
      const dates = forecastData.historical_window_dates;
      const q = forecastData.historical_window_streamflow || [];
      const p = forecastData.historical_window_precipitation || [];
      const t = forecastData.historical_window_temperature || [];

      for (let i = 0; i < dates.length; i++) {
        hist.push({
          index: i,
          date: dates[i],
          type: 'observed',
          streamflow: q[i] !== undefined && q[i] !== null ? q[i] : null,
          precipitation: p[i] !== undefined && p[i] !== null ? p[i] : null,
          temperature: t[i] !== undefined && t[i] !== null ? t[i] : null,
          horizon: 0,
        });
      }
    } else if (observations && observations.length > 0) {
      const recent = observations.slice(-30);
      for (let i = 0; i < recent.length; i++) {
        hist.push({
          index: i,
          date: recent[i].date,
          type: 'observed',
          streamflow: recent[i].streamflow_mm,
          precipitation: recent[i].precipitation_mm,
          temperature: recent[i].temperature_c,
          horizon: 0,
        });
      }
    }

    // 2. Forecast points (+1d, +3d, +7d)
    if (forecastData && forecastData.predictions_mm && forecastData.forecast_dates) {
      const fDates = forecastData.forecast_dates;
      const fPreds = forecastData.predictions_mm;
      const fTruth = forecastData.actual_ground_truth_mm || [];
      const horizons = forecastData.horizons || [1, 3, 7];

      for (let i = 0; i < fDates.length; i++) {
        fc.push({
          horizon: horizons[i],
          date: fDates[i],
          type: 'predicted',
          streamflow: fPreds[i],
          groundTruth: fTruth[i] !== undefined && fTruth[i] !== null ? fTruth[i] : null,
          precipitation: null,
          temperature: null,
        });
      }
    }

    const origin = hist.length > 0 ? hist[hist.length - 1] : null;

    return {
      historicalItems: hist,
      forecastItems: fc,
      originItem: origin,
    };
  }, [forecastData, observations]);

  // Layout and dimensions
  const padding = { top: 45, right: 75, bottom: 50, left: 65 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  // Space allocation: 68% for 30 historical days, 32% for the 7 forecast days
  const historyWidth = innerWidth * 0.68;
  const forecastWidth = innerWidth * 0.32;
  const originX = padding.left + historyWidth;

  // Coordinate mappers
  const nHist = Math.max(historicalItems.length, 1);
  const getHistoricalX = (i) => {
    if (nHist <= 1) return padding.left;
    return padding.left + (i / (nHist - 1)) * historyWidth;
  };

  const getForecastX = (horizon) => {
    // Horizon is between 1 and 7 days
    return originX + (Math.max(horizon, 0) / 7) * forecastWidth;
  };

  // Max calculations for scaling
  const { maxQ, maxP } = useMemo(() => {
    let qMax = 3.0;
    let pMax = 15.0;

    for (const item of historicalItems) {
      if (item.streamflow !== null && item.streamflow !== undefined) {
        qMax = Math.max(qMax, item.streamflow);
      }
      if (item.precipitation !== null && item.precipitation !== undefined) {
        pMax = Math.max(pMax, item.precipitation);
      }
    }

    for (const item of forecastItems) {
      if (item.streamflow !== null && item.streamflow !== undefined) {
        qMax = Math.max(qMax, item.streamflow);
      }
      if (item.groundTruth !== null && item.groundTruth !== undefined) {
        qMax = Math.max(qMax, item.groundTruth);
      }
    }

    if (thresholds.P95_mm_day) qMax = Math.max(qMax, thresholds.P95_mm_day * 1.12);
    if (thresholds.P99_mm_day) qMax = Math.max(qMax, thresholds.P99_mm_day * 1.12);

    return {
      maxQ: qMax * 1.18,
      maxP: Math.max(pMax * 1.35, 20.0),
    };
  }, [historicalItems, forecastItems, thresholds]);

  const getY = (val) => padding.top + innerHeight - (Math.max(val || 0, 0) / maxQ) * innerHeight;

  // Rainfall hyetograph takes top 30% of chart
  const hyetographMaxH = innerHeight * 0.30;
  const getPrecipHeight = (val) => (Math.max(val || 0, 0) / maxP) * hyetographMaxH;

  // Build SVG paths for observed flow
  let observedPath = '';
  let observedAreaPath = '';
  if (historicalItems.length > 0) {
    observedPath = historicalItems
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getHistoricalX(i).toFixed(1)} ${getY(d.streamflow || 0).toFixed(1)}`)
      .join(' ');

    const lastX = originX;
    const firstX = padding.left;
    const bottomY = padding.top + innerHeight;
    observedAreaPath = `${observedPath} L ${lastX.toFixed(1)} ${bottomY} L ${firstX.toFixed(1)} ${bottomY} Z`;
  }

  // Forecast path connects from Day 0 origin to +1d, +3d, +7d
  let forecastPath = '';
  if (originItem && forecastItems.length > 0) {
    const points = [
      { x: originX, y: getY(originItem.streamflow || 0) },
      ...forecastItems.map((d) => ({
        x: getForecastX(d.horizon),
        y: getY(d.streamflow || 0),
      })),
    ];
    forecastPath = points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ');
  }

  // Ground truth actual future path if present
  let groundTruthPath = '';
  if (originItem && forecastItems.every((d) => d.groundTruth !== null && d.groundTruth !== undefined)) {
    const points = [
      { x: originX, y: getY(originItem.streamflow || 0) },
      ...forecastItems.map((d) => ({
        x: getForecastX(d.horizon),
        y: getY(d.groundTruth),
      })),
    ];
    groundTruthPath = points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ');
  }

  // Threshold Y coordinates
  const p95Y = thresholds.P95_mm_day ? getY(thresholds.P95_mm_day) : null;
  const p99Y = thresholds.P99_mm_day ? getY(thresholds.P99_mm_day) : null;

  // Offset threshold badges if close to each other
  let p95BadgeY = p95Y;
  let p99BadgeY = p99Y;
  if (p95Y !== null && p99Y !== null && Math.abs(p95Y - p99Y) < 18) {
    p99BadgeY = Math.min(p95Y, p99Y) - 8;
    p95BadgeY = Math.max(p95Y, p99Y) + 8;
  }

  // Combined list for hover interaction
  const allInteractivePoints = useMemo(() => {
    const list = [];
    for (let i = 0; i < historicalItems.length; i++) {
      list.push({
        ...historicalItems[i],
        x: getHistoricalX(i),
        isForecast: false,
      });
    }
    for (let i = 0; i < forecastItems.length; i++) {
      list.push({
        ...forecastItems[i],
        x: getForecastX(forecastItems[i].horizon),
        isForecast: true,
      });
    }
    return list;
  }, [historicalItems, forecastItems, innerWidth]);

  return (
    <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 'auto', display: 'block', background: 'var(--bg-card)' }}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id="streamflowGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0.01" />
          </linearGradient>
          <linearGradient id="precipGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.25" />
          </linearGradient>
          <pattern id="forecastHatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(79, 70, 229, 0.05)" strokeWidth="3" />
          </pattern>
        </defs>

        {/* Forecast Window Shaded Background */}
        <rect
          x={originX}
          y={padding.top}
          width={forecastWidth}
          height={innerHeight}
          fill="url(#forecastHatch)"
        />
        <rect
          x={originX}
          y={padding.top}
          width={forecastWidth}
          height={innerHeight}
          fill="rgba(79, 70, 229, 0.02)"
        />

        {/* Horizontal Streamflow Gridlines */}
        {[0, 0.25, 0.5, 0.75, 1.0].map((ratio) => {
          const y = padding.top + innerHeight * (1 - ratio);
          const val = (ratio * maxQ).toFixed(1);
          return (
            <g key={ratio}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="var(--border)"
                strokeDasharray="3 3"
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                fill="var(--text-3)"
                fontFamily="var(--font-mono)"
              >
                {val}
              </text>
            </g>
          );
        })}

        {/* Precipitation Inverted Hyetograph Bars */}
        {historicalItems.map((d, i) => {
          if (d.precipitation === null || d.precipitation <= 0.05) return null;
          const barW = Math.max((historyWidth / nHist) - 2, 4);
          const barH = getPrecipHeight(d.precipitation);
          const x = getHistoricalX(i) - barW / 2;
          return (
            <rect
              key={`precip-${i}`}
              x={x}
              y={padding.top}
              width={barW}
              height={barH}
              fill="url(#precipGradient)"
              rx="1.5"
            />
          );
        })}

        {/* Secondary Y-Axis for Precipitation (Right Side) */}
        <line
          x1={width - padding.right + 10}
          y1={padding.top}
          x2={width - padding.right + 10}
          y2={padding.top + hyetographMaxH}
          stroke="#0891B2"
          strokeWidth="1.5"
          opacity="0.6"
        />
        {/* Precip Ticks */}
        {[0, 0.5, 1.0].map((r) => {
          const y = padding.top + r * hyetographMaxH;
          const val = (r * maxP).toFixed(0);
          return (
            <g key={`p-tick-${r}`}>
              <line
                x1={width - padding.right + 10}
                y1={y}
                x2={width - padding.right + 15}
                y2={y}
                stroke="#0891B2"
                strokeWidth="1.5"
              />
              <text
                x={width - padding.right + 18}
                y={y + 3.5}
                textAnchor="start"
                fontSize="9"
                fontWeight="600"
                fill="#0891B2"
                fontFamily="var(--font-mono)"
              >
                {val}
              </text>
            </g>
          );
        })}
        <text
          x={width - padding.right + 12}
          y={padding.top - 10}
          textAnchor="start"
          fontSize="9.5"
          fontWeight="700"
          fill="#0891B2"
        >
          Rain (mm) ↓
        </text>

        {/* P95 Flow Threshold Line */}
        {p95Y !== null && p95Y >= padding.top && p95Y <= padding.top + innerHeight && (
          <g>
            <line
              x1={padding.left}
              y1={p95Y}
              x2={width - padding.right}
              y2={p95Y}
              stroke="#D97706"
              strokeWidth="1.5"
              strokeDasharray="6 4"
            />
            {/* Legible Badge Container on Right */}
            <rect
              x={width - padding.right - 110}
              y={(p95BadgeY || p95Y) - 10}
              width="106"
              height="16"
              rx="3"
              fill="#FEF3C7"
              stroke="#F59E0B"
              strokeWidth="1"
            />
            <text
              x={width - padding.right - 57}
              y={(p95BadgeY || p95Y) + 2}
              textAnchor="middle"
              fontSize="9"
              fontWeight="700"
              fill="#B45309"
              fontFamily="var(--font-mono)"
            >
              P95: {thresholds.P95_mm_day.toFixed(2)} mm/d
            </text>
          </g>
        )}

        {/* P99 Flow Threshold Line */}
        {p99Y !== null && p99Y >= padding.top && p99Y <= padding.top + innerHeight && (
          <g>
            <line
              x1={padding.left}
              y1={p99Y}
              x2={width - padding.right}
              y2={p99Y}
              stroke="#DC2626"
              strokeWidth="1.8"
              strokeDasharray="4 3"
            />
            {/* Legible Badge Container on Right */}
            <rect
              x={width - padding.right - 110}
              y={(p99BadgeY || p99Y) - 10}
              width="106"
              height="16"
              rx="3"
              fill="#FEE2E2"
              stroke="#EF4444"
              strokeWidth="1"
            />
            <text
              x={width - padding.right - 57}
              y={(p99BadgeY || p99Y) + 2}
              textAnchor="middle"
              fontSize="9"
              fontWeight="700"
              fill="#B91C1C"
              fontFamily="var(--font-mono)"
            >
              P99: {thresholds.P99_mm_day.toFixed(2)} mm/d
            </text>
          </g>
        )}

        {/* Forecast Origin Dividing Line */}
        {originItem && (
          <g>
            <line
              x1={originX}
              y1={padding.top}
              x2={originX}
              y2={padding.top + innerHeight}
              stroke="#4F46E5"
              strokeDasharray="3 3"
              strokeWidth="1.5"
            />
            <rect
              x={originX - 52}
              y={padding.top - 20}
              width="104"
              height="16"
              rx="3"
              fill="#EEF2FF"
              stroke="#818CF8"
              strokeWidth="1"
            />
            <text
              x={originX}
              y={padding.top - 9}
              textAnchor="middle"
              fontSize="9"
              fontWeight="700"
              fill="#4338CA"
            >
              Day 0 Origin ({originItem.date.slice(5)})
            </text>
          </g>
        )}

        {/* Observed Streamflow Shaded Area and Curve */}
        {observedAreaPath && <path d={observedAreaPath} fill="url(#streamflowGradient)" />}
        {observedPath && (
          <path
            d={observedPath}
            fill="none"
            stroke="#2563EB"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Actual Ground Truth Future Curve (if verified against test dataset) */}
        {groundTruthPath && (
          <path
            d={groundTruthPath}
            fill="none"
            stroke="#10B981"
            strokeWidth="2"
            strokeDasharray="4 3"
            strokeLinecap="round"
          />
        )}

        {/* Predicted Discharge Trajectory (Bold Dashed Line) */}
        {forecastPath && (
          <path
            d={forecastPath}
            fill="none"
            stroke="#4F46E5"
            strokeWidth="3"
            strokeDasharray="7 4"
            strokeLinecap="round"
          />
        )}

        {/* Forecast Target Nodes with Non-Overlapping Spaced Badges */}
        {forecastItems.map((d) => {
          const x = getForecastX(d.horizon);
          const y = getY(d.streamflow || 0);
          const dateStr = d.date.slice(5); // MM-DD
          const badgeY = y < padding.top + 45 ? y + 16 : y - 38;

          return (
            <g key={`pred-${d.horizon}`}>
              {/* Vertical connector line from point to badge */}
              <line
                x1={x}
                y1={y}
                x2={x}
                y2={badgeY + (y < padding.top + 45 ? 0 : 30)}
                stroke="#818CF8"
                strokeWidth="1"
                strokeDasharray="2 2"
              />

              {/* Forecast Point Circle */}
              <circle cx={x} cy={y} r="6" fill="#4F46E5" stroke="#FFFFFF" strokeWidth="2.5" />

              {/* Forecast Label Badge Card */}
              <rect
                x={x - 42}
                y={badgeY}
                width="84"
                height="32"
                rx="4"
                fill="#FFFFFF"
                stroke="#4F46E5"
                strokeWidth="1.5"
                filter="drop-shadow(0 2px 4px rgba(0,0,0,0.08))"
              />
              <text
                x={x}
                y={badgeY + 12}
                textAnchor="middle"
                fontSize="9"
                fontWeight="700"
                fill="#4F46E5"
              >
                +{d.horizon}d ({dateStr})
              </text>
              <text
                x={x}
                y={badgeY + 25}
                textAnchor="middle"
                fontSize="10.5"
                fontWeight="800"
                fill="#1E1B4B"
                fontFamily="var(--font-mono)"
              >
                {d.streamflow !== null ? `${d.streamflow.toFixed(2)}` : 'N/A'}{' '}
                <tspan fontSize="8" fontWeight="500" fill="var(--text-3)">mm/d</tspan>
              </text>

              {/* Ground Truth Marker & Label (if present) */}
              {d.groundTruth !== null && d.groundTruth !== undefined && (
                <g>
                  <circle
                    cx={x}
                    cy={getY(d.groundTruth)}
                    r="4.5"
                    fill="#10B981"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                  />
                  <rect
                    x={x - 36}
                    y={getY(d.groundTruth) + 8}
                    width="72"
                    height="16"
                    rx="3"
                    fill="#ECFDF5"
                    stroke="#10B981"
                    strokeWidth="1"
                  />
                  <text
                    x={x}
                    y={getY(d.groundTruth) + 19}
                    textAnchor="middle"
                    fontSize="8.5"
                    fontWeight="700"
                    fill="#047857"
                    fontFamily="var(--font-mono)"
                  >
                    Obs: {d.groundTruth.toFixed(2)}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* X-Axis Ticks & Dates */}
        {/* 1. Historical dates (every 5 days + Day 0) */}
        {historicalItems.map((d, i) => {
          const isKey = i % 5 === 0 || i === historicalItems.length - 1;
          if (!isKey) return null;

          const x = getHistoricalX(i);
          const dateStr = d.date.slice(5);

          return (
            <g key={`x-hist-${i}`}>
              <line
                x1={x}
                y1={padding.top + innerHeight}
                x2={x}
                y2={padding.top + innerHeight + 5}
                stroke="var(--border)"
              />
              <text
                x={x}
                y={padding.top + innerHeight + 17}
                textAnchor="middle"
                fontSize="9.5"
                fill="var(--text-3)"
                fontFamily="var(--font-mono)"
              >
                {dateStr}
              </text>
            </g>
          );
        })}

        {/* 2. Forecast date ticks on X-axis */}
        {forecastItems.map((d) => {
          const x = getForecastX(d.horizon);
          const dateStr = d.date.slice(5);

          return (
            <g key={`x-fc-${d.horizon}`}>
              <line
                x1={x}
                y1={padding.top + innerHeight}
                x2={x}
                y2={padding.top + innerHeight + 6}
                stroke="#4F46E5"
                strokeWidth="1.5"
              />
              <text
                x={x}
                y={padding.top + innerHeight + 17}
                textAnchor="middle"
                fontSize="10"
                fontWeight="700"
                fill="#4F46E5"
                fontFamily="var(--font-mono)"
              >
                +{d.horizon}d
              </text>
              <text
                x={x}
                y={padding.top + innerHeight + 29}
                textAnchor="middle"
                fontSize="8.5"
                fill="var(--text-2)"
                fontFamily="var(--font-mono)"
              >
                {dateStr}
              </text>
            </g>
          );
        })}

        {/* Left Y-Axis Label */}
        <text
          x={-(padding.top + innerHeight / 2)}
          y={18}
          transform="rotate(-90)"
          textAnchor="middle"
          fontSize="11"
          fontWeight="700"
          fill="var(--text-2)"
        >
          River flow (mm / day)
        </text>

        {/* Bottom X-Axis Axis Title */}
        <text
          x={padding.left + historyWidth / 2}
          y={height - 8}
          textAnchor="middle"
          fontSize="10.5"
          fontWeight="600"
          fill="var(--text-3)"
        >
          ← Past 30 Days (Observed River Flow & Weather)
        </text>
        <text
          x={originX + forecastWidth / 2}
          y={height - 8}
          textAnchor="middle"
          fontSize="10.5"
          fontWeight="700"
          fill="#4F46E5"
        >
          Next 7 Days (Model Flow Forecast) →
        </text>

        {/* Interactive Invisible Overlay Rectangles for Hover */}
        {allInteractivePoints.map((pt, i) => {
          const prevX = i > 0 ? (allInteractivePoints[i - 1].x + pt.x) / 2 : padding.left;
          const nextX = i < allInteractivePoints.length - 1 ? (pt.x + allInteractivePoints[i + 1].x) / 2 : width - padding.right;
          const colW = Math.max(nextX - prevX, 6);

          return (
            <rect
              key={`overlay-${i}`}
              x={prevX}
              y={padding.top}
              width={colW}
              height={innerHeight}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoverIndex(i)}
            />
          );
        })}

        {/* Active Hover Crosshair Line */}
        {hoverIndex !== null && allInteractivePoints[hoverIndex] && (
          <g>
            <line
              x1={allInteractivePoints[hoverIndex].x}
              y1={padding.top}
              x2={allInteractivePoints[hoverIndex].x}
              y2={padding.top + innerHeight}
              stroke="#64748B"
              strokeWidth="1.2"
              strokeDasharray="3 3"
            />
            <circle
              cx={allInteractivePoints[hoverIndex].x}
              cy={getY(allInteractivePoints[hoverIndex].streamflow || 0)}
              r="6.5"
              fill={allInteractivePoints[hoverIndex].isForecast ? '#4F46E5' : '#2563EB'}
              stroke="#FFFFFF"
              strokeWidth="2.5"
            />
          </g>
        )}
      </svg>

      {/* Floating Detailed Tooltip */}
      {hoverIndex !== null && allInteractivePoints[hoverIndex] && (
        <div
          style={{
            position: 'absolute',
            left: `${Math.min(Math.max(allInteractivePoints[hoverIndex].x - 90, 15), width - 210)}px`,
            top: '8px',
            background: 'rgba(15, 23, 42, 0.96)',
            color: '#FFFFFF',
            padding: '9px 13px',
            borderRadius: '6px',
            fontSize: '11px',
            pointerEvents: 'none',
            boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
            zIndex: 15,
            minWidth: '175px',
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: '5px', borderBottom: '1px solid rgba(255,255,255,0.18)', paddingBottom: '3px', display: 'flex', justifyContent: 'space-between' }}>
            <span>{allInteractivePoints[hoverIndex].date}</span>
            <span style={{ color: allInteractivePoints[hoverIndex].isForecast ? '#818CF8' : '#60A5FA', fontWeight: 600 }}>
              {allInteractivePoints[hoverIndex].isForecast ? `+${allInteractivePoints[hoverIndex].horizon}d Forecast` : 'Observed'}
            </span>
          </div>
          <div>
            River flow:{' '}
            <strong style={{ color: '#60A5FA' }}>
              {allInteractivePoints[hoverIndex].streamflow !== null ? allInteractivePoints[hoverIndex].streamflow.toFixed(3) : 'N/A'}
            </strong>{' '}
            mm/day
          </div>
          {allInteractivePoints[hoverIndex].groundTruth !== null && allInteractivePoints[hoverIndex].groundTruth !== undefined && (
            <div style={{ color: '#34D399', marginTop: '2px' }}>
              Actual Ground Truth: <strong>{allInteractivePoints[hoverIndex].groundTruth.toFixed(3)}</strong> mm/day
            </div>
          )}
          {allInteractivePoints[hoverIndex].precipitation !== null && (
            <div style={{ marginTop: '2px' }}>
              Precipitation: <strong style={{ color: '#22D3EE' }}>{allInteractivePoints[hoverIndex].precipitation.toFixed(1)}</strong> mm/day
            </div>
          )}
          {allInteractivePoints[hoverIndex].temperature !== null && (
            <div style={{ marginTop: '2px' }}>
              Temperature: <strong>{allInteractivePoints[hoverIndex].temperature.toFixed(1)}</strong> °C
            </div>
          )}
          {thresholds.P95_mm_day && allInteractivePoints[hoverIndex].streamflow >= thresholds.P95_mm_day && (
            <div style={{ color: '#FBBF24', fontWeight: 700, marginTop: '4px', fontSize: '10px' }}>
              ⚠ Exceeds P95 High-Flow Threshold ({thresholds.P95_mm_day.toFixed(2)} mm/d)
            </div>
          )}
        </div>
      )}

      {/* Clean Hydrograph Legend */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '10px 14px',
          fontSize: '11.5px',
          color: 'var(--text-2)',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-elevated)',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '14px', height: '3px', background: '#2563EB', borderRadius: '2px' }} />
          <strong>Observed river flow</strong> (mm/d)
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '14px', height: '3px', borderTop: '2px dashed #4F46E5' }} />
          <strong>Model predicted flow</strong> (+1d, +3d, +7d)
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', background: '#06B6D4', borderRadius: '1.5px' }} />
          <strong>Rainfall</strong> (mm/d)
        </span>
        {thresholds.P95_mm_day && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '14px', height: '2px', borderTop: '2px dashed #D97706' }} />
            <strong style={{ color: '#B45309' }}>P95 High-flow threshold</strong> ({thresholds.P95_mm_day.toFixed(2)} mm/d)
          </span>
        )}
        {thresholds.P99_mm_day && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '14px', height: '2px', borderTop: '2px dashed #DC2626' }} />
            <strong style={{ color: '#B91C1C' }}>P99 High-flow threshold</strong> ({thresholds.P99_mm_day.toFixed(2)} mm/d)
          </span>
        )}
      </div>
    </div>
  );
}
