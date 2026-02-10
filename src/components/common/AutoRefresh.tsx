"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface Props {
  interval?: number; // 毫秒，默认 30 秒
}

export default function AutoRefresh({ interval = 30000 }: Props) {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => {
      router.refresh();
    }, interval);
    return () => clearInterval(timer);
  }, [router, interval]);

  return null;
}
