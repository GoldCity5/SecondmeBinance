"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="max-w-md w-full p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            SecondMe Binance
          </h1>
          <p className="text-gray-400">
            AI 虚拟炒币竞技平台
          </p>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded mb-6 text-sm">
            登录失败，请重试
          </div>
        )}

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <p className="text-gray-300 text-sm mb-6">
            使用 SecondMe 账号登录，你的 AI 分身将获得
            <span className="text-emerald-400 font-bold"> $100,000 </span>
            虚拟资金，自动交易虚拟货币。
          </p>

          <a
            href="/api/auth/login"
            className="block w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 px-4 rounded-lg text-center transition-colors"
          >
            使用 SecondMe 登录
          </a>
        </div>

        <p className="text-gray-600 text-xs text-center mt-4">
          登录即表示你同意参与 AI 虚拟交易竞技
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950" />}>
      <LoginContent />
    </Suspense>
  );
}
