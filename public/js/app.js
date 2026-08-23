/* =====================================================
   ZANDO — FRONTEND APPLICATION
===================================================== */

"use strict";
/* =====================================================
   SUPABASE
===================================================== */

const SUPABASE_URL =
    "https://kcrliiinrjlrcspnaeac.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_iv3rzG16WGv7e7DObdzCNw_dDs4VDM3";

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
    );

/* =====================================================
   SUPABASE — TEST CONNECTION
===================================================== */

async function testSupabaseConnection() {
    try {
        const { data, error } = await supabaseClient
            .from("products")
            .select("id, name, price, currency, status")
            .limit(5);

        if (error) {
            console.error("❌ Supabase:", error);
            return;
        }

        console.log("✅ Supabase connecté !");
        console.log("Produits:", data);

    } catch (error) {
        console.error("❌ Erreur connexion Supabase:", error);
    }
}

/* =====================================================
   PRODUCTS — SUPABASE
===================================================== */

async function loadSupabaseProducts() {

    if (!productsGrid) return;

    try {

        const { data, error } = await supabaseClient
            .from("products")
            .select(`
                id,
                name,
                description,
                price,
                compare_at_price,
                currency,
                stock_quantity,
                status,
                categories (
                    name
                ),
                stores (
                    name
                ),
                product_images (
                    image_url,
                    alt_text,
                    sort_order
                )
            `)
            .eq("status", "active")
            .order("created_at", {
                ascending: false
            });

        if (error) {
            console.error(
                "❌ Impossible de charger les produits Supabase :",
                error
            );
            return;
        }

        console.log(
            "✅ Produits Supabase chargés :",
            data
        );

        if (!data || data.length === 0) {
            console.log(
                "ℹ️ Aucun produit actif dans Supabase."
            );
            return;
        }

        renderSupabaseProducts(data);

    } catch (error) {

        console.error(
            "❌ Erreur chargement produits :",
            error
        );

    }

}


/* =====================================================
   RENDER SUPABASE PRODUCTS
===================================================== */

function renderSupabaseProducts(products) {

    if (!productsGrid) return;

    const html = products.map((product) => {

        const category =
            product.categories?.name ||
            "Autre";

        const currency =
            product.currency || "USD";

        const price =
            Number(product.price || 0);

        const oldPrice =
            product.compare_at_price
                ? Number(product.compare_at_price)
                : null;

        const image =
            product.product_images
                ?.sort(
                    (a, b) =>
                        a.sort_order - b.sort_order
                )[0];

        const imageHTML = image
            ? `
                <img
                    src="${escapeHTML(image.image_url)}"
                    alt="${escapeHTML(
                        image.alt_text ||
                        product.name
                    )}"
                    loading="lazy"
                >
            `
            : "📦";

        return `
            <article
                class="product-card"
                data-category="${escapeHTML(category)}"
                data-product-id="${escapeHTML(product.id)}"
            >

                <div class="product-card-image">

                    ${imageHTML}

                    <span class="product-badge">
                        Nouveau
                    </span>

                </div>

                <div class="product-card-body">

                    <small>
                        ${escapeHTML(category)}
                    </small>

                    <h3>
                        ${escapeHTML(product.name)}
                    </h3>

                    <div class="rating">
                        ⭐⭐⭐⭐⭐
                        <span>Produit Zando</span>
                    </div>

                    <div class="product-bottom">

                        <div>

                            <strong>
                                ${price.toFixed(2)}
                                ${escapeHTML(currency)}
                            </strong>

                            ${
                                oldPrice
                                    ? `
                                    <del>
                                        ${oldPrice.toFixed(2)}
                                        ${escapeHTML(currency)}
                                    </del>
                                    `
                                    : ""
                            }

                        </div>

                        <button
                            class="add-cart"
                            data-product-id="${escapeHTML(product.id)}"
                            data-product="${escapeHTML(product.name)}"
                            data-price="${price}"
                            data-currency="${escapeHTML(currency)}"
                        >
                            + 🛒
                        </button>

                    </div>

                </div>

            </article>
        `;

    }).join("");

    productsGrid.innerHTML = html;

    /*
     * Les boutons viennent d'être créés
     * dynamiquement. On doit donc
     * réattacher leurs événements.
     */

    setupCartButtons();

}

/* =====================================================
   AUTHENTICATION — SUPABASE
===================================================== */

