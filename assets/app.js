// GLOBAL STORE TYPOGRAPHY & FONT SCALING ENGINE
function getFontStack(fontName) {
  if (!fontName) return "'Inter', ui-sans-serif, system-ui, sans-serif";
  const name = fontName.trim();
  if (name.includes(',') || name.includes('sans-serif') || name.includes('monospace')) return name;
  return `'${name}', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
}

function applyTypographySettings(t) {
  if (!t || typeof t !== 'object') return;
  const root = document.documentElement;

  if (t.fontPrimary) root.style.setProperty('--font-primary', getFontStack(t.fontPrimary));
  if (t.fontHeading) root.style.setProperty('--font-heading', getFontStack(t.fontHeading));
  if (t.baseFontSize) root.style.setProperty('--base-font-size', t.baseFontSize);
  if (t.bodyLineHeight) root.style.setProperty('--body-line-height', t.bodyLineHeight);
  if (t.letterSpacingBase) root.style.setProperty('--letter-spacing-base', t.letterSpacingBase);
  if (t.letterSpacingHeading) root.style.setProperty('--letter-spacing-heading', t.letterSpacingHeading);
  if (t.headingTransform) root.style.setProperty('--heading-transform', t.headingTransform);
  if (t.fontWeightHeading) root.style.setProperty('--font-weight-heading', t.fontWeightHeading);

  if (t.heroH1Size) root.style.setProperty('--hero-h1-size', t.heroH1Size);
  if (t.sectionH2Size) root.style.setProperty('--section-h2-size', t.sectionH2Size);
  if (t.prodTitleSize) root.style.setProperty('--prod-title-size', t.prodTitleSize);
  if (t.cardH3Size) root.style.setProperty('--card-h3-size', t.cardH3Size);
  if (t.prodPriceSize) root.style.setProperty('--prod-price-size', t.prodPriceSize);
}

function initGlobalTypography() {
  try {
    const local = localStorage.getItem("hx_typography_settings");
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed) applyTypographySettings(parsed);
    }
  } catch(e) {}

  fetch('/api/integrations?service=typography&action=get')
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (data && data.status === 'ok' && data.data) {
        applyTypographySettings(data.data);
        try { localStorage.setItem("hx_typography_settings", JSON.stringify(data.data)); } catch(e) {}
      }
    })
    .catch(() => {});
}

// Immediate synchronous run to avoid FOUC
try { initGlobalTypography(); } catch(e) {}

// PERSISTENT STOREFRONT PRODUCTS DATABASE SYNCHRONIZER
function loadProductsDB() {
  const staticProducts = (window.HX_PRODUCTS && Array.isArray(window.HX_PRODUCTS)) ? window.HX_PRODUCTS.filter(p => p && p.id != null) : [];
  
  try {
    const local = localStorage.getItem("hx_products_db");
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed && Array.isArray(parsed) && parsed.length >= 10) {
        const map = new Map();
        staticProducts.forEach(p => {
          if (p && p.id != null) map.set(String(p.id), p);
        });
        parsed.forEach(p => {
          if (p && p.id != null) {
            const key = String(p.id);
            const existing = map.get(key) || {};
            const merged = { ...existing, ...p };
            if (p.image || (Array.isArray(p.images) && p.images.length > 0)) {
              merged.no_image = false;
            } else if (p.no_image || (p.image === "" && Array.isArray(p.images) && p.images.length === 0)) {
              merged.image = "";
              merged.images = [];
              merged.no_image = true;
            }
            map.set(key, merged);
          }
        });
        const result = Array.from(map.values()).filter(p => p && p.id != null);
        if (result.length >= 10) return result;
      }
    }
  } catch(e) {}
  
  return staticProducts;
}

let P = loadProductsDB();

// Category lists were hardcoded in three places and included "Mini RC", which no product
// actually carries — those links and filters always produced an empty result set.
// Deriving them from the catalogue keeps the UI honest as the data changes.
function getCategories() {
  const seen = new Map();
  getProducts().forEach(p => {
    const cat = p && p.category ? String(p.category).trim() : "";
    if (cat) seen.set(cat, (seen.get(cat) || 0) + 1);
  });
  return [...seen.entries()].map(([name, count]) => ({ name, count }));
}

function getScales() {
  const seen = new Set();
  getProducts().forEach(p => {
    const s = p && p.scale ? String(p.scale).trim() : "";
    if (s && s !== "Not specified") seen.add(s);
  });
  // Sort by denominator so 1:7 comes before 1:64.
  return [...seen].sort((a, b) => (Number(a.split(":")[1]) || 0) - (Number(b.split(":")[1]) || 0));
}

function getProducts() {
  if (Array.isArray(P) && P.length >= 10) {
    const valid = P.filter(p => p && p.id != null);
    if (valid.length >= 10) return valid;
  }
  P = loadProductsDB();
  if (Array.isArray(P) && P.length >= 10) {
    const valid = P.filter(p => p && p.id != null);
    if (valid.length >= 10) return valid;
  }
  if (window.HX_PRODUCTS && Array.isArray(window.HX_PRODUCTS)) {
    const staticValid = window.HX_PRODUCTS.filter(p => p && p.id != null);
    if (staticValid.length > 0) return staticValid;
  }
  return [];
}

// Product ids are compared as strings everywhere (backend rows may use non-numeric ids),
// so inline handlers must emit them as quoted JS strings rather than bare numbers.
const idArg = v => `'${String(v).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
const $ = (q, r = document) => r.querySelector(q);
const $$ = (q, r = document) => [...r.querySelectorAll(q)];
const INR = n => "₹" + Number(n || 0).toLocaleString("en-IN");
const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
const safeUrl = (u, fallback = "") => {
  const raw = String(u ?? "").trim();
  if (!raw) return fallback;
  if (/^(https?:|data:image\/|mailto:|tel:)/i.test(raw)) return esc(raw);
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return fallback; // any other scheme is rejected
  return esc(raw);
};

// Formats multi-line text into HTML paragraphs/breaks or preserves custom HTML markup
function formatDescriptionHTML(raw, fallback = "") {
  const content = (raw && String(raw).trim()) ? String(raw).trim() : fallback;
  if (!content) return "";

  // If content contains standard HTML block/formatting tags, allow safe rendering
  const hasHtmlTags = /<\/?(p|div|br|h[1-6]|ul|ol|li|strong|b|em|i|table|span|blockquote)/i.test(content);
  if (hasHtmlTags) {
    return content;
  }

  // Split by double newlines into distinct paragraphs, and single newlines into <br>
  const paragraphs = content.split(/\r?\n\s*\r?\n/);
  return paragraphs.map(p => {
    const lines = p.split(/\r?\n/).map(l => esc(l.trim())).filter(Boolean).join("<br>");
    return lines ? `<p style="margin:0 0 14px 0;line-height:1.75">${lines}</p>` : "";
  }).filter(Boolean).join("");
}
window.formatDescriptionHTML = formatDescriptionHTML;

window.openModal = function(id) {
  if (!id) return;
  if (id === "accountModal") {
    ensureGlobalModalsAndDrawers();
    renderAccountModalUI();
  }
  const el = $("#" + id);
  if (el) {
    el.classList.add("open");
    el.style.display = "block";
    el.style.visibility = "visible";
    el.style.opacity = "1";
    el.style.pointerEvents = "auto";

    const box = $(".modal-box", el);
    if (box) {
      box.style.opacity = "1";
      box.style.visibility = "visible";
      box.style.transform = "translate(-50%, -50%)";
    }
  }
};

window.closeEl = function(el) {
  if (!el) {
    document.querySelectorAll(".modal.open, .drawer.open").forEach(m => {
      m.classList.remove("open");
      m.style.display = "";
      m.style.visibility = "";
      m.style.opacity = "";
      m.style.pointerEvents = "";
    });
    return;
  }
  const modal = (el && el.nodeType) ? (el.classList.contains("modal") || el.classList.contains("drawer") ? el : el.closest(".modal,.drawer")) : (typeof el === "string" ? $("#" + el) : null);
  if (modal) {
    modal.classList.remove("open");
    modal.style.display = "";
    modal.style.visibility = "";
    modal.style.opacity = "";
    modal.style.pointerEvents = "";

    const box = $(".modal-box", modal);
    if (box) {
      box.style.opacity = "";
      box.style.visibility = "";
      box.style.transform = "";
    }
  }
};

// Universal click delegation for modal opening, closing (x button & shade backdrop)
document.addEventListener("click", function(e) {
  // 1. Click on Close button (.x or elements inside .x or [data-close])
  const closeBtn = e.target.closest(".x, [data-close], .close-modal");
  if (closeBtn) {
    e.preventDefault();
    e.stopPropagation();
    window.closeEl(closeBtn);
    return;
  }

  // 2. Click on Backdrop / Shade
  const shade = e.target.closest(".shade");
  if (shade && shade.parentElement && (shade.parentElement.classList.contains("modal") || shade.parentElement.classList.contains("drawer"))) {
    e.preventDefault();
    e.stopPropagation();
    window.closeEl(shade.parentElement);
    return;
  }

  // 3. Click on Modal Trigger [data-modal]
  const modalTrigger = e.target.closest("[data-modal]");
  if (modalTrigger) {
    const modalId = modalTrigger.getAttribute("data-modal");
    if (modalId && modalId !== "#") {
      e.preventDefault();
      window.openModal(modalId);
    }
  }
});

// Close open modals when pressing 'Escape' or open on Enter/Space
document.addEventListener("keydown", function(e) {
  if (e.key === "Escape" || e.keyCode === 27) {
    const openEls = document.querySelectorAll(".modal.open, .drawer.open");
    openEls.forEach(el => window.closeEl(el));
    return;
  }
  if (e.key === "Enter" || e.key === " ") {
    if (document.activeElement && document.activeElement.hasAttribute("data-modal")) {
      const modalId = document.activeElement.getAttribute("data-modal");
      if (modalId && modalId !== "#") {
        e.preventDefault();
        window.openModal(modalId);
      }
    }
  }
});

function toast(msg) {
  const t = $("#toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2400);
}

// ROBUST MULTI-IMAGE GALLERY PARSER
function parseImagesArray(p) {
  if (!p || p.no_image) return [];
  let list = [];

  const addUrls = (raw) => {
    if (!raw) return;
    if (Array.isArray(raw)) {
      raw.forEach(addUrls);
    } else if (typeof raw === "string" && raw.trim()) {
      const trimmed = raw.trim();
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) return parsed.forEach(addUrls);
        } catch(e) {}
      }
      trimmed.split(',').map(x => x.trim()).filter(Boolean).forEach(u => {
        if (u && u.length > 5 && !list.includes(u)) list.push(u);
      });
    }
  };

  if (p.images) addUrls(p.images);
  if (p.image) addUrls(p.image);

  return [...new Set(list)].filter(x => x && x.length > 5);
}

// INTERACTIVE HERO IMAGE SWITCHER
window.switchHeroImage = function(src, el) {
  const main = document.getElementById("mainProdImg");
  if (main) {
    main.style.opacity = "0.3";
    setTimeout(() => {
      main.src = src;
      main.style.opacity = "1";
    }, 120);
  }
  const parent = el.parentElement;
  if (parent) {
    [...parent.children].forEach(c => {
      c.classList.remove("active");
    });
    el.classList.add("active");
  }
};

// ASYNC LIVE BACKEND SERVER DATABASE FETCH
async function fetchLiveBackendProducts() {
  try {
    const res = await fetch('/api/products-crud');
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.products && Array.isArray(data.products) && data.products.length > 0) {
      const liveProducts = data.products.filter(p => p && p.id != null);
      const staticProducts = (window.HX_PRODUCTS && Array.isArray(window.HX_PRODUCTS)) ? window.HX_PRODUCTS.filter(p => p && p.id != null) : [];
      
      let localProducts = [];
      try {
        const local = localStorage.getItem("hx_products_db");
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed)) localProducts = parsed.filter(p => p && p.id != null);
        }
      } catch(e) {}

      const map = new Map();
      staticProducts.forEach(p => map.set(String(p.id), p));
      localProducts.forEach(p => {
        const key = String(p.id);
        const existing = map.get(key) || {};
        map.set(key, { ...existing, ...p });
      });
      liveProducts.forEach(p => {
        const key = String(p.id);
        const existing = map.get(key) || {};
        const merged = { ...existing, ...p };
        if (p.image || (Array.isArray(p.images) && p.images.length > 0)) {
          merged.no_image = false;
        } else if (p.no_image || (p.image === "" && Array.isArray(p.images) && p.images.length === 0)) {
          merged.image = "";
          merged.images = [];
          merged.no_image = true;
        }
        map.set(key, merged);
      });

      const mergedList = Array.from(map.values()).filter(p => p && p.id != null);
      if (mergedList.length > 0) {
        P = mergedList;
        window.HX_PRODUCTS = P;
        localStorage.setItem("hx_products_db", JSON.stringify(P));
        reRenderAllStorefrontPages();
      }
    }
  } catch(e) {}
}

function reRenderAllStorefrontPages() {
  P = getProducts();
  if (typeof homeInit === "function") homeInit();
  if (typeof shopInit === "function") shopInit();
  if (typeof productInit === "function") productInit();
  if (typeof renderCartDrawer === "function") renderCartDrawer();
  if (typeof renderQuickCategories === "function") renderQuickCategories();
  if (typeof renderCategoryCarousels === "function") renderCategoryCarousels();
}

window.addEventListener("storage", (e) => {
  if (e.key === "hx_products_db") {
    P = loadProductsDB();
    window.HX_PRODUCTS = P;
    reRenderAllStorefrontPages();
  }
});

window.addEventListener("hx_stock_update", (e) => {
  if (e.detail && e.detail.length >= 10) {
    P = e.detail;
    window.HX_PRODUCTS = P;
    reRenderAllStorefrontPages();
  }
});

