import { prisma } from "../lib/prisma-client.js";
import { ProjectService } from "../lib/services/project-service.js";

async function test() {
  try {
    const user = await prisma.user.findFirst({
      where: { role: "NGO" }
    });
    if (!user) {
      console.log("No NGO user found.");
      return;
    }
    console.log("Using user:", user.email, "role:", user.role);

    console.log("Testing ProjectService.createDraft...");
    const project = await ProjectService.createDraft(user.id, user.role, {
      name: "Test Project Creation",
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
    });
    console.log("createDraft SUCCESS! Project ID:", project.id);

  } catch (error) {
    console.error("Test failed with error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

test();
