import { NextRequest, NextResponse } from "next/server";
import { generateSocialPosts } from "@/lib/social";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const totalPosts = await generateSocialPosts();
    return NextResponse.json({
      code: 0,
      data: { totalPosts },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Social cron error:", err);
    return NextResponse.json({ code: 500, message: "社交动态生成失败" }, { status: 500 });
  }
}
