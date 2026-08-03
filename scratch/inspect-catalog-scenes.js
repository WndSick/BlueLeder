import fs from "fs";
import { prisma } from "../lib/prisma-client";
import { SentinelProvider } from "../lib/services/gis/satellite-provider";

try {
  const envText = fs.readFileSync(".env", "utf8");
  for (const line of envText.split("\n")) {
    const match = line.match(/^\s*([\w_]+)\s*=\s*"?([^"\r\n]+)"?/);
    if (match) process.env[match[1]] = match[2];
  }
} catch (_) {}

async function inspectCatalog() {
  const project = await prisma.project.findFirst({
    where: { status: "APPROVED" },
  });

  if (!project) {
    console.log("No approved project found.");
    return;
  }

  console.log("=== INSPECTING ALL CATALOG SCENES FOR PROJECT ===");
  console.log("Project:", project.name, `(${project.id})`);

  const tokenRes = await fetch("https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.SENTINEL_HUB_CLIENT_ID || "",
      client_secret: process.env.SENTINEL_HUB_CLIENT_SECRET || "",
    }),
  });

  const tokenData = await tokenRes.json();
  const token = tokenData.access_token;

  const targetDate = new Date(2026, 7, 1);
  const windowStart = new Date(targetDate.getTime() - 15 * 24 * 60 * 60 * 1000);
  const windowEnd = new Date(targetDate.getTime() + 15 * 24 * 60 * 60 * 1000);

  const geojson = JSON.parse(project.boundaryGeojson);
  const geometry = geojson.geometry || geojson;

  const response = await fetch("https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      collections: ["sentinel-2-l2a"],
      datetime: `${windowStart.toISOString()}/${windowEnd.toISOString()}`,
      intersects: geometry,
      limit: 20,
    }),
  });

  const data = await response.json();
  const features = data.features || [];

  console.log(`\nTotal Returned Features from CDSE Catalog: ${features.length}\n`);

  const mapped = features.map((feat, index) => ({
    index: index + 1,
    sceneId: feat.id,
    acquisitionDate: feat.properties.datetime,
    cloudCoverPercent: feat.properties["eo:cloud_cover"],
    platform: feat.properties["eo:platform"] || "Sentinel-2",
    tileId: feat.properties["s2:mgrs_tile"] || feat.id.split("_").find(p => p.startsWith("T")),
    bounds: feat.bbox,
  }));

  console.log("=== RAW STAC CATALOG RETURN ORDER ===");
  console.table(mapped);

  const sorted = [...mapped].sort((a, b) => a.cloudCoverPercent - b.cloudCoverPercent);
  console.log("\n=== SORTED BY CLOUD COVER (ASCENDING) ===");
  console.table(sorted);

  await prisma.$disconnect();
}

inspectCatalog();
