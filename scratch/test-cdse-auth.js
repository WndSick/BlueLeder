import fs from "fs";
import { SentinelProvider } from "../lib/services/gis/satellite-provider";

try {
  const envText = fs.readFileSync(".env", "utf8");
  for (const line of envText.split("\n")) {
    const match = line.match(/^\s*([\w_]+)\s*=\s*"?([^"\r\n]+)"?/);
    if (match) process.env[match[1]] = match[2];
  }
} catch (_) {}

async function testCdseAuth() {
  const provider = new SentinelProvider();
  const testGeojson = JSON.stringify({
    type: "Polygon",
    coordinates: [
      [
        [88.5, 22.1],
        [88.6, 22.1],
        [88.6, 22.2],
        [88.5, 22.2],
        [88.5, 22.1]
      ]
    ]
  });

  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = new Date();

  console.log("=== TESTING CDSE OAUTH AUTHENTICATION & API INTEGRATION ===");
  try {
    const scenes = await provider.queryCatalog(testGeojson, startDate, endDate);
    console.log("Catalog query returned candidate scenes count:", scenes.length);
    if (scenes.length > 0) {
      console.log("Top candidate scene:", scenes[0]);
      const bands = await provider.fetchBands(scenes[0].sceneId, testGeojson, ["B4", "B8", "SCL"]);
      console.log("Fetched bands successfully. B8 size:", bands.B8?.length);
    }
  } catch (err) {
    console.error("CDSE Test failed:", err);
  }
}

testCdseAuth();
