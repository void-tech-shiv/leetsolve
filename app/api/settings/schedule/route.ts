import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getUserSettings, updateUserSettings } from "@/lib/db";
import { isValidTimezone } from "@/lib/schedule";

const schema = z.object({
  enabled: z.boolean(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  timezone: z.string().min(1).max(80),
  language: z.enum(["java", "python3", "cpp", "javascript"]),
  leetcodeUsername: z.string().trim().max(80).optional(),
});

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return NextResponse.json(await getUserSettings(userId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid profile or schedule settings." }, { status: 400 });
    if (!isValidTimezone(parsed.data.timezone)) {
      return NextResponse.json({ error: "Invalid timezone." }, { status: 400 });
    }

    return NextResponse.json(await updateUserSettings(userId, parsed.data));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
