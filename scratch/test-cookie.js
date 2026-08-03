async function run() {
  try {
    console.log("=== PHASE 1: NGO SUBMISSION ===");
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

    // Find the test project
    const ngoRegistry = await (await fetch("http://localhost:3000/api/registry", {
      headers: { "Cookie": ngoCookie }
    })).json();
    let project = (ngoRegistry.projects || []).find(p => p.name.includes("Test Project Creation"));
    if (!project) {
      console.error("Test project not found!");
      return;
    }
    console.log(`NGO project status: ${project.status}`);

    if (project.status === "DRAFT") {
      console.log("NGO submitting project...");
      const submitRes = await fetch(`http://localhost:3000/api/projects/${project.id}/submit`, {
        method: "POST",
        headers: { "Cookie": ngoCookie }
      });
      console.log("Submit status:", submitRes.status, await submitRes.text());
    }

    console.log("\n=== PHASE 2: ADMIN REVIEW & APPROVAL ===");
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

    // Reload project status as admin
    const adminRegistry = await (await fetch("http://localhost:3000/api/registry", {
      headers: { "Cookie": adminCookie }
    })).json();
    project = (adminRegistry.projects || []).find(p => p.id === project.id);
    console.log(`Admin project status: ${project.status}`);

    if (project.status === "SUBMITTED") {
      console.log("Admin starting review...");
      const startRes = await fetch(`http://localhost:3000/api/projects/${project.id}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cookie": adminCookie
        },
        body: JSON.stringify({ action: "START" }),
      });
      console.log("START Status:", startRes.status, await startRes.text());

      // Reload project status
      const reloadRegistry = await (await fetch("http://localhost:3000/api/registry", {
        headers: { "Cookie": adminCookie }
      })).json();
      project = (reloadRegistry.projects || []).find(p => p.id === project.id);
      console.log(`Project status after START: ${project.status}`);
    }

    if (project.status === "UNDER_REVIEW") {
      console.log("Admin approving project...");
      const approveRes = await fetch(`http://localhost:3000/api/projects/${project.id}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cookie": adminCookie
        },
        body: JSON.stringify({ action: "APPROVE", note: "Approved by Admin!" }),
      });
      console.log("APPROVE Status:", approveRes.status, await approveRes.text());
    }

  } catch (error) {
    console.error("Test lifecycle failed:", error);
  }
}

run();
