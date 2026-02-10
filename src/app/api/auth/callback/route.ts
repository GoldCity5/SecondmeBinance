import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken, getUserInfo } from "@/lib/secondme";
import { createSession, setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

    const user = await prisma.user.upsert({
      where: { secondmeUserId: userInfo.userId },
      update: {
        name: userInfo.name,
        email: userInfo.email,
        avatar: userInfo.avatar,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        tokenExpiresAt: new Date(Date.now() + token.expiresIn * 1000),
      },
      create: {
        secondmeUserId: userInfo.userId,
        name: userInfo.name,
        email: userInfo.email,
        avatar: userInfo.avatar,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        tokenExpiresAt: new Date(Date.now() + token.expiresIn * 1000),
        portfolio: {
          create: {
            cashBalance: parseFloat(process.env.INITIAL_FUND || "100000"),
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

    return NextResponse.redirect(`${appUrl}/dashboard`);
  } catch (err) {
    console.error("OAuth callback error:", err);
    return NextResponse.redirect(`${appUrl}/login?error=auth_failed`);
  }
}
