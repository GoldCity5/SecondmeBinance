import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PostItem } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cursor = request.nextUrl.searchParams.get("cursor");
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") || "20"), 50);
  const type = request.nextUrl.searchParams.get("type"); // 筛选 postType

  try {
    const where: Record<string, unknown> = {};
    if (type && type !== "all") {
      where.postType = type;
    }
    if (cursor) {
      where.createdAt = { lt: new Date(cursor) };
    }

    const posts = await prisma.post.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      include: {
        user: { select: { id: true, name: true, avatar: true, tradingStyle: true } },
        mentionedUser: { select: { id: true, name: true } },
      },
    });

    const hasMore = posts.length > limit;
    const sliced = hasMore ? posts.slice(0, limit) : posts;

    const items: PostItem[] = sliced.map((p) => ({
      id: p.id,
      userId: p.user.id,
      userName: p.user.name,
      userAvatar: p.user.avatar,
      tradingStyle: p.user.tradingStyle,
      content: p.content,
      postType: p.postType,
      mentionedUserName: p.mentionedUser?.name || null,
      mentionedUserId: p.mentionedUser?.id || null,
      createdAt: p.createdAt.toISOString(),
    }));

    const nextCursor = hasMore
      ? sliced[sliced.length - 1].createdAt.toISOString()
      : null;

    return NextResponse.json({
      code: 0,
      data: { posts: items, nextCursor },
    });
  } catch (err) {
    console.error("Square API error:", err);
    return NextResponse.json({ code: 500, message: "获取动态失败" }, { status: 500 });
  }
}
