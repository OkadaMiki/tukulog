"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import { collection, onSnapshot, orderBy, query, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { ensureAnonymousAuth } from "@/lib/auth/ensureAuth";

import styles from "./page.module.css";
// もし既にフッターナビがあるなら使う
// import FooterNav from "@/components/layout/FooterNav";

type RecipeDoc = {
    id: string;
    title: string;
    image_url?: string | null;
    tags?: string[];
    createdAt?: Timestamp;
    updatedAt?: Timestamp;

    cooked_count?: number;
    last_cooked_at?: Timestamp | null;
};

type FilterKey = "all" | "repeat" | "uncooked" | "cooked";

const FILTERS: { key: FilterKey; label: string }[] = [
    { key: "all", label: "すべて" },
    { key: "repeat", label: "リピート" },
    { key: "uncooked", label: "未調理" },
    { key: "cooked", label: "調理済み" },
];

const formatYmd = (t?: Timestamp | null) => {
    if (!t) return "";
    const d = t.toDate();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
};

export default function RecipeListPage() {
    const router = useRouter();

    const [filter, setFilter] = useState<FilterKey>("all");
    const [loading, setLoading] = useState(true);
    const [recipes, setRecipes] = useState<RecipeDoc[]>([]);

    useEffect(() => {
        let unsub: (() => void) | null = null;

        (async () => {
            const user = await ensureAnonymousAuth();

            const col = collection(db, "users", user.uid, "recipes");
            const q = query(col, orderBy("updatedAt", "desc"));

            unsub = onSnapshot(
                q,
                (snap) => {
                    const list = snap.docs.map((d) => {
                        const data = d.data() as any;
                        return {
                            id: d.id,
                            title: String(data.title ?? ""),
                            image_url: (data.image_url ?? null) as string | null,
                            tags: Array.isArray(data.tags) ? data.tags.map((x: any) => String(x)) : [],
                            createdAt: data.createdAt as Timestamp | undefined,
                            updatedAt: data.updatedAt as Timestamp | undefined,
                            cooked_count: typeof data.cooked_count === "number" ? data.cooked_count : 0,
                            last_cooked_at: (data.last_cooked_at ?? null) as Timestamp | null,
                        };
                    });

                    setRecipes(list);
                    setLoading(false);
                },
                () => {
                    setLoading(false);
                }
            );
        })();

        return () => {
            if (unsub) unsub();
        };
    }, []);

    const filtered = useMemo(() => {
        return recipes.filter((r) => {
            const cookedCount = r.cooked_count ?? 0;
            const lastCookedAt = r.last_cooked_at ?? null;

            const isCooked = Boolean(lastCookedAt) || cookedCount > 0;
            const isRepeat = cookedCount >= 2;

            if (filter === "repeat") return isRepeat;
            if (filter === "uncooked") return !isCooked;
            if (filter === "cooked") return isCooked;
            return true;
        });
    }, [recipes, filter]);

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <h1 className={styles.h1}>レシピ一覧</h1>
            </header>

            <div className={styles.filters} role="tablist" aria-label="フィルター">
                {FILTERS.map((f) => {
                    const active = f.key === filter;
                    return (
                        <button
                            key={f.key}
                            type="button"
                            className={`${styles.filterBtn} ${active ? styles.filterBtnActive : ""}`}
                            onClick={() => setFilter(f.key)}
                            role="tab"
                            aria-selected={active}
                        >
                            {f.label}
                        </button>
                    );
                })}
            </div>

            <main className={styles.list}>
                {loading && <div className={styles.info}>読み込み中…</div>}

                {!loading && filtered.length === 0 && (
                    <div className={styles.info}>まだレシピがありません</div>
                )}

                {filtered.map((r) => {
                    const cookedLabel = r.last_cooked_at ? formatYmd(r.last_cooked_at) : "未調理";
                    const tagsText = (r.tags ?? []).slice(0, 4).map((t) => `#${t}`).join(" ");

                    return (
                        <article key={r.id} className={styles.card}>
                            <div className={styles.thumbWrap}>
                                {r.image_url ? (
                                    <Image
                                        src={r.image_url}
                                        alt=""
                                        fill
                                        sizes="120px"
                                        className={styles.thumb}
                                    />
                                ) : (
                                    <div className={styles.thumbFallback} />
                                )}
                            </div>

                            <div className={styles.meta}>
                                <div className={styles.title}>{r.title || "（タイトルなし）"}</div>
                                <div className={styles.sub}>{cookedLabel}</div>
                                <div className={styles.tags}>{tagsText}</div>

                                <div className={styles.actions}>
                                    <button
                                        type="button"
                                        className={styles.actionBtn}
                                        onClick={() => router.push(`/recipe/${r.id}`)}
                                    >
                                        詳細
                                    </button>

                                    <button
                                        type="button"
                                        className={styles.actionBtn}
                                        onClick={() => router.push(`/record?recipeId=${encodeURIComponent(r.id)}`)}
                                    >
                                        記録
                                    </button>
                                </div>
                            </div>
                        </article>
                    );
                })}
            </main>

            {/* <FooterNav /> */}
        </div>
    );
}
