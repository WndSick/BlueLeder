import { prisma } from "@/lib/prisma-client";
import { ProjectStatus, Role, DocumentType } from "@prisma/client";
import {
  isProjectOwner,
  isProjectEditable,
  canRegisterProject,
  isAdmin,
  isValidStatusTransition,
} from "@/lib/business-rules/project-rules";

export class ProjectService {
  /**
   * Creates a new DRAFT project.
   */
  static async createDraft(
    ownerId: string,
    role: Role,
    data: {
      name: string;
      ecosystem: string;
      state: string;
      district: string;
      village: string;
      startDate: string;
      durationYears: number;
      responsibleOrganization: string;
      communityPartner: string;
      boundaryGeojson: string;
      areaHectares: number;
    }
  ) {
    if (!canRegisterProject(role)) {
      throw new Error("Only NGOs and Communities can register projects.");
    }

    const project = await prisma.project.create({
      data: {
        ownerId,
        name: data.name,
        ecosystem: data.ecosystem,
        state: data.state,
        district: data.district,
        village: data.village,
        startDate: data.startDate,
        durationYears: data.durationYears,
        responsibleOrganization: data.responsibleOrganization,
        communityPartner: data.communityPartner,
        boundaryGeojson: data.boundaryGeojson,
        areaHectares: data.areaHectares,
        status: ProjectStatus.DRAFT,
      },
    });

    // Create initial timeline entry
    await prisma.projectTimeline.create({
      data: {
        projectId: project.id,
        status: ProjectStatus.DRAFT,
        userId: ownerId,
        note: "Project draft created.",
      },
    });

    return project;
  }

