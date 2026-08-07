import { Sparkles, TriangleAlert } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { monthlyBudget, monthlySpend } from "@/lib/ai/usage";
import { db } from "@/lib/db";

/**
 * O'qituvchi uchun AI xarajati. Maktab byudjeti cheklangan —
 * kutilmagan hisob kelmasligi kerak.
 */
export async function AiBudgetCard() {
  const [spend, failed] = await Promise.all([
    monthlySpend(),
    db.aiReview.count({ where: { status: "FAILED" } }),
  ]);

  const budget = monthlyBudget();
  const percent = Math.min(100, Math.round((spend / budget) * 100));
  const exceeded = spend >= budget;
  const hasKey = Boolean(
    process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY
  );

  if (!hasKey) {
    return (
      <Card className="border-warning/40 bg-warning/5">
        <CardContent className="flex items-start gap-3 p-4 pt-4">
          <TriangleAlert size={18} className="mt-0.5 shrink-0 text-warning" aria-hidden />
          <div className="text-sm">
            <p className="font-medium">AI kaliti sozlanmagan</p>
            <p className="mt-0.5 text-muted-foreground">
              Vazifalar test-case bo'yicha tekshirilmoqda, lekin AI izohi
              berilmayapti. <code>.env</code> faylida{" "}
              <code>ANTHROPIC_API_KEY</code> ni to'ldiring.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={exceeded ? "border-danger/40 bg-danger/5" : ""}>
      <CardContent className="space-y-2 p-4 pt-4">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Sparkles size={16} className="text-primary" aria-hidden />
            AI xarajati (shu oy)
          </span>
          <span className="text-sm font-semibold">
            ${spend.toFixed(2)} / ${budget.toFixed(0)}
          </span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={exceeded ? "h-full bg-danger" : "h-full bg-primary"}
            style={{ width: `${percent}%` }}
          />
        </div>

        {exceeded && (
          <p className="text-sm text-danger">
            Byudjet tugadi — AI izohi vaqtincha o'chirildi. Test tekshiruvi
            ishlashda davom etmoqda.
          </p>
        )}
        {failed > 0 && (
          <p className="text-sm text-muted-foreground">
            {failed} ta baholash muvaffaqiyatsiz — har 30 daqiqada avtomatik
            qayta urinilmoqda.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
