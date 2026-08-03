import { Project, ProjectStatus, Role } from "@prisma/client";

/**
 * Checks if the user is the owner of the project.
 */
export function isProjectOwner(project: Project, userId: string): boolean {
  return project.ownerId === userId;
}

/**
 * Asserts if a project is in an editable state (DRAFT or CHANGES_REQUESTED).
 */
export function isProjectEditable(project: Project): boolean {
  return project.status === ProjectStatus.DRAFT || project.status === ProjectStatus.CHANGES_REQUESTED;
}

/**
 * Asserts if the user role can register or manage drafts.
 * Only NGO and COMMUNITY roles are allowed to create/register projects.
 */
export function canRegisterProject(role: Role): boolean {
  return role === Role.NGO || role === Role.COMMUNITY;
}

/**
 * Asserts if the user role is an administrator allowed to perform reviews.
 */
export function isAdmin(role: Role): boolean {
  return role === Role.ADMIN;
}

/**
 * Validates if a transition from the current project status to a new target status is allowed.
 */
export function isValidStatusTransition(current: ProjectStatus, target: ProjectStatus): boolean {
  switch (current) {
    case ProjectStatus.DRAFT:
      return target === ProjectStatus.SUBMITTED;
    case ProjectStatus.SUBMITTED:
      return target === ProjectStatus.UNDER_REVIEW;
    case ProjectStatus.UNDER_REVIEW:
      return (
        target === ProjectStatus.APPROVED ||
        target === ProjectStatus.REJECTED ||
        target === ProjectStatus.CHANGES_REQUESTED
      );
    case ProjectStatus.CHANGES_REQUESTED:
      return target === ProjectStatus.SUBMITTED;
    case ProjectStatus.APPROVED:
    case ProjectStatus.REJECTED:
    default:
      return false; // Terminal states
  }
}
