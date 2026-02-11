import Link from "next/link";
import { getSession } from "@/lib/auth";
import UserNav from "./UserNav";

export default async function Header() {
  const session = await getSession();

  return (
    <header className="bg-gray-900/80 backdrop-blur border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold text-white">
          SecondMe Binance
        </Link>

        <nav className="flex items-center gap-6 text-sm">
          <Link href="/" className="text-gray-300 hover:text-white transition-colors">
            排行榜
          </Link>
          <Link href="/market" className="text-gray-300 hover:text-white transition-colors">
            行情
          </Link>
          <Link href="/square" className="text-gray-300 hover:text-white transition-colors">
            广场
          </Link>
          {session ? (
            <UserNav name={session.name} />
          ) : (
            <Link
              href="/login"
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg transition-colors"
            >
              登录
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
