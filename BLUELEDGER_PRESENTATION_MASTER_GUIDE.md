# BlueLedger: Satellite MRV & Blockchain Carbon Registry
## Presentation & Technical Master Guide for Project Review

---

## 1. Executive Summary

### Problem Statement
The global voluntary carbon market for marine and coastal ecosystems ("Blue Carbon"—mangroves, seagrasses, and salt marshes) suffers from critical structural flaws:
1. **Manual & Irregular MRV**: Monitoring, Reporting, and Verification (MRV) relies on expensive, manual, in-situ field surveys conducted once every 3–5 years.
2. **High Transaction Costs**: Up to 40–60% of carbon credit revenue is absorbed by project auditors and third-party verification intermediaries.
3. **Double Counting & Greenwashing**: Opaque registries fail to guarantee that carbon credits are unique, non-overlapping, and backed by verifiable satellite telemetry.
4. **Lack of Transparency**: Stakeholders and carbon credit buyers cannot inspect raw satellite data or mathematical transformation models.

### Objectives of BlueLedger
BlueLedger automates the end-to-end Blue Carbon MRV and registry pipeline by unifying **Copernicus Sentinel-2 satellite imagery**, **multi-spectral vegetation index algorithms**, **automated biomass/carbon modeling**, and **Polygon Web3 smart contract registries**.

Key outcomes:
* Continuous monthly monitoring of coastal ecosystems via Sentinel-2 satellite telemetry.
* Automated calculation of multi-spectral vegetation indices (NDVI, EVI, NDWI, SAVI, MSAVI).
* Tier-2 IPCC compliant biomass and carbon stock sequestration modeling.
* Cryptographic anchoring of satellite evidence onto an immutable ledger chain.
* Direct tokenization of audited carbon credits into ERC-1155 tokens on the Polygon Amoy network.

### Scope of Current Implementation (First Review)
* **Completed**:
  - Full integration with Copernicus Data Space Ecosystem (CDSE) OAuth, STAC Catalog Search, and Process APIs.
  - Multi-spectral vegetation index engine (`VegetationAnalysisEngine`).
  - Biomass & carbon stock estimation engine (`BiomassEstimationService`, `CarbonSequestrationService`).
  - Image processing & pure JavaScript BMP raster encoder (`ImageProcessingService`).
  - Disk storage management & cleanup utility (`StorageManager`).
  - Automated MRV monitoring cycle orchestrator (`MonitoringService`).
  - OpenZeppelin ERC-1155 smart contracts (`BlueCarbonToken.sol`, `BlueCarbonMarketplace.sol`) compiled for Polygon Amoy Testnet.
* **Planned for Future Phases**:
  - Mainnet deployment on Polygon PoS.
  - Real-time automated UAV/drone telemetry cross-calibration.
  - Advanced deep-learning semantic segmentation for species-level mangrove canopy classification.

---

## 2. Complete System Design

### Architecture Overview

