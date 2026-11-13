import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") || "*",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8"
};

const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY_ITEMS = 8;
const MAX_CATALOG_ITEMS = 12;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 8;
const requestTimes = new Map<string, number[]>();

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function cleanText(value: unknown, maxLength: number): string {
    return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function hitRateLimit(userId: string): boolean {
    const now = Date.now();
    const recent = (requestTimes.get(userId) || []).filter(time => now - time < RATE_WINDOW_MS);
    if (recent.length >= RATE_LIMIT) {
        requestTimes.set(userId, recent);
        return true;
    }
    recent.push(now);
    requestTimes.set(userId, recent);
    return false;
}

Deno.serve(async request => {
    if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (request.method !== "POST") return jsonResponse({ error: "Méthode non autorisée." }, 405);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const aiApiKey = Deno.env.get("AI_API_KEY");
    const aiModel = Deno.env.get("AI_MODEL");
    const aiApiUrl = (Deno.env.get("AI_API_URL") || "https://api.openai.com/v1").replace(/\/$/, "");

    if (!supabaseUrl || !supabaseAnonKey || !aiApiKey || !aiModel) {
        return jsonResponse({ error: "Assistant non configuré." }, 503);
    }

    const authorization = request.headers.get("Authorization") || "";
    const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return jsonResponse({ error: "Authentification requise." }, 401);

    try {
        const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
                "apikey": supabaseAnonKey,
                "Authorization": `Bearer ${token}`
            }
        });
        if (!authResponse.ok) return jsonResponse({ error: "Session invalide." }, 401);
        const user = await authResponse.json();
        const userId = cleanText(user?.id, 80);
        if (!userId) return jsonResponse({ error: "Session invalide." }, 401);

        if (hitRateLimit(userId)) {
            return jsonResponse({ error: "Trop de messages. Réessayez dans une minute." }, 429);
        }

        const contentLength = Number(request.headers.get("Content-Length") || 0);
        if (contentLength > 16_000) return jsonResponse({ error: "Requête trop volumineuse." }, 413);

        let payload: Record<string, unknown>;
        try {
            payload = await request.json();
        } catch {
            return jsonResponse({ error: "Requête invalide." }, 400);
        }

        const message = cleanText(payload.message, MAX_MESSAGE_LENGTH);
        if (!message) return jsonResponse({ error: "Le message est requis." }, 400);

        const history = Array.isArray(payload.history)
            ? payload.history.slice(-MAX_HISTORY_ITEMS).flatMap(item => {
                if (!item || typeof item !== "object") return [];
                const role = item.role === "assistant" ? "assistant" : item.role === "user" ? "user" : null;
                const content = cleanText(item.content, MAX_MESSAGE_LENGTH);
                return role && content ? [{ role, content }] : [];
            })
            : [];

        const catalog = Array.isArray(payload.catalog)
            ? payload.catalog.slice(0, MAX_CATALOG_ITEMS).map(item => {
                if (!item || typeof item !== "object") return null;
                return {
                    name: cleanText(item.name, 120),
                    description: cleanText(item.description, 350),
                    price: Number.isFinite(Number(item.price)) ? Number(item.price) : null,
                    currency: cleanText(item.currency, 8),
                    category: cleanText(item.category, 80)
                };
            }).filter(item => item?.name)
            : [];

        const systemPrompt = `Tu es l’assistant d’aide de Zando, une marketplace panafricaine. Réponds en français, de façon simple, polie et concise. Aide à trouver des produits, à expliquer la commande, et à orienter vers les bons parcours utilisateur. 

Règles strictes :
- Ne jamais inventer un prix, un stock, une livraison, un paiement ou un service absent du catalogue fourni.
- Si l’information manque, dis-le clairement et propose une piste utile.
- Ne demande jamais un mot de passe, un code de vérification ou une donnée bancaire.
- Si le client demande un produit, propose jusqu’à 3 options réelles issues du catalogue donné, en citant la catégorie et le prix quand disponible.
- Si le client pose une question sur la commande ou la livraison, donne une réponse générale et clairement indique qu’il faut vérifier dans l’application ou le support.
- Sois utile et orienté service client.

Catalogue public disponible : ${JSON.stringify(catalog)}`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20_000);
        let aiResponse: Response;
        try {
            aiResponse = await fetch(`${aiApiUrl}/chat/completions`, {
                method: "POST",
                signal: controller.signal,
                headers: {
                    "Authorization": `Bearer ${aiApiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: aiModel,
                    messages: [
                        { role: "system", content: systemPrompt },
                        ...history,
                        { role: "user", content: message }
                    ],
                    max_tokens: 350,
                    temperature: 0.4
                })
            });
        } finally {
            clearTimeout(timeout);
        }

        if (!aiResponse.ok) {
            console.error("AI provider returned status", aiResponse.status);
            return jsonResponse({ error: "Le service IA est indisponible." }, 502);
        }

        const result = await aiResponse.json();
        const reply = cleanText(result?.choices?.[0]?.message?.content, 4000);
        if (!reply) return jsonResponse({ error: "Réponse IA vide." }, 502);

        return jsonResponse({ reply });
    } catch (error) {
        console.error("Assistant request failed:", error instanceof Error ? error.name : "unknown");
        return jsonResponse({ error: "Erreur temporaire de l’assistant." }, 500);
    }
});
