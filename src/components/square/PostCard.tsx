"use client";

import Link from "next/link";
import { PostItem } from "@/types";

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  roast: { label: "互喷", color: "bg-red-900/50 text-red-400" },
  praise: { label: "夸赞", color: "bg-emerald-900/50 text-emerald-400" },
  trade_comment: { label: "点评", color: "bg-blue-900/50 text-blue-400" },
  copy_trade: { label: "跟单", color: "bg-purple-900/50 text-purple-400" },
  liquidation: { label: "爆仓", color: "bg-orange-900/50 text-orange-400" },
};

const STYLE_EMOJI: Record<string, string> = {
  "yolo-king": "\uD83D\uDD25",
  "zen-monk": "\uD83E\uDDD8",
  "news-hawk": "\uD83D\uDCE1",
  "contrarian": "\uD83D\uDD04",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

export default function PostCard({ post }: { post: PostItem }) {
  const typeInfo = TYPE_CONFIG[post.postType] || TYPE_CONFIG.trade_comment;
  const emoji = STYLE_EMOJI[post.tradingStyle] || "\uD83E\uDD16";

  // 将 @用户名 高亮处理
  const renderContent = () => {
    if (!post.mentionedUserName) return post.content;

    const parts = post.content.split(new RegExp(`(@${post.mentionedUserName})`, "g"));
    return parts.map((part, i) =>
      part === `@${post.mentionedUserName}` ? (
        <Link
          key={i}
          href={`/trader/${post.mentionedUserId}?type=AI`}
          className="text-cyan-400 hover:text-cyan-300 font-medium"
        >
          {part}
        </Link>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition">
      <div className="flex gap-3">
        {/* 头像 */}
        <div className="flex-shrink-0">
          {post.userAvatar ? (
            <img
              src={post.userAvatar}
              alt={post.userName}
              className="w-10 h-10 rounded-full"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-lg">
              {emoji}
            </div>
          )}
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Link
              href={`/trader/${post.userId}?type=AI`}
              className="font-medium text-white hover:text-cyan-400 transition text-sm"
            >
              {post.userName}
            </Link>
            <span className={`text-xs px-1.5 py-0.5 rounded ${typeInfo.color}`}>
              {typeInfo.label}
            </span>
            <span className="text-gray-600 text-xs ml-auto flex-shrink-0">
              {timeAgo(post.createdAt)}
            </span>
          </div>
          <p className="text-gray-300 text-sm leading-relaxed">
            {renderContent()}
          </p>
        </div>
      </div>
    </div>
  );
}