// SUPABASE CUSTOMER AUTH & SESSION MANAGEMENT
function getAuthSession() {
  try {
    const raw = localStorage.getItem("hx_auth_session");
    if (raw) return JSON.parse(raw);
    const legacy = localStorage.getItem("hx_customer_user");
    if (legacy) return { user: JSON.parse(legacy), token: "demo_token" };
  } catch(e) {}
  return null;
}

function getAuthUser() {
  const session = getAuthSession();
  return session ? session.user : null;
}

function getAuthToken() {
  const session = getAuthSession();
  return session ? (session.token || "") : "";
}

function isLoggedIn() {
  return !!getAuthUser();
}

function setAuthSession(user, token = "demo_token", refresh_token = null) {
  const session = { user, token, refresh_token, loggedAt: new Date().toISOString() };
  localStorage.setItem("hx_auth_session", JSON.stringify(session));
  localStorage.setItem("hx_customer_user", JSON.stringify(user));
  window.dispatchEvent(new CustomEvent("hx_auth_change", { detail: session }));
}

function clearAuthSession() {
  localStorage.removeItem("hx_auth_session");
  localStorage.removeItem("hx_customer_user");
  window.dispatchEvent(new CustomEvent("hx_auth_change", { detail: null }));
}

async function logoutCustomer() {
  const token = getAuthToken();
  if (token) {
    try {
      await fetch('/api/supabase-auth?action=logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch(e) {}
  }
  clearAuthSession();
  toast("Logged out of Driver Garage ✓");
}

function updateAuthUI() {
  const user = getAuthUser();
  const accountBtns = $$('[data-modal="accountModal"], .accountBtn');
  const userSvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

  accountBtns.forEach(btn => {
    if (user) {
      if (btn.classList.contains("icon")) {
        btn.title = `Driver: ${user.name || user.email}`;
        btn.innerHTML = userSvg;
      } else {
        btn.innerHTML = `${userSvg} ${esc(user.name ? user.name.split(' ')[0] : 'My Garage')}`;
      }
    } else {
      if (btn.classList.contains("icon")) {
        btn.title = "Driver Account / Login";
        btn.innerHTML = userSvg;
      } else {
        btn.innerHTML = `${userSvg} Customer Login`;
      }
    }
  });

  const mobAccBtn = $("#btnMobGarageAcc");
  if (mobAccBtn) {
    mobAccBtn.innerHTML = user ? `${userSvg} ${esc(user.name || 'My Garage')}` : `${userSvg} Driver Sign In / Register`;
  }
}

window.addEventListener("hx_auth_change", () => {
  updateAuthUI();
  if (typeof renderAccountModalUI === "function") renderAccountModalUI();
});

// Shipping was calculated three different ways (checkout.html used >4999 ? 0 : 250, the cart
// page claimed free over ₹999, both APIs use >=4999 ? 0 : 199). The server recalculates the
// total authoritatively, so the client must mirror api/create-order.js exactly or the
// customer is quoted a price the payment session will not match.
const FREE_SHIPPING_THRESHOLD = 4999;
const FLAT_SHIPPING_FEE = 199;
const shippingFor = subtotal => (Number(subtotal) >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING_FEE);

// LOCAL STORAGE HELPERS
const getCart = () => JSON.parse(localStorage.getItem("hx_cart") || "{}");
const setCart = c => localStorage.setItem("hx_cart", JSON.stringify(c));
const getWish = () => JSON.parse(localStorage.getItem("hx_wish") || "[]");
const setWish = w => localStorage.setItem("hx_wish", JSON.stringify(w));

function getOrdersDB() {
  try {
    const raw = localStorage.getItem("hx_orders_db");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.length) return parsed;
    }
  } catch(e) {}
  return window.HX_ORDERS || [];
}

function saveOrderToDB(newOrder) {
  const current = getOrdersDB();
  const updated = [newOrder, ...current.filter(o => o.id !== newOrder.id)];
  window.HX_ORDERS = updated;
  try {
    localStorage.setItem("hx_orders_db", JSON.stringify(updated));
  } catch(e) {}
  return updated;
}

function addCart(id, qty = 1) {
  const p = getProducts().find(x => String(x.id) === String(id));
  if (!p) return;

  const stock = p.stock !== undefined ? p.stock : 25;
  if (stock === 0) {
    toast(`Sorry, "${p.name}" is currently Out of Stock.`);
    return;
  }

  const c = getCart();
  const currentInCart = c[id] || 0;
  const newQty = currentInCart + Number(qty);

  if (newQty > stock) {
    toast(`Only ${stock} units available in stock for "${p.name}".`);
    c[id] = stock;
  } else {
    c[id] = newQty;
    toast(`Added ${qty} × "${p.name}" to cart ✓`);
  }

  setCart(c);
  updateCount();
  renderCartDrawer();
}

function removeCart(id) {
  const c = getCart();
  delete c[id];
  setCart(c);
  updateCount();
  renderCartDrawer();
  if (typeof cartPageInit === "function") cartPageInit();
}

function setQty(id, q) {
  const p = getProducts().find(x => String(x.id) === String(id));
  const stock = p && p.stock !== undefined ? p.stock : 25;

  const c = getCart();
  if (q <= 0) {
    delete c[id];
  } else if (q > stock) {
    toast(`Max available stock for this model is ${stock} units.`);
    c[id] = stock;
  } else {
    c[id] = Number(q);
  }

  setCart(c);
  updateCount();
  renderCartDrawer();
  if (typeof cartPageInit === "function") cartPageInit();
}

function updateCount() {
  const c = getCart();
  const count = Object.values(c).reduce((a, b) => a + b, 0);
  $$(".cart-count").forEach(el => el.textContent = count);
}

// Wishlist ids are normalised to strings so entries saved before/after a backend refresh
// (which can change id types) still match.
function isWished(id) {
  return getWish().some(x => String(x) === String(id));
}

function toggleWish(id) {
  const key = String(id);
  const w = getWish().map(String);
  const next = w.includes(key) ? w.filter(x => x !== key) : [...w, key];
  setWish(next);

  const on = next.includes(key);
  $$(`[data-wish="${key}"]`).forEach(b => {
    b.classList.toggle("on", on);
    b.textContent = on ? "♥" : "♡";
  });
  toast(on ? "Saved to wishlist" : "Removed from wishlist");
}

/* 4-COLUMN RESPONSIVE PRODUCT CARD WITH REAL-TIME STOCK BADGES */
function productCard(p) {
  if (!p || p.id == null) return "";
  const w = isWished(p.id);
  const specs = [p.scale, p.drive, p.speed].filter(x => x && x !== "Not specified").join(" · ");
  
  const stock = p.stock !== undefined ? p.stock : 25;
  let stockBadgeHTML = `<span style="font-size:10px;font-weight:900;color:#2e7d32;display:block;margin-top:4px">🟢 In Stock (${stock} Units)</span>`;
  let buyBtnHTML = `<button class="mini-btn solid" onclick="addCart(${idArg(p.id)})">Add to cart</button>`;

  if (stock === 0) {
    stockBadgeHTML = `<span style="font-size:10px;font-weight:900;color:#ed1c24;display:block;margin-top:4px">🔴 Out of Stock (Sold Out)</span>`;
    buyBtnHTML = `<button class="mini-btn solid" style="background:#888;cursor:not-allowed" disabled>Out of Stock</button>`;
  } else if (stock <= 5) {
    stockBadgeHTML = `<span style="font-size:10px;font-weight:900;color:#b78103;display:block;margin-top:4px">🟡 Only ${stock} Units Left!</span>`;
  }

  return `<article class="product-card">
    <div class="product-media">
      <a href="product.html?id=${p.id}">${(p.image && p.image.trim()) ? `<img loading="lazy" src="${p.image.trim()}" alt="${esc(p.name)}">` : `<div style="width:100%;height:180px;background:#f8f9fa;border-radius:12px;display:grid;place-items:center;color:#888;font-size:12px;font-weight:800">📷 Photo Coming Soon</div>`}</a>
      <div class="product-badges">
        ${p.discount ? `<span class="tag sale-tag">${p.discount}% OFF</span>` : ""}
        <span class="tag cat-tag">${esc(p.category)}</span>
      </div>
      <button class="wish ${w ? "on" : ""}" data-wish="${p.id}" onclick="toggleWish(${idArg(p.id)})">${w ? "♥" : "♡"}</button>
    </div>
    <div class="product-meta">
      <div class="sku">HYPERXGT · ${esc(p.sku)}</div>
      <a href="product.html?id=${p.id}"><h3>${esc(p.name)}</h3></a>
      <p>${esc(specs || (p.scale + " · " + p.drive))}</p>
      ${stockBadgeHTML}
      <div class="price" style="margin-top:6px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <strong style="flex-shrink:0;white-space:nowrap">${INR(p.price)}</strong>
        ${p.mrp > p.price ? `<del style="flex-shrink:0;white-space:nowrap">${INR(p.mrp)}</del>` : ""}
      </div>
      <div class="product-actions" style="margin-top:12px;display:flex;gap:6px">
        <button class="mini-btn quick" onclick="quickView(${idArg(p.id)})" style="flex:1;white-space:nowrap">Quick view</button>
        ${buyBtnHTML}
      </div>
    </div>
  </article>`;
}

function renderFullSpecGrid(p) {
  const specs = [
    ["Scale", p.scale || "1:16"],
    ["Top Speed", p.speed || "35+ KM/H"],
    ["Drive System", p.drive || "4WD"],
    ["Motor Type", p.motor || "High-Output Electric Motor"],
    ["Battery Spec", p.battery || "Rechargeable Li-ion Pack"],
    ["Control System", p.control || "2.4GHz Proportional (100m+)"],
    ["Dimensions", p.dimensions || "Standard Scale Chassis"],
    ["Weight", p.weight || "Hobby-Grade RTR"],
    ["Recommended Age", p.age || "14+ Years"],
    ["Brand", p.brand || "HyperXGT"]
  ];

  return specs.map(x => `<div><b>${esc(x[0])}</b><span>${esc(x[1])}</span></div>`).join("");
}

function quickView(id) {
  const p = getProducts().find(x => String(x.id) === String(id));
  if (!p) return;

  const stock = p.stock !== undefined ? p.stock : 25;
  let stockBadge = `<span style="font-size:11px;font-weight:900;color:#2e7d32">🟢 In Stock (${stock} Units)</span>`;
  let btnHTML = `<button class="btn dark" onclick="addCart(${idArg(p.id)})">Add to Cart 🛒</button>`;
  
  if (stock === 0) {
    stockBadge = `<span style="font-size:11px;font-weight:900;color:#ed1c24">🔴 Out of Stock</span>`;
    btnHTML = `<button class="btn dark" style="background:#888;cursor:not-allowed" disabled>Out of Stock</button>`;
  } else if (stock <= 5) {
    stockBadge = `<span style="font-size:11px;font-weight:900;color:#b78103">🟡 Only ${stock} Left!</span>`;
  }

  const qvImg = (p.image && !p.no_image) ? `<img src="${p.image}" style="width:180px;height:160px;object-fit:contain;background:#f6f6f6;border-radius:14px">` : `<div style="width:180px;height:160px;background:#f8f9fa;border-radius:14px;display:grid;place-items:center;color:#888;font-size:11px;font-weight:700">📷 No Photo</div>`;
  $("#quickBox").innerHTML = `<div class="drawer-head"><b>Quick View</b><button class="x" onclick="closeEl(this)">×</button></div>
  <div style="display:grid;grid-template-columns:180px 1fr;gap:20px;align-items:center;margin-top:20px">
    ${qvImg}
    <div>
      <div class="eyebrow">${esc(p.category)} · ${esc(p.sku)}</div>
      <h3 style="margin:8px 0">${esc(p.name)}</h3>
      <div style="margin-bottom:8px">${stockBadge}</div>
      <div class="price"><strong>${INR(p.price)}</strong>${p.mrp > p.price ? `<del>${INR(p.mrp)}</del>` : ""}</div>
      <p style="font-size:11px;color:#666;margin-top:4px">${esc(p.scale)} · ${esc(p.speed)} · ${esc(p.drive)}</p>
      <div class="modal-row" style="margin-top:14px">
        ${btnHTML}
        <a class="btn" href="product.html?id=${p.id}">Full product page</a>
      </div>
    </div>
  </div>`;
  openModal("quickModal");
}

function renderCartDrawer() {
  const root = $("#cartItems");
  if (!root) return;
  const c = getCart(), ids = Object.keys(c);
  if (!ids.length) {
    root.innerHTML = '<div class="empty">Your cart is currently empty.</div>';
    $("#cartSummary").style.display = "none";
    return;
  }

  let subtotal = 0;
  root.innerHTML = ids.map(id => {
    const p = getProducts().find(x => String(x.id) === String(id));
    if (!p) return "";
    const qty = c[id];
    const itemTotal = p.price * qty;
    subtotal += itemTotal;
    const stock = p.stock !== undefined ? p.stock : 25;

    return `<div class="cart-item">
      ${(p.image && !p.no_image) ? `<img src="${p.image}" alt="${esc(p.name)}">` : `<div style="width:52px;height:52px;background:#f8f9fa;border-radius:8px;display:grid;place-items:center;font-size:10px;color:#888">📷</div>`}
      <div>
        <b>${esc(p.name)}</b>
        <div style="font-size:10px;color:#666">${esc(p.sku)} · ${stock > 0 ? `In Stock (${stock} avail)` : 'Out of stock'}</div>
        <div class="price" style="margin-top:4px"><strong>${INR(p.price)}</strong> × ${qty} = ${INR(itemTotal)}</div>
        <div style="display:flex;align-items:center;gap:6px;margin-top:6px">
          <button class="qty-btn" onclick="setQty(${idArg(id)}, ${qty - 1})">-</button>
          <span style="font-size:12px;font-weight:900">${qty}</span>
          <button class="qty-btn" onclick="setQty(${idArg(id)}, ${qty + 1})">+</button>
        </div>
      </div>
      <button class="remove" onclick="removeCart(${idArg(id)})">Remove</button>
    </div>`;
  }).join("");

  $("#cartSummary").style.display = "block";
  if ($("#cartSubtotal")) $("#cartSubtotal").textContent = INR(subtotal);
}

