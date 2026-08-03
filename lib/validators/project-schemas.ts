import { z } from "zod";

export const projectCreateSchema = z.object({
  name: z.string().min(3, "Project name must be at least 3 characters long"),
  ecosystem: z.enum(["mangrove", "seagrass", "salt_marsh"]),
  state: z.string().min(2, "State is required"),
  district: z.string().min(2, "District is required"),
  village: z.string().min(2, "Village is required"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be YYYY-MM-DD"),
  durationYears: z.number().min(1, "Duration must be at least 1 year").max(100, "Duration cannot exceed 100 years"),
  responsibleOrganization: z.string().min(2, "Responsible organization is required"),
  communityPartner: z.string().min(2, "Community partner is required"),
  boundaryGeojson: z.string().refine((val) => {
    try {
      JSON.parse(val);
      return true;
    } catch {
      return false;
    }
  }, "Invalid boundary GeoJSON"),
  areaHectares: z.number().positive("Area must be a positive number"),
});

export const projectUpdateSchema = projectCreateSchema.partial();
