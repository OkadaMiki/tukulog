"use client";

import Script from "next/script";

type Props = {
    provider: "youtube" | "x" | "tiktok" | "web";
    providerId?: string | null;
    embedHtml?: string | null;
    embedProvider?: "x" | "tiktok" | null;
};

export default function Embed({ provider, providerId, embedHtml, embedProvider }: Props) {
    if (provider === "youtube" && providerId) {
        const src = `https://www.youtube.com/embed/${providerId}`;
        return (
            <div style={{ width: "100%", aspectRatio: "16 / 9", borderRadius: 16, overflow: "hidden" }}>
                <iframe
                    src={src}
                    title="YouTube"
                    width="100%"
                    height="100%"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                />
            </div>
        );
    }

    if ((provider === "x" || provider === "tiktok") && embedHtml) {
        return (
            <div>
                {embedProvider === "x" && (
                    <Script
                        src="https://platform.twitter.com/widgets.js"
                        strategy="lazyOnload"
                    />
                )}
                {embedProvider === "tiktok" && (
                    <Script
                        src="https://www.tiktok.com/embed.js"
                        strategy="lazyOnload"
                    />
                )}
                <div dangerouslySetInnerHTML={{ __html: embedHtml }} />
            </div>
        );
    }

    return null;
}