async function getCurrentUser() {

    try {

        const {
            data: { user },
            error
        } = await supabaseClient.auth.getUser();

        if (error) {

            console.error(
                "❌ Erreur récupération utilisateur :",
                error
            );

            return null;
        }

        return user;

    } catch (error) {

        console.error(
            "❌ Erreur Auth Supabase :",
            error
        );

        return null;
    }
}


/* =====================================================
   AUTH STATE
===================================================== */

async function setupAuth() {

    const user = await getCurrentUser();

    if (user) {

        console.log(
            "✅ Utilisateur Zando connecté :",
            user.id
        );

    } else {

        console.log(
            "ℹ️ Aucun utilisateur Zando connecté."
        );

    }

    supabaseClient.auth.onAuthStateChange(
        (event, session) => {

            console.log(
                "🔐 Auth event :",
                event
            );

            if (session?.user) {

                console.log(
                    "✅ Session Zando active."
                );

            } else {

                console.log(
                    "ℹ️ Session Zando terminée."
                );

            }

        }
    );

}


/* =====================================================
   STATE
===================================================== */

const state = {
    cart: [],
    activeCategory: null
};


/* =====================================================
   DOM ELEMENTS
===================================================== */

const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");

const productsGrid = document.getElementById("productsGrid");
const emptyMessage = document.getElementById("emptyMessage");

const cartCount = document.getElementById("cartCount");

const modalOverlay = document.getElementById("modalOverlay");
const modalContent = document.getElementById("modalContent");
const modalClose = document.getElementById("modalClose");

const accountButton = document.getElementById("accountButton");
const cartButton = document.getElementById("cartButton");

const sellerButton = document.getElementById("sellerButton");

const currentYear = document.getElementById("currentYear");


/* =====================================================
   INITIALIZATION
===================================================== */

document.addEventListener("DOMContentLoaded", () => {

    loadCart();

    updateCartCounter();

    setupSearch();

    setupCategories();

    setupCartButtons();

    setupAccount();

    setupSeller();

    setupModal();

    updateYear();

    testSupabaseConnection();

    loadSupabaseProducts();

    setupAuth();

});


/* =====================================================
   YEAR
===================================================== */

function updateYear() {

    if (currentYear) {
        currentYear.textContent = new Date().getFullYear();
    }

}


/* =====================================================
   SEARCH
===================================================== */

function setupSearch() {

    if (!searchForm) return;

    searchForm.addEventListener("submit", (event) => {

        event.preventDefault();

        const query = searchInput.value
            .trim()
            .toLowerCase();

        filterProducts(query);

        document
            .getElementById("produits")
            ?.scrollIntoView({
                behavior: "smooth"
            });

    });

}


function filterProducts(query = "") {

    const products =
        productsGrid.querySelectorAll(".product-card");

    let visibleProducts = 0;

    products.forEach((product) => {

        const name =
            product.querySelector("h3")
                ?.textContent
                .toLowerCase() || "";

        const category =
            product.dataset.category
                ?.toLowerCase() || "";

        const matches =
            !query ||
            name.includes(query) ||
            category.includes(query);

        if (matches) {

            product.style.display = "";

            visibleProducts++;

        } else {

            product.style.display = "none";

        }

    });

    if (emptyMessage) {

        emptyMessage.style.display =
            visibleProducts === 0
                ? "block"
                : "none";

    }

}


/* =====================================================
   CATEGORIES
===================================================== */

function setupCategories() {

    const categoryButtons =
        document.querySelectorAll(".category-card");

    categoryButtons.forEach((button) => {

        button.addEventListener("click", () => {

            const category =
                button.dataset.category;

            state.activeCategory = category;

            filterByCategory(category);

        });

    });

}


function filterByCategory(category) {

    const products =
        productsGrid.querySelectorAll(".product-card");

    let visibleProducts = 0;

    products.forEach((product) => {

        const productCategory =
            product.dataset.category;

        if (productCategory === category) {

            product.style.display = "";

            visibleProducts++;

        } else {

            product.style.display = "none";

        }

    });

    if (emptyMessage) {

        emptyMessage.style.display =
            visibleProducts === 0
                ? "block"
                : "none";

    }

    document
        .getElementById("produits")
        ?.scrollIntoView({
            behavior: "smooth"
        });

}


/* =====================================================
   CART
===================================================== */

function setupCartButtons() {

    const buttons =
        document.querySelectorAll(".add-cart");

    buttons.forEach((button) => {

        button.addEventListener("click", () => {

            const product = {
                name: button.dataset.product,

                price: Number(button.dataset.price)
            };

            addToCart(product);

        });

    });

}