// DYNAMIC GLOBAL MODALS & DRAWERS INJECTOR
function ensureGlobalModalsAndDrawers() {
  if (!$("#mobileDrawer")) {
    const div = document.createElement("div");
    div.className = "drawer";
    div.id = "mobileDrawer";
    div.innerHTML = `
      <div class="shade" onclick="closeEl(this)"></div>
      <div class="drawer-panel" style="width:min(380px,90vw);padding:22px">
        <div class="drawer-head">
          <div><b style="color:#ed1c24;font-size:18px;letter-spacing:-.03em">HYPERXGT</b> <span style="font-size:10px;color:#888">Store & Driver Hub</span></div>
          <button class="x" onclick="closeEl(this)">×</button>
        </div>
        
        <div style="margin-top:14px">
          <button class="field" data-modal="searchModal" onclick="closeEl(this); openModal('searchModal')" style="display:flex;align-items:center;gap:10px;color:#888;font-size:13px;text-align:left;cursor:pointer">
            <span>⌕</span> Search SKU, Brushless, 1:14, Drift...
          </button>
        </div>

        <div style="display:flex;flex-direction:column;gap:5px;margin-top:14px;overflow-y:auto;max-height:calc(100vh - 165px);padding-right:4px">
          <div style="font-size:9px;font-weight:900;letter-spacing:.12em;color:#999;text-transform:uppercase;margin:8px 0 4px">Navigation & Store</div>
          <a href="index.html" class="mob-link">🏠 Home Overview</a>
          <a href="shop.html" class="mob-link">🛒 Shop Catalogue (338 Rigs)</a>
          <a href="upgrades.html" class="mob-link">⚡ Upgrades & Spare Parts</a>
          <a href="why.html" class="mob-link">🏆 Why HyperXGT (Hobby Grade)</a>
          <a href="club.html" class="mob-link">🤝 Driver Club & Community</a>

          <div style="font-size:9px;font-weight:900;letter-spacing:.12em;color:#999;text-transform:uppercase;margin:12px 0 4px">Popular RC Categories</div>
          ${getCategories().map(c => `<a href="shop.html?cat=${encodeURIComponent(c.name)}" class="mob-link">${CATEGORY_ICONS[c.name] || "🚗"} ${esc(c.name)} (${c.count})</a>`).join("\n          ")}

          <div style="font-size:9px;font-weight:900;letter-spacing:.12em;color:#999;text-transform:uppercase;margin:12px 0 4px">Customer Care & Tracking</div>
          <a href="contact.html" class="mob-link">💬 Support & WhatsApp Care</a>
          <a href="faq.html" class="mob-link">❓ FAQ & Warranty Policy</a>
          <a href="shipping.html" class="mob-link">🚚 Shipping & Delivery Info</a>
          <a href="returns.html" class="mob-link">🔄 Returns & Replacement</a>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px;padding-bottom:16px">
            <button class="btn blue" data-modal="trackModal" onclick="closeEl(this); openModal('trackModal')" style="height:44px;font-size:12px;display:flex;align-items:center;justify-content:center">⌖ Track Order</button>
            <button class="btn dark" id="btnMobGarageAcc" data-modal="accountModal" onclick="closeEl(this); openModal('accountModal')" style="height:44px;font-size:12px;display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Driver Garage</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(div);
  }

  if (!$("#trackModal")) {
    const div = document.createElement("div");
    div.className = "modal";
    div.id = "trackModal";
    // /api/track-order verifies ownership, so it needs the email or phone on the order
    // as well as the order number. Collecting only the order number always returned 400.
    div.innerHTML = `
      <div class="shade" onclick="closeEl(this)"></div>
      <div class="modal-box">
        <div class="drawer-head"><b>Track My Order</b><button class="x" onclick="closeEl(this)" aria-label="Close">×</button></div>
        <h3 style="font-size:22px;margin:12px 0 16px">Where is my RC?</h3>
        <input class="field" id="trackOrder" placeholder="Order number, e.g. HX-10482" style="margin-bottom:10px">
        <input class="field" id="trackContact" placeholder="Email or mobile used on the order">
        <div class="modal-row"><button class="btn blue" id="trackBtn">Track shipment</button></div>
        <div id="trackResult"></div>
      </div>
    `;
    document.body.appendChild(div);
  }

  if (!$("#searchModal")) {
    const div = document.createElement("div");
    div.className = "modal";
    div.id = "searchModal";
    div.innerHTML = `
      <div class="shade" onclick="closeEl(this)"></div>
      <div class="modal-box">
        <div class="drawer-head"><b>Search HyperXGT</b><button class="x" onclick="closeEl(this)" aria-label="Close">×</button></div>
        <h3 style="font-size:22px;margin:12px 0 16px">What are you looking for?</h3>
        <input class="field" id="searchField" placeholder="Search SKU, 4WD, 1:14, brushless, drift...">
        <div id="searchResults" style="font-size:11px;color:#666;margin-top:10px">Try: drift, racing, off road, 1:14</div>
      </div>
    `;
    document.body.appendChild(div);
  }

  let accModal = $("#accountModal");
  if (!accModal) {
    accModal = document.createElement("div");
    accModal.className = "modal";
    accModal.id = "accountModal";
    document.body.appendChild(accModal);
  }
  if (!$("#accountModalBody", accModal)) {
    accModal.innerHTML = `
      <div class="shade" onclick="closeEl(this)"></div>
      <div class="modal-box" style="max-width:440px;position:relative;z-index:2">
        <div class="drawer-head">
          <b style="font-size:15px;color:#111">Driver Garage Account</b>
          <button class="x" onclick="closeEl(this)" style="cursor:pointer">×</button>
        </div>
        <div id="accountModalBody" style="margin-top:16px"></div>
      </div>
    `;
  }

  // toast() no-ops when #toast is absent, which silently swallowed every confirmation
  // on the pages whose markup never included it (care, club, contact, privacy, returns,
  // upgrades, why). Inject it globally so feedback works everywhere.
  if (!$("#toast")) {
    const t = document.createElement("div");
    t.className = "toast";
    t.id = "toast";
    document.body.appendChild(t);
  }

  if (!$("#cartDrawer")) {
    const div = document.createElement("div");
    div.className = "drawer";
    div.id = "cartDrawer";
    div.innerHTML = `
      <div class="shade" onclick="closeEl(this)"></div>
      <div class="drawer-panel">
        <div class="drawer-head">
          <div><b>Your Cart</b><div style="font-size:10px;color:#888">HyperXGT Store</div></div>
          <button class="x" onclick="closeEl(this)" aria-label="Close">×</button>
        </div>
        <div id="cartItems" class="cart-empty">Your cart is empty.</div>
        <div id="cartSummary" style="display:none;margin-top:22px">
          <a class="btn dark" style="width:100%;display:flex;align-items:center;justify-content:center" href="checkout.html">Proceed to secure checkout</a>
        </div>
      </div>
    `;
    document.body.appendChild(div);
  }

  // productInit() renders a "Submit Review" button on product.html, but the modal it opens
  // only existed in index.html's markup. Inject it wherever it is missing.
  if (!$("#reviewModal")) {
    const div = document.createElement("div");
    div.className = "modal";
    div.id = "reviewModal";
    div.innerHTML = `
      <div class="shade" onclick="closeEl(this)"></div>
      <div class="modal-box" style="width:min(600px,92vw)">
        <div class="drawer-head"><b>Submit Review &amp; Unboxing Content</b><button class="x" onclick="closeEl(this)" aria-label="Close">×</button></div>
        <div style="background:#e8f5e9;border:1px solid #a5d6a7;padding:14px;border-radius:12px;margin:16px 0;font-size:12px;color:#1b5e20;font-weight:700">
          🎉 Submit your review, testimonial, or unboxing video/photo and get a <strong>10% OFF Coupon</strong> upon admin approval!
        </div>
        <form id="reviewSubmissionForm">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div><label class="form-label">Full Name *</label><input class="field" id="revName" required placeholder="Aman Sharma"></div>
            <div><label class="form-label">Email Address *</label><input class="field" type="email" id="revEmail" required placeholder="aman@gmail.com"></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px">
            <div><label class="form-label">Order ID / Ref Number</label><input class="field" id="revOrder" placeholder="HX-10482"></div>
            <div><label class="form-label">Rating (1 to 5 Stars) *</label>
              <select class="field" id="revRating">
                <option value="5" selected>⭐⭐⭐⭐⭐ (5/5 Stars)</option>
                <option value="4">⭐⭐⭐⭐ (4/5 Stars)</option>
                <option value="3">⭐⭐⭐ (3/5 Stars)</option>
              </select>
            </div>
          </div>
          <div style="margin-top:10px">
            <label class="form-label">Review / Testimonial Text *</label>
            <textarea class="field" id="revText" required style="height:90px;padding-top:10px" placeholder="Share your experience driving or unboxing your model..."></textarea>
          </div>
          <div id="revErr" style="color:#ed1c24;font-size:11px;margin-top:10px;display:none"></div>
          <button class="btn dark" type="submit" style="width:100%;height:48px;margin-top:16px">Submit Review &amp; Claim 10% OFF →</button>
        </form>
      </div>
    `;
    document.body.appendChild(div);
  }
}

// The review form markup shipped without any submit handler, so submissions never reached
// /api/submit-review (the endpoint the admin moderation queue reads from).
function initReviewForm() {
  const form = $("#reviewSubmissionForm");
  if (!form || form.dataset.bound === "1") return;
  form.dataset.bound = "1";

  form.onsubmit = async function(e) {
    e.preventDefault();
    const err = $("#revErr");
    const btn = form.querySelector('button[type="submit"]');
    if (err) err.style.display = "none";
    if (btn) btn.disabled = true;

    try {
      const res = await fetch('/api/submit-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: $("#revName")?.value.trim(),
          email: $("#revEmail")?.value.trim(),
          orderId: $("#revOrder")?.value.trim(),
          prodName: document.title.split(" — ")[0],
          rating: $("#revRating")?.value,
          text: $("#revText")?.value.trim()
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Could not submit your review.");

      form.reset();
      closeEl($("#reviewModal"));
      toast("Review submitted! Your coupon is emailed once approved ✓");
    } catch (submitErr) {
      console.error("Review submission failed:", submitErr);
      if (err) {
        err.textContent = submitErr.message || "Could not submit your review.";
        err.style.display = "block";
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  };
}

let currentModalAuthTab = "login";

function renderAccountModalUI() {
  if (!$("#accountModal") || !$("#accountModalBody")) {
    ensureGlobalModalsAndDrawers();
  }
  const body = $("#accountModalBody");
  if (!body) return;

  const user = getAuthUser();

  if (user) {
    body.innerHTML = `
      <div style="text-align:center;padding:12px 0">
        <div style="width:58px;height:58px;border-radius:50%;background:#eef4ff;color:#1488d8;display:grid;place-items:center;font-size:26px;font-weight:900;margin:0 auto 10px">👤</div>
        <h3 style="margin:0;font-size:18px">${esc(user.name || "Customer")}</h3>
        <div style="font-size:12px;color:#666;margin-top:2px">${esc(user.email)}</div>
        <div style="display:inline-block;background:#e8f5e9;color:#2e7d32;font-size:10px;font-weight:900;padding:4px 10px;border-radius:8px;margin-top:10px">AUTHENTICATED DRIVER MEMBER 🛡️</div>

        <div style="display:grid;gap:10px;margin-top:22px">
          <a class="btn blue" href="account.html" style="text-align:center;display:block">Open My Garage & Orders →</a>
          <button class="btn clear" onclick="logoutCustomer(); renderAccountModalUI();" style="border:1px solid #ddd;color:#555">Sign In as Different User</button>
          <button class="btn red" onclick="logoutCustomer(); renderAccountModalUI();">Sign Out</button>
        </div>
      </div>
    `;
    return;
  }

  const isLogin = currentModalAuthTab === "login";
  const isReg = currentModalAuthTab === "register";
  const isForgot = currentModalAuthTab === "forgot";

  body.innerHTML = `
    <div class="auth-pill-nav">
      <button type="button" class="auth-pill-btn ${isLogin ? 'active' : ''}" onclick="currentModalAuthTab='login';renderAccountModalUI()">Sign In</button>
      <button type="button" class="auth-pill-btn ${isReg ? 'active' : ''}" onclick="currentModalAuthTab='register';renderAccountModalUI()">Create Account</button>
      <button type="button" class="auth-pill-btn ${isForgot ? 'active' : ''}" onclick="currentModalAuthTab='forgot';renderAccountModalUI()">Forgot Password</button>
    </div>

    ${isLogin ? `
      <form onsubmit="handleModalAuthSubmit(event, 'login')">
        <h4 style="margin:0 0 12px;font-size:14px">Sign In to Driver Garage</h4>
        <input class="field" id="mLogEmail" type="email" placeholder="Email address" required style="margin-bottom:10px">
        <input class="field" id="mLogPass" type="password" placeholder="Password" required style="margin-bottom:12px">
        <div id="mAuthErr" style="color:#ed1c24;font-size:11px;margin-bottom:10px;display:none"></div>
        <button class="btn dark" type="submit" id="mAuthSubmitBtn" style="width:100%;height:44px;font-size:13px">Sign In →</button>
        <div style="text-align:center;margin-top:10px">
          <a href="#" onclick="currentModalAuthTab='forgot';renderAccountModalUI();return false;" style="font-size:11px;color:#1488d8">Forgot your password?</a>
        </div>
      </form>
    ` : ''}

    ${isReg ? `
      <form onsubmit="handleModalAuthSubmit(event, 'register')">
        <h4 style="margin:0 0 12px;font-size:14px">Create Driver Account</h4>
        <input class="field" id="mRegName" placeholder="Full Name *" required style="margin-bottom:10px">
        <input class="field" id="mRegEmail" type="email" placeholder="Email Address *" required style="margin-bottom:10px">
        <input class="field" id="mRegPhone" type="tel" placeholder="Mobile Number *" required style="margin-bottom:10px">
        <input class="field" id="mRegPass" type="password" placeholder="Choose Password (min 6 chars) *" required style="margin-bottom:12px">
        <div id="mAuthErr" style="color:#ed1c24;font-size:11px;margin-bottom:10px;display:none"></div>
        <button class="btn blue" type="submit" id="mAuthSubmitBtn" style="width:100%;height:44px;font-size:13px;background:#1488d8;color:#fff">Register & Get Gift 🎁</button>
      </form>
    ` : ''}

    ${isForgot ? `
      <form onsubmit="handleModalAuthSubmit(event, 'forgot')">
        <h4 style="margin:0 0 12px;font-size:14px">Reset Your Password</h4>
        <p style="font-size:11px;color:#666;margin-bottom:12px">Enter your email and we'll send a password recovery link.</p>
        <input class="field" id="mForgotEmail" type="email" placeholder="Registered Email Address" required style="margin-bottom:12px">
        <div id="mAuthErr" style="color:#ed1c24;font-size:11px;margin-bottom:10px;display:none"></div>
        <button class="btn dark" type="submit" id="mAuthSubmitBtn" style="width:100%;height:44px;font-size:13px">Send Reset Link 📧</button>
      </form>
    ` : ''}
  `;
}

window.handleModalAuthSubmit = async function(e, type) {
  e.preventDefault();
  const errDiv = $("#mAuthErr");
  const btn = $("#mAuthSubmitBtn");
  if (errDiv) errDiv.style.display = "none";
  if (btn) { btn.disabled = true; btn.style.opacity = "0.6"; }

  try {
    if (type === "login") {
      const email = $("#mLogEmail").value.trim();
      const password = $("#mLogPass").value.trim();
      const res = await fetch('/api/supabase-auth?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Invalid email or password.");
      setAuthSession(data.user, data.token, data.refresh_token);
      toast("Signed in to Driver Garage ✓");
      closeEl($("#accountModal"));
    } else if (type === "register") {
      const name = $("#mRegName").value.trim();
      const email = $("#mRegEmail").value.trim();
      const phone = $("#mRegPhone").value.trim();
      const password = $("#mRegPass").value.trim();
      const res = await fetch('/api/supabase-auth?action=register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, password })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Registration failed");

      // No token means Supabase requires email confirmation — do not fake a session.
      if (!data.token) {
        currentModalAuthTab = "login";
        renderAccountModalUI();
        toast(data.message || `Confirm your email (${email}), then sign in.`);
        return;
      }

      setAuthSession(data.user, data.token, data.refresh_token);
      toast(`Account created! Welcome email sent to ${email} ✓`);
      closeEl($("#accountModal"));
    } else if (type === "forgot") {
      const email = $("#mForgotEmail").value.trim();
      const res = await fetch('/api/supabase-auth?action=forgot_password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Could not send the reset link.");
      toast(`Password reset instructions sent to ${email} ✓`);
      currentModalAuthTab = "login";
      renderAccountModalUI();
    }
  } catch(err) {
    if (errDiv) {
      errDiv.textContent = err.message || "Authentication error";
      errDiv.style.display = "block";
    }
  } finally {
    if (btn) { btn.disabled = false; btn.style.opacity = "1"; }
  }
};

function initChrome() {
  ensureGlobalModalsAndDrawers();
  updateCount();
  renderCartDrawer();
  updateAuthUI();
  renderAccountModalUI();
  initReviewForm();

  // GLOBAL DELEGATED CLICK LISTENER FOR ALL MODALS & DRAWERS
  document.addEventListener("click", (e) => {
    const modalBtn = e.target.closest("[data-modal]");
    if (modalBtn) {
      const modalId = modalBtn.getAttribute("data-modal");
      if (modalId) {
        e.preventDefault();
        openModal(modalId);
        return;
      }
    }

    const drawerBtn = e.target.closest("[data-drawer]");
    if (drawerBtn) {
      const drawerId = drawerBtn.getAttribute("data-drawer");
      if (drawerId) {
        e.preventDefault();
        openModal(drawerId);
        return;
      }
    }
  });

  // Mobile Menu Triggers (☰ #mobileOpen, .icon.mobile)
  $$("#mobileOpen, .mobileOpen, button.icon.mobile").forEach(mobBtn => {
    mobBtn.onclick = (e) => {
      e.preventDefault();
      openModal("mobileDrawer");
    };
  });

  // Automatically close mobileDrawer when any menu item is clicked
  $$("#mobileDrawer a, #mobileDrawer button").forEach(item => {
    item.addEventListener("click", () => {
      $("#mobileDrawer")?.classList.remove("open");
    });
  });

  // Cart Open 🛒 (#cartOpen)
  $$("#cartOpen, .cartOpen").forEach(cartBtn => {
    cartBtn.onclick = (e) => {
      e.preventDefault();
      renderCartDrawer();
      openModal("cartDrawer");
    };
  });

  // Search Input live filtering in modal
  const searchInput = $("#searchField");
  if (searchInput) {
    searchInput.oninput = function() {
      const q = searchInput.value.toLowerCase().trim();
      const resultsDiv = $("#searchResults");
      if (!resultsDiv) return;
      if (!q) {
        resultsDiv.innerHTML = 'Try: drift, racing, off road, 1:14';
        return;
      }
      const matches = getProducts().filter(p => (p.name + " " + p.sku + " " + p.category).toLowerCase().includes(q)).slice(0, 5);
      if (!matches.length) {
        resultsDiv.innerHTML = '<div style="color:#999;padding:10px 0">No matching models found.</div>';
      } else {
        resultsDiv.innerHTML = matches.map(p => `
          <a href="product.html?id=${p.id}" style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #eee">
            <img src="${safeUrl(p.image)}" alt="" style="width:36px;height:30px;object-fit:contain${p.no_image ? ';display:none' : ''}">
            <div>
              <strong style="color:#111;font-size:12px">${esc(p.name)}</strong>
              <div style="font-size:10px;color:#1488d8">${esc(p.sku)} · ${INR(p.price)}</div>
            </div>
          </a>
        `).join("");
      }
    };
  }

  // Track AWB Order Handler
  const tb = $("#trackBtn");
  if (tb) {
    tb.onclick = async () => {
      const result = $("#trackResult");
      if (!result) return;

      const orderId = $("#trackOrder")?.value.trim() || "";
      const contact = $("#trackContact")?.value.trim() || "";

      const showError = msg => {
        result.innerHTML = `<div style="margin-top:14px;padding:12px 14px;border-radius:12px;background:#ffeeef;border:1px solid #ffc9cc;font-size:12px;color:#b3151b;font-weight:700">${esc(msg)}</div>`;
      };

      if (!orderId) return showError("Please enter your order number.");
      if (!contact) return showError("Please enter the email or mobile number used on the order.");

      // The API accepts either an email or a phone number for ownership verification.
      const params = new URLSearchParams({ orderId });
      params.set(contact.includes("@") ? "email" : "phone", contact);

      tb.disabled = true;
      result.innerHTML = '<div style="margin-top:14px;font-size:11px;color:#888">Fetching live tracking status...</div>';

      try {
        const res = await fetch('/api/track-order?' + params.toString());
        const data = await res.json();

        if (!res.ok || !data.success || !data.tracking) {
          return showError(data.error || "We could not find that order. Please check the details and try again.");
        }

        const t = data.tracking;
        const timeline = Array.isArray(t.timeline) ? t.timeline : [];
        result.innerHTML = `<div style="margin-top:18px;padding:18px;border-radius:16px;background:#f4f6ff;border:1px solid #dfe4ff;text-align:left">
          <div style="font-size:12px;font-weight:900;color:#1488d8">Order ${esc(t.orderId)} · ${esc(t.courier)}</div>
          <div style="font-size:11px;color:#555;margin-top:4px">AWB Tracking: <strong>${esc(t.trackingNumber)}</strong></div>
          <div style="font-size:11px;color:#555;margin-top:4px">Status: <strong>${esc(t.status)}</strong></div>
          <div style="font-size:11px;color:#2e7d32;font-weight:800;margin-top:4px">Est. Delivery: ${esc(t.estimatedDelivery)}</div>
          ${t.shiprocketUrl ? `<a href="${esc(t.shiprocketUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:8px;font-size:11px;color:#1488d8;font-weight:800">Open courier tracking page →</a>` : ''}
          ${timeline.length ? `<div style="margin-top:14px;border-top:1px solid #dfe4ff;padding-top:12px">
            ${timeline.map(s => `<div style="font-size:11px;color:${s.done ? '#2e7d32' : '#888'};margin-bottom:6px">${s.done ? '✅' : '⬜'} ${esc(s.step)} <span style="color:#999">· ${esc(s.time)}</span></div>`).join("")}
          </div>` : ''}
        </div>`;
      } catch (err) {
        console.error("Track order failed:", err);
        showError("Tracking service is unreachable right now. Please try again shortly.");
      } finally {
        tb.disabled = false;
      }
    };
  }

  // Global Close Click Delegate
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("shade") || e.target.classList.contains("x")) {
      const parent = e.target.closest(".modal,.drawer");
      if (parent) parent.classList.remove("open");
    }
  });
}

// QUICK CATEGORY STRIP — counts come from the catalogue so they cannot drift out of date.
const CATEGORY_ICONS = {
  "Racing Cars": "🏁",
  "Drift Cars": "↗",
  "Monster Trucks": "🛞",
  "Off Road Crawlers": "⛰",
  "Buggies & Truggies": "⚡",
  "Collectables": "★"
};

function renderQuickCategories() {
  const container = $("#quickCats");
  if (!container) return;

  container.innerHTML = getCategories().map(c => `
    <a class="cat" href="shop.html?cat=${encodeURIComponent(c.name)}">
      <div class="dot">${CATEGORY_ICONS[c.name] || "🚗"}</div>
      <b>${esc(c.name)}</b>
      <small>${c.count} model${c.count === 1 ? "" : "s"}</small>
    </a>
  `).join("");
}

// CATEGORY PRODUCT CAROUSELS
function renderCategoryCarousels() {
  const container = $("#categoryCarousels");
  if (!container) return;

  const productsList = getProducts();
  // Collectables is the display-only long tail; the rails showcase the driveable ranges.
  const categories = getCategories().filter(c => c.name !== "Collectables").map(c => c.name);

  container.innerHTML = categories.map(cat => {
    const catProducts = productsList.filter(p => p.category === cat).slice(0, 10);
    if (!catProducts.length) return "";

    const cardsHTML = catProducts.map(p => {
      const stock = p.stock !== undefined ? p.stock : 25;
      return `
        <div class="carousel-card" style="flex:0 0 270px;background:#fff;border:1px solid var(--line);border-radius:18px;padding:16px;scroll-snap-align:start;display:flex;flex-direction:column;justify-content:space-between">
          <a href="product.html?id=${p.id}">
            ${(p.image && !p.no_image) ? `<img src="${p.image}" alt="${esc(p.name)}" style="width:100%;height:165px;object-fit:contain;background:#f8f9fa;border-radius:12px;padding:10px">` : `<div style="width:100%;height:165px;background:#f8f9fa;border-radius:12px;display:grid;place-items:center;color:#888;font-size:11px;font-weight:700">📷 Coming Soon</div>`}
            <div style="font-size:9px;font-weight:900;color:#1488d8;margin-top:10px">${esc(p.category)} · ${esc(p.sku)}</div>
            <h4 style="font-size:13px;line-height:1.3;margin:4px 0 8px;color:#111;min-height:34px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(p.name)}</h4>
          </a>
          <div>
            <div style="font-size:10px;font-weight:900;color:${stock > 0 ? '#2e7d32' : '#ed1c24'}">${stock > 0 ? `🟢 In Stock (${stock})` : '🔴 Out of Stock'}</div>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:10px">
              <strong style="font-size:15px;color:#111;flex-shrink:0;white-space:nowrap">${INR(p.price)}</strong>
              <button class="mini-btn solid" onclick="addCart(${idArg(p.id)})" style="flex:0 0 auto;height:34px;padding:0 14px;white-space:nowrap">Add 🛒</button>
            </div>
          </div>
        </div>
      `;
    }).join("");

    const carouselId = "car_" + cat.replace(/[^a-zA-Z]/g, "");

    return `
      <div style="margin-bottom:48px">
        <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:16px">
          <div>
            <div class="eyebrow">${esc(cat)} Collection</div>
            <h3 style="font-size:24px;font-weight:900;margin-top:4px">${esc(cat)}</h3>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <button onclick="scrollCarousel('${carouselId}', -300)" style="width:36px;height:36px;border-radius:50%;border:1px solid var(--line);background:#fff;font-weight:900;cursor:pointer">‹</button>
            <button onclick="scrollCarousel('${carouselId}', 300)" style="width:36px;height:36px;border-radius:50%;border:1px solid var(--line);background:#fff;font-weight:900;cursor:pointer">›</button>
            <a href="shop.html?cat=${encodeURIComponent(cat)}" class="btn clear" style="height:36px;padding:0 14px;display:inline-flex;align-items:center;background:#f0f2f5;color:#111;font-size:11px">View All (${productsList.filter(p=>p.category===cat).length}) →</a>
          </div>
        </div>
        <div id="${carouselId}" style="display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-behavior:smooth;padding-bottom:12px;-webkit-overflow-scrolling:touch">
          ${cardsHTML}
        </div>
      </div>
    `;
  }).join("");
}

window.scrollCarousel = function(id, offset) {
  const el = document.getElementById(id);
  if (el) el.scrollBy({ left: offset, behavior: 'smooth' });
};

// BRAND COLLABORATIONS CAROUSEL
async function renderCollaborationsRail() {
  const container = $("#collaborationsRail");
  if (!container) return;

  try {
    const res = await fetch('/api/collaborations');
    const data = await res.json();
    const collabs = (data && data.collaborations) ? data.collaborations.filter(c => c.active) : [];

    if (collabs.length) {
      container.innerHTML = collabs.map(c => `
        <a href="${safeUrl(c.link, 'index.html')}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:10px;padding:12px 24px;background:#fff;border:1px solid var(--line);border-radius:14px;white-space:nowrap;font-weight:800;font-size:12px;color:#111">
          <img src="${safeUrl(c.logo)}" alt="${esc(c.name)}" style="width:32px;height:32px;object-fit:contain">
          <span>${esc(c.name)}</span>
        </a>
      `).join("");
    } else {
      container.innerHTML = '';
    }
  } catch (e) {
    console.error("Collaborations rail failed to load:", e);
    container.innerHTML = '';
  }
}

// SHOP FILTERING & DYNAMIC PAGINATION
let currentPage = 1;
const itemsPerPage = 16;

function shopInit() {
  const grid = $("#shopGrid");
  if (!grid) return;

  const qs = new URLSearchParams(location.search);
  const searchInput = $("#searchFilter");
  const catSelect = $("#catFilter");
  const scaleSelect = $("#scaleFilter");
  const priceSelect = $("#priceFilter");
  const sortSelect = $("#sortFilter");

  // Always rebuild from the catalogue: the static markup listed a "Mini RC" category that
  // no product has, and omitted several scales that products do have.
  if (catSelect) {
    catSelect.innerHTML = `<option value="">All Categories</option>` +
      getCategories().map(c => `<option value="${esc(c.name)}">${esc(c.name)} (${c.count})</option>`).join("");
  }
  if (scaleSelect) {
    scaleSelect.innerHTML = `<option value="">All Scales</option>` +
      getScales().map(s => `<option value="${esc(s)}">${esc(s)} Scale</option>`).join("");
  }

  // Only apply a URL filter the catalogue can actually satisfy, so a stale link shows the
  // full catalogue rather than a silently empty grid.
  const qsCat = qs.get("cat");
  if (catSelect && qsCat) {
    catSelect.value = qsCat;
    if (catSelect.value !== qsCat) catSelect.value = "";
  }
  const qsScale = qs.get("scale");
  if (scaleSelect && qsScale) {
    scaleSelect.value = qsScale;
    if (scaleSelect.value !== qsScale) scaleSelect.value = "";
  }

  if (searchInput && qs.get("q")) searchInput.value = qs.get("q");

  function render() {
    let a = [...getProducts()];

    const q = (searchInput?.value || "").toLowerCase().trim();
    if (q) a = a.filter(p => (p.name + " " + p.sku + " " + p.category + " " + (p.scale || '')).toLowerCase().includes(q));

    const cat = catSelect?.value || "";
    if (cat) a = a.filter(p => p.category === cat);

    const scale = scaleSelect?.value || "";
    if (scale) a = a.filter(p => p.scale === scale);

    const maxPrice = Number(priceSelect?.value || 0);
    if (maxPrice > 0) a = a.filter(p => p.price <= maxPrice);

    const sort = sortSelect?.value || "";
    if (sort === "low") a.sort((x, y) => x.price - y.price);
    else if (sort === "high") a.sort((x, y) => y.price - x.price);
    else if (sort === "discount") a.sort((x, y) => (y.discount || 0) - (x.discount || 0));

    if ($("#resultCount")) $("#resultCount").textContent = `${a.length} Products Found`;
    if ($("#shopCount")) $("#shopCount").textContent = `${a.length} Products Found`;

    const totalPages = Math.max(1, Math.ceil(a.length / itemsPerPage));
    if (currentPage > totalPages) currentPage = 1;

    const startIdx = (currentPage - 1) * itemsPerPage;
    const pageProducts = a.slice(startIdx, startIdx + itemsPerPage);

    if (!pageProducts.length) {
      grid.innerHTML = '<div class="empty" style="grid-column:1/-1;text-align:center;padding:48px;color:#888">No matching models found. Try clearing filters.</div>';
    } else {
      try {
        grid.innerHTML = pageProducts.map(productCard).filter(Boolean).join("");
      } catch(err) {
        console.error("Shop grid render error:", err);
        const fallback = (window.HX_PRODUCTS || []).slice(0, itemsPerPage);
        grid.innerHTML = fallback.map(productCard).filter(Boolean).join("");
      }
    }

    const pager = $("#pager");
    if (pager) {
      if (totalPages <= 1) {
        pager.innerHTML = "";
      } else {
        let pagerHTML = "";
        
        // Prev button
        if (currentPage > 1) {
          pagerHTML += `<button class="page-btn page-nav-btn" onclick="goToShopPage(${currentPage - 1})">← Prev</button>`;
        } else {
          pagerHTML += `<button class="page-btn page-nav-btn disabled" disabled>← Prev</button>`;
        }
        
        // Sliding window page numbers & ellipsis
        const items = getPaginationItems(currentPage, totalPages);
        items.forEach(item => {
          if (item === "...") {
            pagerHTML += `<span class="page-ellipsis">…</span>`;
          } else {
            const isActive = item === currentPage;
            pagerHTML += `<button class="page-btn page-num ${isActive ? 'active' : ''}" onclick="goToShopPage(${item})">${item}</button>`;
          }
        });
        
        // Next button
        if (currentPage < totalPages) {
          pagerHTML += `<button class="page-btn page-nav-btn" onclick="goToShopPage(${currentPage + 1})">Next →</button>`;
        } else {
          pagerHTML += `<button class="page-btn page-nav-btn disabled" disabled>Next →</button>`;
        }
        
        pager.innerHTML = pagerHTML;
      }
    }
  }

  function getPaginationItems(currentPage, totalPages) {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const delta = 2;
    const range = [];
    const rangeWithDots = [];
    let l;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        range.push(i);
      }
    }

    for (let i of range) {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    }
    return rangeWithDots;
  }

  window.goToShopPage = function(pNum) {
    currentPage = pNum;
    render();
    const target = grid || $("#shopGrid") || document.body;
    const topPos = target.getBoundingClientRect().top + window.pageYOffset - 110;
    window.scrollTo({ top: Math.max(0, topPos), behavior: 'smooth' });
  };

  // shopInit() runs again whenever live backend products arrive, so bind filters only once —
  // otherwise every refresh stacked another listener and re-rendered the grid N times.
  [searchInput, catSelect, scaleSelect, priceSelect, sortSelect].forEach(el => {
    if (!el || el.dataset.bound === "1") return;
    el.dataset.bound = "1";
    el.addEventListener("change", () => { currentPage = 1; render(); });
    if (el.tagName === "INPUT") el.addEventListener("input", () => { currentPage = 1; render(); });
  });

  render();
}

// DYNAMIC HOMEPAGE HERO BANNER SYNCHRONIZER
function initHeroBannerLive() {
  const heroMain = $(".hero-main.ambassador-hero, .hero-main");
  if (!heroMain) return;

  const applyHeroData = (data) => {
    if (!data) return;
    
    // 1. Eyebrow
    const eyebrowEl = $(".hero-copy .eyebrow", heroMain);
    if (eyebrowEl && data.eyebrow) eyebrowEl.textContent = data.eyebrow;

    // 2. Headline
    const h1El = $(".hero-copy h1", heroMain);
    if (h1El && data.title) h1El.textContent = data.title;

    // 3. Narrative Description
    const pEl = $(".hero-copy p", heroMain);
    if (pEl && data.description) pEl.textContent = data.description;

    // 4. Primary CTA Button
    const primaryBtn = $(".hero-ctas .btn.white", heroMain);
    if (primaryBtn) {
      if (data.primaryBtnText) primaryBtn.textContent = data.primaryBtnText;
      if (data.primaryBtnUrl) primaryBtn.href = data.primaryBtnUrl;
    }

    // 5. Secondary CTA Button
    const secondaryBtn = $(".hero-ctas .btn.clear", heroMain);
    if (secondaryBtn) {
      if (data.secondaryBtnText) secondaryBtn.textContent = data.secondaryBtnText;
      if (data.secondaryBtnUrl) secondaryBtn.href = data.secondaryBtnUrl;
    }

    // 6. Background Car Image
    const bgCarImg = $("img.hero-bg-car", heroMain);
    if (bgCarImg && data.bgImage) {
      bgCarImg.src = data.bgImage;
    }

    // 7. Brand Ambassador Showcase
    const ambLayer = $(".ambassador-layer", heroMain);
    if (ambLayer) {
      if (data.showAmbassador === false || data.showAmbassador === "false") {
        ambLayer.style.display = "none";
      } else {
        ambLayer.style.display = "block";
        const ambImg = $("img", ambLayer);
        if (ambImg && data.ambassadorImage) ambImg.src = data.ambassadorImage;
      }
    }

    // 8. Performance Badges
    const heroNotes = $$(".hero-note > div", heroMain);
    if (heroNotes.length >= 3) {
      if (data.badge1Label && $("strong", heroNotes[0])) $("strong", heroNotes[0]).textContent = data.badge1Label;
      if (data.badge1Sub && $("span", heroNotes[0])) $("span", heroNotes[0]).textContent = data.badge1Sub;
      if (data.badge2Label && $("strong", heroNotes[1])) $("strong", heroNotes[1]).textContent = data.badge2Label;
      if (data.badge2Sub && $("span", heroNotes[1])) $("span", heroNotes[1]).textContent = data.badge2Sub;
      if (data.badge3Label && $("strong", heroNotes[2])) $("strong", heroNotes[2]).textContent = data.badge3Label;
      if (data.badge3Sub && $("span", heroNotes[2])) $("span", heroNotes[2]).textContent = data.badge3Sub;
    }

    // 9. Side Feature Cards
    const sideCards = $$(".hero-side .side-card");
    if (sideCards.length >= 2) {
      // Side Card 1
      if (data.sideCard1Image && $("img", sideCards[0])) $("img", sideCards[0]).src = data.sideCard1Image;
      if (data.sideCard1Category && $("small", sideCards[0])) $("small", sideCards[0]).textContent = data.sideCard1Category;
      if (data.sideCard1Title && $("h3", sideCards[0])) $("h3", sideCards[0]).innerHTML = data.sideCard1Title.replace(/\n/g, "<br>");
      if (data.sideCard1Link) sideCards[0].href = data.sideCard1Link;

      // Side Card 2
      if (data.sideCard2Image && $("img", sideCards[1])) $("img", sideCards[1]).src = data.sideCard2Image;
      if (data.sideCard2Category && $("small", sideCards[1])) $("small", sideCards[1]).textContent = data.sideCard2Category;
      if (data.sideCard2Title && $("h3", sideCards[1])) $("h3", sideCards[1]).innerHTML = data.sideCard2Title.replace(/\n/g, "<br>");
      if (data.sideCard2Link) sideCards[1].href = data.sideCard2Link;
    }

    // 10. "Find your kind of fast" Terrain Cards Section (#shop)
    const terrainSection = $("#shop");
    if (terrainSection) {
      if (data.terrainSectionEyebrow && $(".section-head .eyebrow", terrainSection)) {
        $(".section-head .eyebrow", terrainSection).textContent = data.terrainSectionEyebrow;
      }
      if (data.terrainSectionTitle && $(".section-head h2", terrainSection)) {
        $(".section-head h2", terrainSection).textContent = data.terrainSectionTitle;
      }
      if (data.terrainSectionDesc && $(".section-head p", terrainSection)) {
        $(".section-head p", terrainSection).textContent = data.terrainSectionDesc;
      }

      const collCards = $$(".collection-band .collection", terrainSection);
      if (collCards.length >= 2) {
        // Terrain Card 1 (Crawlers & Off Road)
        if (data.terrainCard1Link) collCards[0].href = data.terrainCard1Link;
        if (data.terrainCard1Image && $("img", collCards[0])) $("img", collCards[0]).src = data.terrainCard1Image;
        if (data.terrainCard1Eyebrow && $(".copy .eyebrow", collCards[0])) $(".copy .eyebrow", collCards[0]).textContent = data.terrainCard1Eyebrow;
        if (data.terrainCard1Title && $(".copy h3", collCards[0])) $(".copy h3", collCards[0]).textContent = data.terrainCard1Title;
        if (data.terrainCard1Desc && $(".copy p", collCards[0])) $(".copy p", collCards[0]).textContent = data.terrainCard1Desc;
        if (data.terrainCard1BtnText && $(".copy .textlink", collCards[0])) $(".copy .textlink", collCards[0]).textContent = data.terrainCard1BtnText;

        // Terrain Card 2 (Racing & Speed)
        if (data.terrainCard2Link) collCards[1].href = data.terrainCard2Link;
        if (data.terrainCard2Image && $("img", collCards[1])) $("img", collCards[1]).src = data.terrainCard2Image;
        if (data.terrainCard2Eyebrow && $(".copy .eyebrow", collCards[1])) $(".copy .eyebrow", collCards[1]).textContent = data.terrainCard2Eyebrow;
        if (data.terrainCard2Title && $(".copy h3", collCards[1])) $(".copy h3", collCards[1]).textContent = data.terrainCard2Title;
        if (data.terrainCard2Desc && $(".copy p", collCards[1])) $(".copy p", collCards[1]).textContent = data.terrainCard2Desc;
        if (data.terrainCard2BtnText && $(".copy .textlink", collCards[1])) $(".copy .textlink", collCards[1]).textContent = data.terrainCard2BtnText;
      }
    }
  };

  // 1. Instant load from local cache
  try {
    const cached = localStorage.getItem("hx_hero_settings");
    if (cached) applyHeroData(JSON.parse(cached));
  } catch(e) {}

  // 2. Background sync from server API
  fetch("/api/integrations?service=hero")
    .then(r => r.json())
    .then(res => {
      if (res && res.status === "ok" && res.data) {
        applyHeroData(res.data);
        try { localStorage.setItem("hx_hero_settings", JSON.stringify(res.data)); } catch(e) {}
      }
    })
    .catch(() => {});
}

function homeInit() {
  initHeroBannerLive();
  const root = $("#homeProducts");
  if (!root) return;
  function show(cat = "All") {
    let a = getProducts().filter(p => p.image && p.category !== "Collectables");
    if (cat !== "All") a = a.filter(p => p.category === cat);
    a = a.sort((x, y) => (y.featured - x.featured) || (y.discount - x.discount)).slice(0, 8);
    root.innerHTML = a.map(productCard).join("");
  }
  show();
  $$("[data-home-filter]").forEach(b => b.onclick = () => {
    $$("[data-home-filter]").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    show(b.dataset.homeFilter);
  });
}

// CRAZYRC-INSPIRED RICH & KNOWLEDGEABLE PRODUCT PAGE HELPER METHODS
window.switchProductTab = function(tabId, btn) {
  const wrapper = btn.closest(".product-tabs-wrapper");
  if (!wrapper) return;
  const buttons = wrapper.querySelectorAll(".product-tab-btn");
  const panes = wrapper.querySelectorAll(".product-tab-pane");
  buttons.forEach(b => b.classList.remove("active"));
  panes.forEach(p => p.classList.remove("active"));
  btn.classList.add("active");
  const activePane = wrapper.querySelector("#tab-" + tabId);
  if (activePane) activePane.classList.add("active");
};

window.buyNowDirect = function(id, qty = 1) {
  const q = Number(qty) || 1;
  const c = getCart();
  c[id] = (c[id] || 0) + q;
  setCart(c);
  location.href = "checkout.html";
};

function renderInBoxTabHTML(p) {
  const customInBox = p.in_box || p.package_contents;
  if (customInBox && String(customInBox).trim()) {
    const raw = String(customInBox).trim();
    const hasHtmlTags = /<\/?(p|div|br|h[1-6]|ul|ol|li|strong|b)/i.test(raw);
    let listContent = "";
    if (hasHtmlTags) {
      listContent = raw;
    } else {
      const items = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      listContent = `<ul style="margin:0;padding-left:20px;font-size:14px;line-height:2;color:#333">
        ${items.map(item => `<li>${esc(item.replace(/^[•\-\*]\s*/, ''))}</li>`).join("")}
      </ul>`;
    }

    return `
      <div style="max-width:800px">
        <div class="eyebrow" style="color:#1488d8">Complete Unboxing Set</div>
        <h2 style="font-size:24px;margin:8px 0 16px;color:#111">Package Contents</h2>
        <p style="color:#555;margin-bottom:20px">Every HyperXGT model comes 100% factory assembled and Ready-to-Run (RTR) out of the box.</p>
        <div style="background:#f8f9fa;border:1px solid var(--line);border-radius:16px;padding:24px">
          ${listContent}
        </div>
        <div style="margin-top:20px;background:#ffeeef;border:1px solid #ffcdd2;border-radius:14px;padding:16px 20px">
          <strong style="color:#ed1c24;display:block;margin-bottom:4px">⚠️ Required for Operation:</strong>
          <span style="font-size:13px;color:#666">Transmitter requires standard AA batteries for the remote controller (not included).</span>
        </div>
      </div>
    `;
  }

  return `
    <div style="max-width:800px">
      <div class="eyebrow" style="color:#1488d8">Complete Unboxing Set</div>
      <h2 style="font-size:24px;margin:8px 0 16px;color:#111">Package Contents</h2>
      <p style="color:#555;margin-bottom:20px">Every HyperXGT model comes 100% factory assembled and Ready-to-Run (RTR) out of the box.</p>

      <div style="background:#f8f9fa;border:1px solid var(--line);border-radius:16px;padding:24px">
        <ul style="margin:0;padding-left:20px;font-size:14px;line-height:2;color:#333">
          <li>1 × <strong>${esc(p.name)}</strong> Model Vehicle (battery pre-installed)</li>
          <li>1 × <strong>2.4GHz Proportional Remote Controller</strong></li>
          <li>1 × <strong>${esc(p.battery || 'Rechargeable Li-ion Battery Pack')}</strong></li>
          <li>1 × <strong>USB High-Speed Charging Cable</strong></li>
          <li>1 × <strong>Wheel Wrench & Cross Tool Set</strong></li>
          <li>1 × <strong>Official Instruction & Tuning Manual</strong></li>
        </ul>
      </div>

      <div style="margin-top:20px;background:#ffeeef;border:1px solid #ffcdd2;border-radius:14px;padding:16px 20px">
        <strong style="color:#ed1c24;display:block;margin-bottom:4px">⚠️ Required for Operation:</strong>
        <span style="font-size:13px;color:#666">Transmitter requires 3 or 4 × standard AA batteries for the remote controller (not included).</span>
      </div>
    </div>
  `;
}

function renderAmcTabHTML(p) {
  if (p.amc_custom && String(p.amc_custom).trim()) {
    return `
      <div style="max-width:850px">
        <div class="eyebrow" style="color:#ed1c24">Dedicated RC Protection</div>
        <h2 style="font-size:24px;margin:8px 0 16px;color:#111">HyperXGT AMC & Annual Care Program</h2>
        <div style="background:#f8f9fa;border:1px solid var(--line);border-radius:16px;padding:24px;font-size:14px;line-height:1.8;color:#333">
          ${formatDescriptionHTML(p.amc_custom)}
        </div>
        <div style="margin-top:20px">
          <a class="btn blue" href="care.html" style="display:inline-flex;align-items:center;height:44px;padding:0 24px;font-size:13px">Learn more about Care & Support →</a>
        </div>
      </div>
    `;
  }

  return `
    <div style="max-width:850px">
      <div class="eyebrow" style="color:#ed1c24">Dedicated RC Protection</div>
      <h2 style="font-size:24px;margin:8px 0 16px;color:#111">HyperXGT AMC & Annual Care Program</h2>
      <p style="color:#555;margin-bottom:24px">Give your RC model the protection it deserves. Every new HyperXGT vehicle purchase includes <strong>6 months of complimentary AMC coverage</strong> right from day one.</p>

      <h3 style="font-size:16px;color:#111;margin-bottom:12px">🛡️ What's Covered:</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px">
        <div style="background:#f8f9fa;padding:14px 16px;border-radius:12px;border:1px solid var(--line)">
          <strong>✅ Accidental Damage Support</strong>
          <span style="font-size:12px;color:#666;display:block;margin-top:4px">Covers high-speed crashes, suspension snaps, and rollover impacts.</span>
        </div>
        <div style="background:#f8f9fa;padding:14px 16px;border-radius:12px;border:1px solid var(--line)">
          <strong>⚙️ Mechanical & Gear Overhaul</strong>
          <span style="font-size:12px;color:#666;display:block;margin-top:4px">Includes differential calibration, motor servicing, and steering servo maintenance.</span>
        </div>
        <div style="background:#f8f9fa;padding:14px 16px;border-radius:12px;border:1px solid var(--line)">
          <strong>🔋 Battery & ESC Diagnostics</strong>
          <span style="font-size:12px;color:#666;display:block;margin-top:4px">Full electronic speed controller troubleshooting and voltage testing.</span>
        </div>
        <div style="background:#f8f9fa;padding:14px 16px;border-radius:12px;border:1px solid var(--line)">
          <strong>🚀 Priority Lab Turnaround</strong>
          <span style="font-size:12px;color:#666;display:block;margin-top:4px">48-hour response and expedited repair lab queue for members.</span>
        </div>
      </div>

      <a class="btn blue" href="care.html" style="display:inline-flex;align-items:center;height:44px;padding:0 24px;font-size:13px">Learn more about Care & Support →</a>
    </div>
  `;
}

function renderShippingTabHTML(p) {
  if (p.shipping_custom && String(p.shipping_custom).trim()) {
    return `
      <div style="max-width:850px">
        <div class="eyebrow" style="color:#1488d8">Domestic Courier & Fulfillment</div>
        <h2 style="font-size:24px;margin:8px 0 16px;color:#111">Shipping & Express Delivery Information</h2>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:14px;padding:20px;font-size:14px;line-height:1.8;color:#333">
          ${formatDescriptionHTML(p.shipping_custom)}
        </div>
      </div>
    `;
  }

  return `
    <div style="max-width:850px">
      <div class="eyebrow" style="color:#1488d8">Domestic Courier & Fulfillment</div>
      <h2 style="font-size:24px;margin:8px 0 16px;color:#111">Shipping & Express Delivery Information</h2>

      <div style="display:grid;gap:16px;margin-top:16px">
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:14px;padding:18px 20px">
          <strong style="color:#166534;font-size:15px;display:block;margin-bottom:4px">🚀 Fast In-Stock Dispatch (24–48 Hours)</strong>
          <span style="font-size:13px;color:#333;line-height:1.6">All catalogue models tagged In Stock are dispatched from our central Indian warehouses via premium air & surface courier partners (Shiprocket, Bluedart, Delhivery).</span>
          <ul style="margin:8px 0 0 18px;font-size:12.5px;color:#444">
            <li>Metro Cities: <strong>1–3 Business Days</strong> after dispatch.</li>
            <li>Rest of India: <strong>3–5 Business Days</strong> after dispatch.</li>
          </ul>
        </div>

        <div style="background:#f8f9fa;border:1px solid var(--line);border-radius:14px;padding:18px 20px">
          <strong style="color:#111;font-size:14px;display:block;margin-bottom:4px">📦 Real-Time AWB Tracking</strong>
          <span style="font-size:13px;color:#555">You will receive an automated SMS and WhatsApp update with your live Airway Bill (AWB) tracking link immediately upon courier pickup.</span>
        </div>
      </div>
    </div>
  `;
}

function renderReturnsTabHTML(p) {
  if (p.returns_custom && String(p.returns_custom).trim()) {
    return `
      <div style="max-width:850px">
        <div class="eyebrow" style="color:#ed1c24">Hassle-Free Protection</div>
        <h2 style="font-size:24px;margin:8px 0 16px;color:#111">7-Day Replacement & Warranty Policy</h2>
        <div style="background:#fff8e1;border:1px solid #ffe082;border-radius:14px;padding:20px;font-size:14px;line-height:1.8;color:#333">
          ${formatDescriptionHTML(p.returns_custom)}
        </div>
      </div>
    `;
  }

  return `
    <div style="max-width:850px">
      <div class="eyebrow" style="color:#ed1c24">Hassle-Free Protection</div>
      <h2 style="font-size:24px;margin:8px 0 16px;color:#111">7-Day Replacement & Transit Damage Guarantee</h2>

      <p style="color:#555;font-size:13.5px;line-height:1.7;margin-bottom:20px">
        In rare cases where your package arrives damaged during transit or exhibits a manufacturing defect out of the box, we provide a 100% free pickup and replacement.
      </p>

      <div style="background:#fff8e1;border:1px solid #ffe082;border-radius:14px;padding:18px 20px;margin-bottom:20px">
        <strong style="color:#b78103;font-size:14px;display:block;margin-bottom:6px">📹 Unboxing Video Requirement:</strong>
        <span style="font-size:13px;color:#444;line-height:1.6">
          To guarantee fast approval, record a continuous, unedited video while opening the outer courier parcel. This protects you against courier mishandling and ensures immediate replacement dispatch.
        </span>
      </div>

      <div style="font-size:13px;color:#666;line-height:1.8">
        <strong>How to submit a claim:</strong>
        <ol style="margin:8px 0 0 18px">
          <li>WhatsApp our support team at <strong>+91 70902 27777</strong> or email <strong>contact@hyperxgt.com</strong> with your Order ID.</li>
          <li>Attach your unboxing video footage.</li>
          <li>Our technical support desk approves the pickup within 24–48 hours.</li>
        </ol>
      </div>
    </div>
  `;
}

function productInit() {
  const root = $("#productDetail");
  if (!root) return;

  const qs = new URLSearchParams(location.search);
  const rawId = qs.get("id") || qs.get("sku") || "71";
  const productsList = getProducts();
  const p = productsList.find(x => String(x.id) === String(rawId) || String(x.sku).toLowerCase() === String(rawId).toLowerCase());

  if (!p) {
    document.title = "Product not found — HyperXGT";
    root.innerHTML = `<div class="empty" style="grid-column:1/-1;text-align:center;padding:64px 20px">
      <div style="font-size:48px;margin-bottom:12px">🔍</div>
      <h2 style="font-size:24px;color:#111;margin-bottom:8px">We couldn't find that model</h2>
      <p style="font-size:14px;color:#666;max-width:420px;margin:0 auto 24px">The product <strong>${esc(rawId)}</strong> is no longer in the catalogue, or the link is out of date.</p>
      <a class="btn blue" href="shop.html" style="height:48px;padding:0 28px;display:inline-flex;align-items:center">Browse the full catalogue →</a>
    </div>`;
    return;
  }

  document.title = `${p.name} — HyperXGT`;

  const w = isWished(p.id);
  const stock = p.stock !== undefined ? p.stock : 25;
  const savings = Math.max(0, (p.mrp || 0) - (p.price || 0));

  const imagesList = parseImagesArray(p);
  const heroImage = (p.no_image) ? '' : ((p.image && imagesList.includes(p.image)) ? p.image : imagesList[0] || '');

  const galleryThumbnailsHTML = imagesList.map((img, idx) => {
    const isHero = img.trim() === heroImage.trim() || idx === 0;
    return `
      <img class="product-thumb-item ${isHero ? 'active' : ''}" src="${img.trim()}" alt="Angle ${idx + 1}" onclick="switchHeroImage('${img.trim()}', this)">
    `;
  }).join("");

  let stockStatusHTML = `<div style="margin: 14px 0 16px; font-size: 13px; color: #2e7d32; font-weight: 700; display: flex; align-items: center; gap: 8px; background:#e8f5e9; border:1px solid #c8e6c9; padding:8px 14px; border-radius:10px; width:fit-content">
    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#2e7d32;box-shadow:0 0 0 3px rgba(46,125,50,0.2)"></span>
    In Stock — <strong>${stock} Units Available</strong> for Express Dispatch (Ships in 24 Hours)
  </div>`;
  let buyDetailBtn = `<button class="btn-add-cart-alt" onclick="addCart(${idArg(p.id)}, $('#detailQty').value)">Add to Cart 🛒</button>`;
  let buyNowBtn = `<button class="btn-buy-now" onclick="buyNowDirect(${idArg(p.id)}, $('#detailQty').value)">⚡ Buy It Now</button>`;

  if (stock === 0) {
    stockStatusHTML = `<div style="margin: 14px 0 16px; font-size: 13px; color: #ed1c24; font-weight: 700; display: flex; align-items: center; gap: 8px; background:#ffeeef; border:1px solid #ffcdd2; padding:8px 14px; border-radius:10px; width:fit-content">
      <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#ed1c24"></span>
      Currently Out of Stock (Sold Out)
    </div>`;
    buyDetailBtn = `<button class="btn-add-cart-alt" style="background:#888;cursor:not-allowed" disabled>Out of Stock 🚫</button>`;
    buyNowBtn = `<button class="btn-buy-now" style="background:#aaa;box-shadow:none;cursor:not-allowed" disabled>Sold Out</button>`;
  } else if (stock <= 5) {
    stockStatusHTML = `<div style="margin: 14px 0 16px; font-size: 13px; color: #b78103; font-weight: 700; display: flex; align-items: center; gap: 8px; background:#fff8e1; border:1px solid #ffe082; padding:8px 14px; border-radius:10px; width:fit-content">
      <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#b78103;box-shadow:0 0 0 3px rgba(183,129,3,0.2)"></span>
      Low Stock Alert — <strong>Only ${stock} Units Remaining!</strong> Order soon.
    </div>`;
  }

  let videoPlayerHTML = "";
  if (p.video && p.video.trim()) {
    const vUrl = p.video.trim();
    let vId = "";

    if (vUrl.includes("youtube.com/watch?v=")) {
      vId = vUrl.split("v=")[1]?.split("&")[0];
    } else if (vUrl.includes("youtu.be/")) {
      vId = vUrl.split("youtu.be/")[1]?.split("?")[0];
    } else if (vUrl.includes("youtube.com/shorts/")) {
      vId = vUrl.split("youtube.com/shorts/")[1]?.split("?")[0];
    } else if (vUrl.includes("youtube.com/embed/")) {
      vId = vUrl.split("youtube.com/embed/")[1]?.split("?")[0];
    }

    if (vId) {
      const iframeSrc = `https://www.youtube-nocookie.com/embed/${vId.trim()}?autoplay=0&rel=0`;
      videoPlayerHTML = `
        <div style="margin-top:24px;background:#0d0e11;border-radius:18px;overflow:hidden;box-shadow:var(--shadow);border:1px solid var(--line)">
          <div style="background:#111;padding:12px 18px;color:#fff;font-size:12px;font-weight:900;display:flex;align-items:center;justify-content:space-between">
            <span style="display:flex;align-items:center;gap:8px">🎥 <strong style="color:#ed1c24">Live Action Product Video & Action Demo</strong></span>
            <span style="background:#ed1c24;color:#fff;font-size:10px;font-weight:900;padding:3px 8px;border-radius:6px">YOUTUBE HD</span>
          </div>
          <div style="position:relative;padding-bottom:56.25%;height:0">
            <iframe src="${iframeSrc}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
          </div>
        </div>
      `;
    }
  }

  // Full Rich CrazyRC-Style Product Page HTML
  root.innerHTML = `
    <!-- BREADCRUMB -->
    <div class="product-breadcrumb">
      <a href="index.html">Home</a>
      <span class="sep">/</span>
      <a href="shop.html">Collection</a>
      <span class="sep">/</span>
      <a href="shop.html?cat=${encodeURIComponent(p.category || 'All')}">${esc(p.category || 'RC Cars')}</a>
      <span class="sep">/</span>
      <span style="color:#111;font-weight:600">${esc(p.name)}</span>
    </div>

    <!-- MAIN PRODUCT 2-COLUMN SECTION -->
    <div style="display:grid;grid-template-columns:1.05fr .95fr;gap:44px;align-items:start" class="product-main-grid" id="productMainSection">
      
      <!-- LEFT: IMAGE GALLERY & CRAZYRC TRUST BADGES -->
      <div class="product-gallery-container">
        <div class="product-main-viewport">
          ${(heroImage && heroImage.trim()) ? `<img id="mainProdImg" src="${heroImage.trim()}" alt="${esc(p.name)}">` : `<div style="height:380px;display:grid;place-items:center;color:#666;font-size:15px;font-weight:700;background:#f8f9fa;border-radius:18px;border:1.5px dashed #ccc">📷 Official Product Photos Coming Soon</div>`}
        </div>
        ${imagesList.length > 1 ? `
        <div class="product-thumbs-strip">
          ${galleryThumbnailsHTML}
        </div>` : ''}

        <!-- 6 CRAZYRC-STYLE TRUST BADGES GRID -->
        <div class="crazyrc-trust-grid">
          <div class="crazyrc-trust-item">
            <span class="crazyrc-trust-icon">🇮🇳</span>
            <div>
              <strong class="crazyrc-trust-title">Ships Directly from India</strong>
              <span class="crazyrc-trust-sub">Fast nationwide express delivery (2-5 business days)</span>
            </div>
          </div>
          <div class="crazyrc-trust-item">
            <span class="crazyrc-trust-icon">🛠️</span>
            <div>
              <strong class="crazyrc-trust-title">6 Months Free AMC Care</strong>
              <span class="crazyrc-trust-sub">Complimentary maintenance & repair lab support</span>
            </div>
          </div>
          <div class="crazyrc-trust-item">
            <span class="crazyrc-trust-icon">💬</span>
            <div>
              <strong class="crazyrc-trust-title">WhatsApp Expert Support</strong>
              <span class="crazyrc-trust-sub">Real-time RC troubleshooting 7 days a week</span>
            </div>
          </div>
          <div class="crazyrc-trust-item">
            <span class="crazyrc-trust-icon">🔁</span>
            <div>
              <strong class="crazyrc-trust-title">7-Day Easy Replacement</strong>
              <span class="crazyrc-trust-sub">Hassle-free guarantee for damages or transit defects</span>
            </div>
          </div>
          <div class="crazyrc-trust-item">
            <span class="crazyrc-trust-icon">🔒</span>
            <div>
              <strong class="crazyrc-trust-title">100% Safe & Secure Checkout</strong>
              <span class="crazyrc-trust-sub">Encrypted UPI, Cards, Netbanking & Partial COD</span>
            </div>
          </div>
          <div class="crazyrc-trust-item">
            <span class="crazyrc-trust-icon">⭐</span>
            <div>
              <strong class="crazyrc-trust-title">Trusted by 1000+ RC Hobbyists</strong>
              <span class="crazyrc-trust-sub">Join India's fastest growing RC driver community</span>
            </div>
          </div>
        </div>

        ${videoPlayerHTML}
      </div>


      <!-- RIGHT: PURCHASING & PRODUCT HIGHLIGHTS -->
      <div class="detail-info">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px">
          <span style="background:#111;color:#fff;font-size:11px;font-weight:900;padding:4px 10px;border-radius:6px;letter-spacing:.06em">${esc(p.brand || 'HYPERXGT')}</span>
          <span style="background:#eef4ff;color:#1488d8;font-size:11px;font-weight:900;padding:4px 10px;border-radius:6px">${esc(p.scale || '1:16')} SCALE</span>
          <span style="background:#f0fdf4;color:#16a34a;font-size:11px;font-weight:900;padding:4px 10px;border-radius:6px">${esc(p.drive || '4WD')}</span>
          <span style="color:#666;font-size:12px;margin-left:auto">SKU: <strong>${esc(p.sku)}</strong></span>
        </div>

        <h1 style="font-size:28px;line-height:1.3;margin:8px 0 12px;color:#111;letter-spacing:-.02em">${esc(p.name)}</h1>

        <!-- REVIEWS SUMMARY BADGE -->
        <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#555;margin-bottom:16px">
          <span style="color:#f59e0b;font-weight:900;letter-spacing:.08em">★★★★★</span>
          <strong style="color:#111">5.0</strong>
          <a href="#ProductSignleReview" onclick="document.getElementById('ProductSignleReview')?.scrollIntoView({behavior:'smooth'}); return false;" style="color:#1488d8;text-decoration:underline;font-weight:600;cursor:pointer">(24 Reviews)</a>
          <span style="color:#999">·</span>
          <span style="color:#16a34a;font-weight:700">✓ Verified RC Buyers</span>
        </div>
        
        <!-- PRICE & DISCOUNT -->
        <div class="detail-price" style="display:flex;align-items:baseline;gap:12px;margin:14px 0 8px;flex-wrap:wrap">
          <strong style="font-size:34px;color:#db0000;letter-spacing:-.03em">${INR(p.price)}</strong>
          ${p.mrp > p.price ? `<del style="font-size:18px;color:#888">${INR(p.mrp)}</del>` : ""}
          ${savings > 0 ? `<span style="font-size:13px;color:#ed1c24;font-weight:900;background:#ffeeef;padding:4px 12px;border-radius:8px">SAVE ${INR(savings)} (${p.discount}% OFF)</span>` : ""}
        </div>
        <div style="font-size:12px;color:#666;margin-bottom:16px">
          Inclusive of all taxes (18% GST). <strong>Free Express Courier Delivery</strong> across India.
        </div>

        ${stockStatusHTML}

        <!-- QUICK HIGHLIGHT SPECS SNAPSHOT -->
        <div class="quick-specs-grid">
          <div class="quick-spec-card">
            <span>🚀 Top Speed</span>
            <strong>${esc(p.speed || '50+ KM/H')}</strong>
          </div>
          <div class="quick-spec-card">
            <span>🕹️ Control Range</span>
            <strong>${esc(p.control || '2.4GHz 100m+')}</strong>
          </div>
          <div class="quick-spec-card">
            <span>⚙️ Drive System</span>
            <strong>${esc(p.drive || '4WD Full-Time')}</strong>
          </div>
          <div class="quick-spec-card">
            <span>🔋 Power Motor</span>
            <strong>${esc(p.motor ? (p.motor.length > 18 ? p.motor.substring(0, 18) + '...' : p.motor) : 'Electric Motor')}</strong>
          </div>
        </div>

        <!-- NARRATIVE SHORT DESCRIPTION -->
        <div class="product-short-desc" style="color:#444; font-size: 14px; line-height: 1.7; margin-bottom: 24px; background:#f9fafb; padding:18px 20px; border-radius:14px; border:1px solid #eaedf2">
          ${formatDescriptionHTML(p.short_description, `Experience high-performance RC action with the official ${esc(p.brand || 'HyperXGT')} ${esc(p.scale || '1:16')} ${esc(p.category || 'RC Car')}. Engineered with a heavy-duty chassis, 2.4GHz proportional control, and high-torque power delivery for all terrains.`)}
        </div>

        <!-- ACTION BUTTONS ROW: QUANTITY + ADD TO CART + BUY NOW + WISHLIST -->
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;border:1.5px solid var(--line);border-radius:12px;overflow:hidden;background:#fff;height:52px">
            <button style="width:38px;height:100%;border:0;background:none;font-weight:900;cursor:pointer;font-size:16px" onclick="const i=$('#detailQty'); i.value=Math.max(1, Number(i.value)-1)">-</button>
            <input id="detailQty" style="width:48px;height:100%;border:0;text-align:center;font-weight:900;margin:0;font-size:15px;background:none" type="number" min="1" max="${stock}" value="1">
            <button style="width:38px;height:100%;border:0;background:none;font-weight:900;cursor:pointer;font-size:16px" onclick="const i=$('#detailQty'); i.value=Math.min(${stock}, Number(i.value)+1)">+</button>
          </div>
          ${buyDetailBtn}
          ${buyNowBtn}
          <button class="btn" style="width:52px;height:52px;padding:0;display:grid;place-items:center;font-size:20px;flex-shrink:0" onclick="toggleWish(${idArg(p.id)})">${w ? "♥" : "♡"}</button>
        </div>

        <!-- WHATSAPP FAST ORDER BUTTON -->
        <a href="https://wa.me/917090227777?text=${encodeURIComponent('Hi HyperXGT, I want to inquire about purchasing: ' + p.name + ' (SKU: ' + p.sku + ')')}" target="_blank" style="display:flex;align-items:center;justify-content:center;gap:10px;background:#25d366;color:#fff;border-radius:12px;height:46px;font-weight:800;font-size:13px;margin-bottom:24px;text-decoration:none">
          <span>💬 Chat with RC Expert on WhatsApp (+91 70902 27777)</span>
        </a>

        <!-- PAYMENT ACCEPTANCE STRIP -->
        <div style="background:#f8f9fa;border:1px solid #e5e8ec;border-radius:12px;padding:12px 16px;font-size:11.5px;color:#666;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <span>💳 <strong>Guaranteed Safe Checkout:</strong> UPI · GPay · PhonePe · Cards · Netbanking</span>
          <span style="color:#2e7d32;font-weight:800">256-Bit SSL Encrypted</span>
        </div>
      </div>
    </div>

    <!-- CRAZYRC-STYLE TABBED KNOWLEDGE & SPECIFICATIONS CONTAINER -->
    <div class="product-tabs-wrapper">
      <div class="product-tabs-nav">
        <button class="product-tab-btn active" onclick="switchProductTab('features', this)">📋 Features & Specifications</button>
        <button class="product-tab-btn" onclick="switchProductTab('inbox', this)">📦 What's In The Box</button>
        <button class="product-tab-btn" onclick="switchProductTab('amc', this)">🛠️ AMC / Care Program</button>
        <button class="product-tab-btn" onclick="switchProductTab('shipping', this)">🚚 Shipping & Delivery</button>
        <button class="product-tab-btn" onclick="switchProductTab('returns', this)">🔁 Returns & Warranty</button>
      </div>

      <!-- TAB 1: FEATURES & FULL SPECIFICATIONS -->
      <div class="product-tab-pane active" id="tab-features">
        <div style="display:grid;grid-template-columns:1.2fr .8fr;gap:40px">
          <div>
            <div class="eyebrow" style="color:#1488d8">Vehicle Engineering & Key Features</div>
            <h2 style="font-size:24px;margin:8px 0 16px;color:#111">Full Performance Overview</h2>
            
            <div class="product-full-desc" style="font-size:14px;line-height:1.8;color:#333">
              ${p.full_description ? `
                ${formatDescriptionHTML(p.full_description)}
              ` : `
                <p>${formatDescriptionHTML(p.short_description || `The ${esc(p.brand || 'HyperXGT')} ${esc(p.name)} combines advanced RC engineering with rugged structural durability. Built for enthusiasts who demand extreme power, precision steering, and scale realism across every driving surface.`)}</p>
                
                <h3 style="font-size:17px;color:#111;margin-top:20px">⚡ High-Output Drive & Proportional Control</h3>
                <p>Driven by a high-torque <strong>${esc(p.motor || 'High-Output Electric Motor')}</strong> with <strong>${esc(p.drive || '4WD Full-Time 4-Wheel Drive')}</strong>, offering precise proportional throttle, instantaneous braking, and responsive steering calibration for high-speed tracking and rock crawling.</p>

                <h3 style="font-size:17px;color:#111;margin-top:20px">🕹️ 2.4GHz Anti-Interference Radio Transmitter</h3>
                <p>Reliable 2.4GHz multi-channel transmitter with an operating range of up to <strong>${esc(p.control || '100+ meters')}</strong>. Race alongside friends with zero signal cross-talk or radio interference.</p>

                <h3 style="font-size:17px;color:#111;margin-top:20px">🔋 High-Capacity Battery & Endurance Runtime</h3>
                <p>Equipped with a rechargeable <strong>${esc(p.battery || 'Li-ion Battery Pack')}</strong> and high-speed charging system. Enjoy extended runtimes per charge with built-in low-voltage protection.</p>

                <h3 style="font-size:17px;color:#111;margin-top:20px">🛡️ Heavy-Duty Drivetrain & Chassis</h3>
                <p>Features alloy differential gears, precision ball bearings, and all-terrain rubber tires with aggressive tread patterns for optimal traction across dirt, grass, gravel, and asphalt.</p>
              `}
            </div>
          </div>

          <div>
            <div style="background:#f8f9fa;border:1px solid var(--line);border-radius:18px;padding:24px">
              <h3 style="font-size:17px;margin-top:0;margin-bottom:14px;color:#111">📋 Technical Matrix</h3>
              <div class="spec-table">${renderFullSpecGrid(p)}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 2: IN-BOX ITEMS -->
      <div class="product-tab-pane" id="tab-inbox">
        ${renderInBoxTabHTML(p)}
      </div>

      <!-- TAB 3: AMC / CARE PROGRAM -->
      <div class="product-tab-pane" id="tab-amc">
        ${renderAmcTabHTML(p)}
      </div>

      <!-- TAB 4: SHIPPING & DELIVERY -->
      <div class="product-tab-pane" id="tab-shipping">
        ${renderShippingTabHTML(p)}
      </div>

      <!-- TAB 5: RETURNS & REPLACEMENT POLICY -->
      <div class="product-tab-pane" id="tab-returns">
        ${renderReturnsTabHTML(p)}
      </div>
    </div>


    <!-- CUSTOMER REVIEWS & TESTIMONIALS SECTION -->
    <div style="margin-top:60px;background:#fff;border:1px solid var(--line);border-radius:24px;padding:40px;box-shadow:var(--shadow)" id="ProductSignleReview">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:16px">
        <div>
          <div class="eyebrow" style="color:#2e7d32">Customer Reviews & Unboxing Content</div>
          <h2 style="font-size:26px;margin:4px 0 0;color:#111">Driver Feedback & Testimonials</h2>
        </div>
        <button class="btn blue" onclick="openModal('reviewModal')">⭐ Submit Review & Get 10% OFF Coupon</button>
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px" id="reviewsGrid">
        <div style="background:#f8f9fa;border:1px solid var(--line);border-radius:16px;padding:20px">
          <div style="color:#f59e0b;font-weight:900;font-size:14px;margin-bottom:6px">★★★★★ 5/5 Stars</div>
          <p style="font-size:12.5px;color:#444;line-height:1.6;margin:0 0 10px">"Got mine 5 days ago, love everything about it! The 4WD climbing torque is relentless and the metal gears handle high-speed jumps easily."</p>
          <strong style="font-size:11.5px;color:#111">Vikram S. — Verified Buyer</strong>
        </div>

        <div style="background:#f8f9fa;border:1px solid var(--line);border-radius:16px;padding:20px">
          <div style="color:#f59e0b;font-weight:900;font-size:14px;margin-bottom:6px">★★★★★ 5/5 Stars</div>
          <p style="font-size:12.5px;color:#444;line-height:1.6;margin:0 0 10px">"Super fast delivery to Bangalore. Arrived in 2 days via Bluedart. 2.4GHz remote has zero lag and great range."</p>
          <strong style="font-size:11.5px;color:#111">Rahul M. — Verified Buyer</strong>
        </div>

        <div style="background:#f8f9fa;border:1px solid var(--line);border-radius:16px;padding:20px">
          <div style="color:#f59e0b;font-weight:900;font-size:14px;margin-bottom:6px">★★★★★ 5/5 Stars</div>
          <p style="font-size:12.5px;color:#444;line-height:1.6;margin:0 0 10px">"Best hobby-grade crawler in this price range. Ground clearance is awesome and battery lasts a solid 40+ minutes."</p>
          <strong style="font-size:11.5px;color:#111">Aditya K. — Verified Buyer</strong>
        </div>
      </div>
    </div>
  `;

  // RENDER SIMILAR VARIANTS CATALOGUE RECOMMENDATIONS GRID
  renderRelatedProducts(p);
}

