import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma-client";
import { z } from "zod";

export const dynamic = "force-dynamic";

const profileSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters").trim().optional(),
  organization: z.string().trim().optional(),
  contactPhone: z.string().trim().optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id");
    
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const result = profileSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const updateData: Record<string, any> = {};
    if (result.data.fullName !== undefined) updateData.fullName = result.data.fullName;
    if (result.data.organization !== undefined) updateData.organization = result.data.organization;
    if (result.data.contactPhone !== undefined) updateData.contactPhone = result.data.contactPhone;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update." },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        organization: true,
        contactPhone: true,
      },
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    console.error("PATCH Profile Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