  /**
   * Updates an existing DRAFT or CHANGES_REQUESTED project.
   */
  static async updateDraft(
    projectId: string,
    ownerId: string,
    data: {
      name?: string;
      ecosystem?: string;
      state?: string;
      district?: string;
      village?: string;
      startDate?: string;
      durationYears?: number;
      responsibleOrganization?: string;
      communityPartner?: string;
      boundaryGeojson?: string;
      areaHectares?: number;
    }
  ) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new Error("Project not found.");
    }

    if (!isProjectOwner(project, ownerId)) {
      throw new Error("Only the project owner can update this project.");
    }

    if (!isProjectEditable(project)) {
      throw new Error("Only drafts or projects requesting changes can be updated.");
    }

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        name: data.name,
        ecosystem: data.ecosystem,
        state: data.state,
        district: data.district,
        village: data.village,
        startDate: data.startDate,
        durationYears: data.durationYears,
        responsibleOrganization: data.responsibleOrganization,
        communityPartner: data.communityPartner,
        boundaryGeojson: data.boundaryGeojson,
        areaHectares: data.areaHectares,
      },
    });

    return updatedProject;
  }

  /**
   * Links an uploaded document record to the project.
   */
  static async addDocument(
    projectId: string,
    ownerId: string,
    document: {
      category: DocumentType;
      fileName: string;
      objectKey: string;
      contentType: string;
      sizeBytes: number;
    }
  ) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new Error("Project not found.");
    }

    if (!isProjectOwner(project, ownerId)) {
      throw new Error("Only the project owner can add documents.");
    }

    if (!isProjectEditable(project)) {
      throw new Error("Cannot add documents to a non-editable project.");
    }

    // Delete existing document of the same category if it exists
    await prisma.document.deleteMany({
      where: {
        projectId,
        category: document.category,
      },
    });

    const doc = await prisma.document.create({
      data: {
        projectId,
        category: document.category,
        fileName: document.fileName,
        objectKey: document.objectKey,
        contentType: document.contentType,
        sizeBytes: document.sizeBytes,
      },
    });

    return doc;
  }

  /**
   * Promotes a project to SUBMITTED state.
   */
  static async submitProject(projectId: string, ownerId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { documents: true },
    });

    if (!project) {
      throw new Error("Project not found.");
    }

    if (!isProjectOwner(project, ownerId)) {
      throw new Error("Only the project owner can submit this project.");
    }

    if (!isProjectEditable(project)) {
      throw new Error("Project is not in a submittable state.");
    }

    if (!isValidStatusTransition(project.status, ProjectStatus.SUBMITTED)) {
      throw new Error(`Invalid status transition from ${project.status} to SUBMITTED.`);
    }

    // Verify that at least one supporting document is uploaded
    if (project.documents.length === 0) {
      throw new Error("At least one supporting document must be uploaded before submission.");
    }

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        status: ProjectStatus.SUBMITTED,
      },
    });

    await prisma.projectTimeline.create({
      data: {
        projectId,
        status: ProjectStatus.SUBMITTED,
        userId: ownerId,
        note: "Project submitted for review.",
      },
    });

    return updatedProject;
  }

  /**
   * Puts a project into UNDER_REVIEW state.
   */
  static async startReview(projectId: string, adminId: string, adminRole: Role) {
    if (!isAdmin(adminRole)) {
      throw new Error("Only administrators can review projects.");
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new Error("Project not found.");
    }

    if (!isValidStatusTransition(project.status, ProjectStatus.UNDER_REVIEW)) {
      throw new Error(`Invalid status transition from ${project.status} to UNDER_REVIEW.`);
    }

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        status: ProjectStatus.UNDER_REVIEW,
      },
    });

    await prisma.projectTimeline.create({
      data: {
        projectId,
        status: ProjectStatus.UNDER_REVIEW,
        userId: adminId,
        note: "Admin started reviewing documents.",
      },
    });

    return updatedProject;
  }

  /**
   * Approves a project.
   */
  static async approveProject(projectId: string, adminId: string, adminRole: Role, note: string) {
    if (!isAdmin(adminRole)) {
      throw new Error("Only administrators can approve projects.");
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new Error("Project not found.");
    }

    if (!isValidStatusTransition(project.status, ProjectStatus.APPROVED)) {
      throw new Error(`Invalid status transition from ${project.status} to APPROVED.`);
    }

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        status: ProjectStatus.APPROVED,
        reviewerNote: note,
        reviewedAt: new Date(),
        reviewedById: adminId,
      },
    });

    await prisma.projectTimeline.create({
      data: {
        projectId,
        status: ProjectStatus.APPROVED,
        userId: adminId,
        note: note || "Project approved for MRV entry.",
      },
    });

    // Establish satellite baseline and configure monitoring config
    try {
      const { MonitoringService } = await import("@/lib/services/mrv/monitoring-service");
      const mrvService = new MonitoringService();
      await mrvService.establishBaseline(projectId);
      await mrvService.initConfig(projectId);
    } catch (baselineErr) {
      console.error("Failed to establish satellite baseline during approval:", baselineErr);
    }

    return updatedProject;
  }

  /**
   * Rejects a project.
   */
  static async rejectProject(projectId: string, adminId: string, adminRole: Role, note: string) {
    if (!isAdmin(adminRole)) {
      throw new Error("Only administrators can reject projects.");
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new Error("Project not found.");
    }

    if (!isValidStatusTransition(project.status, ProjectStatus.REJECTED)) {
      throw new Error(`Invalid status transition from ${project.status} to REJECTED.`);
    }

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        status: ProjectStatus.REJECTED,
        reviewerNote: note,
        reviewedAt: new Date(),
        reviewedById: adminId,
      },
    });

    await prisma.projectTimeline.create({
      data: {
        projectId,
        status: ProjectStatus.REJECTED,
        userId: adminId,
        note: note || "Project rejected.",
      },
    });

    return updatedProject;
  }

  /**
   * Requests revisions on a project.
   */
  static async requestChanges(projectId: string, adminId: string, adminRole: Role, note: string) {
    if (!isAdmin(adminRole)) {
      throw new Error("Only administrators can request changes.");
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new Error("Project not found.");
    }

    if (!isValidStatusTransition(project.status, ProjectStatus.CHANGES_REQUESTED)) {
      throw new Error(`Invalid status transition from ${project.status} to CHANGES_REQUESTED.`);
    }

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        status: ProjectStatus.CHANGES_REQUESTED,
        reviewerNote: note,
        reviewedAt: new Date(),
        reviewedById: adminId,
      },
    });

    await prisma.projectTimeline.create({
      data: {
        projectId,
        status: ProjectStatus.CHANGES_REQUESTED,
        userId: adminId,
        note: note || "Changes requested.",
      },
    });

    return updatedProject;
  }

  /**
   * Fetches a project with its full details.
   */
  static async getProject(projectId: string) {
    return await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        documents: true,
        timeline: {
          include: {
            user: {
              select: {
                fullName: true,
                role: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });
  }

  /**
   * Lists projects based on permission rules.
   */
  static async listProjects(userId: string, role: Role) {
    if (role === Role.ADMIN) {
      return await prisma.project.findMany({
        include: { documents: true },
        orderBy: { submittedAt: "desc" },
      });
    }

    return await prisma.project.findMany({
      where: { ownerId: userId },
      include: { documents: true },
      orderBy: { submittedAt: "desc" },
    });
  }
}
