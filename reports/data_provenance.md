# FLOODCAST — Data Provenance & Hydrological Lineage Report

**Primary Dataset:** CAMELS-BR v1.2 (Catchment Attributes and MEteorology for Large-Sample Studies — Brazil)  
**Publication Reference:** Chagas et al., *CAMELS-BR: hydrometeorological time series and attributes for 897 catchments in Brazil*, Earth System Science Data (ESSD), 2020.  
**DOI:** [10.5194/essd-12-2075-2020](https://doi.org/10.5194/essd-12-2075-2020)  
**Audit Date:** November 5, 2026  
**Auditor:** Technical Documentation Lead & Data Governance Specialist  

---

## 1. Primary Hydrometeorological Data Sources

The benchmark utilizes CAMELS-BR v1.2, integrating three primary data streams:

### A. Streamflow Measurements
- **Primary Custodian:** Agência Nacional de Águas e Saneamento Básico (ANA), Brazil.
- **Data Delivery:** Daily mean discharge ($Q$, converted from $\text{m}^3/\text{s}$ to specific runoff $\text{mm}/\text{day}$ by dividing by upstream contributing catchment area).
- **Quality Flags:** Quality-checked hydrological gauge measurements filtered for sensor drift, physical bounds, and stage-discharge rating curve validity.

### B. Daily Meteorological Forcings
- **Precipitation:** Multi-source ensemble combining station gauges from ANA and the Instituto Nacional de Meteorologia (INMET), gridded via CHIRPS (Climate Hazards Group InfraRed Precipitation with Station data) and MSWEP (Multi-Source Weighted-Ensemble Precipitation).
- **Temperature:** Daily mean 2-meter air temperature ($T$, °C) derived from ERA5-Land reanalysis and INMET observation stations.

---

## 2. Static Catchment Descriptors & Temporal Provenance

Static features encode geological, topographic, pedological, land cover, and human disturbance attributes across each catchment.

| Feature Group | Attributes | Primary Original Source | Temporal Provenance & Epoch | Static Assumption Validity |
| :--- | :--- | :--- | :--- | :--- |
| **Topography** | `elev_gauge`, `elev_mean`, `slope_mean`, `area` | SRTM (Shuttle Radar Topography Mission) 30m DEM | 2000 Baseline | Valid (Geomorphology static on human timescales) |
| **Pedology (Soil)** | `sand_perc`, `silt_perc`, `clay_perc`, `org_carbon_content`, `bedrock_depth`, `water_table_depth` | SoilGrids 250m & Pelletier / Fan et al. global depth models | ~2014 Composite | Valid (Macro soil texture and depth stable across evaluation window) |
| **Geology & Hydrogeology** | `geol_class_1st_perc`, `geol_class_2nd_perc`, `carb_rocks_perc`, `geol_porosity`, `geol_permeability` | GLHYMPS 1.0 (Global Hydrogeology Maps) & CPRM (Geological Survey of Brazil) | Pre-2010 Lithology Atlas | Valid (Bedrock lithology static) |
| **Land Cover & Vegetation** | `forest_perc`, `crop_perc`, `crop_mosaic_perc`, `shrub_perc`, `grass_perc`, `barren_perc`, `imperv_perc`, `wet_perc`, `snow_perc`, `dom_land_cover_perc` | MapBiomas Collection 2.0 / 3.0 (MODIS/Landsat annual land use) | 2000–2010 Average Composite | **Temporal Caveat:** Fixed historical mean does not reflect localized dynamic deforestation or urban expansion occurring post-2015. |
| **Human Regulation** | `consumptive_use`, `consumptive_use_perc`, `reservoirs_vol`, `regulation_degree` | ANA Water Rights Register & National Dam Safety System (SNISB) | ~2017 Administrative Snapshot | **Temporal Caveat:** Dam constructions or reservoir commissionings post-2017 are not reflected in static storage volume. |

---

## 3. Data License & Redistribution Terms

- **CAMELS-BR License:** Distributed under the **Creative Commons Attribution 4.0 International (CC-BY 4.0)** license.
  - Attribution: *Chagas et al. (2020), Earth System Science Data.*
  - Commercial & Non-Commercial Use: Permitted with attribution.
  - Derivative Works: Permitted provided modifications and derivations are documented.
- **Repository Inclusion:** Preprocessed feature matrices and Parquet subsets distributed within `artifacts/` are compliant with CC-BY 4.0 derivative data sharing provisions.
- **USGS Starter Data:** The initial 5-station starter data from USGS NWIS (`data/raw/train.csv`, `data/raw/test.csv`) is dedicated to the public domain (US Government work, 17 U.S.C. § 105). However, as mandated by the project instructions, **USGS data is not used for this operational model**, which is dedicated exclusively to the CAMELS-BR Brazilian benchmark.

---

## 4. Benchmark Splitting & Target Origin Definition

- **Reference Period (1980–2000):** Used exclusively for calculating climatological historical percentiles (P95, P99) and dynamic/static feature scalers.
- **Evaluation Period (2001–2024):** Strictly used for out-of-sample forward testing.
- **No Temporal Cross-Contamination:** No test target values were observed or computed using data past origin date $t_0$.

