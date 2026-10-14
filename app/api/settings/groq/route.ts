import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/server";
import {
  clearGroqApiKey,
  getGroqKeyStatus,
  saveGroqApiKey,
  verifyGroqApiKey,
} from "@/lib/user-groq";

const schema = z.object({
  apiKey: z.string().trim().min(20).max(512),
});

async function userId() {
  const { data: session } = await auth.getSession();
  return session?.user?.id || null;
}

export async function GET() {
  const id = await userId();
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return NextResponse.json(await getGroqKeyStatus(id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const id = await userId();
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a valid Groq API key." }, { status: 400 });
    }

    await verifyGroqApiKey(parsed.data.apiKey);
    return NextResponse.json(await saveGroqApiKey(id, parsed.data.apiKey));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not verify Groq API key.";
    const status = message.toLowerCase().includes("invalid") || message.toLowerCase().includes("access") ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE() {
  const id = await userId();
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return NextResponse.json(await clearGroqApiKey(id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
