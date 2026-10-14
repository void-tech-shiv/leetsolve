import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import { activateSubscription, getSubscriptionStatus } from "@/lib/subscription";

const schema = z.object({
  activationCode: z.string().trim().min(10).max(120),
});

async function userId() {
  const { data: session } = await auth.getSession();
  return session?.user?.id || null;
}

export async function GET() {
  const id = await userId();
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return NextResponse.json(await getSubscriptionStatus(id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const id = await userId();
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Enter a valid activation code." }, { status: 400 });

    const subscription = await activateSubscription(id, parsed.data.activationCode);
    return NextResponse.json({ ok: true, subscription });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Activation failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
