import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getScheduleSettings, updateScheduleSettings } from "@/lib/db";
import { isValidTimezone } from "@/lib/schedule";

const schema = z.object({
  enabled: z.boolean(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  timezone: z.string().min(1).max(80),
  language: z.enum(["java", "python3", "cpp", "javascript"]),
});

export async function GET() {
  try {
    return NextResponse.json(await getScheduleSettings());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const configuredKey = process.env.APP_ACCESS_KEY;
  if (configuredKey && request.headers.get("x-leetsolve-key") !== configuredKey) {
    return NextResponse.json({ error: "Invalid app access key." }, { status: 401 });
  }

  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid schedule settings." }, { status: 400 });
    if (!isValidTimezone(parsed.data.timezone)) {
      return NextResponse.json({ error: "Invalid timezone." }, { status: 400 });
    }

    return NextResponse.json(await updateScheduleSettings(parsed.data));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
