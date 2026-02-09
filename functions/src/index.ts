import { onCall, HttpsError } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

import * as crypto from "crypto";
import * as cheerio from "cheerio";

setGlobalOptions({
    region: "asia-northeast1",
});

initializeApp();
const db = getFirestore();

type Ingredient = {
    name: string;
    amount: string;
    unit: string;
    note?: string;
};

const stripScripts = (html: string) => {
    return html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
};

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

const resolveFinalUrl = async (raw: string) => {
    const res = await fetch(raw, {
        redirect: "follow",
    });
    return res.url;
};

const canonicalize = (input: string) => {
    const u = new URL(input);
    u.hash = "";

    const removeKeys = ["fbclid", "s"];
    for (const k of [...u.searchParams.keys()]) {
        if (k.startsWith("utm_")) u.searchParams.delete(k);
        if (removeKeys.includes(k)) u.searchParams.delete(k);
    }

    const sorted = [...u.searchParams.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    u.search = new URLSearchParams(sorted).toString();

    let provider: "youtube" | "x" | "tiktok" | "web" = "web";
    let providerId: string | null = null;

    const host = u.hostname.replace(/^www\./, "").toLowerCase();

    // YouTube
    if (host === "youtu.be" || host.endsWith("youtube.com")) {
        const id = host === "youtu.be" ? u.pathname.replace("/", "") : u.searchParams.get("v");
        if (id) {
            provider = "youtube";
            providerId = id;
            u.hostname = "www.youtube.com";
            u.pathname = "/watch";
            u.search = `v=${id}`;
        }
    }

    // X / Twitter
    if (host === "x.com" || host.endsWith("twitter.com")) {
        provider = "x";
        u.hostname = "twitter.com";
    }

    // TikTok
    if (host.endsWith("tiktok.com")) {
        provider = "tiktok";
    }

    return {
        canonicalUrl: u.toString(),
        provider,
        providerId,
    };
};



const readOGP = async (url: string) => {
    const html = await (await fetch(url)).text();
    const $ = cheerio.load(html);

    const pick = (key: string) =>
        $(`meta[property='${key}']`).attr("content") ||
        $(`meta[name='${key}']`).attr("content") ||
        "";

    const title = pick("og:title") || $("title").text() || "";
    const description = pick("og:description") || pick("description") || "";
    const imageUrl = pick("og:image") || pick("twitter:image") || "";

    return {
        title,
        description,
        imageUrl,
    };
};

const oembedYouTube = async (videoId: string) => {
    const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(
        `https://www.youtube.com/watch?v=${videoId}`
    )}`;
    const r = await fetch(url);
    if (!r.ok) {
        throw new Error("youtube oembed failed");
    }
    const j: any = await r.json();
    return {
        title: String(j.title || ""),
        description: "",
        imageUrl: String(j.thumbnail_url || ""),
        embedHtml: null,
        embedProvider: null as null,
    };
};

const oembedX = async (canonicalUrl: string) => {
    const url = `https://publish.twitter.com/oembed?omit_script=1&url=${encodeURIComponent(canonicalUrl)}`;
    const r = await fetch(url);
    if (!r.ok) {
        throw new Error("x oembed failed");
    }
    const j: any = await r.json();
    return {
        title: "",
        description: "",
        imageUrl: "",
        embedHtml: stripScripts(String(j.html || "")),
        embedProvider: "x" as const,
    };
};

const oembedTikTok = async (canonicalUrl: string) => {
    const url = `https://www.tiktok.com/oembed?url=${encodeURIComponent(canonicalUrl)}`;
    const r = await fetch(url);
    if (!r.ok) {
        throw new Error("tiktok oembed failed");
    }
    const j: any = await r.json();
    return {
        title: String(j.title || ""),
        description: String(j.author_name ? `by ${j.author_name}` : ""),
        imageUrl: String(j.thumbnail_url || ""),
        embedHtml: stripScripts(String(j.html || "")),
        embedProvider: "tiktok" as const,
    };
};