```text
+-----------------------------------------------------------------------------------+
|                                 USER INTERFACE                                    |
|   Next.js 16 (React 19 / TailwindCSS / Leaflet Map Editor / Marketplace UI)        |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v (HTTP / REST API Routes)
+-----------------------------------------------------------------------------------+
|                                 BACKEND API LAYER                                 |
|  app/api/projects/  |  app/api/mrv/trigger/  |  app/api/analytics/  |  app/api/auth/   |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                            MONITORING & MRV ENGINE                                |
|  - MonitoringService (lib/services/mrv/monitoring-service.ts)                      |
|  - VegetationAnalysisEngine (lib/services/gis/vegetation-engine.ts)              |
|  - BiomassEstimationService (lib/services/mrv/biomass-service.ts)               |
|  - CarbonSequestrationService (lib/services/mrv/carbon-service.ts)                |
|  - QualityAssessmentService (lib/services/mrv/quality-service.ts)                |
|  - StorageManager (lib/services/gis/storage-manager.ts)                          |
+-------------------+-----------------------------------+---------------------------+
                    |                                   |
                    v                                   v
+---------------------------------------+   +---------------------------------------+
|        COPERNICUS DATA SPACE          |   |          DATABASE & STORAGE           |
|        (CDSE SATELLITE API)           |   |  - PostgreSQL Database (Prisma ORM)   |
|  - Keycloak OAuth Token Endpoint      |   |  - Disk Storage (public/mrv/*.bmp)    |
|  - STAC 1.0.0 Catalog Search API      |   +---------------------------------------+
|  - Sentinel-2 Process API (Float32)   |
+---------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                               BLOCKCHAIN LAYER                                    |
|  - Viem Web3 Broadcast Worker (lib/services/blockchain/broadcast-worker.ts)       |
|  - BlueCarbonToken ERC-1155 (contracts/BlueCarbonToken.sol)                        |
|  - BlueCarbonMarketplace (contracts/BlueCarbonMarketplace.sol)                    |
|  - Polygon Amoy Testnet (Chain ID 80002)                                          |
+-----------------------------------------------------------------------------------+
```

### Technology Selection Rationale

| Technology Layer | Selected Tool | Rationale |
| :--- | :--- | :--- |
| **Framework** | Next.js 16 (App Router) | Server-side rendering (SSR), API routes, and standard Node.js server execution. |
| **Database** | PostgreSQL + Prisma ORM | Relational schema enforcement, transactional integrity, and strong typing. |
| **Satellite Source** | Copernicus Data Space Ecosystem | Official ESA Sentinel-2 L2A bottom-of-atmosphere surface reflectance provider. |
| **Raster Engine** | Pure JS Float32 Array Math | Zero external C++ dependencies, cross-platform stability in Node.js environments. |
| **Web3 Client** | Viem + Hardhat | Lightweight, type-safe Ethereum library configured for Polygon Amoy (Chain ID 80002). |
| **Smart Contracts**| OpenZeppelin ERC-1155 | Standard multi-token architecture supporting unique batch IDs for carbon credit vintages. |

---

## 3. Complete Backend Flow

### End-to-End Operational Lifecycle

```text
[1. Project Creation] -> [2. Polygon Stored] -> [3. Cycle Scheduled] -> [4. CDSE OAuth] 
        |
        v
[5. Catalog STAC Search] -> [6. Scene Selection] -> [7. Process API Float32 Download]
        |
        v
[8. Band Masking (SCL)] -> [9. Vegetation Indices] -> [10. Biomass & Carbon Stock] 
        |
        v
[11. Quality Audit (MQI)] -> [12. BMP Raster Saving] -> [13. Database & Dashboard Sync]
```

### Detailed Flow Specifications

#### Step 1: Project Creation & GeoJSON Validation
* **Purpose**: User registers a blue carbon restoration site.
* **Input**: Project metadata, ecosystem type (`mangrove`, `seagrass`, `salt_marsh`), land area (hectares), and GeoJSON Polygon.
* **Output**: Persistent `Project` record in PostgreSQL database with status `SUBMITTED`.
* **Files Involved**: [`app/api/projects/route.ts`](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/app/api/projects/route.ts), [`lib/services/project-service.ts`](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/lib/services/project-service.ts).

#### Step 2: Monitoring Initialization & Baseline Setup
* **Purpose**: Initializes monthly monitoring schedules and calculates baseline pre-project vegetation indices.
* **Input**: Project ID and boundary GeoJSON.
* **Output**: `BaselineAnalysis` and monthly `MonitoringCycle` database rows.
* **Files Involved**: [`lib/services/mrv/monitoring-service.ts`](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/lib/services/mrv/monitoring-service.ts) (`initConfig`, `establishBaseline`).

