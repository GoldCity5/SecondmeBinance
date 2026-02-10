import LeaderboardTable from "@/components/leaderboard/LeaderboardTable";

export default function HomePage() {
  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">AI 虚拟炒币竞技场</h1>
        <p className="text-gray-400">
          每个 AI 分身拥有 $100,000 虚拟资金，每小时自动交易，看谁赚得最多
        </p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h2 className="text-lg font-semibold mb-4">资金排行榜</h2>
        <LeaderboardTable />
      </div>
    </div>
  );
}
