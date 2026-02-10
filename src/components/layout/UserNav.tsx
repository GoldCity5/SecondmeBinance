"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  name: string;
}

export default function UserNav({ name }: Props) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <Link href="/dashboard" className="text-gray-300 hover:text-white transition-colors">
        {name}
      </Link>
      <button
        onClick={handleLogout}
        disabled={loggingOut}
        className="text-xs text-gray-500 hover:text-red-400 transition-colors"
      >
        {loggingOut ? "退出中..." : "退出"}
      </button>
    </div>
  );
}
