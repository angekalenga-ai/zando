(() => {
    const COACH_FUNCTION_URL = "https://kcrliiinrjlrcspnaeac.supabase.co/functions/v1/zando-seller-coach";
    const SUGGESTIONS = [
        "Comment améliorer ma fiche produit ?",
        "Quel produit faut-il mettre en avant ?",
        "Comment mieux vendre mon catalogue ?",
        "Mon stock est-il bien présenté ?",
        "Que puis-je faire pour améliorer mon boutique ?"
    ];

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function ensureCoachPanel() {
        const existing = document.getElementById("sellerCoachPanel");
        if (existing) return existing;

        const panel = document.createElement("section");
        panel.id = "sellerCoachPanel";
        panel.className = "card";
        panel.style.marginTop = "24px";
        panel.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
                <div>
                    <h2 style="margin:0 0 6px; color:#0f172a;">Coach vendeur Zando</h2>
                    <p style="margin:0; color:#64748b;">Conseils personnalisés sur votre boutique, vos produits et votre catalogue.</p>
                </div>
                <span style="padding:6px 10px; background:#ecfeff; color:#0f766e; border-radius:999px; font-size:12px; font-weight:700;">IA sécurisée</span>
            </div>

            <div id="sellerCoachMessages" style="margin-top:18px; display:flex; flex-direction:column; gap:12px; min-height:120px; max-height:320px; overflow:auto; padding-right:4px;">
                <div style="padding:12px 14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; color:#334155; line-height:1.5;">
                    Bonjour ! Je peux vous aider à améliorer votre boutique, vos fiches produits et la présentation de votre catalogue.
                </div>
            </div>

            <div style="margin-top:16px; display:flex; flex-wrap:wrap; gap:8px;">
                ${SUGGESTIONS.map(suggestion => `
                    <button type="button" class="btn btn-secondary seller-coach-prompt" data-prompt="${escapeHtml(suggestion)}" style="padding:8px 12px; border-radius:999px; font-size:13px;">
                        ${suggestion}
                    </button>
                `).join("")}
            </div>

            <form id="sellerCoachForm" style="margin-top:16px; display:flex; gap:10px; flex-wrap:wrap;">
                <input id="sellerCoachInput" type="text" placeholder="Posez une question à votre coach vendeur…" style="flex:1 1 260px; min-height:46px; padding:12px 14px; border:1px solid #cbd5e1; border-radius:10px; font-size:15px;" maxlength="1000" />
                <button type="submit" class="btn btn-primary" style="min-width:140px;">Envoyer</button>
            </form>
        `;

        const target = document.getElementById("sellerContent") || document.querySelector("main") || document.body;
        target.appendChild(panel);
        return panel;
    }

    function addCoachMessage(role, text) {
        const container = document.getElementById("sellerCoachMessages");
        if (!container) return;

        const item = document.createElement("div");
        item.style.padding = "12px 14px";
        item.style.borderRadius = "12px";
        item.style.lineHeight = "1.5";
        item.style.maxWidth = "85%";
        item.style.whiteSpace = "pre-wrap";
        item.style.overflowWrap = "anywhere";

        if (role === "user") {
            item.style.marginLeft = "auto";
            item.style.background = "#0f172a";
            item.style.color = "#fff";
        } else {
            item.style.background = "#f8fafc";
            item.style.border = "1px solid #e2e8f0";
            item.style.color = "#334155";
        }

        item.textContent = text;
        container.appendChild(item);
        container.scrollTop = container.scrollHeight;
    }

    async function getSellerSession() {
        const { data, error } = await window.supabaseClient.auth.getSession();
        if (error) throw error;
        if (!data?.session?.access_token) throw new Error("SESSION_REQUIRED");
        return data.session.access_token;
    }

    async function askCoach(message) {
        const token = await getSellerSession();
        const response = await fetch(COACH_FUNCTION_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                apikey: "sb_publishable_iv3rzG16WGv7e7DObdzCNw_dDs4VDM3"
            },
            body: JSON.stringify({ message })
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            if (response.status === 401) throw new Error("SESSION_REQUIRED");
            if (response.status === 403) throw new Error("ACCÈS_REFUSÉ");
            throw new Error(result?.error || "COACH_UNAVAILABLE");
        }

        if (typeof result.reply !== "string" || !result.reply.trim()) {
            throw new Error("Réponse vide du coach.");
        }

        return result.reply;
    }

    function bindCoachEvents() {
        const form = document.getElementById("sellerCoachForm");
        const input = document.getElementById("sellerCoachInput");

        if (!form || !input) return;

        form.addEventListener("submit", async event => {
            event.preventDefault();
            const message = input.value.trim();
            if (!message) return;

            addCoachMessage("user", message);
            input.value = "";
            input.disabled = true;
            addCoachMessage("assistant", "Je prépare une réponse personnalisée…");

            try {
                const reply = await askCoach(message);
                const last = document.querySelectorAll("#sellerCoachMessages > div");
                if (last.length) {
                    const statusMessage = last[last.length - 1];
                    statusMessage.textContent = reply;
                    statusMessage.style.background = "#f8fafc";
                    statusMessage.style.border = "1px solid #e2e8f0";
                    statusMessage.style.color = "#334155";
                    statusMessage.style.marginLeft = "0";
                }
            } catch (error) {
                const last = document.querySelectorAll("#sellerCoachMessages > div");
                const finalMessage = last[last.length - 1];
                if (finalMessage) {
                    finalMessage.textContent = error?.message === "SESSION_REQUIRED"
                        ? "Votre session a expiré. Reconnectez-vous pour continuer."
                        : error?.message === "ACCÈS_REFUSÉ"
                            ? "Ce coach est réservé aux comptes vendeurs."
                            : "Le coach vendeur est temporairement indisponible. Réessayez dans quelques instants.";
                    finalMessage.style.background = "#fff7ed";
                    finalMessage.style.border = "1px solid #fed7aa";
                    finalMessage.style.color = "#9a4d00";
                }
            } finally {
                input.disabled = false;
                input.focus();
            }
        });

        document.querySelectorAll(".seller-coach-prompt").forEach(button => {
            button.addEventListener("click", () => {
                const prompt = button.dataset.prompt;
                if (!prompt) return;
                const input = document.getElementById("sellerCoachInput");
                if (!input) return;
                input.value = prompt;
                input.focus();
                input.form?.requestSubmit();
            });
        });
    }

    function initSellerCoach() {
        if (!window.supabaseClient || !window.supabaseClient.auth) return;
        const panel = ensureCoachPanel();
        if (!panel) return;
        bindCoachEvents();
    }

    document.addEventListener("DOMContentLoaded", initSellerCoach);
    window.ZandoSellerCoach = { init: initSellerCoach };
})();