function addToCart(product) {

    const existing =
        state.cart.find(
            item => item.name === product.name
        );

    if (existing) {

        existing.quantity += 1;

    } else {

        state.cart.push({
            ...product,
            quantity: 1
        });

    }

    saveCart();

    updateCartCounter();

    showModal(
        `
        <div class="modal-success">
            <h2>Produit ajouté 🛒</h2>

            <p>
                <strong>${escapeHTML(product.name)}</strong>
                a été ajouté à votre panier.
            </p>

            <br>

            <button
                class="btn btn-primary"
                onclick="closeModal()"
            >
                Continuer mes achats
            </button>
        </div>
        `
    );

}


function updateCartCounter() {

    if (!cartCount) return;

    const total =
        state.cart.reduce(
            (sum, item) =>
                sum + item.quantity,
            0
        );

    cartCount.textContent = total;

}


/* =====================================================
   LOCAL STORAGE
===================================================== */

function saveCart() {

    try {

        localStorage.setItem(
            "zando_cart",
            JSON.stringify(state.cart)
        );

    } catch (error) {

        console.error(
            "Impossible de sauvegarder le panier.",
            error
        );

    }

}


function loadCart() {

    try {

        const saved =
            localStorage.getItem("zando_cart");

        if (saved) {

            state.cart =
                JSON.parse(saved);

        }

    } catch (error) {

        console.error(
            "Impossible de charger le panier.",
            error
        );

        state.cart = [];

    }

}


/* =====================================================
   CART MODAL
===================================================== */

cartButton?.addEventListener("click", () => {

    showCart();

});


function showCart() {

    if (state.cart.length === 0) {

        showModal(`
            <h2>Votre panier</h2>

            <p>
                Votre panier est actuellement vide.
            </p>

            <br>

            <button
                class="btn btn-primary"
                onclick="closeModal()"
            >
                Découvrir les produits
            </button>
        `);

        return;

    }


    const total =
        state.cart.reduce(
            (sum, item) =>
                sum + item.price * item.quantity,
            0
        );


    const itemsHTML =
        state.cart.map((item, index) => {

            return `
                <div
                    style="
                        display:flex;
                        justify-content:space-between;
                        gap:15px;
                        padding:12px 0;
                        border-bottom:1px solid #e5e7eb;
                    "
                >

                    <div>
                        <strong>
                            ${escapeHTML(item.name)}
                        </strong>

                        <br>

                        <small>
                            ${item.quantity} × ${item.price} $
                        </small>
                    </div>

                    <button
                        onclick="removeFromCart(${index})"
                        style="
                            border:0;
                            background:none;
                            color:#dc2626;
                        "
                    >
                        Supprimer
                    </button>

                </div>
            `;

        }).join("");


    showModal(`
        <h2>Votre panier</h2>

        <div>
            ${itemsHTML}
        </div>

        <div
            style="
                display:flex;
                justify-content:space-between;
                margin-top:20px;
                font-size:20px;
                font-weight:800;
            "
        >
            <span>Total</span>

            <span>${total.toFixed(2)} $</span>
        </div>

        <br>

        <button
            class="btn btn-primary"
            style="width:100%"
            onclick="checkout()"
        >
            Passer la commande
        </button>
    `);

}


function removeFromCart(index) {

    state.cart.splice(index, 1);

    saveCart();

    updateCartCounter();

    showCart();

}


function checkout() {

    showModal(`
        <h2>Commande</h2>

        <p>
            Le système de commande et de paiement
            sera connecté à Supabase dans la prochaine
            étape du développement de Zando.
        </p>

        <br>

        <button
            class="btn btn-primary"
            onclick="closeModal()"
        >
            Fermer
        </button>
    `);

}


/* =====================================================
   ACCOUNT — SUPABASE AUTH
===================================================== */

async function setupAccount() {

    if (!accountButton) return;

    accountButton.addEventListener("click", async () => {

        const user = await getCurrentUser();

        if (user) {

            const email =
                user.email || "Utilisateur Zando";

            showModal(`
                <h2>Mon compte 👤</h2>

                <p>
                    Connecté avec :
                </p>

                <strong>
                    ${escapeHTML(email)}
                </strong>

                <br><br>

                <button
                    class="btn btn-primary"
                    style="width:100%"
                    onclick="logoutZando()"
                >
                    Se déconnecter
                </button>
            `);

            return;
        }

        showLoginForm();

    });

}


