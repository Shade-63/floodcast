# FLOODCAST — Data Governance and Lineage Policy

**Benchmark Dataset:** CAMELS-BR v1.2  
**Publication:** Chagas et al., *CAMELS-BR: hydrometeorological time series and attributes for 897 catchments in Brazil*, Earth System Science Data (ESSD), 12, 2075–2096, 2020.  
**DOI:** [10.5194/essd-12-2075-2020](https://doi.org/10.5194/essd-12-2075-2020)  
**Governance Scope:** Time series observations, static geomorphological descriptors, spatial partitions, and derivative feature matrices.  
**Audit Date:** November 5, 2026  

---

## 1. Data Provenance & Primary Custodians

| Stream | Primary Custodian | Temporal Resolution | Aggregation / Spatial Processing |
| :--- | :--- | :---: | :--- |
| **Streamflow ($Q$)** | Agência Nacional de Águas e Saneamento Básico (ANA) | Daily | Measured daily discharge ($\text{m}^3/\text{s}$) converted to specific catchment runoff ($\text{mm}/\text{day}$) using SRTM upstream contributing area. |
| **Precipitation ($P$)** | CHIRPS v2.0 & MSWEP v2.2 | Daily | Areal mean precipitation ($\text{mm}/\text{day}$) calculated via polygon intersection over catchment drainage boundaries. |
| **Temperature ($T$)** | ERA5-Land Reanalysis (ECMWF) & INMET | Daily | Daily 2-meter air temperature (°C) spatial mean across catchment polygons. |
| **Topography** | SRTM 30m Digital Elevation Model | Static | Basin elevation (min, mean, max) and slope derived using TauDEM hydrological analysis. |
| **Pedology** | SoilGrids (ISRIC) & Pelletier et al. | Static | Sand, silt, clay percentages, organic carbon content, and depth to bedrock. |
| **Geology** | GLHYMPS 1.0 & CPRM Geological Survey | Static | Surface lithology classes, carbonate fraction, porosity, and logarithmic permeability. |
| **Land Cover** | MapBiomas Collection 2.0 / 3.0 | Static | Catchment-aggregated percentage fractions of forest, crop, mosaic, grass, shrub, wetland, water, and urban cover. |
| **Human Regulation** | ANA Water Rights & SNISB Dam Safety | Static | Consumptive extraction rates, upstream reservoir storage capacity ($\text{hm}^3$), and regulation degree. |

---

## 2. Licensing and Redistribution Rights

- **CAMELS-BR License:** Open access under the **Creative Commons Attribution 4.0 International (CC-BY 4.0)** license.
  - **Permissions:** Unrestricted sharing, adaptation, and redistribution in any medium for academic and commercial purposes.
  - **Attribution Requirement:** Explicit citation of Chagas et al. (2020), fulfilled in all repository documentation.
- **Derivative Artifacts (`artifacts/`):** Feature matrices, Parquet timeseries partitions, and PyTorch tensors distributed in this repository are derived works compliant with CC-BY 4.0 guidelines.
- **USGS NWIS Starter Data:** Dedicated to the public domain (17 U.S.C. § 105). In accordance with non-negotiable benchmark rules, **USGS starter data is not used in the operational FLOODCAST system**, which is dedicated to CAMELS-BR.

---

## 3. Data Completeness & Quality Filtering

### Filtering Pipeline
1. **Initial Population:** 897 Brazilian catchments.
2. **Quality Filter (3-Year Continuous Joint Streak):**
   - Requires $\ge 1,095$ continuous calendar days with simultaneous valid streamflow and meteorology.
   - 788 catchments satisfied this criteria ($87.85\%$).
   - 109 catchments were filtered out due to fragmented records or prolonged gauge outages.
3. **Threshold Reference Period Quality Filter (1980–2000):**
   - Historical P95 and P99 thresholds require sufficient baseline coverage during 1980–2000.
   - In the test holdout (118 catchments), **115 catchments met this requirement**.
   - 3 catchments were excluded from binary event evaluation:
     - `42546000` (Basin 245): Gauge established post-2000 (0% reference coverage).
     - `54260000` (Basin 363): Only 30.1% reference coverage ($< 50\%$ threshold gate).
     - `54950000` (Basin 374): Only 43.4% reference coverage ($< 50\%$ threshold gate).

---

## 4. Policy on Missing Values and Imputation

- **Strict No-Imputation Policy in Production:**
  The operational inference service rejects input sequences with missing days or NaNs with **HTTP 400**.
  The system never silently forward-fills or fabricates missing observations in production.
- **Static Feature Imputation:**
  Any missing static catchment characteristic is imputed exclusively using the **training set median** vector ($\mathbf{M}_{\text{static}}$).

---

## 5. Temporal Provenance & Caveats of Static Descriptors

While topographic and geological features remain invariant over human timescales:
1. **Land Cover Changes:** Land cover percentages represent ~2000–2010 MapBiomas composites. Deforestation or agricultural expansion occurring post-2015 is not captured dynamically.
2. **Dam Construction:** Reservoir volumes represent ~2017 administrative snapshots. Dams commissioned post-2017 are not reflected in upstream storage capacity.