#### Step 3: Copernicus OAuth Authentication
* **Purpose**: Acquires a secure Keycloak Bearer access token for Sentinel Hub API calls.
* **Input**: `SENTINEL_HUB_CLIENT_ID` & `SENTINEL_HUB_CLIENT_SECRET`.
* **Output**: In-memory cached OAuth access token string (valid for 3600 seconds).
* **Files Involved**: [`lib/services/gis/satellite-provider.ts`](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/lib/services/gis/satellite-provider.ts) (`SentinelOAuthClient.getToken`).

#### Step 4: Catalog STAC Search & Scene Selection
* **Purpose**: Searches CDSE STAC Catalog API for Sentinel-2 L2A candidate scenes intersecting the project boundary within a 30-day window and selects the least cloudy scene.
* **Input**: Boundary GeoJSON geometry, `windowStart`, `windowEnd`.
* **Output**: Array of `CandidateScene` objects sorted ascending by `cloudCoverPercent`.
* **Files Involved**: [`lib/services/gis/satellite-provider.ts`](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/lib/services/gis/satellite-provider.ts) (`SentinelCatalogClient.searchScenes`, `SentinelProvider.queryCatalog`).

#### Step 5: Process API Spectral Band Retrieval
* **Purpose**: Downloads raw 32-bit floating point (Float32) band rasters for Red (`B04`), Green (`B03`), Blue (`B02`), NIR (`B08`), SWIR (`B11`), and Scene Classification Layer (`SCL`).
* **Input**: Selected `sceneId`, boundary geometry, requested bands.
* **Output**: `Record<string, Float32Array>` containing raw pixel arrays.
* **Files Involved**: [`lib/services/gis/satellite-provider.ts`](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/lib/services/gis/satellite-provider.ts) (`SentinelProcessClient.fetchRawBands`, `SentinelProvider.fetchBands`).

#### Step 6: Vegetation Index Computation & Quality Audit
* **Purpose**: Computes 5 multi-spectral vegetation indices, estimates biomass/carbon stock, and audits data quality.
* **Input**: Raw band arrays.
* **Output**: `ndviStats`, `eviStats`, `ndwiStats`, `saviStats`, `msaviStats`, `biomassResult`, `carbonResult`, `qualityResult`.
* **Files Involved**: [`lib/services/gis/vegetation-engine.ts`](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/lib/services/gis/vegetation-engine.ts), [`lib/services/mrv/biomass-service.ts`](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/lib/services/mrv/biomass-service.ts), [`lib/services/mrv/carbon-service.ts`](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/lib/services/mrv/carbon-service.ts), [`lib/services/mrv/quality-service.ts`](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/lib/services/mrv/quality-service.ts).

#### Step 7: Local BMP Raster Generation & Database Persistence
* **Purpose**: Generates True-Color RGB and NDVI heatmap 24-bit BMP image rasters, saves them to `public/mrv/`, and updates database records.
* **Input**: Normalized Float32 pixel arrays.
* **Output**: Physical BMP image files on disk and `VegetationAnalysis`, `AutomatedMrvReport` rows in database.
* **Files Involved**: [`lib/services/gis/image-processor.ts`](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/lib/services/gis/image-processor.ts), [`lib/services/mrv/monitoring-service.ts`](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/lib/services/mrv/monitoring-service.ts).

---

## 4. Database Schema Design

The application utilizes PostgreSQL managed through **Prisma ORM**. The primary relational models include:

