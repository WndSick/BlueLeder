import { PrismaClient, Role, ProjectStatus, DocumentType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding started...");

  // 1. Clean existing database records
  await prisma.benefitRecord.deleteMany();
  await prisma.ledgerEvent.deleteMany();
  await prisma.creditBatch.deleteMany();
  await prisma.evidenceReview.deleteMany();
  await prisma.evidenceFile.deleteMany();
  await prisma.evidenceItem.deleteMany();
  await prisma.document.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  console.log("Database cleaned.");

  // 2. Hash passwords
  const passwordHash = await bcrypt.hash("demo123", 10);

  // 3. Create Users
  const demoUser = await prisma.user.create({
    data: {
      email: "demo@blueregistry.local",
      fullName: "SIH Demo Workspace",
      role: Role.NGO,
      passwordHash,
      organization: "Sundarban Delta Development Collective",
      registrationNumber: "NGO-100234-WB",
      organizationType: "NGO",
      website: "https://sundarban-collective.org",
      contactPhone: "+91 98300 12345",
      verificationStatus: "verified",
    },
  });

  const pendingNgo = await prisma.user.create({
    data: {
      email: "pending-ngo@blueregistry.local",
      fullName: "Rahim Coastal Trust",
      role: Role.NGO,
      passwordHash,
      organization: "Rahim Coastal Trust",
      registrationNumber: "NGO-998822-WB",
      organizationType: "NGO",
      website: "https://rahimcoastal.org",
      contactPhone: "+91 98301 98765",
      verificationStatus: "unverified",
    },
  });

  const verifier = await prisma.user.create({
    data: {
      email: "verifier@blueregistry.local",
      fullName: "SGS India Verifier",
      role: Role.VERIFIER,
      passwordHash,
      organization: "SGS Environmental Audits",
      registrationNumber: "V-887766",
      organizationType: "Auditor",
      website: "https://sgs.com",
      contactPhone: "+91 22 6640 1234",
      verificationStatus: "verified",
    },
  });

  const admin = await prisma.user.create({
    data: {
      email: "admin@blueregistry.local",
      fullName: "Ministry Administrator",
      role: Role.ADMIN,
      passwordHash,
      organization: "National Coastal Zone Management Authority",
      registrationNumber: "GOV-ADMIN-01",
      organizationType: "Government Authority",
      website: "https://nczma.gov.in",
      contactPhone: "+91 11 2436 0000",
      verificationStatus: "verified",
    },
  });

  const buyer = await prisma.user.create({
    data: {
      email: "buyer@blueregistry.local",
      fullName: "GreenTech Carbon Funds",
      role: Role.BUYER,
      passwordHash,
      organization: "GreenTech ESG Venture Fund",
      registrationNumber: "CORP-445566-DE",
      organizationType: "Corporate Buyer",
      website: "https://greentech-esg.com",
      contactPhone: "+1 650 555 0199",
      verificationStatus: "verified",
    },
  });

  console.log("Users seeded.");

  // 4. Create Projects
  const project1 = await prisma.project.create({
    data: {
      id: "demo-sundarbans-001",
      ownerId: demoUser.id,
      name: "Sundarban Mangrove Recovery Corridor",
      ecosystem: "mangrove",
      state: "West Bengal",
      district: "South 24 Parganas",
      village: "Gosaba Block (14 Villages)",
      startDate: "2024-03-01",
      durationYears: 20,
      responsibleOrganization: "Sundarban Delta Development Collective",
      communityPartner: "Gosaba Mangrove Conservation Committee",
      boundaryGeojson: JSON.stringify({
        type: "Feature",
        properties: { name: "Sundarban Mangrove Recovery Area 1" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [88.7524, 22.1234],
              [88.7845, 22.1234],
              [88.7845, 22.1485],
              [88.7524, 22.1485],
              [88.7524, 22.1234]
            ]
          ]
        }
      }),
      areaHectares: 846.5,
      status: ProjectStatus.APPROVED,
      reviewerNote: "Documents verified and site verified by verifier audit on March 15, 2024.",
    },
  });

  const project2 = await prisma.project.create({
    data: {
      id: "demo-overlap-alert-002",
      ownerId: pendingNgo.id,
      name: "Matla Creek Mangrove Proposal",
      ecosystem: "mangrove",
      state: "West Bengal",
      district: "South 24 Parganas",
      village: "Basanti Block",
      startDate: "2025-06-01",
      durationYears: 15,
      responsibleOrganization: "Rahim Coastal Trust",
      communityPartner: "Basanti Fisherman Cooperative",
      boundaryGeojson: JSON.stringify({
        type: "Feature",
        properties: { name: "Overlapping Matla Creek Area" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [88.7612, 22.1312],
              [88.7954, 22.1312],
              [88.7954, 22.1524],
              [88.7612, 22.1524],
              [88.7612, 22.1312]
            ]
          ]
        }
      }),
      areaHectares: 685.2,
      status: ProjectStatus.UNDER_REVIEW,
      reviewerNote: "GIS Overlap Alert: Shares 38% boundary overlap with Sundarban Mangrove Recovery Corridor (demo-sundarbans-001).",
    },
  });

  console.log("Projects seeded.");

  // 5. Create Documents
  await prisma.document.create({
    data: {
      projectId: project1.id,
      category: DocumentType.LAND_AUTHORIZATION,
      fileName: "West_Bengal_Forest_Dept_Authorization_gosaba.pdf",
      objectKey: "demo-sundarbans-001/land_authorization/forest_dept.pdf",
      contentType: "application/pdf",
      sizeBytes: 1048576,
    },
  });

  await prisma.document.create({
    data: {
      projectId: project1.id,
      category: DocumentType.RESTORATION_PLAN,
      fileName: "Gosaba_Restoration_Plan_v3.pdf",
      objectKey: "demo-sundarbans-001/restoration_plan/restoration_plan.pdf",
      contentType: "application/pdf",
      sizeBytes: 2548220,
    },
  });

  await prisma.document.create({
    data: {
      projectId: project1.id,
      category: DocumentType.BASELINE_EVIDENCE,
      fileName: "Sundarbans_Baseline_Landcover_2023.pdf",
      objectKey: "demo-sundarbans-001/baseline_evidence/baseline_evidence.pdf",
      contentType: "application/pdf",
      sizeBytes: 4120300,
    },
  });

  console.log("Documents seeded.");

  // 6. Create Evidence Items
  const evidence1 = await prisma.evidenceItem.create({
    data: {
      id: "demo-field-2026q2",
      projectId: project1.id,
      sourceType: "field_photo",
      monitoringStage: "quarterly",
      periodLabel: "2026 Q2",
      observedAt: new Date("2026-06-15T10:30:00Z"),
      uploaderEmail: demoUser.email,
      dataJson: JSON.stringify({
        latitude: 22.1354,
        longitude: 88.7612,
        species: "Rhizophora mucronata, Avicennia marina",
        saplings: 15400,
        survivalPercent: 92,
        notes: "Healthy growth seen. Drone flyover confirms high leaf canopy index.",
      }),
    },
  });

  const evidence2 = await prisma.evidenceItem.create({
    data: {
      id: "demo-sensor-2026q2",
      projectId: project1.id,
      sourceType: "sensor",
      monitoringStage: "quarterly",
      periodLabel: "2026 Q2",
      observedAt: new Date("2026-06-16T11:00:00Z"),
      uploaderEmail: demoUser.email,
      dataJson: JSON.stringify({
        sensorId: "SEN-GOSABA-04",
        salinity: 18.5,
        waterLevel: 0.42,
        soilMoisture: 68.2,
        temperature: 29.4,
      }),
    },
  });

  const evidence3 = await prisma.evidenceItem.create({
    data: {
      id: "demo-satellite-2026q2",
      projectId: project1.id,
      sourceType: "satellite",
      monitoringStage: "quarterly",
      periodLabel: "2026 Q2",
      observedAt: new Date("2026-06-14T05:22:00Z"),
      uploaderEmail: verifier.email,
      dataJson: JSON.stringify({
        sceneId: "S2B_MSIL2A_20260614T052200",
        platform: "Sentinel-2B",
        cloudCover: 4.8,
        ndviValue: 0.612,
        imageDate: "2026-06-14T05:22:00Z",
        notes: "Automated composite generation. High biomass reflectance index.",
      }),
    },
  });

  console.log("Evidence items seeded.");

  // 7. Create Evidence Files
  await prisma.evidenceFile.create({
    data: {
      id: "file-field-photo-gosaba",
      evidenceId: evidence1.id,
      projectId: project1.id,
      fileRole: "field_photo",
      fileName: "gosaba_planting_quadrat_C.jpg",
      objectKey: "mrv/demo-sundarbans-001/demo-field-2026q2/quadrat_c.jpg",
      contentType: "image/jpeg",
      sizeBytes: 1548200,
      sha256: "0af1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1",
    },
  });

  console.log("Evidence files seeded.");

  // 8. Create Evidence Reviews
  await prisma.evidenceReview.create({
    data: {
      evidenceId: evidence1.id,
      projectId: project1.id,
      reviewerEmail: verifier.email,
      decision: "approved",
      comment: "Field geotag verified inside drawn boundary. Density matches plan.",
    },
  });

  await prisma.evidenceReview.create({
    data: {
      evidenceId: evidence2.id,
      projectId: project1.id,
      reviewerEmail: verifier.email,
      decision: "approved",
      comment: "Sensor salinity and soil readings align with typical estuarine trends.",
    },
  });

  await prisma.evidenceReview.create({
    data: {
      evidenceId: evidence3.id,
      projectId: project1.id,
      reviewerEmail: verifier.email,
      decision: "approved",
      comment: "Sentinel NDVI composite approved. Cloud filtering verified.",
    },
  });

  console.log("Evidence reviews seeded.");

  // 9. Create Credit Batches
  const batch1 = await prisma.creditBatch.create({
    data: {
      id: "demo-batch-issued-2026",
      projectId: project1.id,
      periodKey: "2026_Q1_Q2",
      vintageYear: 2026,
      reportHash: "0xab12cd34ef567890abcdef1234567890abcdef1234567890abcdef1234567890",
      issuedQuantity: 3450,
      currentHolder: buyer.email,
      status: "issued",
      createdBy: demoUser.id,
    },
  });

  const batch2 = await prisma.creditBatch.create({
    data: {
      id: "demo-batch-retired-2025",
      projectId: project1.id,
      periodKey: "2025_ANNUAL",
      vintageYear: 2025,
      reportHash: "0xde567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12",
      issuedQuantity: 6200,
      currentHolder: "Wipro ESG Carbon Neutrality Pool",
      status: "retired",
      createdBy: demoUser.id,
    },
  });

  console.log("Credit batches seeded.");

  // 10. Create Ledger Events
  await prisma.ledgerEvent.create({
    data: {
      projectId: project1.id,
      batchId: batch1.id,
      eventType: "credit_issuance",
      entityId: batch1.id,
      periodKey: batch1.periodKey,
      payloadHash: "0x55aa66bb77cc88dd99ee00ff11223344556677889900aabbccddeeff11223344",
      eventHash: "0x9900aabbccddeeff11223344556677889900aabbccddeeff1122334455667788",
      network: "polygon-amoy",
      chainId: 80002,
      transactionId: "0x8844884488448844884488448844884488448844884488448844884488448844",
      actorEmail: verifier.email,
      metadataJson: JSON.stringify({
        quantity: 3450,
        holder: buyer.email,
        smartContractFunction: "issueCredits",
      }),
    },
  });

  await prisma.ledgerEvent.create({
    data: {
      projectId: project1.id,
      batchId: batch2.id,
      eventType: "credit_retirement",
      entityId: batch2.id,
      periodKey: batch2.periodKey,
      payloadHash: "0xff11223344556677889900aabbccddeeff11223344556677889900aabbccdde",
      eventHash: "0xeeff11223344556677889900aabbccddeeff11223344556677889900aabbccdd",
      network: "polygon-amoy",
      chainId: 80002,
      transactionId: "0x7733773377337733773377337733773377337733773377337733773377337733",
      actorEmail: buyer.email,
      metadataJson: JSON.stringify({
        holder: "Wipro ESG Carbon Neutrality Pool",
        quantity: 6200,
        retirementPurpose: "Offsetting scope-3 corporate emissions for FY25 logistics footprint.",
        smartContractFunction: "retireCredits",
      }),
    },
  });

  console.log("Ledger events seeded.");

  // 11. Create Benefit Records
  await prisma.benefitRecord.create({
    data: {
      projectId: project1.id,
      recordType: "direct_payment",
      amount: 150000,
      currency: "INR",
      beneficiary: "Gosaba Cooperative Salt Marsh Fund",
      description: "Direct community benefit sharing payout from 2025 Q1-Q2 credit pre-purchase.",
      proofHash: "0x445566778899aabbccddeeff00112233445566778899aabbccddeeff00112233",
    },
  });

  console.log("Benefit records seeded.");

  console.log("Seeding completed successfully.");
}

main()
  .catch((e) => {
    console.error("Seeding Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
