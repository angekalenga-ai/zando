/* Assistant client Zando. Les clés de fournisseur IA ne sont jamais envoyées au navigateur. */
(function () {
    "use strict";

    const SUPABASE_URL = "https://kcrliiinrjlrcspnaeac.supabase.co";
    const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_iv3rzG16WGv7e7DObdzCNw_dDs4VDM3";
    const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/zando-assistant`;
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

    const authPanel = document.getElementById("authPanel");
    const chatArea = document.getElementById("chatArea");
    const composerWrap = document.getElementById("composerWrap");
    const quickActions = document.getElementById("quickActions");
    const authMessage = document.getElementById("authMessage");
    const loginForm = document.getElementById("loginForm");
    const loginButton = document.getElementById("loginButton");
    const signOutButton = document.getElementById("signOutButton");
    const chatForm = document.getElementById("chatForm");
    const messageInput = document.getElementById("messageInput");
    const sendButton = document.getElementById("sendButton");
    const history = [];
    let busy = false;

    const quickPrompts = [
        "Je cherche un smartphone",
        "Je veux des produits de beauté",
        "Montre-moi les meilleures offres",
        "Comment passer une commande ?",
        "Aide-moi à trouver un produit pour la maison",
        "J’ai besoin d’aide sur la livraison"
    ];

    function setAuthenticated(isAuthenticated) {
        authPanel.hidden = isAuthenticated;
        chatArea.hidden = !isAuthenticated;
        composerWrap.hidden = !isAuthenticated;
        quickActions.hidden = !isAuthenticated;
        signOutButton.hidden = !isAuthenticated;
        if (isAuthenticated) messageInput.focus();
    }

    function renderQuickPrompts() {
        quickActions.innerHTML = "";
        quickPrompts.forEach(prompt => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "quick-action";
            button.textContent = prompt;
            button.addEventListener("click", () => {
                messageInput.value = prompt;
                messageInput.focus();
                chatForm.requestSubmit();
            });
            quickActions.appendChild(button);
        });
    }

    function addMessage(text, role, extraClass) {
        const message = document.createElement("p");
        message.className = `message ${role}${extraClass ? ` ${extraClass}` : ""}`;
        message.textContent = text;
        chatArea.appendChild(message);
        chatArea.scrollTop = chatArea.scrollHeight;
        return message;
    }

    function buildFallbackReply(message, catalog) {
        const lower = message.toLowerCase();
        const categoryMap = [
            { key: "mode", terms: ["mode", "vêtements", "vetements", "habit", "fashion", "chaussure", "sneaker"] },
            { key: "electronique", terms: ["smartphone", "phone", "electronique", "tech", "téléphone", "telephone", "appareil"] },
            { key: "beaute", terms: ["beauté", "beaute", "cosmétique", "soin", "beauty", "maquillage"] },
            { key: "maison", terms: ["maison", "décoration", "decoration", "meuble", "mobilier", "home"] },
            { key: "alimentation", terms: ["aliment", "nourriture", "snack", "produit local", "africain", "food"] }
        ];

        const matchedCategory = categoryMap.find(entry =>
            entry.terms.some(term => lower.includes(term))
        );

        if (matchedCategory && catalog.length) {
            const relevant = catalog.filter(item => {
                const label = `${item.category || ""} ${item.name || ""} ${item.description || ""}`.toLowerCase();
                return categoryMap.find(entry => entry.key === matchedCategory.key)?.terms.some(term => label.includes(term));
            }).slice(0, 3);

            if (relevant.length) {
                const lines = relevant.map(item => {
                    const price = item.price ? `${item.price} ${item.currency || "USD"}` : "Prix disponible sur demande";
                    return `- ${item.name} (${item.category || "Produit"}) — ${price}`;
                });
                return `Voici des idées qui correspondent à votre demande :\n${lines.join("\n")}\n\nSi vous voulez, je peux aussi vous aider à choisir selon votre budget ou votre besoin précis.`;
            }
        }

        if (/(commande|acheter|acheter|panier|pay|paiement|livraison|livrer|retour|aide)/i.test(lower)) {
            return "Pour commander, choisissez un produit puis confirmez votre panier. Vérifiez votre adresse de livraison et votre compte Zando avant de passer la commande. Si vous avez un cas spécifique, donnez-moi plus de détails et je vous guiderai étape par étape.";
        }

        if (/(bonjour|salut|merci|aide|qui|quoi)/i.test(lower)) {
            return "Je peux vous aider à trouver des idées de produits, comparer des catégories, ou expliquer le parcours commande sur Zando. Dites-moi ce que vous cherchez : smartphone, beauté, maison, mode, ou un produit précis.";
        }

        return "Je peux vous aider à découvrir des produits, identifier une catégorie, ou expliquer le parcours d'achat sur Zando. Donnez-moi un besoin précis comme : ‘smartphone’, ‘beauté’, ‘maison’ ou ‘comment passer une commande ?’.";
    }

    async function loadCatalogContext() {
        const { data, error } = await supabase
            .from("products")
            .select("name, description, price, currency, categories(name)")
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(12);

        if (error || !Array.isArray(data)) return [];

        return data.map(product => ({
            name: String(product.name || "").slice(0, 120),
            description: String(product.description || "").slice(0, 350),
            price: Number.isFinite(Number(product.price)) ? Number(product.price) : null,
            currency: String(product.currency || "").slice(0, 8),
            category: String(product.categories?.name || "").slice(0, 80)
        }));
    }

    loginForm.addEventListener("submit", async event => {
        event.preventDefault();
        authMessage.textContent = "Connexion en cours…";
        loginButton.disabled = true;

        const { error } = await supabase.auth.signInWithPassword({
            email: document.getElementById("emailInput").value.trim(),
            password: document.getElementById("passwordInput").value
        });

        loginButton.disabled = false;
        if (error) authMessage.textContent = "Connexion impossible. Vérifiez vos identifiants et réessayez.";
        else authMessage.textContent = "";
    });

    signOutButton.addEventListener("click", async () => {
        await supabase.auth.signOut();
        history.length = 0;
        chatArea.replaceChildren();
        addMessage("Bonjour ! Je suis l’assistant Zando. Je peux vous aider à explorer les produits disponibles et à mieux utiliser la marketplace. Que recherchez-vous ?", "assistant");
    });

    chatForm.addEventListener("submit", async event => {
        event.preventDefault();
        if (busy) return;

        const text = messageInput.value.trim();
        if (!text) return;

        busy = true;
        sendButton.disabled = true;
        messageInput.disabled = true;
        addMessage(text, "user");
        messageInput.value = "";
        const pending = addMessage("Je prépare une réponse…", "assistant", "status");

        let catalog = [];

        try {
            catalog = await loadCatalogContext();
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session?.access_token) throw new Error("SESSION");

            const response = await fetch(FUNCTION_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session.access_token}`,
                    "apikey": SUPABASE_PUBLISHABLE_KEY
                },
                body: JSON.stringify({
                    message: text,
                    history: history.slice(-8),
                    catalog
                })
            });

            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                if (response.status === 401) throw new Error("SESSION");
                if (response.status === 429) throw new Error("LIMIT");
                throw new Error("SERVICE");
            }
            if (typeof result.reply !== "string" || !result.reply.trim()) throw new Error("SERVICE");

            pending.remove();
            addMessage(result.reply, "assistant");
            history.push({ role: "user", content: text }, { role: "assistant", content: result.reply });
            if (history.length > 8) history.splice(0, history.length - 8);
        } catch (error) {
            pending.remove();
            const fallback = buildFallbackReply(text, catalog);
            const message = error.message === "SESSION"
                ? "Votre session a expiré. Reconnectez-vous pour continuer."
                : error.message === "LIMIT"
                    ? "Vous avez envoyé plusieurs messages trop rapidement. Attendez un instant puis réessayez."
                    : fallback;
            addMessage(message, "assistant");
            history.push({ role: "user", content: text }, { role: "assistant", content: message });
            if (history.length > 8) history.splice(0, history.length - 8);
        } finally {
            busy = false;
            sendButton.disabled = false;
            messageInput.disabled = false;
            messageInput.focus();
        }
    });

    supabase.auth.getSession().then(({ data, error }) => {
        setAuthenticated(!error && Boolean(data.session));
    });

    supabase.auth.onAuthStateChange((_event, session) => {
        setAuthenticated(Boolean(session));
    });

    renderQuickPrompts();
})();