```prisma
model User {
  id           String    @id @default(uuid())
  email        String    @unique
  passwordHash String
  fullName     String
  role         Role      @default(NGO) // ADMIN, NGO, COMMUNITY, VERIFIER, BUYER
  projects     Project[] @relation("ProjectOwner")
}

model Project {
  id               String            @id @default(uuid())
  name             String
  ecosystem        String            // mangrove, seagrass, salt_marsh
  areaHectares     Float
  boundaryGeojson  String
  status           ProjectStatus     @default(DRAFT) // DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED
  ownerId          String
  owner            User              @relation("ProjectOwner", fields: [ownerId], references: [id])
  baselineAnalysis BaselineAnalysis?
  monitoringCycles MonitoringCycle[]
  creditBatches    CreditBatch[]
}

model MonitoringCycle {
  id              String              @id @default(uuid())
  projectId       String
  periodKey       String              // e.g. "2026-M08"
  monitoringStage String              // "monitoring"
  status          String              // pending, running, completed, skipped, failed
  scheduledAt     DateTime
  vegetation      VegetationAnalysis?
  mrvReport       AutomatedMrvReport?
}

model VegetationAnalysis {
  id               String          @id @default(uuid())
  cycleId          String          @unique
  ndviMean         Float
  eviMean          Float
  ndwiMean         Float
  saviMean         Float
  msaviMean        Float
  agbEstimated     Float           // Above-Ground Biomass (t/ha)
  bgbEstimated     Float           // Below-Ground Biomass (t/ha)
  totalBiomassTons Float
  trueColorPath    String
  ndviMapPath      String
  cycle            MonitoringCycle @relation(fields: [cycleId], references: [id])
}

model AutomatedMrvReport {
  id                  String          @id @default(uuid())
  cycleId             String          @unique
  algorithmVersion    String
  ndviDeltaPercent    Float
  baselineDeltaPercent Float
  confidenceScore     Float
  mqiScore            Float
  anomalyDetected     Boolean
  verificationStatus  String          // awaiting_verification, verified, rejected
  cycle               MonitoringCycle @relation(fields: [cycleId], references: [id])
}
```

---

## 5. Copernicus Sentinel-2 Integration

### Why Sentinel-2 L2A?
* **Sentinel-2 L2A (Level-2A)**: Provides **Bottom-Of-Atmosphere (BOA)** surface reflectance images after automated atmospheric correction via SEN2COR.
* **Spatial Resolution**: 10-meter spatial resolution for visible (RGB) and Near-Infrared (NIR) bands, allowing precise canopy monitoring without requiring commercial satellite subscriptions.
* **Temporal Resolution**: 5-day revisit time at the equator (combining Sentinel-2A, 2B, and 2C satellites).

### Downloaded Spectral Bands & Purpose

| Band Name | Central Wavelength | Native Resolution | Purpose in BlueLedger |
| :--- | :--- | :--- | :--- |
| **B02 (Blue)** | 490 nm | 10 meters | Aerosol scattering correction & Enhanced Vegetation Index (EVI) computation. |
| **B03 (Green)**| 560 nm | 10 meters | True-Color image rendering & Normalized Difference Water Index (NDWI). |
| **B04 (Red)**  | 665 nm | 10 meters | Chlorophyll absorption peak, True-Color rendering, and NDVI computation. |
| **B08 (NIR)**  | 842 nm | 10 meters | High cellular mesophyll reflectance peak; key component for all vegetation indices. |
| **B11 (SWIR)** | 1610 nm | 20 meters | Vegetation canopy moisture content and Soil-Adjusted Vegetation Index (SAVI). |
| **SCL**        | N/A (Categorical)| 20 meters | Scene Classification Layer (cloud, cloud shadow, water, vegetation bitmask). |

---

## 6. Scene Selection & Filtering Algorithm

1. **Date Range Windowing**: The monitoring engine constructs a 30-day temporal window centered around the target monthly cycle date ($\pm 15\text{ days}$).
2. **STAC Catalog Query**: Queries `https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search` filtering by spatial intersection (`intersects`) and collection `sentinel-2-l2a`.
3. **Ascending Cloud Sort**: All returned candidate scenes are parsed into JavaScript objects and sorted strictly in ascending order by cloud cover percentage:
   ```ts
   scenes.sort((a, b) => a.cloudCoverPercent - b.cloudCoverPercent);
   ```
4. **Best Scene Selection**: `scenes[0]` (the scene with the absolute minimum cloud cover in the 30-day window) is selected.
5. **Quality Threshold Check**: If `bestScene.cloudCoverPercent > MAX_ALLOWED_CLOUD_COVER_PERCENT` (configured to `60%` for demo, `45%` for production), the cycle is safely skipped to avoid processing monsoon cloud interference.

