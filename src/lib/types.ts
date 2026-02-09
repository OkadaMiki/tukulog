export type Ingredient = {
    name: string;
    amount: string;
    unit: string;
    note?: string;
};

export type RecipeDraft = {
    url: string;
    urlFinal: string;
    canonicalUrl: string;
    provider: "youtube" | "x" | "tiktok" | "web";
    providerId?: string | null;
    title: string;
    description: string;
    imageUrl?: string | null;
    embedHtml?: string | null;
    embedProvider?: "x" | "tiktok" | null;
    tags: string[];
    ingredientsBase: Ingredient[];
};
