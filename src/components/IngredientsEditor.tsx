"use client";

import { useState } from "react";
import type { Ingredient } from "@/lib/types";
import styles from "./IngredientsEditor.module.css";

const UNIT_OPTIONS = [
    "g",
    "ml",
    "大さじ",
    "小さじ",
    "つ",
    "人分",
    "適量",
    "秒",
] as const;

const normalizeAmount = (raw: string) => {
    let v = raw.replace(/[‐-‒–—−-]/g, "");
    v = v.replace(/[^\d\/.\s]/g, "");
    v = v.replace(/\s+/g, " ").trim();
    return v;
};

const isValidAmount = (v: string) => {
    if (v === "") return true;

    if (/^\d+$/.test(v)) return true;

    if (/^\d+(\.\d+)?$/.test(v)) return true;

    if (/^\d+\/[1-9]\d*$/.test(v)) return true;

    if (/^\d+\s+\d+\/[1-9]\d*$/.test(v)) return true;

    return false;
};



type Props = {
    value: Ingredient[];
    onChange: (next: Ingredient[]) => void;
};

export default function IngredientsEditor({ value, onChange }: Props) {
    const [unitPicker, setUnitPicker] = useState<{
        open: boolean;
        index: number | null;
    }>({
        open: false,
        index: null,
    });

    const update = (idx: number, patch: Partial<Ingredient>) => {
        const next = value.map((row, i) => (i === idx ? { ...row, ...patch } : row));
        onChange(next);
    };

    const addRow = () => {
        onChange([
            ...value,
            {
                name: "",
                amount: "",
                unit: "g",
                note: "",
            },
        ]);
    };

    const removeRow = (idx: number) => {
        onChange(value.filter((_, i) => i !== idx));
    };

    const closePicker = () => {
        setUnitPicker({ open: false, index: null });
    };

    const selectUnit = (unit: string) => {
        if (unitPicker.index === null) return;

        const index = unitPicker.index;
        const next = value.map((x, i) => (i === index ? { ...x, unit } : x));
        onChange(next);
        closePicker();
    };

    return (
        <div className={styles.wrap}>
            <div className={styles.headerRow}>
                <div className={styles.colName}>材料</div>
                <div className={styles.colAmount}>量</div>
                <div className={styles.colUnit}>単位</div>
                <div className={styles.colNote}>メモ</div>
                <div className={styles.colActions} />
            </div>

            {value.map((row, idx) => (
                <div key={idx} className={styles.row}>
                    <input
                        className={styles.input}
                        value={row.name}
                        placeholder="例：玉ねぎ"
                        onChange={(e) => update(idx, { name: e.target.value })}
                    />

                    <input
                        className={styles.input}
                        type="text"
                        inputMode="text"
                        value={row.amount}
                        placeholder="例：1/2, 2, 0.5"
                        onChange={(e) => {
                            const nextAmount = normalizeAmount(e.target.value);
                            if (!isValidAmount(nextAmount)) return;
                            update(idx, { amount: nextAmount });
                        }}
                    />

                    <button
                        type="button"
                        className={styles.unitButton}
                        onClick={() => setUnitPicker({ open: true, index: idx })}
                    >
                        {row.unit || "単位"}
                    </button>

                    <input
                        className={styles.input}
                        value={row.note || ""}
                        placeholder="例：薄切り"
                        onChange={(e) => update(idx, { note: e.target.value })}
                    />

                    <button
                        type="button"
                        className={styles.deleteBtn}
                        onClick={() => removeRow(idx)}
                        aria-label="delete"
                    >
                        ×
                    </button>
                </div>
            ))}

            <button type="button" className={styles.addBtn} onClick={addRow}>
                ＋ 材料を追加
            </button>

            {unitPicker.open && unitPicker.index !== null && (
                <div className={styles.sheetBackdrop} onClick={closePicker}>
                    <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.sheetTitle}>単位を選ぶ</div>

                        <div className={styles.sheetList}>
                            {UNIT_OPTIONS.map((u) => {
                                const selected = value[unitPicker.index!]?.unit === u;

                                return (
                                    <button
                                        key={u}
                                        type="button"
                                        className={`${styles.sheetItem} ${selected ? styles.sheetItemSelected : ""}`}
                                        onClick={() => selectUnit(u)}
                                    >
                                        {u}
                                    </button>
                                );
                            })}
                        </div>


                        <button type="button" className={styles.sheetClose} onClick={closePicker}>
                            閉じる
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
