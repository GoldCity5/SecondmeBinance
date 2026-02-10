/**
 * 数据迁移脚本：为所有已有 Trade 记录回填 portfolioId
 * 通过 trade.userId 找到 type="AI" 的 portfolio，将其 id 写入 trade.portfolioId
 *
 * 执行方式：npx tsx scripts/migrate-trade-portfolio.ts
 */
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  const trades = await prisma.trade.findMany({
    where: { portfolioId: "" },
  });

  console.log(`需要回填的交易记录: ${trades.length} 条`);

  let updated = 0;
  for (const trade of trades) {
    const portfolio = await prisma.portfolio.findFirst({
      where: { userId: trade.userId, type: "AI" },
    });

    if (!portfolio) {
      console.warn(`用户 ${trade.userId} 没有 AI portfolio，跳过 trade ${trade.id}`);
      continue;
    }

    await prisma.trade.update({
      where: { id: trade.id },
      data: { portfolioId: portfolio.id },
    });
    updated++;
  }

  console.log(`回填完成: ${updated}/${trades.length} 条`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
