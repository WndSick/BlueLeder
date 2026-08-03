import { signToken } from "../lib/auth/token.js";
import { prisma } from "../lib/prisma-client.js";

// Manually set JWT_SECRET to match .env
process.env.JWT_SECRET = "sih-blueledger-development-token-secret-2026-restored";

async function run() {
  try {
    const user = await prisma.user.findFirst({ where: { role: "NGO" } });
    if (!user) {
      console.error("No NGO user found");
      return;
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    console.log("Using token for user:", user.email);

    const payload = {
      name: "Sundarban Mangrove Test Project",
      ecosystem: "mangrove",
      state: "West Bengal",
      district: "South 24 Parganas",
      village: "Gosaba",
      startDate: "2026-07-31",
      durationYears: 10,
      responsibleOrganization: "Test Org",
      communityPartner: "Test Partner",
      boundaryGeojson: JSON.stringify({
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [[[88.5, 22.1], [88.6, 22.1], [88.6, 22.2], [88.5, 22.2], [88.5, 22.1]]]
        }
      }),
      areaHectares: 15.0
    };

    console.log("Sending POST /api/projects...");
    const res = await fetch("http://localhost:3000/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "Cookie": `token=${token}`
      },
      body: JSON.stringify(payload),
    });

    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response:", text);

  } catch (error) {
    console.error("Fetch failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
