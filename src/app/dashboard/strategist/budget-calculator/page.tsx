"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Download, Copy } from "lucide-react";
import { toast } from "sonner";

interface LineItem {
  id: string;
  name: string;
  category: string;
  cost: number;
  quantity: number;
}

const categories = ["Media", "Production", "Creative", "Technology", "Talent", "Other"];

function newItem(): LineItem {
  return { id: crypto.randomUUID(), name: "", category: "Media", cost: 0, quantity: 1 };
}

export default function BudgetCalculatorPage() {
  const [items, setItems] = useState<LineItem[]>([newItem()]);
  const [budgetCap, setBudgetCap] = useState<number | "">("");

  function update(id: string, field: keyof LineItem, value: string | number) {
    setItems((list) =>
      list.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  }

  function add() {
    setItems((list) => [...list, newItem()]);
  }

  function remove(id: string) {
    if (items.length <= 1) return;
    setItems((list) => list.filter((i) => i.id !== id));
  }

  const total = items.reduce((sum, i) => sum + i.cost * i.quantity, 0);

  // Group by category
  const byCategory = items.reduce(
    (acc, item) => {
      const subtotal = item.cost * item.quantity;
      acc[item.category] = (acc[item.category] || 0) + subtotal;
      return acc;
    },
    {} as Record<string, number>
  );

  const overBudget = budgetCap !== "" && total > budgetCap;

  function exportCsv() {
    const header = "Name,Category,Unit Cost,Quantity,Subtotal\n";
    const rows = items
      .map((i) => `"${i.name}","${i.category}",${i.cost},${i.quantity},${i.cost * i.quantity}`)
      .join("\n");
    const footer = `\n\n"TOTAL","","","",${total}`;
    const blob = new Blob([header + rows + footer], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "budget.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Budget Calculator</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const text = items
                .map((i) => `${i.name || "Unnamed"} (${i.category}): ${fmt(i.cost)} x ${i.quantity} = ${fmt(i.cost * i.quantity)}`)
                .join("\n") + `\n\nTotal: ${fmt(total)}`;
              navigator.clipboard.writeText(text);
              toast.success("Copied");
            }}
          >
            <Copy className="mr-1 h-4 w-4" />
            Copy
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="mr-1 h-4 w-4" />
            CSV
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <div className={`text-3xl font-bold ${overBudget ? "text-red-500" : ""}`}>
              {fmt(total)}
            </div>
            <div className="text-xs text-muted-foreground">Total Budget</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <div className="text-3xl font-bold">{items.length}</div>
            <div className="text-xs text-muted-foreground">Line Items</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <Label className="text-xs">Budget Cap</Label>
            <Input
              type="number"
              value={budgetCap}
              onChange={(e) => setBudgetCap(e.target.value ? Number(e.target.value) : "")}
              placeholder="Optional max budget"
              className="mt-1"
            />
            {overBudget && (
              <Badge variant="destructive" className="mt-2">
                Over by {fmt(total - Number(budgetCap))}
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Category breakdown */}
      {Object.keys(byCategory).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(byCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, amount]) => (
                  <div key={cat} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{cat}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {total > 0 ? ((amount / total) * 100).toFixed(0) : 0}%
                        </span>
                        <span className="font-medium">{fmt(amount)}</span>
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-primary transition-all"
                        style={{ width: `${total > 0 ? (amount / total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Line items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Line Items</CardTitle>
          <Button size="sm" onClick={add}>
            <Plus className="mr-1 h-4 w-4" />
            Add Item
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-2 rounded-lg border p-3">
              <div className="flex-1 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
                <Input
                  value={item.name}
                  onChange={(e) => update(item.id, "name", e.target.value)}
                  placeholder="Item name"
                />
                <select
                  value={item.category}
                  onChange={(e) => update(item.id, "category", e.target.value)}
                  className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <Input
                  type="number"
                  value={item.cost || ""}
                  onChange={(e) => update(item.id, "cost", Number(e.target.value))}
                  placeholder="Cost"
                  className="w-28"
                />
                <Input
                  type="number"
                  min={1}
                  value={item.quantity || ""}
                  onChange={(e) => update(item.id, "quantity", Number(e.target.value))}
                  placeholder="Qty"
                  className="w-20"
                />
              </div>
              <div className="w-24 text-right text-sm font-medium">
                {fmt(item.cost * item.quantity)}
              </div>
              {items.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => remove(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
