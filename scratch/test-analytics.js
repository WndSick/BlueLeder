async function testAnalytics() {
  try {
    const loginRes = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@blueregistry.local", password: "demo123" }),
    });
    const cookie = loginRes.headers.get("set-cookie").split(";")[0];

    const res = await fetch("http://localhost:3000/api/analytics", {
      headers: { Cookie: cookie },
    });
    const data = await res.json();
    console.log("Analytics HTTP Status:", res.status);
    console.log("Has analysis:", !!data.analysis);
    if (data.analysis) {
      console.log("analysis.report.unresolvedFlags count:", data.analysis.report?.unresolvedFlags?.length);
      console.log("analysis.gis.approvedAreaHectares:", data.analysis.gis?.approvedAreaHectares);
      console.log("analysis.confidence.score:", data.analysis.confidence?.score);
    }
  } catch (err) {
    console.error("Analytics test error:", err);
  }
}

testAnalytics();
