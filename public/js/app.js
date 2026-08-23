/* =====================================================
   ZANDO — FRONTEND APPLICATION
===================================================== */

"use strict";


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
   ACCOUNT
===================================================== */

function setupAccount() {

    accountButton?.addEventListener("click", () => {

        showModal(`
            <h2>Bienvenue sur Zando 👋</h2>

            <p>
                La connexion et la création de compte
                seront bientôt disponibles.
            </p>

            <br>

            <button
                class="btn btn-primary"
                onclick="closeModal()"
            >
                Continuer
            </button>
        `);

    });

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