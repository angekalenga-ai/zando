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
        SUPABASE_PUBLISHABLE_KEY,
        {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        }
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
   SUPABASE CART
===================================================== */

async function addProductToSupabaseCart(
    productId,
    productName
) {

    const user = await getCurrentUser();

    if (!user) {

        showModal(`
            <h2>Connexion nécessaire 👤</h2>

            <p>
                Connectez-vous à votre compte
                pour ajouter des produits à votre panier.
            </p>

            <br>

            <button
                class="btn btn-primary"
                onclick="closeModal()"
            >
                Fermer
            </button>
        `);

        return;
    }

    try {

        /*
         * Récupérer le panier de l'utilisateur.
         */

        const {
            data: cart,
            error: cartError
        } = await supabaseClient
            .from("carts")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (cartError) {
            throw cartError;
        }

        if (!cart) {

            console.error(
                "❌ Panier utilisateur introuvable."
            );

            showModal(`
                <h2>Panier indisponible</h2>

                <p>
                    Impossible de récupérer votre panier.
                    Veuillez réessayer.
                </p>

                <br>

                <button
                    class="btn btn-primary"
                    onclick="closeModal()"
                >
                    Fermer
                </button>
            `);

            return;
        }

        /*
         * Vérifier si le produit existe déjà
         * dans le panier.
         */

        const {
            data: existingItem,
            error: itemError
        } = await supabaseClient
            .from("cart_items")
            .select("id, quantity")
            .eq("cart_id", cart.id)
            .eq("product_id", productId)
            .maybeSingle();

        if (itemError) {
            throw itemError;
        }

        if (existingItem) {

            const newQuantity =
                existingItem.quantity + 1;

            const {
                error: updateError
            } = await supabaseClient
                .from("cart_items")
                .update({
                    quantity: newQuantity
                })
                .eq("id", existingItem.id);

            if (updateError) {
                throw updateError;
            }

        } else {

            const {
                error: insertError
            } = await supabaseClient
                .from("cart_items")
                .insert({
                    cart_id: cart.id,
                    product_id: productId,
                    quantity: 1
                });

            if (insertError) {
                throw insertError;
            }

        }

        console.log(
            "✅ Produit ajouté au panier Supabase :",
            productId
        );

        /*
         * Conserver temporairement le panier local
         * pour l'affichage du compteur existant.
         */

        const {
    data: productData,
    error: productDataError
} = await supabaseClient
    .from("products")
    .select("id, name, price, currency, store_id")
    .eq("id", productId)
    .single();

if (productDataError) {
    throw productDataError;
}

const localProduct = {
    id: productData.id,
    name: productData.name,
    store_id: productData.store_id,
    price: Number(productData.price || 0),
    currency: productData.currency || "USD"
};

        const existingLocal =
            state.cart.find(
                item => item.id === productId
            );

        if (existingLocal) {

            existingLocal.quantity += 1;

        } else {

            state.cart.push({
                ...localProduct,
                quantity: 1
            });

        }


        updateCartCounter();

        showModal(`
            <div class="modal-success">

                <h2>Produit ajouté 🛒</h2>

                <p>
                    <strong>
                        ${escapeHTML(productName)}
                    </strong>
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
        `);

    } catch (error) {

        console.error(
            "❌ Erreur panier Supabase :",
            error
        );

        showModal(`
            <h2>Erreur</h2>

            <p>
                Impossible d'ajouter ce produit
                au panier.
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

        await loadCartFromSupabase();

        updateCartCounter();

    } else {

        console.log(
            "ℹ️ Aucun utilisateur Zando connecté."
        );

        state.cart = [];

        updateCartCounter();

    }

    supabaseClient.auth.onAuthStateChange(
        async (event, session) => {

            console.log(
                "🔐 Auth event :",
                event
            );

            if (session?.user) {

                console.log(
                    "✅ Session Zando active."
                );

                await loadCartFromSupabase();

                updateCartCounter();

            } else {

                console.log(
                    "ℹ️ Session Zando terminée."
                );

                state.cart = [];

                updateCartCounter();

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

    loadCartFromSupabase();

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

        // Évite d'attacher deux fois le même événement
        if (button.dataset.cartReady === "true") {
            return;
        }

        button.dataset.cartReady = "true";

        button.addEventListener("click", async () => {

            const productId =
                button.dataset.productId;

            const productName =
                button.dataset.product;

            if (!productId) {

                console.error(
                    "❌ ID produit Supabase manquant."
                );

                return;
            }

            await addProductToSupabaseCart(
                productId,
                productName
            );

        });

    });

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

async function loadCartFromSupabase() {

    try {

        const user = await getCurrentUser();

        if (!user) {

            state.cart = [];

            updateCartCounter();

            console.log(
                "ℹ️ Aucun utilisateur connecté : panier Supabase non chargé."
            );

            return;

        }

        const {
            data: cart,
            error: cartError
        } = await supabaseClient
            .from("carts")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (cartError) {
            throw cartError;
        }

        if (!cart) {

            state.cart = [];

            updateCartCounter();

            console.log(
                "ℹ️ Aucun panier Supabase trouvé pour cet utilisateur."
            );

            return;

        }

        const {
            data: items,
            error: itemsError
        } = await supabaseClient
            .from("cart_items")
            .select(`
                id,
                product_id,
                quantity,
                products (
                    id,
                    name,
                    price,
                    currency,
                    store_id
                )
            `)
            .eq("cart_id", cart.id);

        if (itemsError) {
            throw itemsError;
        }

        state.cart = (items || [])
            .filter(item => item.products)
            .map(item => ({
                id: item.products.id,
                name: item.products.name,
                store_id: item.products.store_id,
                price: Number(item.products.price || 0),
                currency: item.products.currency || "USD",
                quantity: Number(item.quantity || 0)
            }));

        updateCartCounter();

        console.log(
            "✅ Panier chargé depuis Supabase :",
            state.cart
        );

    } catch (error) {

        console.error(
            "❌ Impossible de charger le panier Supabase :",
            error
        );

        state.cart = [];

        updateCartCounter();

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


async function removeFromCart(index) {

    try {

        const item = state.cart[index];

        if (!item) {
            return;
        }

        const user = await getCurrentUser();

        if (!user) {

            console.error(
                "❌ Utilisateur non connecté."
            );

            return;
        }

        const {
            data: cart,
            error: cartError
        } = await supabaseClient
            .from("carts")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (cartError) {
            throw cartError;
        }

        if (!cart) {

            console.error(
                "❌ Panier Supabase introuvable."
            );

            return;
        }

        const {
            error: deleteError
        } = await supabaseClient
            .from("cart_items")
            .delete()
            .eq("cart_id", cart.id)
            .eq("product_id", item.id);

        if (deleteError) {
            throw deleteError;
        }

        state.cart.splice(index, 1);

        updateCartCounter();

        console.log(
            "✅ Produit supprimé du panier Supabase :",
            item.id
        );

        showCart();

    } catch (error) {

        console.error(
            "❌ Erreur suppression panier Supabase :",
            error
        );

    }

}


async function checkout() {

    if (!state.cart.length) {

        showModal(`
            <h2>Panier vide 🛒</h2>
            <p>Ajoutez au moins un produit avant de passer la commande.</p>
            <br>
            <button
                class="btn btn-primary"
                onclick="closeModal()"
            >
                Fermer
            </button>
        `);

        return;
    }

    const user = await getCurrentUser();

    if (!user) {

        showModal(`
            <h2>Connexion nécessaire 👤</h2>
            <p>Connectez-vous pour passer votre commande.</p>
            <br>
            <button
                class="btn btn-primary"
                onclick="closeModal()"
            >
                Fermer
            </button>
        `);

        return;
    }

    try {

        const subtotal = state.cart.reduce(
            (sum, item) =>
                sum + Number(item.price || 0) * Number(item.quantity || 0),
            0
        );

        const currency =
            state.cart[0]?.currency || "USD";

        const shippingFee = 0;

        const total =
            subtotal + shippingFee;

        const {
            data: order,
            error: orderError
        } = await supabaseClient
            .from("orders")
            .insert({
                user_id: user.id,
                status: "pending",
                payment_status: "pending",
                currency: currency,
                subtotal: subtotal,
                shipping_fee: shippingFee,
                total: total
            })
            .select("id")
            .single();

        if (orderError) {
            throw orderError;
        }

        const orderItems = state.cart.map(item => ({
            order_id: order.id,
            product_id: item.id,
            store_id: item.store_id,
            product_name: item.name,
            unit_price: Number(item.price || 0),
            quantity: Number(item.quantity || 0),
            line_total:
                Number(item.price || 0) *
                Number(item.quantity || 0)
        }));

        const {
            error: itemsError
        } = await supabaseClient
            .from("order_items")
            .insert(orderItems);

        if (itemsError) {
            throw itemsError;
        }

        console.log(
            "✅ Commande Zando créée :",
            order.id
        );

        state.cart = [];

        updateCartCounter();

        showModal(`
            <div class="modal-success">

                <h2>Commande enregistrée 🎉</h2>

                <p>
                    Votre commande a été enregistrée
                    avec succès.
                </p>

                <p>
                    <strong>
                        Total : ${total.toFixed(2)} ${escapeHTML(currency)}
                    </strong>
                </p>

                <p>
                    Référence :
                    <strong>${escapeHTML(order.id)}</strong>
                </p>

                <br>

                <button
                    class="btn btn-primary"
                    onclick="closeModal()"
                >
                    Continuer
                </button>

            </div>
        `);

    } catch (error) {

        console.error(
            "❌ Erreur création commande Zando :",
            error
        );

        showModal(`
            <h2>Erreur de commande ❌</h2>

            <p>
                Impossible d'enregistrer votre commande.
            </p>

            <p>
                Veuillez réessayer.
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

}

/* =====================================================
   ACCOUNT — SUPABASE AUTH
===================================================== */

async function setupAccount() {

    if (!accountButton) return;

    accountButton.addEventListener("click", async () => {

        const user = await getCurrentUser();

        if (!user) {
            showLoginForm();
            return;
        }

        try {

            const {
                data: profile,
                error
            } = await supabaseClient
                .from("profiles")
                .select("full_name, phone, role")
                .eq("id", user.id)
                .maybeSingle();

            if (error) {
                throw error;
            }

            const name =
                profile?.full_name || "";

            const phone =
                profile?.phone || "";

            const role =
                profile?.role || "customer";

            showAccountView(
                user.email || "Utilisateur Zando",
                name,
                phone,
                role
            );

        } catch (error) {

            console.error(
                "❌ Erreur chargement profil :",
                error
            );

            showModal(`
                <h2>Mon compte 👤</h2>

                <p>
                    Impossible de charger vos informations.
                </p>

                <p style="color:#dc2626;">
                    ${escapeHTML(error.message || "Erreur inconnue.")}
                </p>

                <button
                    class="btn btn-primary"
                    style="width:100%;"
                    onclick="closeModal()"
                >
                    Fermer
                </button>
            `);

        }

    });

}


function showAccountView(email, name, phone, role) {

    const roleLabel =
        role === "seller"
            ? "Vendeur"
            : role === "admin"
                ? "Administrateur"
                : "Client";

    showModal(`
        <h2>Mon compte 👤</h2>

        <p style="color:#64748b;">
            Gérez vos informations personnelles.
        </p>

        <div style="
            margin-top:18px;
            padding:16px;
            background:#f8fafc;
            border-radius:12px;
        ">

            <label style="
                display:block;
                font-weight:700;
                margin-bottom:6px;
            ">
                Nom complet
            </label>

            <input
                type="text"
                id="accountName"
                value="${escapeHTML(name)}"
                placeholder="Votre nom complet"
                style="
                    width:100%;
                    box-sizing:border-box;
                    padding:12px;
                    border:1px solid #d1d5db;
                    border-radius:9px;
                    margin-bottom:15px;
                "
            >

            <label style="
                display:block;
                font-weight:700;
                margin-bottom:6px;
            ">
                Numéro de téléphone
            </label>

            <input
                type="tel"
                id="accountPhone"
                value="${escapeHTML(phone)}"
                placeholder="+243 8XX XXX XXX"
                style="
                    width:100%;
                    box-sizing:border-box;
                    padding:12px;
                    border:1px solid #d1d5db;
                    border-radius:9px;
                    margin-bottom:15px;
                "
            >

            <label style="
                display:block;
                font-weight:700;
                margin-bottom:6px;
            ">
                Adresse e-mail
            </label>

            <input
                type="email"
                value="${escapeHTML(email)}"
                disabled
                style="
                    width:100%;
                    box-sizing:border-box;
                    padding:12px;
                    border:1px solid #e5e7eb;
                    border-radius:9px;
                    background:#f1f5f9;
                    color:#64748b;
                "
            >

            <p style="
                margin:12px 0 0;
                color:#64748b;
                font-size:13px;
            ">
                Type de compte :
                <strong>${escapeHTML(roleLabel)}</strong>
            </p>

        </div>

        <p
            id="accountMessage"
            style="margin-top:12px;"
        ></p>

        <button
            class="btn btn-primary"
            style="width:100%; margin-top:8px;"
            onclick="saveAccountProfile()"
        >
            💾 Enregistrer les modifications
        </button>


        <button
            class="btn btn-primary"
            style="width:100%; margin-top:10px;"
            onclick="showAddressManager()"
        >
            📍 Mes adresses
        </button>

        <button
            class="btn btn-primary"
            style="width:100%; margin-top:10px;"
            onclick="window.location.href='orders.html'"
        >
            📦 Mes commandes
        </button>

        <button
            class="btn btn-primary"
            style="width:100%; margin-top:10px;"
            onclick="logoutZando()"
        >
            🚪 Se déconnecter
        </button>
    `);

}


/* =====================================================
   CUSTOMER ADDRESSES
===================================================== */


async function showAddressManager() {

    showModal(`
        <h2>Mes adresses 📍</h2>

        <p style="color:#64748b;">
            Gérez vos adresses de livraison.
        </p>

        <div id="addressesMessage" style="margin-top:12px;"></div>

        <div
            id="addressesList"
            style="margin-top:16px;"
        >
            Chargement...
        </div>

        <button
            class="btn btn-primary"
            style="width:100%; margin-top:16px;"
            onclick="showAddressForm()"
        >
            ➕ Ajouter une adresse
        </button>

        <button
            class="btn btn-primary"
            style="width:100%; margin-top:10px;"
            onclick="closeModal()"
        >
            Fermer
        </button>
    `);

    await loadAddresses();

}


async function loadAddresses() {

    const container =
        document.getElementById("addressesList");

    const message =
        document.getElementById("addressesMessage");

    if (!container) return;

    container.innerHTML = "Chargement...";

    try {

        const user = await getCurrentUser();

        if (!user) {
            throw new Error("Vous devez être connecté.");
        }

        const {
            data,
            error
        } = await supabaseClient
            .from("addresses")
            .select(`
                id,
                full_name,
                phone,
                address_line1,
                address_line2,
                city,
                region,
                country,
                postal_code,
                is_default
            `)
            .eq("user_id", user.id)
            .order("is_default", { ascending: false })
            .order("created_at", { ascending: false });

        if (error) {
            throw error;
        }

        if (!data || data.length === 0) {

            container.innerHTML = `
                <div style="
                    padding:18px;
                    text-align:center;
                    background:#f8fafc;
                    border-radius:12px;
                    color:#64748b;
                ">
                    <div style="font-size:30px;">📍</div>
                    <p style="margin:8px 0 0;">
                        Vous n'avez encore aucune adresse.
                    </p>
                </div>
            `;

            return;
        }

        container.innerHTML = data.map(address => {

            const fullAddress = [
                address.address_line1,
                address.address_line2,
                address.city,
                address.region,
                address.postal_code
            ]
                .filter(Boolean)
                .join(", ");

            return `
                <div style="
                    padding:16px;
                    margin-bottom:12px;
                    border:1px solid ${address.is_default ? "#2563eb" : "#e2e8f0"};
                    border-radius:12px;
                    background:${address.is_default ? "#eff6ff" : "#ffffff"};
                ">

                    <div style="
                        display:flex;
                        justify-content:space-between;
                        gap:10px;
                        align-items:flex-start;
                    ">

                        <strong>
                            ${escapeHTML(address.full_name || "")}
                        </strong>

                        ${
                            address.is_default
                                ? `
                                    <span style="
                                        background:#dbeafe;
                                        color:#1d4ed8;
                                        padding:4px 8px;
                                        border-radius:999px;
                                        font-size:12px;
                                        font-weight:700;
                                    ">
                                        Adresse par défaut
                                    </span>
                                `
                                : ""
                        }

                    </div>

                    <div style="
                        margin-top:8px;
                        color:#475569;
                        line-height:1.5;
                    ">
                        📞 ${escapeHTML(address.phone || "")}<br>
                        📍 ${escapeHTML(fullAddress)}
                    </div>

                    <div style="
                        display:flex;
                        gap:8px;
                        margin-top:14px;
                        flex-wrap:wrap;
                    ">

                        <button
                            class="btn btn-primary"
                            onclick='showAddressForm(${JSON.stringify(address).replace(/'/g, "&#39;")})'
                        >
                            ✏️ Modifier
                        </button>

                        ${
                            !address.is_default
                                ? `
                                    <button
                                        class="btn btn-primary"
                                        onclick="setDefaultAddress('${address.id}')"
                                    >
                                        ⭐ Par défaut
                                    </button>
                                `
                                : ""
                        }

                        <button
                            class="btn btn-primary"
                            onclick="deleteAddress('${address.id}')"
                        >
                            🗑️ Supprimer
                        </button>

                    </div>

                </div>
            `;

        }).join("");

    } catch (error) {

        console.error(
            "❌ Erreur chargement adresses :",
            error
        );

        container.innerHTML = `
            <p style="color:#dc2626;">
                ❌ ${escapeHTML(
                    error.message ||
                    "Impossible de charger vos adresses."
                )}
            </p>
        `;

        if (message) {
            message.textContent = "";
        }

    }

}


function showAddressForm(address = null) {

    const isEdit = Boolean(address);

    showModal(`
        <h2>
            ${isEdit ? "Modifier l'adresse ✏️" : "Ajouter une adresse 📍"}
        </h2>

        <p style="color:#64748b;">
            ${
                isEdit
                    ? "Modifiez les informations de cette adresse."
                    : "Ajoutez une adresse pour vos prochaines livraisons."
            }
        </p>

        <div style="
            margin-top:18px;
            padding:16px;
            background:#f8fafc;
            border-radius:12px;
        ">

            <label style="display:block; font-weight:700; margin-bottom:6px;">
                Nom complet
            </label>

            <input
                type="text"
                id="addressFullName"
                value="${escapeHTML(address?.full_name || "")}"
                placeholder="Nom du destinataire"
                style="
                    width:100%;
                    box-sizing:border-box;
                    padding:12px;
                    border:1px solid #d1d5db;
                    border-radius:9px;
                    margin-bottom:14px;
                "
            >

            <label style="display:block; font-weight:700; margin-bottom:6px;">
                Téléphone
            </label>

            <input
                type="tel"
                id="addressPhone"
                value="${escapeHTML(address?.phone || "")}"
                placeholder="+243 8XX XXX XXX"
                style="
                    width:100%;
                    box-sizing:border-box;
                    padding:12px;
                    border:1px solid #d1d5db;
                    border-radius:9px;
                    margin-bottom:14px;
                "
            >

            <label style="display:block; font-weight:700; margin-bottom:6px;">
                Adresse
            </label>

            <input
                type="text"
                id="addressLine1"
                value="${escapeHTML(address?.address_line1 || "")}"
                placeholder="Avenue, numéro, quartier..."
                style="
                    width:100%;
                    box-sizing:border-box;
                    padding:12px;
                    border:1px solid #d1d5db;
                    border-radius:9px;
                    margin-bottom:14px;
                "
            >

            <label style="display:block; font-weight:700; margin-bottom:6px;">
                Complément d'adresse
            </label>

            <input
                type="text"
                id="addressLine2"
                value="${escapeHTML(address?.address_line2 || "")}"
                placeholder="Référence, bâtiment, commune..."
                style="
                    width:100%;
                    box-sizing:border-box;
                    padding:12px;
                    border:1px solid #d1d5db;
                    border-radius:9px;
                    margin-bottom:14px;
                "
            >

            <label style="display:block; font-weight:700; margin-bottom:6px;">
                Ville
            </label>

            <input
                type="text"
                id="addressCity"
                value="${escapeHTML(address?.city || "")}"
                placeholder="Kinshasa"
                style="
                    width:100%;
                    box-sizing:border-box;
                    padding:12px;
                    border:1px solid #d1d5db;
                    border-radius:9px;
                    margin-bottom:14px;
                "
            >

            <label style="display:block; font-weight:700; margin-bottom:6px;">
                Région / Province
            </label>

            <input
                type="text"
                id="addressRegion"
                value="${escapeHTML(address?.region || "")}"
                placeholder="Kinshasa"
                style="
                    width:100%;
                    box-sizing:border-box;
                    padding:12px;
                    border:1px solid #d1d5db;
                    border-radius:9px;
                    margin-bottom:14px;
                "
            >

            <label style="display:block; font-weight:700; margin-bottom:6px;">
                Code postal
            </label>

            <input
                type="text"
                id="addressPostalCode"
                value="${escapeHTML(address?.postal_code || "")}"
                placeholder="Optionnel"
                style="
                    width:100%;
                    box-sizing:border-box;
                    padding:12px;
                    border:1px solid #d1d5db;
                    border-radius:9px;
                    margin-bottom:14px;
                "
            >

            <label style="
                display:flex;
                align-items:center;
                gap:8px;
                font-weight:700;
            ">
                <input
                    type="checkbox"
                    id="addressDefault"
                    ${address?.is_default ? "checked" : ""}
                >
                Définir comme adresse par défaut
            </label>

        </div>

        <p id="addressFormMessage" style="margin-top:12px;"></p>

        <button
            class="btn btn-primary"
            style="width:100%; margin-top:8px;"
            onclick="saveAddress(${address ? `'${address.id}'` : "null"})"
        >
            💾 Enregistrer l'adresse
        </button>

        <button
            class="btn btn-primary"
            style="width:100%; margin-top:10px;"
            onclick="showAddressManager()"
        >
            ← Retour à mes adresses
        </button>
    `);

}


async function saveAddress(addressId = null) {

    const message =
        document.getElementById("addressFormMessage");

    const fullName =
        document.getElementById("addressFullName")?.value.trim();

    const phone =
        document.getElementById("addressPhone")?.value.trim();

    const addressLine1 =
        document.getElementById("addressLine1")?.value.trim();

    const addressLine2 =
        document.getElementById("addressLine2")?.value.trim();

    const city =
        document.getElementById("addressCity")?.value.trim();

    const region =
        document.getElementById("addressRegion")?.value.trim();

    const postalCode =
        document.getElementById("addressPostalCode")?.value.trim();

    const isDefault =
        document.getElementById("addressDefault")?.checked || false;

    if (!fullName || !phone || !addressLine1 || !city) {

        if (message) {
            message.textContent =
                "❌ Le nom, le téléphone, l'adresse et la ville sont obligatoires.";
        }

        return;
    }

    if (message) {
        message.textContent =
            "Enregistrement en cours...";
    }

    try {

        const user = await getCurrentUser();

        if (!user) {
            throw new Error("Vous devez être connecté.");
        }

        const payload = {
            user_id: user.id,
            full_name: fullName,
            phone: phone,
            address_line1: addressLine1,
            address_line2: addressLine2 || null,
            city: city,
            region: region || null,
            country: "CD",
            postal_code: postalCode || null,
            is_default: isDefault
        };

        /*
         * Si cette adresse devient l'adresse par défaut,
         * on retire d'abord ce statut aux autres adresses.
         */
        if (isDefault) {

            const {
                error: defaultError
            } = await supabaseClient
                .from("addresses")
                .update({
                    is_default: false
                })
                .eq("user_id", user.id);

            if (defaultError) {
                throw defaultError;
            }

        }

        let result;

        if (addressId) {

            result = await supabaseClient
                .from("addresses")
                .update(payload)
                .eq("id", addressId)
                .eq("user_id", user.id);

        } else {

            result = await supabaseClient
                .from("addresses")
                .insert(payload);

        }

        if (result.error) {
            throw result.error;
        }

        showAddressManager();

    } catch (error) {

        console.error(
            "❌ Erreur enregistrement adresse :",
            error
        );

        if (message) {
            message.textContent =
                "❌ " + (
                    error.message ||
                    "Impossible d'enregistrer cette adresse."
                );
        }

    }

}


async function setDefaultAddress(addressId) {

    try {

        const user = await getCurrentUser();

        if (!user) {
            throw new Error("Vous devez être connecté.");
        }

        const {
            error: resetError
        } = await supabaseClient
            .from("addresses")
            .update({
                is_default: false
            })
            .eq("user_id", user.id);

        if (resetError) {
            throw resetError;
        }

        const {
            error
        } = await supabaseClient
            .from("addresses")
            .update({
                is_default: true
            })
            .eq("id", addressId)
            .eq("user_id", user.id);

        if (error) {
            throw error;
        }

        await loadAddresses();

    } catch (error) {

        console.error(
            "❌ Erreur adresse par défaut :",
            error
        );

        const message =
            document.getElementById("addressesMessage");

        if (message) {
            message.textContent =
                "❌ " + (
                    error.message ||
                    "Impossible de définir cette adresse par défaut."
                );
        }

    }

}


async function deleteAddress(addressId) {

    showModal(`
        <h2>Supprimer cette adresse ? 🗑️</h2>

        <p style="
            color:#64748b;
            line-height:1.5;
        ">
            Cette adresse sera définitivement supprimée de votre compte.
        </p>

        <div style="
            display:flex;
            gap:10px;
            margin-top:20px;
        ">

            <button
                class="btn btn-primary"
                style="flex:1;"
                onclick="showAddressManager()"
            >
                Annuler
            </button>

            <button
                class="btn btn-primary"
                style="
                    flex:1;
                    background:#dc2626;
                    border-color:#dc2626;
                "
                onclick="confirmDeleteAddress('${addressId}')"
            >
                🗑️ Supprimer
            </button>

        </div>
    `);

}


async function confirmDeleteAddress(addressId) {

    try {

        const user = await getCurrentUser();

        if (!user) {
            throw new Error("Vous devez être connecté.");
        }

        const {
            error
        } = await supabaseClient
            .from("addresses")
            .delete()
            .eq("id", addressId)
            .eq("user_id", user.id);

        if (error) {
            throw error;
        }

        showAddressManager();

    } catch (error) {

        console.error(
            "❌ Erreur suppression adresse :",
            error
        );

        showModal(`
            <h2>Erreur</h2>

            <p style="color:#dc2626;">
                ❌ ${escapeHTML(
                    error.message ||
                    "Impossible de supprimer cette adresse."
                )}
            </p>

            <button
                class="btn btn-primary"
                style="width:100%; margin-top:15px;"
                onclick="showAddressManager()"
            >
                Fermer
            </button>
        `);

    }

}





async function saveAccountProfile() {

    const name =
        document.getElementById("accountName")?.value.trim();

    const phone =
        document.getElementById("accountPhone")?.value.trim();

    const message =
        document.getElementById("accountMessage");

    if (!name || !phone) {

        if (message) {
            message.textContent =
                "❌ Le nom et le numéro de téléphone sont obligatoires.";
        }

        return;
    }

    if (message) {
        message.textContent =
            "Enregistrement en cours...";
    }

    try {

        const user = await getCurrentUser();

        if (!user) {
            throw new Error(
                "Vous devez être connecté."
            );
        }

        const {
            error
        } = await supabaseClient
            .from("profiles")
            .update({
                full_name: name,
                phone: phone,
                updated_at: new Date().toISOString()
            })
            .eq("id", user.id);

        if (error) {
            throw error;
        }

        if (message) {
            message.textContent =
                "✅ Informations mises à jour avec succès.";
        }

    } catch (error) {

        console.error(
            "❌ Erreur mise à jour profil :",
            error
        );

        if (message) {
            message.textContent =
                "❌ " + (
                    error.message ||
                    "Impossible de mettre à jour vos informations."
                );
        }

    }

}


/* =====================================================
   LOGIN FORM
===================================================== */


function showRegisterForm() {

    showModal(`
        <h2>Créer votre compte Zando 🛍️</h2>

        <p>
            Rejoignez Zando pour commander plus facilement.
        </p>

        <form id="registerForm">

            <label>Nom complet</label>

            <input
                type="text"
                id="registerName"
                required
                autocomplete="name"
                placeholder="Votre nom complet"
                style="
                    width:100%;
                    padding:12px;
                    margin:8px 0 15px;
                    border:1px solid #d1d5db;
                    border-radius:8px;
                "
            >

            <label>Numéro de téléphone</label>

            <input
                type="tel"
                id="registerPhone"
                required
                autocomplete="tel"
                placeholder="+243 8XX XXX XXX"
                style="
                    width:100%;
                    padding:12px;
                    margin:8px 0 15px;
                    border:1px solid #d1d5db;
                    border-radius:8px;
                "
            >

            <label>Adresse e-mail</label>

            <input
                type="email"
                id="registerEmail"
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

            <label>Mot de passe</label>

            <input
                type="password"
                id="registerPassword"
                required
                minlength="6"
                autocomplete="new-password"
                placeholder="Minimum 6 caractères"
                style="
                    width:100%;
                    padding:12px;
                    margin:8px 0 15px;
                    border:1px solid #d1d5db;
                    border-radius:8px;
                "
            >

            <label>Confirmer le mot de passe</label>

            <input
                type="password"
                id="registerPasswordConfirm"
                required
                minlength="6"
                autocomplete="new-password"
                placeholder="Confirmez votre mot de passe"
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
                Créer mon compte
            </button>

        </form>

        <p
            id="registerMessage"
            style="margin-top:15px;"
        ></p>

        <button
            type="button"
            onclick="showLoginForm()"
            style="
                margin-top:10px;
                border:0;
                background:none;
                color:#2563eb;
                font-weight:800;
                cursor:pointer;
                font-size:14px;
            "
        >
            J'ai déjà un compte
        </button>
    `);

    const form =
        document.getElementById("registerForm");

    form?.addEventListener(
        "submit",
        registerZando
    );

}


async function registerZando(event) {

    event.preventDefault();

    const name =
        document.getElementById("registerName")?.value.trim();

    const phone =
        document.getElementById("registerPhone")?.value.trim();

    const email =
        document.getElementById("registerEmail")?.value.trim();

    const password =
        document.getElementById("registerPassword")?.value;

    const passwordConfirm =
        document.getElementById("registerPasswordConfirm")?.value;

    const message =
        document.getElementById("registerMessage");

    if (!name || !phone || !email || !password || !passwordConfirm) {
        if (message) {
            message.textContent =
                "Veuillez remplir tous les champs.";
        }
        return;
    }

    if (password !== passwordConfirm) {
        if (message) {
            message.textContent =
                "❌ Les mots de passe ne correspondent pas.";
        }
        return;
    }

    if (password.length < 6) {
        if (message) {
            message.textContent =
                "❌ Le mot de passe doit contenir au moins 6 caractères.";
        }
        return;
    }

    if (message) {
        message.textContent =
            "Création du compte en cours...";
    }

    try {

        const {
            data,
            error
        } = await supabaseClient.auth.signUp({
            email: email,
            password: password
        });

        if (error) {
            throw error;
        }

        if (!data?.user) {
            throw new Error(
                "Impossible de créer le compte."
            );
        }

        const {
            error: profileError
        } = await supabaseClient
            .from("profiles")
            .upsert({
                id: data.user.id,
                full_name: name,
                phone: phone,
                role: "customer"
            });

        if (profileError) {
            throw profileError;
        }

        showModal(`
            <div class="modal-success">

                <h2>Compte créé avec succès 🎉</h2>

                <p>
                    Votre compte Zando a été créé.
                </p>

                <p>
                    Vous pouvez maintenant vous connecter
                    et commencer vos achats.
                </p>

                <button
                    class="btn btn-primary"
                    onclick="showLoginForm()"
                >
                    Se connecter
                </button>

            </div>
        `);

    } catch (error) {

        console.error(
            "❌ Erreur création compte Zando :",
            error
        );

        if (message) {
            message.textContent =
                "❌ " + (
                    error.message ||
                    "Impossible de créer le compte."
                );
        }

    }

}


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

        <div
            style="
                margin-top:18px;
                text-align:center;
                padding-top:15px;
                border-top:1px solid #e5e7eb;
            "
        >
            <p style="margin:0 0 8px;color:#64748b;">
                Vous n'avez pas encore de compte ?
            </p>

            <button
                type="button"
                onclick="showRegisterForm()"
                style="
                    border:0;
                    background:none;
                    color:#2563eb;
                    font-weight:800;
                    cursor:pointer;
                    font-size:14px;
                "
            >
                Créer un compte
            </button>
        </div>

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
        document.getElementById("loginEmail")?.value.trim();

    const password =
        document.getElementById("loginPassword")?.value;

    const message =
        document.getElementById("loginMessage");

    if (!email || !password) {
        if (message) {
            message.textContent =
                "Veuillez remplir tous les champs.";
        }
        return;
    }

    if (message) {
        message.textContent =
            "Connexion en cours...";
    }

    console.log("🔐 Tentative de connexion :", email);

    try {

        const loginPromise =
            supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

        const timeoutPromise =
            new Promise((_, reject) => {
                setTimeout(() => {
                    reject(
                        new Error(
                            "La connexion Supabase prend trop de temps. Vérifiez votre connexion Internet."
                        )
                    );
                }, 15000);
            });

        const {
            data,
            error
        } = await Promise.race([
            loginPromise,
            timeoutPromise
        ]);

        if (error) {

            console.error(
                "❌ Erreur Supabase Auth :",
                error
            );

            if (message) {
                message.textContent =
                    "❌ " + (
                        error.message ||
                        "Échec de la connexion."
                    );
            }

            return;
        }

        console.log(
            "✅ Connexion réussie :",
            data.user?.id
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

    } catch (error) {

        console.error(
            "❌ Exception connexion :",
            error
        );

        if (message) {

            message.textContent =
                "❌ " + (
                    error.message ||
                    "Impossible de contacter Supabase."
                );

        }

    }

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

    sellerButton?.addEventListener("click", async () => {

        const user = await getCurrentUser();

        if (!user) {
            showModal(`
                <h2>Devenir vendeur 🏪</h2>

                <p>
                    Vous devez créer un compte ou vous connecter
                    avant de devenir vendeur sur Zando.
                </p>

                <button
                    class="btn btn-primary"
                    style="width:100%; margin-top:15px;"
                    onclick="showRegisterForm()"
                >
                    Créer un compte
                </button>

                <button
                    class="btn btn-primary"
                    style="width:100%; margin-top:10px;"
                    onclick="showLoginForm()"
                >
                    Se connecter
                </button>
            `);

            return;
        }

        showSellerForm();

    });

}


function showSellerForm() {

    showModal(`
        <h2>Créer ma boutique 🏪</h2>

        <p style="color:#64748b;">
            Présentez votre boutique aux clients de Zando.
        </p>

        <form id="sellerForm">

            <label style="display:block; font-weight:700; margin-top:15px;">
                Nom de la boutique
            </label>

            <input
                type="text"
                id="sellerStoreName"
                required
                maxlength="100"
                placeholder="Ex : Boutique Ange Fashion"
                style="
                    width:100%;
                    box-sizing:border-box;
                    padding:12px;
                    margin:8px 0 15px;
                    border:1px solid #d1d5db;
                    border-radius:9px;
                "
            >

            <label style="display:block; font-weight:700;">
                Description
            </label>

            <textarea
                id="sellerStoreDescription"
                maxlength="500"
                placeholder="Décrivez votre boutique..."
                style="
                    width:100%;
                    min-height:100px;
                    box-sizing:border-box;
                    padding:12px;
                    margin:8px 0 15px;
                    border:1px solid #d1d5db;
                    border-radius:9px;
                    resize:vertical;
                "
            ></textarea>

            <button
                type="submit"
                class="btn btn-primary"
                style="width:100%;"
            >
                🏪 Créer ma boutique
            </button>

        </form>

        <p
            id="sellerMessage"
            style="margin-top:15px;"
        ></p>
    `);

    const form =
        document.getElementById("sellerForm");

    form?.addEventListener(
        "submit",
        createSellerStore
    );

}


async function createSellerStore(event) {

    event.preventDefault();

    const name =
        document.getElementById("sellerStoreName")?.value.trim();

    const description =
        document.getElementById("sellerStoreDescription")?.value.trim();

    const message =
        document.getElementById("sellerMessage");

    if (!name) {

        if (message) {
            message.textContent =
                "❌ Le nom de la boutique est obligatoire.";
        }

        return;
    }

    if (message) {
        message.textContent =
            "Création de votre boutique en cours...";
    }

    try {

        const user = await getCurrentUser();

        if (!user) {
            throw new Error(
                "Vous devez être connecté pour créer une boutique."
            );
        }

        const {
            data: existingStore,
            error: existingError
        } = await supabaseClient
            .from("stores")
            .select("id, name, status")
            .eq("owner_id", user.id)
            .maybeSingle();

        if (existingError) {
            throw existingError;
        }

        if (existingStore) {

            if (message) {
                message.textContent =
                    "ℹ️ Vous avez déjà une boutique : " +
                    existingStore.name;
            }

            return;
        }

        const slug =
            name
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "");

        const {
            data: store,
            error
        } = await supabaseClient
            .from("stores")
            .insert({
                owner_id: user.id,
                name: name,
                slug: slug,
                description: description || null,
                status: "pending"
            })
            .select()
            .single();

        if (error) {
            throw error;
        }

        console.log(
            "✅ Boutique créée :",
            store
        );

        showModal(`
            <div class="modal-success">

                <h2>Boutique créée avec succès 🎉</h2>

                <p>
                    Votre boutique
                    <strong>${escapeHTML(name)}</strong>
                    a bien été enregistrée.
                </p>

                <p>
                    Elle est actuellement en attente de validation.
                </p>

                <button
                    class="btn btn-primary"
                    style="width:100%;"
                    onclick="closeModal()"
                >
                    Continuer
                </button>

            </div>
        `);

    } catch (error) {

        console.error(
            "❌ Erreur création boutique :",
            error
        );

        if (message) {
            message.textContent =
                "❌ " + (
                    error.message ||
                    "Impossible de créer la boutique."
                );
        }

    }

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
