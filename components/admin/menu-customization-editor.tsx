"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import type { CustomizationGroup } from "@/types/menu";

export function MenuCustomizationEditor({
  initialGroups,
}: {
  initialGroups: CustomizationGroup[];
}) {
  const [groups, setGroups] = useState<CustomizationGroup[]>(initialGroups);

  function addGroup() {
    setGroups((prev) => [...prev, { name: "", options: [{ label: "", price_delta: 0 }] }]);
  }

  function removeGroup(gIdx: number) {
    setGroups((prev) => prev.filter((_, i) => i !== gIdx));
  }

  function updateGroupName(gIdx: number, name: string) {
    setGroups((prev) => prev.map((g, i) => (i === gIdx ? { ...g, name } : g)));
  }

  function addOption(gIdx: number) {
    setGroups((prev) =>
      prev.map((g, i) =>
        i === gIdx ? { ...g, options: [...g.options, { label: "", price_delta: 0 }] } : g
      )
    );
  }

  function removeOption(gIdx: number, oIdx: number) {
    setGroups((prev) =>
      prev.map((g, i) =>
        i === gIdx ? { ...g, options: g.options.filter((_, j) => j !== oIdx) } : g
      )
    );
  }

  function updateOption(
    gIdx: number,
    oIdx: number,
    field: "label" | "price_delta",
    value: string
  ) {
    setGroups((prev) =>
      prev.map((g, i) =>
        i === gIdx
          ? {
              ...g,
              options: g.options.map((o, j) =>
                j === oIdx
                  ? { ...o, [field]: field === "price_delta" ? Number(value) || 0 : value }
                  : o
              ),
            }
          : g
      )
    );
  }

  return (
    <div className="space-y-4">
      <input type="hidden" name="customization_options" value={JSON.stringify(groups)} readOnly />

      {groups.map((group, gIdx) => (
        <div key={gIdx} className="space-y-3 rounded-lg border p-3">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Nama grup (contoh: Level Gula)"
              value={group.name}
              onChange={(e) => updateGroupName(gIdx, e.target.value)}
              className="font-medium"
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
              onClick={() => removeGroup(gIdx)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2 pl-1">
            {group.options.map((opt, oIdx) => (
              <div key={oIdx} className="flex items-center gap-2">
                <Input
                  placeholder="Label (contoh: Less Sugar)"
                  value={opt.label}
                  onChange={(e) => updateOption(gIdx, oIdx, "label", e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="number"
                  placeholder="+Rp"
                  value={opt.price_delta}
                  onChange={(e) => updateOption(gIdx, oIdx, "price_delta", e.target.value)}
                  className="w-28"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 text-muted-foreground"
                  onClick={() => removeOption(gIdx, oIdx)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={() => addOption(gIdx)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Tambah Pilihan
            </Button>
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" onClick={addGroup} className="w-full">
        <Plus className="mr-1.5 h-4 w-4" />
        Tambah Grup Kustomisasi
      </Button>
    </div>
  );
}