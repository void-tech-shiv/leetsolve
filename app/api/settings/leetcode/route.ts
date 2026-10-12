import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { clearLeetCodeCredentials, getUserSettings, saveLeetCodeCredentials } from "@/lib/db";
import { verifyLeetCodeCredentials } from "@/lib/leetcode";

const credentialsSchema = z.object({
  session: z.string().trim().min(20).max(8192),
  csrfToken: z.string().trim().min(16).max(1024),
});

async function sessionUserId() {
  const { data: session } = await auth.getSession();
  return session?.user?.id || null;
}

export async function GET() {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const settings = await getUserSettings(userId);
    return NextResponse.json({
      connected: settings.leetcodeConnected,
      username: settings.leetcodeUsername,
      verifiedAt: settings.leetcodeVerifiedAt,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const parsed = credentialsSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a valid LEETCODE_SESSION and csrftoken." }, { status: 400 });
    }

    const credentials = {
      session: parsed.data.session,
      csrfToken: parsed.data.csrfToken,
    };

    const verified = await verifyLeetCodeCredentials(credentials);
    const settings = await saveLeetCodeCredentials(userId, credentials, verified.username);

    return NextResponse.json({
      connected: true,
      username: settings.leetcodeUsername,
      verifiedAt: settings.leetcodeVerifiedAt,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not connect LeetCode." }, { status: 400 });
  }
}

export async function DELETE() {
  const userId = await sessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const settings = await clearLeetCodeCredentials(userId);
    return NextResponse.json({ connected: settings.leetcodeConnected });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not disconnect LeetCode." }, { status: 500 });
  }
}