function renderRelatedProducts(currentProduct) {
  const grid = $("#relatedGrid");
  if (!grid) return;

  const all = getProducts();
  let related = all.filter(x => x.id !== currentProduct.id && x.category === currentProduct.category);
  
  if (related.length < 4) {
    const sameScale = all.filter(x => x.id !== currentProduct.id && x.scale === currentProduct.scale && !related.includes(x));
    related = [...related, ...sameScale];
  }

  if (related.length < 4) {
    const remaining = all.filter(x => x.id !== currentProduct.id && !related.includes(x));
    related = [...related, ...remaining];
  }

  const top4 = related.slice(0, 4);
  if (!top4.length) {
    grid.innerHTML = '<div class="empty" style="grid-column:1/-1;text-align:center;padding:24px;color:#888">No related variants found.</div>';
  } else {
    grid.innerHTML = top4.map(productCard).join("");
  }
}

function cartPageInit() {
  const itemsContainer = $("#cartPageItems");
  const summaryContainer = $("#cartPageSummary");
  if (!itemsContainer || !summaryContainer) return;

  const cart = getCart();
  const ids = Object.keys(cart);
  const products = getProducts();

  if (!ids.length) {
    itemsContainer.innerHTML = `
      <div style="text-align:center;padding:60px 20px;background:#fff;border-radius:24px;border:1px solid var(--line);box-shadow:var(--shadow)">
        <div style="font-size:48px;margin-bottom:12px">🛒</div>
        <h2 style="font-size:24px;color:#111;margin-bottom:8px">Your Cart is Currently Empty</h2>
        <p style="font-size:14px;color:#666;max-width:400px;margin:0 auto 24px">Explore our catalogue of 338 pro-grade RC racing cars, crawlers, drift cars, and bashers.</p>
        <a class="btn blue" href="shop.html" style="height:48px;padding:0 28px;display:inline-flex;align-items:center">Shop Catalogue (338 Models) →</a>
      </div>
    `;
    summaryContainer.innerHTML = "";
    return;
  }

  let subtotal = 0;
  let itemsHTML = ids.map(id => {
    const p = products.find(x => String(x.id) === String(id));
    if (!p) return "";
    const qty = cart[id];
    const itemTotal = p.price * qty;
    subtotal += itemTotal;

    return `
      <div style="display:grid;grid-template-columns:100px 1fr 140px 100px;gap:20px;align-items:center;background:#fff;border:1px solid var(--line);border-radius:18px;padding:18px;margin-bottom:14px;box-shadow:var(--shadow)">
        ${(p.image && !p.no_image) ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" style="width:100px;height:80px;object-fit:contain;background:#f8f9fa;border-radius:12px;padding:4px">` : `<div style="width:100px;height:80px;background:#f8f9fa;border-radius:12px;display:grid;place-items:center;font-size:11px;color:#888">📷</div>`}
        <div>
          <span style="font-size:11px;color:#1488d8;font-weight:900">${esc(p.category)} · SKU: ${esc(p.sku)}</span>
          <h3 style="font-size:16px;margin:4px 0 6px;color:#111"><a href="product.html?id=${p.id}" style="color:inherit">${esc(p.name)}</a></h3>
          <div style="font-size:12px;color:#666">${esc(p.scale || '1:16')} · ${esc(p.drive || '4WD')}</div>
        </div>

        <div style="display:flex;align-items:center;gap:8px;background:#f0f4ff;border-radius:10px;padding:4px 8px;width:fit-content">
          <button style="border:0;background:none;font-weight:900;font-size:16px;cursor:pointer;width:24px;height:24px" onclick="updateQty(${idArg(p.id)}, ${qty - 1})">-</button>
          <span style="font-weight:900;font-size:14px;min-width:20px;text-align:center">${qty}</span>
          <button style="border:0;background:none;font-weight:900;font-size:16px;cursor:pointer;width:24px;height:24px" onclick="updateQty(${idArg(p.id)}, ${qty + 1})">+</button>
        </div>

        <div style="text-align:right">
          <strong style="font-size:16px;color:#2e7d32;display:block">${INR(itemTotal)}</strong>
          <button style="border:0;background:none;color:#ed1c24;font-size:11px;font-weight:700;cursor:pointer;margin-top:4px" onclick="removeCartItem(${idArg(p.id)})">Remove 🗑️</button>
        </div>
      </div>
    `;
  }).join("");

  itemsContainer.innerHTML = itemsHTML;

  const shipping = shippingFor(subtotal);
  const grandTotal = subtotal + shipping;

  summaryContainer.innerHTML = `
    <div style="background:#fff;border:1px solid var(--line);border-radius:20px;padding:28px;box-shadow:var(--shadow)">
      <h3 style="font-size:20px;margin-top:0;margin-bottom:18px;color:#111">Order Summary</h3>
      <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:10px">
        <span style="color:#666">Subtotal (${ids.reduce((a,b)=>a+cart[b],0)} items)</span>
        <strong>${INR(subtotal)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:10px">
        <span style="color:#666">Express Courier Delivery</span>
        ${shipping === 0
          ? `<strong style="color:#2e7d32">FREE (over ${INR(FREE_SHIPPING_THRESHOLD)})</strong>`
          : `<strong>${INR(shipping)}</strong>`}
      </div>
      <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid #eee">
        <span style="color:#666">GST & Taxes</span>
        <span style="color:#666">Included in price (18%)</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:18px;margin-bottom:24px">
        <strong style="color:#111">Total Amount</strong>
        <strong style="color:#2e7d32;font-size:22px">${INR(grandTotal)}</strong>
      </div>

      <a class="btn blue" href="checkout.html" style="width:100%;height:52px;font-size:14px;display:flex;align-items:center;justify-content:center">Proceed to Secure Checkout 🔒</a>
      <a class="btn dark" href="shop.html" style="width:100%;height:44px;font-size:13px;display:flex;align-items:center;justify-content:center;margin-top:12px">← Continue Shopping</a>
    </div>
  `;
}

window.removeCartItem = function(id) {
  const c = getCart();
  delete c[id];
  setCart(c);
  updateCount();
  renderCartDrawer();
  cartPageInit();
  toast("Removed item from cart");
};

// cartPageInit() renders quantity steppers that call updateQty(), which was never defined —
// every +/- click on cart.html threw ReferenceError. It is the cart-page counterpart of setQty().
window.updateQty = function(id, q) {
  setQty(id, q);
  cartPageInit();
};

document.addEventListener("DOMContentLoaded", () => {
  initChrome();
  homeInit();
  shopInit();
  productInit();
  cartPageInit();
  renderQuickCategories();
  renderCategoryCarousels();
  renderCollaborationsRail();
  fetchLiveBackendProducts();
});

// Immediate execution to ensure modals exist before any user click
try { ensureGlobalModalsAndDrawers(); } catch(e) {}