---

## 7. Image Processing & Pure JS Raster Encoding

### pure JS BMP Encoder (`encodeBmp`)
To eliminate native C++ image processing binary dependencies (such as `sharp` or `canvas`), BlueLedger implements a pure JavaScript 24-bit uncompressed Bitmap (BMP) encoder directly in [`lib/services/gis/image-processor.ts`](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/lib/services/gis/image-processor.ts#L28-L75).

```text
+-------------------------------------------------------------+
| BMP Header (14 Bytes): Signature "BM", File Size, Offset 54 |
+-------------------------------------------------------------+
| DIB Header (40 Bytes): 100x100 Resolution, 24-bit BGR Color |
+-------------------------------------------------------------+
| Pixel Data (Bottom-to-Top BGR Triplets with 4-Byte Row Pad) |
+-------------------------------------------------------------+
```

### True-Color & Heatmap Rendering
* **True-Color (`generateTrueColorImage`)**: Maps normalized Red (`B04`) and Green (`B03`) surface reflectance values into 8-bit RGB color channels.
* **NDVI Heatmap (`generateNdviHeatmap`)**: Evaluates pixel NDVI values through a color gradient:
  - $\text{NDVI} \le 0$: Red (Water / Bare Soil / Non-vegetated)
  - $0 < \text{NDVI} \le 0.45$: Yellow-Green (Sparse / Transition Vegetation)
  - $\text{NDVI} > 0.45$: Dark Green (Dense Mangrove Canopy)

---

## 8. Multi-Spectral Vegetation Indices

### 1. NDVI (Normalized Difference Vegetation Index)
* **Formula**:
  $$\text{NDVI} = \frac{\text{B08 (NIR)} - \text{B04 (Red)}}{\text{B08 (NIR)} + \text{B04 (Red)}}$$
* **Range**: $-1.0 \text{ to } +1.0$
* **Interpretation**: Measures total photosynthetic activity and green canopy density.
* **Code Location**: [`lib/services/gis/vegetation-engine.ts:L22`](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/lib/services/gis/vegetation-engine.ts#L22)
* **Citation**: *Rouse, J. W., et al. (1974). Monitoring vegetation systems in the Great Plains with ERTS. NASA SP-351, 309-317.*

### 2. EVI (Enhanced Vegetation Index)
* **Formula**:
  $$\text{EVI} = 2.5 \times \frac{\text{B08} - \text{B04}}{\text{B08} + 6.0 \times \text{B04} - 7.5 \times \text{B02} + 1.0}$$
* **Range**: $-1.0 \text{ to } +1.0$
* **Interpretation**: Corrects for atmospheric aerosols and soil background reflections; does not saturate in high-density tropical mangrove canopies.
* **Code Location**: [`lib/services/gis/vegetation-engine.ts:L28`](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/lib/services/gis/vegetation-engine.ts#L28)
* **Citation**: *Huete, A., et al. (2002). Overview of the radiometric and biophysical performance of the MODIS vegetation indices. Remote Sensing of Environment, 83(1-2), 195-213.*

### 3. NDWI (Normalized Difference Water Index)
* **Formula**:
  $$\text{NDWI} = \frac{\text{B03 (Green)} - \text{B08 (NIR)}}{\text{B03 (Green)} + \text{B08 (NIR)}}$$
* **Range**: $-1.0 \text{ to } +1.0$
* **Interpretation**: Delineates open water bodies, tidal inundation levels, and leaf water content.
* **Code Location**: [`lib/services/gis/vegetation-engine.ts:L25`](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/lib/services/gis/vegetation-engine.ts#L25)
* **Citation**: *McFeeters, S. K. (1996). The use of the Normalized Difference Water Index (NDWI) in the delineation of open water features. International Journal of Remote Sensing, 17(7), 1425-1432.*

### 4. SAVI (Soil-Adjusted Vegetation Index)
* **Formula**:
  $$\text{SAVI} = \frac{\text{B08} - \text{B04}}{\text{B08} + \text{B04} + L} \times (1 + L) \quad \text{where } L = 0.5$$
* **Range**: $-1.0 \text{ to } +1.0$
* **Interpretation**: Suppresses soil brightness influences in sparse coastal salt marshes and intertidal muddy zones.
* **Code Location**: [`lib/services/gis/vegetation-engine.ts:L31`](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/lib/services/gis/vegetation-engine.ts#L31)
* **Citation**: *Huete, A. R. (1988). A soil-adjusted vegetation index (SAVI). Remote Sensing of Environment, 27(1), 47-57.*

### 5. MSAVI (Modified Soil-Adjusted Vegetation Index)
* **Formula**:
  $$\text{MSAVI} = \frac{2 \times \text{B08} + 1 - \sqrt{(2 \times \text{B08} + 1)^2 - 8 \times (\text{B08} - \text{B04})}}{2}$$
* **Range**: $-1.0 \text{ to } +1.0$
* **Interpretation**: Inductively calculates soil adjustment factor $L$ dynamically without requiring manual parameter tuning.
* **Code Location**: [`lib/services/gis/vegetation-engine.ts:L34`](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/lib/services/gis/vegetation-engine.ts#L34)
* **Citation**: *Qi, J., et al. (1994). A modified soil adjusted vegetation index. Remote Sensing of Environment, 48(2), 119-126.*

---

## 9. Biomass Estimation Service

BlueLedger implements ecological ecosystem-specific biophysical biomass models in [`lib/services/mrv/biomass-service.ts`](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/lib/services/mrv/biomass-service.ts).

### Parameter Profiles (`lib/config/scientific-config.ts`)

| Ecosystem | AGB Factor ($\text{t/ha}$) | BGB Factor ($\text{t/ha}$) | Total Base Biomass ($\text{t/ha}$) | Carbon Fraction |
| :--- | :---: | :---: | :---: | :---: |
| **Mangrove** | 9.8 | 2.6 | 12.4 | 0.47 |
| **Seagrass** | 1.8 | 2.4 | 4.2 | 0.45 |
| **Salt Marsh** | 3.1 | 4.0 | 7.1 | 0.46 |

### Estimation Formula
$$\text{AGB}_{\text{estimated}} = \text{AGB}_{\text{base}} \times \left(1 + \frac{\Delta\text{NDVI}_{\%}}{100}\right)$$
$$\text{BGB}_{\text{estimated}} = \text{BGB}_{\text{base}} \times \left(1 + \frac{\Delta\text{NDVI}_{\%}}{100}\right)$$
$$\text{Total Biomass (Tons)} = (\text{AGB}_{\text{estimated}} + \text{BGB}_{\text{estimated}}) \times \text{Area}_{\text{hectares}}$$

* **Code Location**: [`lib/services/mrv/biomass-service.ts:L45-L65`](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/lib/services/mrv/biomass-service.ts#L45-L65)
* **Scientific Reference**: *Alongi, D. M. (2012). Carbon sequestration in mangrove forests. Carbon Management, 3(3), 313-322.*

---

## 10. Carbon Sequestration Modeling

Calculates net carbon stock and stoichiometric $\text{CO}_2$ equivalent tons in [`lib/services/mrv/carbon-service.ts`](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/lib/services/mrv/carbon-service.ts).

### Mathematical Formulas

1. **Carbon Stock (Tons C)**:
   $$\text{Carbon Stock} = \text{Total Biomass (Tons)} \times C_{\text{fraction}}$$
   *(Where $C_{\text{fraction}} = 0.47$ for mangroves according to IPCC Tier-2 guidelines).*

2. **Stoichiometric $\text{CO}_2$ Equivalent ($\text{tCO}_2\text{e}$)**:
   $$\text{CO}_2\text{e} = \text{Carbon Stock} \times \left(\frac{44}{12}\right)$$
   *(Where $44/12 \approx 3.6667$ represents the atomic mass ratio of Carbon Dioxide $\text{CO}_2$ to Carbon $\text{C}$).*

3. **Net Sequestration & Additionality**:
   $$\text{Net Sequestration} = \text{CO}_2\text{e}_{\text{current}} - \text{CO}_2\text{e}_{\text{baseline}}$$
   $$\text{Issuable Credits} = \text{Net Sequestration} \times (1 + \text{Bonus}_{\text{additionality}})$$

* **Code Location**: [`lib/services/mrv/carbon-service.ts:L35-L60`](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/lib/services/mrv/carbon-service.ts#L35-L60)
* **IPCC Reference**: *IPCC (2013). 2013 Supplement to the 2006 IPCC Guidelines for National Greenhouse Gas Inventories: Wetlands. Chapter 4: Coastal Wetlands.*

---

## 11. Monitoring Quality Index (MQI) Scoring

To ensure scientific integrity, every monitoring cycle is assigned a **Monitoring Quality Index (MQI)** score ($0.0 \text{ to } 1.0$) in [`lib/services/mrv/quality-service.ts`](file:///c:/Users/anish/Desktop/Major%20project/restored-blue-carbon/lib/services/mrv/quality-service.ts).

$$\text{MQI} = (w_1 \cdot Q_{\text{SCL}}) + (w_2 \cdot Q_{\text{geo}}) + (w_3 \cdot Q_{\text{temporal}}) + (w_4 \cdot Q_{\text{sensor}})$$

### Configured Weights (`lib/config/scientific-config.ts`)
* **$w_1 = 0.50$ (SCL Valid Pixels)**: Percentage of unclouded pixels in project boundary.
* **$w_2 = 0.20$ (Geometry Coverage)**: Full spatial intersection ratio.
* **$w_3 = 0.20$ (Temporal Age)**: Proximity to scheduled target cycle date.
* **$w_4 = 0.10$ (Sensor Radiometrics)**: Band signal integrity.

---

## 12. External APIs Used

1. **CDSE OAuth Token Endpoint**:
   - URL: `https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token`
   - Grant Type: `client_credentials`
2. **CDSE STAC 1.0.0 Catalog Search API**:
   - URL: `https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search`
   - Collection: `sentinel-2-l2a`
3. **CDSE Sentinel-2 Process API**:
   - URL: `https://sh.dataspace.copernicus.eu/api/v1/process`
   - Format: `image/tiff` Float32 6-channel output array.

---

## 13. Important Terminology Glossary

* **Blue Carbon**: Carbon captured and stored by coastal and marine ecosystems (mangroves, seagrasses, salt marshes).
* **MRV**: Monitoring, Reporting, and Verification—the standard framework for auditing carbon credit claims.
* **Sentinel-2 L2A**: Copernicus Earth Observation satellite dataset providing atmospherically corrected surface reflectance imagery.
* **NDVI**: Normalized Difference Vegetation Index; measures chlorophyll density and canopy vigor.
* **SCL**: Scene Classification Layer; categorical pixel classification mask generated by ESA SEN2COR.
* **MQI**: Monitoring Quality Index; BlueLedger's composite metric scoring satellite data reliability.
* **STAC**: SpatioTemporal Asset Catalog; standard JSON specification for searching satellite scene metadata.
* **ERC-1155**: Ethereum multi-token standard used to represent semi-fungible carbon credit batches on blockchain.

---

## 14. Top 15 Essential Mentor Questions & Direct Answers

1. **Q: Why use Sentinel-2 instead of Landsat-8/9 or commercial satellites?**
   * **A**: Sentinel-2 provides 10-meter spatial resolution and a 5-day revisit cycle free of charge via Copernicus Data Space Ecosystem. Landsat has a 30m resolution and 16-day revisit, which is too coarse for coastal mangrove fringe tracking.

2. **Q: How does the system handle heavy cloud cover during Indian monsoon seasons?**
   * **A**: The system searches candidate scenes over a 30-day window and sorts them by cloud cover. If the least cloudy scene still exceeds 60% cloud cover, the cycle is automatically marked as `skipped` with a clear audit log, preventing corrupted carbon credit issuances.

3. **Q: What is the scientific basis for biomass estimation in BlueLedger?**
   * **A**: BlueLedger implements Tier-2 biophysical models based on peer-reviewed literature (Alongi 2012, IPCC 2013 Wetlands Supplement), combining baseline species biomass coefficients (e.g. 12.4 t/ha for mangroves) with relative NDVI canopy density changes ($\Delta\text{NDVI}_{\%}$).

4. **Q: Why is standard Node.js runtime required instead of Cloudflare Workers (`workerd`)?**
   * **A**: Cloudflare `workerd` isolates strictly prohibit local disk file system writes (`fs.writeFileSync`/`fs.mkdirSync`), throwing `EPERM` errors when saving BMP raster images. Standard Node.js supports native filesystem operations.

5. **Q: How are carbon credits tokenized on the blockchain?**
   * **A**: Verified MRV report metrics are submitted to the `BlueCarbonToken` ERC-1155 smart contract deployed on Polygon Amoy Testnet (Chain ID 80002), minting token batches where each token represents 1 metric ton of sequestered $\text{CO}_2\text{e}$.

---

## 15. Research References & Citations

1. **Alongi, D. M. (2012)**. *Carbon sequestration in mangrove forests*. Carbon Management, 3(3), 313-322. DOI: `10.4155/cmt.12.20`.
2. **IPCC (2013)**. *2013 Supplement to the 2006 IPCC Guidelines for National Greenhouse Gas Inventories: Wetlands*. Chapter 4: Coastal Wetlands.
3. **Rouse, J. W., et al. (1974)**. *Monitoring vegetation systems in the Great Plains with ERTS*. NASA SP-351, 309-317.
4. **Huete, A., et al. (2002)**. *Overview of the radiometric and biophysical performance of the MODIS vegetation indices*. Remote Sensing of Environment, 83(1-2), 195-213.
5. **McFeeters, S. K. (1996)**. *The use of the Normalized Difference Water Index (NDWI) in the delineation of open water features*. International Journal of Remote Sensing, 17(7), 1425-1432.
6. **European Space Agency (ESA) (2024)**. *Sentinel-2 User Handbook & Copernicus Data Space Ecosystem API Documentation*.

---

## 16. Presentation Script (Slide-by-Slide Guide)

* **Slide 1 (Title)**: "Good morning respected mentor. Today I present BlueLedger—an automated Satellite MRV and Blockchain Registry for Blue Carbon Ecosystems."
* **Slide 2 (Problem & Solution)**: "Currently, Blue Carbon verification is manual, slow, and opaque. BlueLedger solves this by replacing manual checks with automated Sentinel-2 satellite telemetry and smart contract registries."
* **Slide 3 (Architecture)**: "Our system combines Next.js 16, PostgreSQL, Copernicus CDSE APIs, pure JavaScript raster processing, and OpenZeppelin ERC-1155 smart contracts on Polygon Amoy."
* **Slide 4 (Sentinel-2 Integration & Math)**: "We fetch 10-meter resolution spectral bands from CDSE and compute 5 indices—NDVI, EVI, NDWI, SAVI, and MSAVI—to measure canopy density without atmospheric interference."
* **Slide 5 (Biomass & Carbon Model)**: "Using IPCC 2013 Tier-2 guidelines and Alongi 2012 empirical models, we convert relative NDVI variations into Above/Below-Ground Biomass and net $\text{CO}_2\text{e}$ sequestered."
* **Slide 6 (Conclusion & Status)**: "All GIS algorithms, CDSE OAuth integrations, raster image encoding, and smart contracts are fully implemented and verified in our codebase."
