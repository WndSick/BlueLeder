import fs from "fs";

async function run() {
  try {
    console.log("=== STEP 1: AUTHENTICATION ===");
    const loginRes = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@blueregistry.local",
        password: "demo123"
      }),
    });
    const cookie = loginRes.headers.get("set-cookie").split(";")[0];
    console.log("Login Cookie acquired!");

    console.log("\n=== STEP 2: TEST SCIENTIFIC CONFIG ENDPOINT ===");
    const configRes = await fetch("http://localhost:3000/api/mrv/config", {
      headers: { "Cookie": cookie }
    });
    const configData = await configRes.json();
    console.log("Scientific Config Status:", configRes.status);
    console.log("Algorithm Version:", configData.config?.version);
    console.log("Mangrove Parameters:", configData.config?.ecosystems?.mangrove);
    console.log("Quality Weights:", configData.config?.qualityWeights);
    console.log("SCL Dilation Radius (Pixels):", configData.config?.sclDilationRadiusPixels);

  } catch (err) {
    console.error("Test Error:", err);
  }
}

run();
