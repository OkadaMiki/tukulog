"use client";

import { httpsCallable } from "firebase/functions";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { ensureAnonymousAuth } from "@/lib/auth/ensureAuth";
import { db, functions } from "@/lib/firebase/client";
import type { Ingredient, RecipeDraft } from "@/lib/types";
import IngredientsEditor from "@/components/IngredientsEditor";
import Embed from "@/components/Embed";
import styles from "./page.module.css";

const TAG_OPTIONS = [
  "レンジ",
  "フライパン",
  "鍋",
  "オーブン",
  "時短",
  "じっくり",
  "作り置き",
] as const;

type PreviewResult = Omit<RecipeDraft, "ingredientsBase">;
type PreviewResponse = {
  urlFinal: string;
  canonicalUrl: string;
  provider: "youtube" | "x" | "tiktok" | "web";
  providerId?: string | null;
  title?: string;
  description?: string;
  imageUrl?: string | null;
  embedHtml?: string | null;
  embedProvider?: "x" | "tiktok" | null;
};

type SaveResponse = {
  id: string;
};

export default function HomePage() {
  const [ready, setReady] = useState(false);
  const [url, setUrl] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ingredientsBase, setIngredientsBase] = useState<Ingredient[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    ensureAnonymousAuth()
      .then(() => setReady(true))
      .catch(() => setReady(true));
  }, []);

  const canPreview = useMemo(() => /^https?:\/\//.test(url.trim()), [url]);

  const runPreview = async () => {
    setLoadingPreview(true);
    setPreview(null);

    try {
      await ensureAnonymousAuth();

      const fn = httpsCallable(functions, "previewUrl");
      const res = await fn({ url: url.trim() });
      const data = res.data as PreviewResponse;

      const next: PreviewResult = {
        url: url.trim(),
        urlFinal: data.urlFinal,
        canonicalUrl: data.canonicalUrl,
        provider: data.provider,
        providerId: data.providerId || null,
        title: data.title || "",
        description: data.description || "",
        imageUrl: data.imageUrl || null,
        embedHtml: data.embedHtml || null,
        embedProvider: data.embedProvider || null,
      };

      setPreview(next);
      setTitle(next.title);
      setDescription(next.description);
      setIngredientsBase([]);
    } catch (e) {
      console.error(e);
      alert("プレビュー取得に失敗しました。URLを確認してください。");
    }
  };

  const save = async () => {
    if (!preview) {
      return;
    }

    setSaving(true);

    try {
      const user = await ensureAnonymousAuth();

      const fn = httpsCallable(functions, "saveRecipe");
      const res = await fn({
        draft: {
          ...preview,
          title,
          description,
          ingredientsBase,
          tags,
        },
      });

      const data = res.data as SaveResponse;

      // ここだけ「失敗しても無視」にしたいので、内側でtry/catchする
      try {
        await setDoc(
          doc(db, "users", user.uid, "recipes_meta", String(data.id)),
          {
            touchedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (metaErr) {
        console.warn("recipes_meta の書き込みに失敗（無視）", metaErr);
      }

      alert("保存しました");
      setUrl("");
      setPreview(null);
      setTitle("");
      setDescription("");
      setIngredientsBase([]);
      setTags([]);
    } catch (e) {
      console.error(e);
      const err = e as { code?: string; message?: string };
      alert(`保存に失敗しました\ncode: ${err.code ?? "-"}\nmessage: ${err.message ?? "-"}`);
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className={styles.page}>
      <h1 className={styles.h1}>保存</h1>

      <div className={styles.card}>
        <label className={styles.label}>SNS投稿のURL</label>
        <div className={styles.row}>
          <input
            className={styles.input}
            value={url}
            placeholder="https://..."
            onChange={(e) => setUrl(e.target.value)}
          />
          <button
            className={styles.button}
            type="button"
            onClick={runPreview}
            disabled={!ready || !canPreview || loadingPreview}
          >
            {loadingPreview ? "取得中" : "プレビュー"}
          </button>
        </div>
        <div className={styles.hint}>
          YouTube / X / TikTok を優先。取れない場合はOGPカードにフォールバックします。
        </div>
      </div>

      {preview && (
        <div className={styles.card}>
          <div className={styles.previewTop}>
            <div className={styles.previewMeta}>
              <div className={styles.badge}>{preview.provider}</div>
              {preview.imageUrl && (
                <img
                  className={styles.thumb}
                  src={preview.imageUrl}
                  alt=""
                />
              )}
            </div>
          </div>

          <div className={styles.embed}>
            <Embed
              provider={preview.provider}
              providerId={preview.providerId}
              embedHtml={preview.embedHtml}
              embedProvider={preview.embedProvider}
            />
          </div>

          <label className={styles.label}>タイトル（編集可）</label>
          <input
            className={styles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <label className={styles.label}>説明（編集可）</label>
          <textarea
            className={styles.textarea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />

          <label className={styles.label}>材料（ベース）</label>
          <IngredientsEditor value={ingredientsBase} onChange={setIngredientsBase} />

          <div className={styles.tags}>
            {TAG_OPTIONS.map((t) => {
              const checked = tags.includes(t);
              return (
                <label key={t} className={styles.tagItem}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setTags((prev) =>
                        checked ? prev.filter((x) => x !== t) : [...prev, t]
                      )
                    }
                  />
                  <span>{t}</span>
                </label>
              );
            })}
          </div>

          <button
            className={styles.primary}
            type="button"
            onClick={save}
            disabled={saving}
          >
            {saving ? "保存中" : "保存"}
          </button>
        </div>
      )}
    </div>
  );
}