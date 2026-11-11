/* =====================================================
   ZANDO — ASSISTANT DE CANDIDATURE VENDEUR
   5 étapes, brouillons privés et soumission sécurisée
===================================================== */

(() => {
    const categories = [
        "Mode",
        "Électronique",
        "Maison",
        "Beauté",
        "Alimentation",
        "Services"
    ];

    const steps = [
        "Identité",
        "Boutique",
        "Localisation",
        "Documents",
        "Paiement"
    ];

    const documentFields = [
        ["identite", "Pièce d'identité"],
        ["rccm", "Document RCCM"],
        ["idnat", "Document ID NAT"],
        ["nif", "Document NIF"],
        ["patente", "Document patente"],
        ["autres", "Autres justificatifs"]
    ];

    window.openSellerWizard = async function (client, user) {
        if (!client || !user) {
            alert("Connexion requise pour continuer.");
            return;
        }

        let currentStep = 1;
        let docs = {};
        let saving = false;

        const defaults = {
            pid_type: "",
            pid_num: "",
            boutique: "",
            categorie: "",
            niveau: "verifie",
            commune: "",
            quartier: "",
            adresse: "",
            lat: "",
            lng: "",
            rccm: "",
            idnat: "",
            nif: "",
            patente: "",
            importateur: false,
            momo_operateur: "",
            momo_numero: "",
            momo_titulaire: "",
            banque: ""
        };

        let values = { ...defaults };

        const esc = value => String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

        const field = (label, name, options = {}) => {
            const value = values[name] ?? "";
            const required = options.required ? "required" : "";
            const placeholder = options.placeholder || "";
            const type = options.type || "text";

            return `
                <label class="seller-wizard-field">
                    <span>${label}${options.required ? " *" : ""}</span>
                    <input
                        type="${type}"
                        name="${name}"
                        value="${esc(value)}"
                        placeholder="${esc(placeholder)}"
                        ${required}
                        ${options.maxlength ? `maxlength="${options.maxlength}"` : ""}
                    >
                </label>
            `;
        };

        const selectField = (label, name, options, required = false) => `
            <label class="seller-wizard-field">
                <span>${label}${required ? " *" : ""}</span>
                <select name="${name}" ${required ? "required" : ""}>
                    <option value="">Choisir...</option>
                    ${options.map(option => `
                        <option value="${esc(option.value)}"
                            ${values[name] === option.value ? "selected" : ""}>
                            ${esc(option.label)}
                        </option>
                    `).join("")}
                </select>
            </label>
        `;

        const documentInput = ([key, label]) => `
            <div class="seller-wizard-document">
                <label class="seller-wizard-field">
                    <span>${label}</span>
                    <input
                        type="file"
                        name="file_${key}"
                        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    >
                </label>
                <small id="doc-status-${key}">
                    ${docs[key] ? "Document déjà enregistré ✓" : "PDF, JPG ou PNG — 5 Mo maximum"}
                </small>
            </div>
        `;

        const render = () => {
            const panels = [
                `
                <h3>1. Identité du demandeur</h3>
                <p>Renseignez les informations de la personne qui demande à devenir vendeur.</p>
                ${selectField("Type de pièce d'identité", "pid_type", [
                    {value:"carte_identite",label:"Carte d'identité"},
                    {value:"passeport",label:"Passeport"},
                    {value:"permis",label:"Permis de conduire"},
                    {value:"electeur",label:"Carte d'électeur"},
                    {value:"autre",label:"Autre document"}
                ], true)}
                ${field("Numéro de la pièce", "pid_num", {required:true, maxlength:100})}
                ${documentInput(documentFields[0])}
                `,
                `
                <h3>2. Informations de la boutique</h3>
                <p>Présentez votre activité commerciale sur Zando.</p>
                ${field("Nom de la boutique", "boutique", {required:true, maxlength:100, placeholder:"Ex. Ange Fashion"})}
                ${selectField("Catégorie principale", "categorie",
                    categories.map(c => ({value:c,label:c})), true)}
                ${selectField("Niveau de vérification souhaité", "niveau", [
                    {value:"verifie",label:"Vendeur vérifié"},
                    {value:"certifie",label:"Vendeur certifié"}
                ], true)}
                <p class="seller-wizard-note">
                    Le niveau demandé sera examiné par l'équipe Zando.
                </p>
                `,
                `
                <h3>3. Localisation de la boutique</h3>
                <p>Indiquez où se trouve votre commerce.</p>
                ${field("Commune", "commune", {required:true, placeholder:"Ex. Gombe"})}
                ${field("Quartier", "quartier", {required:true})}
                ${field("Adresse complète", "adresse", {required:true, maxlength:300})}
                ${field("Latitude GPS", "lat", {type:"number", placeholder:"Ex. -4.325"})}
                ${field("Longitude GPS", "lng", {type:"number", placeholder:"Ex. 15.322"})}
                <p class="seller-wizard-note">
                    Les coordonnées GPS sont facultatives. Elles faciliteront la localisation.
                </p>
                `,
                `
                <h3>4. Informations légales et justificatifs</h3>
                <p>Renseignez les documents administratifs disponibles pour votre activité.</p>
                ${field("Numéro RCCM", "rccm")}
                ${documentInput(documentFields[1])}
                ${field("Numéro ID NAT", "idnat")}
                ${documentInput(documentFields[2])}
                ${field("Numéro NIF", "nif")}
                ${documentInput(documentFields[3])}
                ${field("Numéro de patente", "patente")}
                ${documentInput(documentFields[4])}
                <label class="seller-wizard-check">
                    <input type="checkbox" name="importateur"
                        ${values.importateur ? "checked" : ""}>
                    Mon activité comprend l'importation de marchandises.
                </label>
                ${documentInput(documentFields[5])}
                `,
                `
                <h3>5. Paiement et coordonnées financières</h3>
                <p>Ces informations permettront de préparer la gestion des paiements vendeurs.</p>
                ${selectField("Opérateur Mobile Money", "momo_operateur", [
                    {value:"M-Pesa",label:"M-Pesa"},
                    {value:"Orange Money",label:"Orange Money"},
                    {value:"Airtel Money",label:"Airtel Money"},
                    {value:"Afrimoney",label:"Afrimoney"},
                    {value:"Autre",label:"Autre"}
                ], true)}
                ${field("Numéro Mobile Money", "momo_numero", {required:true, placeholder:"+243..."})}
                ${field("Nom du titulaire Mobile Money", "momo_titulaire", {required:true})}
                ${field("Informations bancaires (banque, compte et titulaire)", "banque", {
                    placeholder:"Facultatif — Banque, numéro de compte, titulaire"
                })}
                <div class="seller-wizard-review">
                    <h4>Confirmation de la candidature</h4>
                    <p>
                        Vérifiez les informations des cinq rubriques.
                        La candidature sera transmise à l'administration
                        uniquement après votre confirmation.
                    </p>
                    <label class="seller-wizard-check">
                        <input type="checkbox" id="sellerFinalConfirm">
                        Je confirme l'exactitude des informations et autorise
                        leur transmission à l'équipe Zando.
                    </label>
                </div>
                `
            ];

            const html = `
                <div class="seller-wizard">
                    <div class="seller-wizard-header">
                        <h2>Devenir vendeur sur Zando 🏪</h2>
                        <p>Complétez les cinq étapes de votre candidature.</p>
                        <div class="seller-wizard-progress">
                            <div class="seller-wizard-progress-bar"
                                style="width:${currentStep * 20}%"></div>
                        </div>
                        <div class="seller-wizard-steps">
                            ${steps.map((name, index) => `
                                <div class="seller-wizard-step ${
                                    index + 1 === currentStep ? "active" :
                                    index + 1 < currentStep ? "done" : ""
                                }">
                                    <span>${index + 1}</span>${name}
                                </div>
                            `).join("")}
                        </div>
                    </div>

                    <form id="sellerWizardForm" novalidate>
                        ${panels.map((panel, index) => `
                            <section class="seller-wizard-panel"
                                data-step="${index + 1}"
                                ${index + 1 !== currentStep ? "hidden" : ""}>
                                ${panel}
                            </section>
                        `).join("")}

                        <p id="sellerWizardMessage" role="status"></p>

                        <div class="seller-wizard-actions">
                            <button type="button" class="btn btn-secondary"
                                id="sellerWizardPrevious"
                                ${currentStep === 1 ? "disabled" : ""}>
                                ← Précédent
                            </button>

                            <button type="button" class="btn btn-secondary"
                                id="sellerWizardSave">
                                Enregistrer le brouillon
                            </button>

                            ${currentStep < 5 ? `
                                <button type="button" class="btn btn-primary"
                                    id="sellerWizardNext">
                                    Suivant →
                                </button>
                            ` : `
                                <button type="submit" class="btn btn-primary"
                                    id="sellerWizardSubmit">
                                    Confirmer et envoyer
                                </button>
                            `}
                        </div>
                    </form>
                </div>
            `;

            if (typeof window.showModal === "function") {
                window.showModal(html);
            } else {
                const overlay = document.getElementById("modalOverlay");
                const content = document.getElementById("modalContent");
                if (!overlay || !content) return;
                content.innerHTML = html;
                overlay.classList.add("active");
                document.body.style.overflow = "hidden";
            }

            document.querySelector("#modalOverlay .modal")
                ?.classList.add("seller-wizard-modal");

            bindEvents();
        };

        const collectValues = () => {
            const form = document.getElementById("sellerWizardForm");
            if (!form) return;

            const data = new FormData(form);

            for (const key of Object.keys(defaults)) {
                const element = form.elements.namedItem(key);
                if (!element) continue;
                values[key] = element.type === "checkbox"
                    ? element.checked
                    : element.value.trim();
            }

            values.importateur =
                form.elements.namedItem("importateur")?.checked || false;

            return data;
        };

        const uploadSelectedFiles = async () => {
            const form = document.getElementById("sellerWizardForm");
            if (!form) return;

            for (const [key, label] of documentFields) {
                const input = form.elements.namedItem("file_" + key);
                const file = input?.files?.[0];

                if (!file) continue;

                const allowed = [
                    "application/pdf",
                    "image/jpeg",
                    "image/png"
                ];

                if (!allowed.includes(file.type)) {
                    throw new Error(label + " : format non autorisé.");
                }

                if (file.size > 5 * 1024 * 1024) {
                    throw new Error(label + " : le fichier dépasse 5 Mo.");
                }

                const extension = file.name.split(".").pop()
                    .toLowerCase().replace(/[^a-z0-9]/g, "");

                const safeName = file.name
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/[^a-zA-Z0-9._-]/g, "_")
                    .slice(-70);

                const path = `${user.id}/${key}-${Date.now()}-${safeName || "document"}`;

                const { error } = await client.storage
                    .from("seller-docs")
                    .upload(path, file, {
                        contentType: file.type,
                        upsert: false
                    });

                if (error) throw error;

                docs[key] = path;

                const status = document.getElementById("doc-status-" + key);
                if (status) status.textContent = "Document enregistré ✓";
                input.value = "";
            }
        };

        const makePayload = () => ({
            pid_type: values.pid_type || null,
            pid_num: values.pid_num || null,
            boutique: values.boutique || null,
            categorie: values.categorie || null,
            niveau: values.niveau || "verifie",
            commune: values.commune || null,
            quartier: values.quartier || null,
            adresse: values.adresse || null,
            lat: values.lat === "" ? null : Number(values.lat),
            lng: values.lng === "" ? null : Number(values.lng),
            rccm: values.rccm || null,
            idnat: values.idnat || null,
            nif: values.nif || null,
            patente: values.patente || null,
            importateur: Boolean(values.importateur),
            momo_operateur: values.momo_operateur || null,
            momo_numero: values.momo_numero || null,
            momo_titulaire: values.momo_titulaire || null,
            banque: values.banque || null,
            docs: { ...docs }
        });

        const saveDraft = async () => {
            if (saving) return;
            saving = true;
            const message = document.getElementById("sellerWizardMessage");

            try {
                collectValues();
                await uploadSelectedFiles();

                const { error } = await client
                    .from("seller_application_drafts")
                    .upsert({
                        user_id: user.id,
                        payload: {
                            ...values,
                            docs: { ...docs }
                        },
                        current_step: currentStep,
                        updated_at: new Date().toISOString()
                    }, { onConflict: "user_id" });

                if (error) throw error;

                if (message) {
                    message.textContent = "✓ Brouillon enregistré. Vous pourrez reprendre plus tard.";
                }
            } catch (error) {
                console.error("Sauvegarde du brouillon :", error);
                if (message) message.textContent = "Erreur : " + error.message;
            } finally {
                saving = false;
            }
        };

        const loadDraft = async () => {
            const { data, error } = await client
                .from("seller_application_drafts")
                .select("payload,current_step")
                .eq("user_id", user.id)
                .maybeSingle();

            if (error) throw error;

            if (data?.payload) {
                values = { ...defaults, ...data.payload };
                docs = data.payload.docs || {};
                currentStep = Math.min(5, Math.max(1, Number(data.current_step) || 1));
            }
        };

        const validateCurrentStep = () => {
            const panel = document.querySelector(
                `.seller-wizard-panel[data-step="${currentStep}"]`
            );
            if (!panel) return true;

            const inputs = [...panel.querySelectorAll("input,select,textarea")];
            for (const input of inputs) {
                if (input.type === "file" || input.type === "checkbox") continue;
                if (!input.checkValidity()) {
                    input.reportValidity();
                    return false;
                }
            }

            if (currentStep === 1 && !docs.identite) {
                const file = panel.querySelector('[name="file_identite"]')?.files?.[0];
                if (!file) {
                    const message = document.getElementById("sellerWizardMessage");
                    if (message) message.textContent =
                        "Veuillez joindre une pièce d'identité avant de continuer.";
                    return false;
                }
            }

            return true;
        };

        const validateAllSteps = () => {
            const requiredFields = [
                { step: 1, name: "pid_type" },
                { step: 1, name: "pid_num" },
                { step: 2, name: "boutique" },
                { step: 2, name: "categorie" },
                { step: 2, name: "niveau" },
                { step: 3, name: "commune" },
                { step: 3, name: "quartier" },
                { step: 3, name: "adresse" },
                { step: 5, name: "momo_operateur" },
                { step: 5, name: "momo_numero" },
                { step: 5, name: "momo_titulaire" }
            ];

            for (const field of requiredFields) {
                if (!String(values[field.name] || "").trim()) {
                    currentStep = field.step;
                    render();

                    const input = document.querySelector(
                        `.seller-wizard-panel[data-step="${field.step}"] [name="${field.name}"]`
                    );

                    if (input) input.reportValidity();

                    const message = document.getElementById("sellerWizardMessage");
                    if (message) message.textContent =
                        "Veuillez compléter les champs obligatoires avant l'envoi.";

                    return false;
                }
            }

            if (!docs.identite) {
                currentStep = 1;
                render();

                const message = document.getElementById("sellerWizardMessage");
                if (message) message.textContent =
                    "Veuillez joindre une pièce d'identité avant l'envoi.";

                return false;
            }

            return true;
        };

        const bindEvents = () => {
            const form = document.getElementById("sellerWizardForm");
            if (!form) return;

            form.addEventListener("input", collectValues);
            form.addEventListener("change", collectValues);

            document.getElementById("sellerWizardPrevious")
                ?.addEventListener("click", () => {
                    collectValues();
                    currentStep = Math.max(1, currentStep - 1);
                    render();
                });

            document.getElementById("sellerWizardNext")
                ?.addEventListener("click", async () => {
                    if (saving || !validateCurrentStep()) return;

                    saving = true;
                    const message = document.getElementById("sellerWizardMessage");

                    try {
                        collectValues();
                        await uploadSelectedFiles();

                        currentStep = Math.min(5, currentStep + 1);
                        render();
                    } catch (error) {
                        console.error("Enregistrement des documents :", error);
                        if (message) {
                            message.textContent = "Erreur : " + error.message;
                        }
                    } finally {
                        saving = false;
                    }
                });

            document.getElementById("sellerWizardSave")
                ?.addEventListener("click", saveDraft);

            form.addEventListener("submit", async event => {
                event.preventDefault();
                if (saving) return;

                collectValues();

                if (!validateAllSteps()) return;

                const confirmBox = document.getElementById("sellerFinalConfirm");
                if (!confirmBox?.checked) {
                    document.getElementById("sellerWizardMessage").textContent =
                        "Veuillez cocher la confirmation avant l'envoi.";
                    return;
                }

                if (!window.confirm(
                    "Confirmez-vous l'envoi définitif de votre candidature vendeur à Zando ?"
                )) return;

                saving = true;
                const message = document.getElementById("sellerWizardMessage");
                const submit = document.getElementById("sellerWizardSubmit");
                if (submit) submit.disabled = true;
                if (message) message.textContent = "Envoi de votre candidature...";

                try {
                    await uploadSelectedFiles();

                    const payload = makePayload();

                    const { data, error } = await client.rpc(
                        "submit_seller_application",
                        { p: payload }
                    );

                    if (error) throw error;

                    const { error: deleteError } = await client
                        .from("seller_application_drafts")
                        .delete()
                        .eq("user_id", user.id);

                    if (deleteError) {
                        console.warn("Candidature envoyée, brouillon non supprimé :", deleteError);
                    }

                    if (typeof window.closeModal === "function") {
                        window.closeModal();
                    }

                    if (typeof window.showModal === "function") {
                        window.showModal(`
                            <div class="modal-success">
                                <h2>Candidature envoyée ! 🎉</h2>
                                <p>Votre demande pour la boutique
                                <strong>${esc(values.boutique)}</strong>
                                a été transmise à l'équipe Zando.</p>
                                <p>Vous pourrez suivre son examen depuis les communications de Zando.</p>
                                <button class="btn btn-primary" onclick="closeModal()">Continuer</button>
                            </div>
                        `);
                    }

                    console.log("Candidature vendeur enregistrée :", data);

                } catch (error) {
                    console.error("Soumission candidature vendeur :", error);
                    if (message) message.textContent =
                        "Échec de l'envoi : " + (error.message || "Erreur inconnue.");
                    if (submit) submit.disabled = false;
                } finally {
                    saving = false;
                }
            });
        };

        try {
            await loadDraft();
            render();
        } catch (error) {
            console.error("Chargement du brouillon vendeur :", error);
            alert("Impossible de charger votre candidature : " + error.message);
        }
    };
})();
