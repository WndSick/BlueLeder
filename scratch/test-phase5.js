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
    console.log("Login successful! Cookie acquired.");

    console.log("\n=== STEP 2: FETCH PROJECTS & VERIFIED REPORT ===");
    const projectsRes = await fetch("http://localhost:3000/api/projects", { headers: { Cookie: cookie } });
    const projectsData = await projectsRes.json();
    const project = projectsData.projects.find(p => p.status === "APPROVED") || projectsData.projects[0];
    console.log("Active Project:", project.name, `(${project.id})`);

    const reportsRes = await fetch(`http://localhost:3000/api/mrv/reports?projectId=${project.id}`, { headers: { Cookie: cookie } });
    const reportsData = await reportsRes.json();
    let cycle = (reportsData.cycles || []).find(c => c.mrvReport && c.mrvReport.verificationStatus === "verified");

    if (!cycle || !cycle.mrvReport) {
      console.log("Triggering fresh satellite MRV telemetry run...");
      const triggerRes = await fetch("http://localhost:3000/api/mrv/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ projectId: project.id, date: new Date().toISOString() }),
      });
      const triggerData = await triggerRes.json();
      console.log("Trigger Result:", triggerData.message || triggerData.error);

      // Re-fetch cycles
      const updatedReports = await fetch(`http://localhost:3000/api/mrv/reports?projectId=${project.id}`, { headers: { Cookie: cookie } });
      const updatedData = await updatedReports.json();
      cycle = (updatedData.cycles || [])[0];

      if (cycle && cycle.mrvReport) {
        console.log("Approving MRV report for tokenization...");
        const reviewRes = await fetch("http://localhost:3000/api/mrv/review", {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookie },
          body: JSON.stringify({ reportId: cycle.mrvReport.id, status: "verified", comment: "Automated telemetry verified." }),
        });
        const reviewData = await reviewRes.json();
        console.log("Review Result:", reviewRes.status);
      }
    }

    if (cycle && cycle.mrvReport) {
      console.log("\n=== STEP 3: MINT ERC-1155 CARBON TOKEN BATCH ===");
      const mintRes = await fetch("http://localhost:3000/api/blockchain/tokenize", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ reportId: cycle.mrvReport.id }),
      });
      const mintData = await mintRes.json();
      console.log("Tokenization Response:", mintRes.status, mintData.success ? `TokenID: ${mintData.tokenId}` : mintData.error);

      console.log("\n=== STEP 4: TRIGGER NON-BLOCKING WEB3 BROADCAST WORKER ===");
      const workerRes = await fetch("http://localhost:3000/api/blockchain/worker", {
        method: "POST",
        headers: { Cookie: cookie },
      });
      const workerData = await workerRes.json();
      console.log("Worker Result:", workerData.result?.broadcastLogs);

      console.log("\n=== STEP 5: QUERY MARKETPLACE INVENTORY ===");
      const marketRes = await fetch("http://localhost:3000/api/blockchain/marketplace", { headers: { Cookie: cookie } });
      const marketData = await marketRes.json();
      console.log("Active Listings Count:", marketData.listings?.length);
      const batch = marketData.listings?.[0];

      if (batch) {
        console.log("\n=== STEP 6: BUY CREDIT BATCH ===");
        const buyRes = await fetch("http://localhost:3000/api/blockchain/marketplace", {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookie },
          body: JSON.stringify({ batchId: batch.id, action: "BUY" }),
        });
        const buyData = await buyRes.json();
        console.log("Buy Result:", buyData.message || buyData.error);

        console.log("\n=== STEP 7: RETIRE & BURN CREDIT BATCH ===");
        const retireRes = await fetch("http://localhost:3000/api/blockchain/retire", {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: cookie },
          body: JSON.stringify({ batchId: batch.id, retirementReason: "Corporate Net-Zero Offsetting" }),
        });
        const retireData = await retireRes.json();
        console.log("Retirement Result:", retireData.message || retireData.error);
        console.log("Proof Certificate Hash:", retireData.certificate?.certificateHash);
      }
    } else {
      console.log("No verified report cycle available for tokenization test.");
    }
  } catch (err) {
    console.error("Test Error:", err);
  }
}

run();
