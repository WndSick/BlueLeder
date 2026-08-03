import fs from "fs";

async function run() {
  try {
    console.log("=== STEP 1: AUTHENTICATION ===");
    console.log("Logging in as NGO...");
    const ngoLogin = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "demo@blueregistry.local",
        password: "demo123"
      }),
    });
    const ngoCookie = ngoLogin.headers.get("set-cookie").split(";")[0];

    console.log("Logging in as ADMIN...");
    const adminLogin = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@blueregistry.local",
        password: "demo123"
      }),
    });
    const adminCookie = adminLogin.headers.get("set-cookie").split(";")[0];

    console.log("=== STEP 2: CREATE & SUBMIT PROJECT ===");
    // Create draft
    const draftRes = await fetch("http://localhost:3000/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": ngoCookie
      },
      body: JSON.stringify({
        name: "Sundarban Automated MRV Test",
        ecosystem: "mangrove",
        state: "West Bengal",
        district: "South 24 Parganas",
        village: "Sajnekhali",
        startDate: "2026-07-01",
        durationYears: 15,
        responsibleOrganization: "Sundarban Collective",
        communityPartner: "Sajnekhali Forest Committee",
        areaHectares: 12.5,
        boundaryGeojson: JSON.stringify({
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [[[88.75, 22.12], [88.85, 22.12], [88.85, 22.22], [88.75, 22.22], [88.75, 22.12]]]
          }
        })
      })
    });
    const draftText = await draftRes.text();
    console.log("Draft status:", draftRes.status);
    console.log("Draft text:", draftText);
    const draftData = JSON.parse(draftText);
    console.log("Created draft ID:", draftData.project.id);
    const projectId = draftData.project.id;

    // Upload a mandatory document
    console.log("Uploading land authorization document...");
    const docForm = new FormData();
    docForm.set("category", "LAND_AUTHORIZATION");
    docForm.set("file", new Blob(["Mock pdf contents"], { type: "application/pdf" }), "authorization.pdf");
    
    const uploadRes = await fetch(`http://localhost:3000/api/projects/${projectId}/documents`, {
      method: "POST",
      headers: { "Cookie": ngoCookie },
      body: docForm
    });
    console.log("Document upload status:", uploadRes.status);

    // Submit project
    console.log("Submitting project for review...");
    const submitRes = await fetch(`http://localhost:3000/api/projects/${projectId}/submit`, {
      method: "POST",
      headers: { "Cookie": ngoCookie }
    });
    console.log("Submit status:", submitRes.status);

    console.log("=== STEP 3: ADMIN APPROVAL & SATELLITE BASELINE ===");
    // Start review
    await fetch(`http://localhost:3000/api/projects/${projectId}/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": adminCookie
      },
      body: JSON.stringify({ action: "START" })
    });

    // Approve project
    console.log("Admin approving project...");
    const approveRes = await fetch(`http://localhost:3000/api/projects/${projectId}/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": adminCookie
      },
      body: JSON.stringify({ action: "APPROVE", note: "Approved boundary area for automated satellite MRV." })
    });
    console.log("Approval status:", approveRes.status);

    // Verify baseline was created
    const reportListRes = await fetch(`http://localhost:3000/api/mrv/reports?projectId=${projectId}`, {
      headers: { "Cookie": adminCookie }
    });
    const reportData = await reportListRes.json();
    console.log("Baseline established:", !!reportData.baseline);
    console.log("Baseline NDVI score:", reportData.baseline?.ndviMean);

    console.log("=== STEP 4: TRIGGER AUTOMATED MONITORING CYCLE ===");
    const triggerRes = await fetch("http://localhost:3000/api/mrv/trigger", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": ngoCookie
      },
      body: JSON.stringify({ projectId, date: "2026-12-15" })
    });
    console.log("Trigger status:", triggerRes.status, await triggerRes.text());

    // Fetch updated cycles
    const reportsRes = await fetch(`http://localhost:3000/api/mrv/reports?projectId=${projectId}`, {
      headers: { "Cookie": ngoCookie }
    });
    const updatedData = await reportsRes.json();
    const cycle = updatedData.cycles[0];
    console.log("Monitoring cycle period:", cycle?.periodKey);
    console.log("Cycle status:", cycle?.status);
    console.log("Calculated NDVI stats:", cycle?.vegetation?.ndviMean);
    console.log("Sentinel scene source ID:", cycle?.satelliteScenes[0]?.sceneId);
    console.log("NDVI delta vs baseline:", cycle?.mrvReport?.baselineDeltaPercent + "%");

    console.log("=== STEP 5: VERIFIER COMPLIANCE AUDIT ===");
    const reportId = cycle.mrvReport.id;
    console.log("Verifying report ID:", reportId);

    const reviewRes = await fetch("http://localhost:3000/api/mrv/review", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": adminCookie
      },
      body: JSON.stringify({
        reportId,
        status: "verified",
        comment: "Sentinel-2 bands indicate healthy canopy regrowth within target boundary. Verified."
      })
    });
    console.log("Report verification status:", reviewRes.status, await reviewRes.text());

    console.log("=== STEP 6: BLUELEDGER CREDIT GENERATION ===");
    // Fetch ledger state
    const ledgerStateRes = await fetch(`http://localhost:3000/api/ledger?projectId=${projectId}`, {
      headers: { "Cookie": adminCookie }
    });
    const ledgerState = await ledgerStateRes.json();
    console.log("Ledger project approved for MRV:", ledgerState.ledger.antiFraud.projectApproved);
    console.log("Boundary overlaps clear:", ledgerState.ledger.antiFraud.overlapClear);
    console.log("Telemetry reports available:", ledgerState.ledger.antiFraud.evidenceAvailable);
    console.log("Verifier approvals complete:", ledgerState.ledger.antiFraud.verifierApprovalComplete);
    console.log("Annual credit limit (tCO2e/yr):", ledgerState.ledger.antiFraud.annualIssuanceLimit);

  } catch (error) {
    console.error("E2E Integration Test failed:", error);
  }
}

run();
