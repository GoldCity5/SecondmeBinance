import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken, getUserInfo } from "@/lib/secondme";
import { createSession, setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { executeTradeForUser } from "@/lib/trading";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/login?error=auth_failed`);
  }

  try {
    const token = await exchangeCodeForToken(code);
    const userInfo = await getUserInfo(token.accessToken);

    // 判断是否为新用户
    const existing = await prisma.user.findUnique({
      where: { secondmeUserId: userInfo.userId },
    });
    const isNewUser = !existing;

    const user = await prisma.user.upsert({
      where: { secondmeUserId: userInfo.userId },
      update: {
        name: userInfo.name,
        email: userInfo.email,
        avatar: userInfo.avatar,
        bio: userInfo.bio,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        tokenExpiresAt: new Date(Date.now() + token.expiresIn * 1000),
      },
      create: {
        secondmeUserId: userInfo.userId,
        name: userInfo.name,
        email: userInfo.email,
        avatar: userInfo.avatar,
        bio: userInfo.bio,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        tokenExpiresAt: new Date(Date.now() + token.expiresIn * 1000),
        portfolio: {
          create: {
            cashBalance: Number(process.env.INITIAL_FUND) || 100000,
          },
        },
      },
    });

    const jwt = await createSession({
      userId: user.id,
      name: user.name,
      avatar: user.avatar,
    });
    await setSessionCookie(jwt);

    // 新用户注册后异步触发首次交易（不阻塞登录跳转）
    if (isNewUser) {
      console.log(`[注册] 新用户 ${user.name}，触发首次交易...`);
      executeTradeForUser(user.id)
        .then((r) => console.log(`[注册] ${user.name} 首次交易完成:`, JSON.stringify(r)))
        .catch((e) => console.error(`[注册] ${user.name} 首次交易失败:`, e));
    }

    return NextResponse.redirect(`${appUrl}/dashboard`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("OAuth callback error:", msg);
    return NextResponse.redirect(`${appUrl}/login?error=${encodeURIComponent(msg)}`);
  }
}
