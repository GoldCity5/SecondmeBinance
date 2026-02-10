import PriceTable from "@/components/market/PriceTable";

export default function MarketPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">实时行情</h1>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <PriceTable />
      </div>
    </div>
  );
}
