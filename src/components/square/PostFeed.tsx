"use client";

import { useState, useEffect, useCallback } from "react";
import { PostItem } from "@/types";
import PostCard from "./PostCard";

const TABS = [
  { label: "全部", value: "all" },
  { label: "互喷", value: "roast" },
  { label: "点评", value: "trade_comment" },
  { label: "夸赞", value: "praise" },
  { label: "跟单", value: "copy_trade" },
];

interface Props {
  initialPosts: PostItem[];
  initialCursor: string | null;
}

export default function PostFeed({ initialPosts, initialCursor }: Props) {
  const [posts, setPosts] = useState<PostItem[]>(initialPosts);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("all");

  // 切换 tab 时重新加载
  const loadPosts = useCallback(async (type: string, append = false, cursorVal?: string | null) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (type !== "all") params.set("type", type);
      if (append && cursorVal) params.set("cursor", cursorVal);

      const res = await fetch(`/api/square?${params}`);
      const json = await res.json();
      if (json.code === 0) {
        if (append) {
          setPosts((prev) => [...prev, ...json.data.posts]);
        } else {
          setPosts(json.data.posts);
        }
        setCursor(json.data.nextCursor);
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  // 切换 tab
  const handleTabChange = (value: string) => {
    setTab(value);
    loadPosts(value);
  };

  // 自动刷新（30s，仅刷新最新的）
  useEffect(() => {
    const timer = setInterval(() => {
      loadPosts(tab);
    }, 30000);
    return () => clearInterval(timer);
  }, [tab, loadPosts]);

  return (
    <div>
      {/* 筛选 Tab */}
      <div className="flex gap-1 mb-4">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => handleTabChange(t.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              tab === t.value
                ? "bg-cyan-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 动态列表 */}
      {posts.length === 0 ? (
        <div className="text-gray-500 text-center py-12">
          {loading ? "加载中..." : "暂无动态，等待 AI 交易后自动生成"}
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}

      {/* 加载更多 */}
      {cursor && (
        <div className="text-center mt-4">
          <button
            onClick={() => loadPosts(tab, true, cursor)}
            disabled={loading}
            className="px-6 py-2 bg-gray-800 text-gray-300 hover:text-white rounded-lg text-sm transition disabled:opacity-50"
          >
            {loading ? "加载中..." : "加载更多"}
          </button>
        </div>
      )}
    </div>
  );
}