export const previewUrl = onCall(async (req) => {
    const rawUrl = String(req.data?.url || "");
    if (!/^https?:\/\//.test(rawUrl)) {
        throw new HttpsError("invalid-argument", "url is required");
    }

    const urlFinal = await resolveFinalUrl(rawUrl);
    const { canonicalUrl, provider, providerId } = canonicalize(urlFinal);

    let title = "";
    let description = "";
    let imageUrl: string | null = null;
    let embedHtml: string | null = null;
    let embedProvider: "x" | "tiktok" | null = null;

    try {
        if (provider === "youtube" && providerId) {
            const m = await oembedYouTube(providerId);
            title = m.title;
            description = m.description;
            imageUrl = m.imageUrl || null;
        } else if (provider === "x") {
            const m = await oembedX(canonicalUrl);
            embedHtml = m.embedHtml;
            embedProvider = m.embedProvider;
        } else if (provider === "tiktok") {
            const m = await oembedTikTok(canonicalUrl);
            title = m.title;
            description = m.description;
            imageUrl = m.imageUrl || null;
            embedHtml = m.embedHtml;
            embedProvider = m.embedProvider;
        }
    } catch {
        // oEmbed失敗はフォールバックへ
    }

    // OGPフォールバック
    if (!title || !imageUrl || !description) {
        try {
            const og = await readOGP(canonicalUrl);
            title = title || og.title;
            description = description || og.description;
            imageUrl = imageUrl || og.imageUrl || null;
        } catch {
            // 無理なら空で返す
        }
    }

    return {
        urlFinal,
        canonicalUrl,
        provider,
        providerId,
        title,
        description,
        imageUrl,
        embedHtml,
        embedProvider,
    };
});

export const saveRecipe = onCall(async (req) => {
    try {
        console.log("saveRecipe called", {
            uid: req.auth?.uid ?? null,
            hasDraft: !!req.data?.draft,
        });

        if (!req.auth?.uid) {
            throw new HttpsError("unauthenticated", "login required");
        }

        const uid = req.auth.uid;
        const draft = req.data?.draft;

        if (!draft?.canonicalUrl || !draft?.urlFinal || !draft?.url) {
            throw new HttpsError("invalid-argument", "draft is invalid");
        }

        const canonicalUrl = String(draft.canonicalUrl);
        const canonicalHash = sha256(canonicalUrl);

        const tags: string[] = Array.isArray(draft.tags)
            ? draft.tags.map((t: any) => String(t))
            : [];

        const ingredientsBase: Ingredient[] = Array.isArray(draft.ingredientsBase)
            ? draft.ingredientsBase.map((r: any) => ({
                name: String(r.name || ""),
                amount: String(r.amount ?? ""),
                unit: String(r.unit || ""),
                note: r.note ? String(r.note) : "",
            }))
            : [];

        const docRef = db.doc(`users/${uid}/recipes/${canonicalHash}`);
        const snap = await docRef.get();

        const now = FieldValue.serverTimestamp();
        const createdAt = snap.exists ? snap.get("createdAt") ?? now : now;

        await docRef.set(
            {
                uid,
                id: canonicalHash,
                url_raw: String(draft.url),
                url_final: String(draft.urlFinal),
                canonical_url: canonicalUrl,
                canonical_hash: canonicalHash,
                provider_id: draft.providerId ? String(draft.providerId) : null,
                title: String(draft.title || ""),
                description: String(draft.description || ""),
                tags,
                image_url: draft.imageUrl ? String(draft.imageUrl) : null,
                embed_html: draft.embedHtml ? String(draft.embedHtml) : null,
                embed_provider: draft.embedProvider ? String(draft.embedProvider) : null,
                ingredients_base: ingredientsBase,
                updatedAt: now,
                createdAt,
            },
            { merge: true }
        );

        return { id: canonicalHash };
    } catch (e) {
        console.error("saveRecipe error:", e);
        throw new HttpsError("internal", "saveRecipe failed");
    }
});