/* =====================================================
   LOGIN FORM
===================================================== */

function showLoginForm() {

    showModal(`
        <h2>Connexion à Zando 👋</h2>

        <p>
            Connectez-vous à votre compte Zando.
        </p>

        <form id="loginForm">

            <label>
                Adresse e-mail
            </label>

            <input
                type="email"
                id="loginEmail"
                required
                autocomplete="email"
                placeholder="vous@exemple.com"
                style="
                    width:100%;
                    padding:12px;
                    margin:8px 0 15px;
                    border:1px solid #d1d5db;
                    border-radius:8px;
                "
            >

            <label>
                Mot de passe
            </label>

            <input
                type="password"
                id="loginPassword"
                required
                autocomplete="current-password"
                placeholder="Votre mot de passe"
                style="
                    width:100%;
                    padding:12px;
                    margin:8px 0 15px;
                    border:1px solid #d1d5db;
                    border-radius:8px;
                "
            >

            <button
                type="submit"
                class="btn btn-primary"
                style="width:100%"
            >
                Se connecter
            </button>

        </form>

        <p
            id="loginMessage"
            style="margin-top:15px;"
        ></p>
    `);

    const form =
        document.getElementById("loginForm");

    form?.addEventListener(
        "submit",
        loginZando
    );

}


/* =====================================================
   LOGIN
===================================================== */

async function loginZando(event) {

    event.preventDefault();

    const email =
        document
            .getElementById("loginEmail")
            ?.value
            .trim();

    const password =
        document
            .getElementById("loginPassword")
            ?.value;

    const message =
        document.getElementById("loginMessage");

    if (!email || !password) return;

    if (message) {

        message.textContent =
            "Connexion en cours...";

    }

    const {
        data,
        error
    } = await supabaseClient.auth.signInWithPassword({
        email,
        password
    });

    if (error) {

        console.error(
            "❌ Connexion :",
            error
        );

        if (message) {

            message.textContent =
                "❌ E-mail ou mot de passe incorrect.";

        }

        return;
    }

    console.log(
        "✅ Connexion réussie :",
        data.user.id
    );

    closeModal();

    showModal(`
        <div class="modal-success">

            <h2>Bienvenue sur Zando 🎉</h2>

            <p>
                Vous êtes maintenant connecté.
            </p>

            <button
                class="btn btn-primary"
                onclick="closeModal()"
            >
                Continuer
            </button>

        </div>
    `);

}


/* =====================================================
   LOGOUT
===================================================== */

async function logoutZando() {

    const {
        error
    } = await supabaseClient.auth.signOut();

    if (error) {

        console.error(
            "❌ Déconnexion :",
            error
        );

        return;
    }

    closeModal();

    showModal(`
        <h2>À bientôt 👋</h2>

        <p>
            Vous êtes maintenant déconnecté.
        </p>

        <button
            class="btn btn-primary"
            onclick="closeModal()"
        >
            Fermer
        </button>
    `);

}


/* =====================================================
   SELLER
===================================================== */

function setupSeller() {

    sellerButton?.addEventListener("click", () => {

        showModal(`
            <h2>Devenir vendeur 🏪</h2>

            <p>
                Votre espace vendeur permettra de créer
                une boutique, ajouter des produits,
                gérer les commandes et suivre vos ventes.
            </p>

            <br>

            <button
                class="btn btn-primary"
                onclick="closeModal()"
            >
                Compris
            </button>
        `);

    });

}


/* =====================================================
   MODAL
===================================================== */

function setupModal() {

    modalClose?.addEventListener(
        "click",
        closeModal
    );


    modalOverlay?.addEventListener(
        "click",
        (event) => {

            if (
                event.target === modalOverlay
            ) {

                closeModal();

            }

        }
    );


    document.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key === "Escape" &&
                modalOverlay.classList.contains("active")
            ) {

                closeModal();

            }

        }
    );

}


function showModal(content) {

    if (!modalOverlay || !modalContent) {
        return;
    }

    modalContent.innerHTML = content;

    modalOverlay.classList.add("active");

    document.body.style.overflow = "hidden";

}


function closeModal() {

    modalOverlay?.classList.remove("active");

    document.body.style.overflow = "";

}


/* =====================================================
   SECURITY HELPER
===================================================== */

function escapeHTML(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/* =====================================================
   GLOBAL FUNCTIONS
===================================================== */

window.closeModal = closeModal;

window.removeFromCart = removeFromCart;

window.checkout = checkout;

window.logoutZando = logoutZando;
