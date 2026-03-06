import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const filename = request.headers.get("x-filename");
  if (!filename) {
    return NextResponse.json(
      { error: "Missing x-filename header" },
      { status: 400 }
    );
  }

  if (!request.body) {
    return NextResponse.json(
      { error: "Missing request body" },
      { status: 400 }
    );
  }

  const blob = await put(filename, request.body, {
    access: "public",
    addRandomSuffix: true,
  });

  return NextResponse.json({ url: blob.url });
}
