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
    const authMessage = document.getElementById("authMessage");
    const loginForm = document.getElementById("loginForm");
    const loginButton = document.getElementById("loginButton");
    const signOutButton = document.getElementById("signOutButton");
    const chatForm = document.getElementById("chatForm");
    const messageInput = document.getElementById("messageInput");
    const sendButton = document.getElementById("sendButton");
    const history = [];
    let busy = false;

    function setAuthenticated(isAuthenticated) {
        authPanel.hidden = isAuthenticated;
        chatArea.hidden = !isAuthenticated;
        composerWrap.hidden = !isAuthenticated;
        signOutButton.hidden = !isAuthenticated;
        if (isAuthenticated) messageInput.focus();
    }

    function addMessage(text, role, extraClass) {
        const message = document.createElement("p");
        message.className = `message ${role}${extraClass ? ` ${extraClass}` : ""}`;
        message.textContent = text;
        chatArea.appendChild(message);
        chatArea.scrollTop = chatArea.scrollHeight;
        return message;
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

        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session?.access_token) throw new Error("SESSION");

            const catalog = await loadCatalogContext();
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
            const message = error.message === "SESSION"
                ? "Votre session a expiré. Reconnectez-vous pour continuer."
                : error.message === "LIMIT"
                    ? "Vous avez envoyé plusieurs messages trop rapidement. Attendez un instant puis réessayez."
                    : "L’assistant est temporairement indisponible. Réessayez un peu plus tard.";
            addMessage(message, "assistant");
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
})();
