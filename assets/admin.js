// PERSISTENT PRODUCTS DATABASE SYNCHRONIZER
function loadProductsDB() {
  try {
    const local = localStorage.getItem("hx_products_db");
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed && parsed.length) return parsed;
    }
  } catch(e) {}
  return window.HX_PRODUCTS || [];
}

function saveProductsDB(arr) {
  window.HX_PRODUCTS = arr;
  try {
    localStorage.setItem("hx_products_db", JSON.stringify(arr));
    window.dispatchEvent(new CustomEvent("hx_stock_update", { detail: arr }));
  } catch(e) {}
}

let P = loadProductsDB();

const $ = (q, r = document) => r.querySelector(q);
const $$ = (q, r = document) => [...r.querySelectorAll(q)];
const INR = n => "₹" + Number(n || 0).toLocaleString("en-IN");
// The apostrophe key was missing from this map, so the regex matched ' but the lookup
// returned undefined — every apostrophe in a customer name or review rendered as the
// literal text "undefined". Double quotes were also mapped to &#039; instead of &quot;.
const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
// Blocks javascript:/vbscript: URLs from customer-submitted review media reaching an href.
const safeUrl = (u, fallback = "") => {
  const raw = String(u ?? "").trim();
  if (!raw) return fallback;
  if (/^(https?:|data:image\/|data:video\/|mailto:|tel:)/i.test(raw)) return esc(raw);
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return fallback;
  return esc(raw);
};
const openModal = id => $("#" + id)?.classList.add("open");
const closeEl = el => el.closest(".modal,.drawer")?.classList.remove("open");

function toast(msg) {
  const t = $("#toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2400);
}

// ADMIN AUTHENTICATION CONTROLLER
function getAdminToken() {
  return localStorage.getItem("hx_admin_token") || "";
}

function getAdminHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-admin-key': getAdminToken()
  };
}

function checkAdminAuth() {
  const overlay = $("#adminLoginOverlay");
  const portal = $("#adminPortal");
  const token = getAdminToken();

  if (token && localStorage.getItem("hx_admin_logged") === "true") {
    if (overlay) overlay.style.display = "none";
    if (portal) portal.style.display = "block";
  } else {
    if (overlay) overlay.style.display = "flex";
    if (portal) portal.style.display = "none";
  }
}

function initAdminAuth() {
  checkAdminAuth();

  const loginForm = $("#adminLoginForm");
  if (loginForm) {
    loginForm.onsubmit = async function(e) {
      e.preventDefault();
      const email = ($("#adminEmail")?.value || "").trim().toLowerCase();
      const password = ($("#adminPass")?.value || "").trim();

      if ($("#adminLoginErr")) $("#adminLoginErr").style.display = "none";

      try {
        const res = await fetch('/api/admin-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (res.ok && data.success && data.admin_token) {
          localStorage.setItem("hx_admin_token", data.admin_token);
          localStorage.setItem("hx_admin_logged", "true");
          checkAdminAuth();
          toast("Welcome back, Store Admin! 🌟");
        } else {
          if ($("#adminLoginErr")) {
            $("#adminLoginErr").style.display = "block";
            $("#adminLoginErr").textContent = data.error || "Invalid admin credentials";
          }
        }
      } catch(err) {
        if ($("#adminLoginErr")) {
          $("#adminLoginErr").style.display = "block";
          $("#adminLoginErr").textContent = "Authentication service error";
        }
      }
    };
  }

  const logoutBtn = $("#adminLogout");
  if (logoutBtn) {
    logoutBtn.onclick = function() {
      localStorage.removeItem("hx_admin_token");
      localStorage.removeItem("hx_admin_logged");
      checkAdminAuth();
      toast("Logged out of Admin Portal.");
    };
  }
}

// ADMIN TABS NAVIGATION CONTROLLER
function initAdminTabs() {
  $$(".admin-tab").forEach(tab => {
    tab.onclick = function() {
      const target = tab.dataset.tab;
      $$(".admin-tab").forEach(t => t.classList.remove("active"));
      $$(".tab-content").forEach(c => c.classList.remove("active"));
      tab.classList.add("active");
      const targetEl = $("#tab-" + target);
      if (targetEl) targetEl.classList.add("active");
    };
  });
}

// STORE ORDERS DATABASE PERSISTENCE
function getOrdersDB() {
  try {
    const local = localStorage.getItem("hx_orders_db");
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed && parsed.length) return parsed;
    }
  } catch(e) {}
  return window.HX_ORDERS || [];
}

function saveOrdersDB(arr) {
  window.HX_ORDERS = arr;
  try {
    localStorage.setItem("hx_orders_db", JSON.stringify(arr));
  } catch(e) {}
}

window.HX_ORDERS = getOrdersDB();

// MULTI-PHOTO UPLOAD & GALLERY PREVIEW MANAGER WITH INDEX-BASED DELETE
function renderAdminGalleryPreview(urlsList, heroUrl) {
  const previewBox = $("#formGalleryPreview");
  if (!previewBox) return;

  const currentHero = heroUrl || $("#formImage")?.value.trim() || (urlsList && urlsList[0]) || "";

  if (!urlsList || !urlsList.length || !urlsList.filter(Boolean).length) {
    previewBox.innerHTML = `
      <div style="background:#f8f9fa;border:1.5px dashed #1488d8;border-radius:12px;padding:16px;text-align:center;color:#666;font-size:12px;width:100%">
        📷 No photos uploaded yet. Click <strong>"Select Multiple Image Files..."</strong> above to upload your product photos.
      </div>
    `;
    return;
  }

  const activeHero = currentHero.trim();
  const hasMatch = urlsList.some(u => u.trim() === activeHero);

  previewBox.innerHTML = urlsList.filter(Boolean).map((url, idx) => {
    const isHero = hasMatch ? (url.trim() === activeHero) : (idx === 0);
    return `
      <div style="position:relative;display:inline-block;margin-right:10px;margin-bottom:10px">
        <img src="${url.trim()}" title="Click to set as Main Hero Image" onclick="setAsHeroImageByIdx(${idx})" style="width:72px;height:60px;object-fit:contain;background:#fff;border-radius:8px;border:${isHero ? '2.5px solid #1488d8' : '1px solid #ccc'};padding:4px;cursor:pointer">
        <button type="button" onclick="deleteProductImageByIdx(${idx})" style="position:absolute;top:-8px;right:-8px;background:#ed1c24;color:#fff;border:0;width:22px;height:22px;border-radius:50%;font-size:13px;font-weight:900;cursor:pointer;display:grid;place-items:center;z-index:20;box-shadow:0 2px 6px rgba(0,0,0,0.4)" title="Delete this picture">×</button>
        ${isHero ? '<span style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);background:#1488d8;color:#fff;font-size:8px;font-weight:900;padding:1px 5px;border-radius:4px;white-space:nowrap">HERO</span>' : ''}
      </div>
    `;
  }).join("");
}

window.deleteProductImageByIdx = function(idxToDelete) {
  const heroInput = $("#formImage");
  const listTextarea = $("#formImagesList");

  let rawList = listTextarea && listTextarea.value.trim() ? listTextarea.value.split(',').map(x => x.trim()).filter(Boolean) : [];
  if (heroInput && heroInput.value.trim() && !rawList.includes(heroInput.value.trim())) {
    rawList.unshift(heroInput.value.trim());
  }

  const deletedUrl = rawList[idxToDelete];
  rawList.splice(idxToDelete, 1);

  const newHero = rawList[0] || '';
  if (heroInput) {
    heroInput.value = newHero;
  }

  if (listTextarea) {
    listTextarea.value = rawList.join(', ');
  }

  renderAdminGalleryPreview(rawList, newHero);
  toast("Deleted picture from product gallery 🗑️");
};

window.clearAllModalImages = function() {
  if ($("#formImage")) $("#formImage").value = "";
  if ($("#formImagesList")) $("#formImagesList").value = "";
  renderAdminGalleryPreview([]);
  toast("Cleared all photos from this product. Click Save Product to apply ✓");
};

window.setAsHeroImageByIdx = function(idx) {
  const listTextarea = $("#formImagesList");
  let rawList = listTextarea && listTextarea.value.trim() ? listTextarea.value.split(',').map(x => x.trim()).filter(Boolean) : [];
  const selectedUrl = rawList[idx] || "";
  if (selectedUrl && $("#formImage")) {
    $("#formImage").value = selectedUrl;
    const reordered = [selectedUrl, ...rawList.filter((_, i) => i !== idx)];
    if (listTextarea) listTextarea.value = reordered.join(', ');
    renderAdminGalleryPreview(reordered, selectedUrl);
    toast("Set as Main Hero Image 🌟");
  }
};

function compressImageFile(file, maxWidth = 1000, maxHeight = 1000, quality = 0.84) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(e.target.result || '');
      img.src = e.target.result;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

function initImageUploadHandler() {
  const fileInput = $("#formFileInput");
  const imgInput = $("#formImage");
  const galleryTextarea = $("#formImagesList");

  if (fileInput) {
    fileInput.onchange = async function(e) {
      const files = [...e.target.files];
      if (!files.length) return;

      toast(`Uploading ${files.length} photos...`);
      const uploadedPublicUrls = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const base64 = await compressImageFile(file);

          const apiRes = await fetch('/api/upload-image', {
            method: 'POST',
            headers: getAdminHeaders(),
            body: JSON.stringify({
              base64,
              filename: file.name,
              contentType: 'image/jpeg'
            })
          });
          const data = await apiRes.json();
          if (data && data.url) {
            uploadedPublicUrls.push(data.url);
          } else {
            uploadedPublicUrls.push(base64);
          }
        } catch(err) {
          console.error("Upload error:", err.message);
        }
      }

      if (uploadedPublicUrls.length) {
        imgInput.value = uploadedPublicUrls[0];
        const existingExtra = galleryTextarea.value.trim() ? galleryTextarea.value.trim().split(',').map(x => x.trim()).filter(Boolean) : [];
        const combined = [...new Set([...uploadedPublicUrls, ...existingExtra])];
        galleryTextarea.value = combined.join(', ');

        renderAdminGalleryPreview(combined, imgInput.value.trim());
        toast(`Uploaded ${uploadedPublicUrls.length} images! Main hero photo & gallery updated ✓`);
      }
    };
  }
}

// VIDEO FILE & YOUTUBE URL UPLOADER HANDLER
function initVideoUploadHandler() {
  const videoFileInput = $("#formVideoFileInput");
  const videoUrlInput = $("#formVideoUrl");

  if (videoFileInput && videoUrlInput) {
    videoFileInput.onchange = async function(e) {
      const file = e.target.files[0];
      if (!file) return;

      toast("Uploading product action video...");
      try {
        const base64 = await new Promise((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result);
          reader.onerror = rej;
          reader.readAsDataURL(file);
        });

        const apiRes = await fetch('/api/upload-image', {
          method: 'POST',
          headers: getAdminHeaders(),
          body: JSON.stringify({
            base64,
            filename: file.name,
            contentType: file.type || 'video/mp4'
          })
        });
        const data = await apiRes.json();
        if (data && data.url) {
          videoUrlInput.value = data.url;
        } else {
          videoUrlInput.value = base64;
        }
        toast("Uploaded product video successfully! Live video ready 🎥");
      } catch(err) {
        console.error("Video upload error:", err.message);
      }
    };
  }
}

// CUSTOMER REVIEWS & UNBOXING APPROVALS
async function renderAdminReviews() {
  const tbody = $("#adminReviewsBody");
  if (!tbody) return;

  try {
    const res = await fetch('/api/submit-review');
    const data = await res.json();
    const reviews = (data && data.reviews) ? data.reviews : [];

    if (!reviews.length) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:30px;color:#888">No customer reviews submitted yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = reviews.map(r => {
      let statusBadge = `<span style="background:#fff8e1;color:#b78103;font-weight:900;padding:3px 8px;border-radius:6px;font-size:10px">🟡 ${esc(r.status)}</span>`;
      if (r.status === "Approved") statusBadge = `<span style="background:#e8f5e9;color:#2e7d32;font-weight:900;padding:3px 8px;border-radius:6px;font-size:10px">🟢 Approved</span>`;
      else if (r.status === "Rejected") statusBadge = `<span style="background:#ffeeef;color:#ed1c24;font-weight:900;padding:3px 8px;border-radius:6px;font-size:10px">🔴 Rejected</span>`;

      return `
        <tr>
          <td><strong>${esc(r.id)}</strong></td>
          <td><strong>${esc(r.name)}</strong><br><small style="color:#666">${esc(r.email)}</small></td>
          <td><code>${esc(r.orderId)}</code></td>
          <td>
            <div style="color:#b78103;font-weight:900">⭐ ${esc(r.rating)}/5</div>
            <p style="font-size:11px;color:#444;margin:4px 0 0;max-width:220px">${esc(r.text)}</p>
          </td>
          <td>
            ${safeUrl(r.mediaUrl) ? `<a href="${safeUrl(r.mediaUrl)}" target="_blank" rel="noopener noreferrer" style="color:#1488d8;font-weight:800;font-size:11px">📁 View ${esc(r.mediaType || 'Media')}</a>` : '<span style="color:#aaa;font-size:10px">No Media</span>'}
          </td>
          <td>${statusBadge}</td>
          <td>${r.couponCode ? `<code style="background:#eef4ff;color:#1488d8;padding:3px 6px;border-radius:6px;font-weight:900">${esc(r.couponCode)} (10% OFF)</code>` : '<span style="color:#888;font-size:10px">Pending</span>'}</td>
          <td>
            <div style="display:flex;gap:6px">
              ${r.status !== 'Approved' ? `<button class="btn blue" style="height:30px;padding:0 8px;font-size:10px" onclick="approveReview('${r.id}')">Approve & Send Coupon 📧</button>` : ''}
              ${r.status !== 'Rejected' ? `<button class="btn red" style="height:30px;padding:0 8px;font-size:10px;background:#666" onclick="rejectReview('${r.id}')">Reject</button>` : ''}
              <button class="btn clear" style="height:30px;padding:0 8px;font-size:10px" onclick="deleteReview('${r.id}')">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  } catch (err) {
    console.error("Could not load reviews:", err);
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:30px;color:#ed1c24">Could not load reviews. Check the API and refresh.</td></tr>`;
  }
}

// Review and collaboration writes require the x-admin-key header (see verifyAdminAuth in
// api/submit-review.js and api/collaborations.js). These calls previously sent only a
// Content-Type header, so every moderation action was rejected with 401 — and because the
// responses were never checked, the UI still reported success.
async function adminWrite(url, options, successMsg, onDone) {
  try {
    const res = await fetch(url, { ...options, headers: getAdminHeaders() });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.error) {
      const msg = res.status === 401
        ? "Admin session expired — please sign in again."
        : (data.error || `Request failed (${res.status})`);
      toast(msg);
      if (res.status === 401) {
        localStorage.removeItem("hx_admin_logged");
        checkAdminAuth();
      }
      return null;
    }

    if (successMsg) toast(typeof successMsg === "function" ? successMsg(data) : successMsg);
    if (onDone) onDone();
    return data;
  } catch (err) {
    console.error(`Admin request to ${url} failed:`, err);
    toast("Network error — the change was not saved.");
    return null;
  }
}

async function approveReview(id) {
  await adminWrite('/api/submit-review',
    { method: 'PUT', body: JSON.stringify({ id, action: 'approve' }) },
    data => `Approved review ${id}! Coupon ${(data.review && data.review.couponCode) || ''} issued ✓`,
    renderAdminReviews);
}

async function rejectReview(id) {
  await adminWrite('/api/submit-review',
    { method: 'PUT', body: JSON.stringify({ id, action: 'reject' }) },
    `Rejected review ${id}`,
    renderAdminReviews);
}

async function deleteReview(id) {
  if (!confirm(`Delete review ${id}?`)) return;
  await adminWrite(`/api/submit-review?id=${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    `Deleted review ${id}`,
    renderAdminReviews);
}

// BRAND COLLABORATIONS MANAGER
async function renderAdminCollaborations() {
  const tbody = $("#adminCollabBody");
  if (!tbody) return;

  try {
    const res = await fetch('/api/collaborations');
    const data = await res.json();
    const collabs = (data && data.collaborations) ? data.collaborations : [];

    if (!collabs.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:#888">No brand collaborations created yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = collabs.map(c => `
      <tr>
        <td><strong>${esc(c.id)}</strong></td>
        <td><img src="${safeUrl(c.logo)}" alt="${esc(c.name)}" style="width:40px;height:40px;object-fit:contain;background:#f5f5f5;border-radius:8px;padding:4px"></td>
        <td><strong>${esc(c.name)}</strong></td>
        <td><a href="${safeUrl(c.link)}" target="_blank" rel="noopener noreferrer" style="color:#1488d8">${esc(c.link)}</a></td>
        <td>${c.active ? '<span style="color:#2e7d32;font-weight:900">🟢 Active</span>' : '<span style="color:#888">⚪ Hidden</span>'}</td>
        <td>
          <div style="display:flex;gap:6px">
            <button class="btn blue" style="height:30px;padding:0 8px;font-size:10px" onclick="toggleCollabActive('${esc(c.id)}')">${c.active ? 'Hide' : 'Show'}</button>
            <button class="btn red" style="height:30px;padding:0 8px;font-size:10px" onclick="deleteCollab('${esc(c.id)}')">🗑️</button>
          </div>
        </td>
      </tr>
    `).join("");
  } catch (err) {
    console.error("Could not load collaborations:", err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:#ed1c24">Could not load collaborations. Check the API and refresh.</td></tr>`;
  }
}

async function toggleCollabActive(id) {
  try {
    const res = await fetch('/api/collaborations');
    const data = await res.json();
    const c = (data.collaborations || []).find(x => String(x.id) === String(id));
    if (!c) return toast("That collaboration no longer exists.");

    await adminWrite('/api/collaborations',
      { method: 'PUT', body: JSON.stringify({ ...c, active: !c.active }) },
      "Updated collaboration visibility ✓",
      renderAdminCollaborations);
  } catch (err) {
    console.error("Could not load collaborations:", err);
    toast("Could not reach the collaborations service.");
  }
}

async function deleteCollab(id) {
  if (!confirm("Delete this brand collaboration?")) return;
  await adminWrite(`/api/collaborations?id=${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    "Deleted brand collaboration ✓",
    renderAdminCollaborations);
}

function initCollabForm() {
  const btn = $("#btnAddCollab");
  if (btn) {
    btn.onclick = function() {
      if ($("#collabForm")) $("#collabForm").reset();
      if ($("#collabId")) $("#collabId").value = "";
      if ($("#collabLogoPreview")) $("#collabLogoPreview").style.display = "none";
      openModal("collabModal");
    };
  }

  const logoInput = $("#collabLogoFileInput");
  if (logoInput) {
    logoInput.onchange = async function(e) {
      const file = e.target.files[0];
      if (!file) return;
      toast("Uploading brand logo image...");
      try {
        const compressedBase64 = await compressImageFile(file);
        const res = await fetch('/api/upload-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-key': getAdminToken()
          },
          body: JSON.stringify({ base64: compressedBase64, filename: file.name, contentType: file.type })
        });
        const data = await res.json();
        if (data && data.url) {
          if ($("#collabLogoUrl")) $("#collabLogoUrl").value = data.url;
          if ($("#collabLogoImgPrev")) $("#collabLogoImgPrev").src = data.url;
          if ($("#collabLogoPreview")) $("#collabLogoPreview").style.display = "flex";
          toast("Brand logo uploaded successfully ✓");
        } else {
          toast("Logo upload failed: " + (data.error || "Unknown error"));
        }
      } catch(err) {
        console.error("Logo upload error:", err);
        toast("Logo upload error: " + err.message);
      }
    };
  }
}

async function saveCollabPartner() {
  const name = ($("#collabName") ? $("#collabName").value : "").trim();
  const logo = ($("#collabLogoUrl") ? $("#collabLogoUrl").value : "").trim();
  const link = ($("#collabLink") ? $("#collabLink").value : "").trim() || "https://hyperxgt.com";
  const id = ($("#collabId") ? $("#collabId").value : "").trim();

  if (!name || !logo) {
    return alert("Please provide both Brand Name and Brand Logo Image.");
  }

  const method = id ? 'PUT' : 'POST';
  const body = { name, logo, link, active: true };
  if (id) body.id = id;

  await adminWrite('/api/collaborations',
    { method, body: JSON.stringify(body) },
    `Brand partner "${name}" saved successfully ✓`,
    () => {
      closeEl($("#collabModal"));
      renderAdminCollaborations();
    });
}

// BULK CSV PRODUCT UPLOADER
function initCsvBulkUploader() {
  const input = $("#adminCsvFileInput");
  if (!input) return;

  input.onchange = function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
      try {
        const text = evt.target.result;
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) return;

        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const newProducts = [];

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
          if (cols.length >= 3) {
            const pObj = {
              id: Date.now() + i,
              name: cols[0] || "RC Model",
              sku: cols[1] || `HX-${1000 + i}`,
              category: cols[2] || "Racing Cars",
              price: Number(cols[3]) || 2999,
              mrp: Number(cols[4]) || 3999,
              stock: Number(cols[5]) || 25,
              scale: cols[6] || "1:16",
              drive: cols[7] || "4WD",
              speed: cols[8] || "35 KM/H",
              image: cols[9] ? cols[9].trim() : "",
              no_image: !cols[9]
            };
            newProducts.push(pObj);
          }
        }

        if (newProducts.length) {
          P = [...newProducts, ...P];
          saveProductsDB(P);
          renderAdminProducts();
          populateAdminCatFilter();
          toast(`Bulk CSV Success! Imported ${newProducts.length} new products ✓`);
        }
      } catch(err) {
        alert("CSV Parsing Error. Please check file format.");
      }
    };
    reader.readAsText(file);
  };
}

// ORDER FULFILLMENT & LOGISTICS TRACKING CONTROLLER
window.openOrderModal = function(orderId) {
  const orders = getOrdersDB();
  const o = orders.find(x => x.id === orderId);
  if (!o) return;

  $("#ordModalTitle").textContent = `Fulfillment & Logistics Hub — Order ${o.id}`;

  const content = $("#ordModalContent");
  if (content) {
    content.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px">
        <div style="background:#f8f9fa;border:1px solid var(--line);border-radius:14px;padding:18px">
          <strong style="font-size:13px;color:#111;display:block;margin-bottom:8px">👤 Customer Info & Address</strong>
          <div style="font-size:12px;color:#444;line-height:1.6">
            <strong>${esc(o.customer.name)}</strong><br>
            Phone: ${esc(o.customer.phone)}<br>
            Email: ${esc(o.customer.email)}<br>
            Address: ${esc(o.customer.address)}, ${esc(o.customer.city)}, ${esc(o.customer.state)} - ${esc(o.customer.pincode)}
          </div>
        </div>

        <div style="background:#f8f9fa;border:1px solid var(--line);border-radius:14px;padding:18px">
          <strong style="font-size:13px;color:#111;display:block;margin-bottom:8px">💳 Payment & Order Details</strong>
          <div style="font-size:12px;color:#444;line-height:1.6">
            Date: ${esc(o.date)}<br>
            Total Amount: <strong style="color:#2e7d32">${INR(o.total)}</strong><br>
            Payment Mode: ${esc(o.paymentMethod)} (${esc(o.paymentStatus)})<br>
            Transaction Ref: <code>${esc(o.paymentId || 'N/A')}</code>
          </div>
        </div>
      </div>

      <div style="background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px;margin-bottom:20px">
        <strong style="font-size:13px;color:#111;display:block;margin-bottom:10px">🛒 Ordered Items:</strong>
        ${(o.items || []).map(it => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #eee;font-size:12px">
            <div>
              <strong>${esc(it.name)}</strong> (SKU: ${esc(it.sku)})
            </div>
            <div>
              ${it.qty} × ${INR(it.price)} = <strong>${INR(it.qty * it.price)}</strong>
            </div>
          </div>
        `).join("")}
      </div>

      <!-- LOGISTICS & SHIPMENT CONTROLLER -->
      <div style="background:#f4f6ff;border:1px solid #cce0ff;border-radius:16px;padding:20px">
        <h4 style="margin:0 0 12px;color:#1488d8">🚚 Shiprocket Courier & Tracking Controller</h4>
        
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:14px">
          <div>
            <label class="form-label">Fulfillment Status</label>
            <select class="field" id="ordStatus" style="margin:0">
              <option value="Pending Admin Acceptance" ${o.fulfillmentStatus === 'Pending Admin Acceptance' ? 'selected' : ''}>🟡 Pending Acceptance</option>
              <option value="Processing" ${o.fulfillmentStatus === 'Processing' ? 'selected' : ''}>⚙️ Processing</option>
              <option value="Packed" ${o.fulfillmentStatus === 'Packed' ? 'selected' : ''}>📦 Packed</option>
              <option value="Shipped" ${o.fulfillmentStatus === 'Shipped' ? 'selected' : ''}>🚚 Shipped</option>
              <option value="Out for Delivery" ${o.fulfillmentStatus === 'Out for Delivery' ? 'selected' : ''}>🛵 Out for Delivery</option>
              <option value="Delivered" ${o.fulfillmentStatus === 'Delivered' ? 'selected' : ''}>🟢 Delivered</option>
              <option value="Cancelled" ${o.fulfillmentStatus === 'Cancelled' ? 'selected' : ''}>🔴 Cancelled</option>
            </select>
          </div>

          <div>
            <label class="form-label">Courier Service</label>
            <input class="field" id="ordCourier" value="${esc(o.courier || 'Shiprocket Express (Bluedart)')}" style="margin:0">
          </div>

          <div>
            <label class="form-label">AWB Tracking Number</label>
            <input class="field" id="ordAwb" value="${esc(o.awb || 'SRK' + Math.floor(10000000 + Math.random() * 90000000))}" style="margin:0">
          </div>
        </div>

        <div style="display:flex;gap:10px">
          <button class="btn blue" onclick="updateOrderStatus('${o.id}')" style="height:44px">Update Order Status & Dispatch AWB ✓</button>
          ${o.fulfillmentStatus === 'Pending Admin Acceptance' ? `<button class="btn dark" onclick="acceptOrder('${o.id}'); closeEl($('#orderFulfillmentModal'))" style="height:44px">Accept Order & Deduct Stock 📦</button>` : ''}
        </div>
      </div>
    `;
  }

  openModal("orderFulfillmentModal");
};

window.updateOrderStatus = function(orderId) {
  const orders = getOrdersDB();
  const o = orders.find(x => x.id === orderId);
  if (!o) return;

  o.fulfillmentStatus = $("#ordStatus")?.value || o.fulfillmentStatus;
  o.courier = $("#ordCourier")?.value || o.courier;
  o.awb = $("#ordAwb")?.value || o.awb;

  saveOrdersDB(orders);
  renderAdminOrders();
  closeEl($("#orderFulfillmentModal"));
  toast(`Updated Order ${orderId} status to "${o.fulfillmentStatus}" ✓`);
};

function acceptOrder(orderId) {
  const orders = getOrdersDB();
  const o = orders.find(x => x.id === orderId);
  if (!o) return;

  o.fulfillmentStatus = "Processing";
  o.acceptedDate = new Date().toLocaleString("en-IN");

  (o.items || []).forEach(item => {
    const prod = P.find(p => p.id === item.id || p.sku === item.sku);
    if (prod) {
      prod.stock = Math.max(0, (prod.stock !== undefined ? prod.stock : 25) - item.qty);
    }
  });

  saveProductsDB(P);
  saveOrdersDB(orders);
  renderAdminProducts();
  renderAdminOrders();

  toast(`Order ${orderId} ACCEPTED by Admin! Stock updated ✓`);
}

function openAddModal() {
  $("#modalTitle").textContent = "Add New Product to Database";
  $("#formProdId").value = "";
  $("#productForm").reset();
  $("#formStock").value = "25";
  $("#formGstTaxType").value = "inclusive";
  $("#formImage").value = "";
  $("#formImagesList").value = "";
  if ($("#formVideoUrl")) $("#formVideoUrl").value = "";
  renderAdminGalleryPreview([]);
  openModal("productModal");
}

function openEditModal(id) {
  const p = P.find(x => x.id === id);
  if (!p) return;

  $("#modalTitle").textContent = `Edit Product #${p.id} (${p.sku})`;
  $("#formProdId").value = p.id;
  $("#formName").value = p.name || "";
  $("#formSku").value = p.sku || "";
  $("#formCat").value = p.category || "Racing Cars";
  $("#formStock").value = p.stock !== undefined ? p.stock : 25;
  $("#formGstTaxType").value = p.taxMode || "inclusive";
  $("#formPrice").value = p.price || "";
  $("#formMrp").value = p.mrp || "";
  $("#formGstRate").value = p.gstRate || 18;
  $("#formHsn").value = p.hsn || "95030090";
  $("#formScale").value = p.scale || "1:16";
  $("#formSpeed").value = p.speed || "35 KM/H";
  $("#formDrive").value = p.drive || "4WD";

  const allImgs = (p.images && p.images.length) ? p.images.filter(Boolean) : (p.image ? [p.image] : []);
  const mainImg = p.image || allImgs[0] || "";
  const isNoImg = p.no_image === true && !mainImg && !allImgs.length;
  
  $("#formImage").value = isNoImg ? "" : mainImg;
  $("#formImagesList").value = isNoImg ? "" : allImgs.join(", ");
  if ($("#formVideoUrl")) $("#formVideoUrl").value = p.video || "";
  renderAdminGalleryPreview(isNoImg ? [] : allImgs, isNoImg ? "" : mainImg);

  $("#formShortDesc").value = p.short_description || "";
  $("#formFullDesc").value = p.full_description || "";

  openModal("productModal");
}

async function saveProduct(e) {
  e.preventDefault();

  const idVal = $("#formProdId").value;
  const name = $("#formName").value.trim();
  const sku = $("#formSku").value.trim();
  const category = $("#formCat").value;
  const stock = Number($("#formStock").value);
  const taxMode = $("#formGstTaxType").value;
  const rawPrice = Number($("#formPrice").value) || 1999;
  const rawMrp = Number($("#formMrp").value) || Math.round(rawPrice * 1.25);
  const gstRate = Number($("#formGstRate").value) || 18;
  const hsn = $("#formHsn").value.trim() || "95030090";

  let price = rawPrice;
  let mrp = rawMrp;
  if (taxMode === 'exclusive') {
    price = Math.round(rawPrice * (1 + (gstRate / 100)));
    mrp = Math.round(rawMrp * (1 + (gstRate / 100)));
  }

  const scale = $("#formScale").value.trim() || "1:16";
  const speed = $("#formSpeed").value.trim() || "35 KM/H";
  const drive = $("#formDrive").value;
  const rawGallery = $("#formImagesList").value.trim();
  let images = rawGallery ? rawGallery.split(',').map(x => x.trim()).filter(Boolean) : [];
  let image = $("#formImage").value.trim();

  if (image) {
    if (!images.includes(image)) {
      images.unshift(image);
    } else if (images[0] !== image) {
      images = [image, ...images.filter(x => x !== image)];
    }
  } else if (images.length > 0) {
    image = images[0];
  }

  const isNoImage = (!image && images.length === 0);

  const video = $("#formVideoUrl") ? $("#formVideoUrl").value.trim() : "";

  const short_description = $("#formShortDesc").value.trim();
  const full_description = $("#formFullDesc").value.trim();

  const productObj = {
    id: idVal ? Number(idVal) : Date.now(),
    sku,
    name,
    category,
    stock,
    taxMode,
    price,
    mrp,
    gstRate,
    hsn,
    discount: Math.round(((mrp - price) / mrp) * 100),
    scale,
    speed,
    drive,
    image: isNoImage ? "" : image,
    images: isNoImage ? [] : images,
    no_image: isNoImage,
    video,
    short_description,
    full_description
  };

  try {
    const method = idVal ? 'PUT' : 'POST';
    const apiRes = await fetch('/api/products-crud', {
      method,
      headers: getAdminHeaders(),
      body: JSON.stringify(productObj)
    });
    const apiData = await apiRes.json();
    if (!apiRes.ok || !apiData.success) {
      console.error('Product save API error:', apiData.error || apiRes.status);
      toast('⚠️ Server save failed: ' + (apiData.error || 'Unknown error') + '. Saved locally only.');
    }
  } catch(err) {
    console.error('Product save network error:', err.message);
    toast('⚠️ Network error saving product. Saved locally only.');
  }

  const idx = P.findIndex(p => String(p.id) === String(idVal) || (p.sku && p.sku.toLowerCase() === (sku || '').toLowerCase()));
  if (idx !== -1) {
    P[idx] = { ...P[idx], ...productObj };
  } else {
    P.unshift(productObj);
  }

  saveProductsDB(P);
  renderAdminProducts();
  populateAdminCatFilter();
  closeEl($("#productModal"));
  toast(idVal ? `Updated Product "${name}" ✓` : `Created Product "${name}" ✓`);
}

async function deleteProduct(id) {
  const p = P.find(x => x.id === id);
  if (!p) return;
  if (!confirm(`Delete product "${p.name}" (SKU: ${p.sku})?`)) return;

  try {
    const apiRes = await fetch(`/api/products-crud?id=${id}`, { method: 'DELETE', headers: getAdminHeaders() });
    const apiData = await apiRes.json();
    if (!apiRes.ok || !apiData.success) {
      console.error('Delete API error:', apiData.error || apiRes.status);
    }
  } catch(err) {
    console.error('Delete network error:', err.message);
  }

  P = P.filter(x => x.id !== id);
  saveProductsDB(P);
  renderAdminProducts();
  populateAdminCatFilter();
  toast(`Deleted Product #${id} ✓`);
}

function populateAdminCatFilter() {
  const select = $("#adminCatFilter");
  if (!select) return;
  const cats = [...new Set(P.map(p => p.category))].sort();
  select.innerHTML = '<option value="">All Categories</option>' + cats.map(c => `<option>${esc(c)}</option>`).join("");
}

function renderAdminProducts() {
  const tbody = $("#adminTableBody");
  if (!tbody) return;

  const q = ($("#adminSearch")?.value || "").toLowerCase().trim();
  const cat = $("#adminCatFilter")?.value || "";

  let filtered = P.filter(p => {
    const textMatch = !q || (p.name + " " + p.sku + " " + p.category + " " + p.scale).toLowerCase().includes(q);
    const catMatch = !cat || p.category === cat;
    return textMatch && catMatch;
  });

  if ($("#adminCountText")) $("#adminCountText").textContent = `Showing ${filtered.length} of ${P.length} total products`;
  if ($("#metricCount")) $("#metricCount").textContent = P.length;

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:40px;color:#888">No matching products found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const gstRate = p.gstRate || 18;
    const priceIncl = p.price || 0;
    const priceExcl = priceIncl / (1 + (gstRate / 100));
    const stock = p.stock !== undefined ? p.stock : 25;

    let stockBadge = `<span style="background:#e8f5e9;color:#2e7d32;font-weight:900;padding:3px 8px;border-radius:6px;font-size:10px">🟢 ${stock} Units</span>`;
    if (stock === 0) stockBadge = `<span style="background:#ffeeef;color:#ed1c24;font-weight:900;padding:3px 8px;border-radius:6px;font-size:10px">🔴 Out of Stock</span>`;
    else if (stock <= 5) stockBadge = `<span style="background:#fff8e1;color:#b78103;font-weight:900;padding:3px 8px;border-radius:6px;font-size:10px">🟡 ${stock} Left</span>`;

    return `
    <tr>
      <td><strong>${p.id}</strong></td>
      <td>${(p.image && !p.no_image) ? `<img src="${p.image}" alt="${esc(p.name)}">` : `<div style="width:52px;height:44px;background:#f0f2f5;border-radius:6px;display:grid;place-items:center;font-size:10px;color:#aaa">📷</div>`}</td>
      <td><code style="background:#edf2f7;padding:3px 7px;border-radius:6px;font-size:11px">${esc(p.sku)}</code></td>
      <td><strong style="color:#111;display:block;max-width:260px">${esc(p.name)}</strong></td>
      <td><span style="background:#eef4ff;color:#1488d8;font-weight:800;padding:3px 8px;border-radius:6px;font-size:10px">${esc(p.category)}</span></td>
      <td>${stockBadge}</td>
      <td><span style="color:#666;font-weight:700">₹${priceExcl.toFixed(2)}</span></td>
      <td><span style="background:#fff8e1;color:#b78103;font-weight:900;padding:3px 7px;border-radius:6px;font-size:10px">${gstRate}% GST</span></td>
      <td><strong style="color:#2e7d32">${INR(priceIncl)}</strong></td>
      <td>${esc(p.scale || '1:16')}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn-icon edit" title="Edit Product Specs & Stock" onclick="openEditModal(${p.id})">✏️</button>
          <button class="btn-icon delete" title="Delete Product" onclick="deleteProduct(${p.id})">🗑️</button>
        </div>
      </td>
    </tr>
  `;
  }).join("");
}

function renderAdminOrders() {
  const tbody = $("#adminOrdersBody");
  if (!tbody) return;

  let orders = getOrdersDB();
  tbody.innerHTML = orders.map(o => `
    <tr>
      <td><strong>${esc(o.id)}</strong></td>
      <td><span style="font-size:11px;color:#666">${esc(o.date)}</span></td>
      <td><strong>${esc(o.customer ? o.customer.name : 'Customer')}</strong><br><small style="color:#666">${esc(o.customer ? o.customer.city : '')}</small></td>
      <td><span style="font-size:11px">${(o.items || []).map(it => esc(it.name)).join(", ")}</span></td>
      <td><strong>${INR(o.total || o.amount)}</strong></td>
      <td><span style="background:#f4f6ff;color:#1488d8;font-size:10px;font-weight:800;padding:3px 8px;border-radius:6px">${esc(o.paymentMethod)}</span></td>
      <td><div style="font-size:11px;color:#7b2cbf">${esc(o.courier || 'Express Shipping')}</div><code>${esc(o.awb || 'Pending AWB')}</code></td>
      <td><span style="background:#fff8e1;color:#b78103;font-weight:900;padding:4px 10px;border-radius:6px;font-size:11px">${esc(o.fulfillmentStatus)}</span></td>
      <td>
        <button class="btn blue" style="height:32px;padding:0 10px;font-size:11px" onclick="openOrderModal('${o.id}')">Manage & Ship 🚚</button>
      </td>
    </tr>
  `).join("");
}

function initDatabaseSyncHub() {
  const btnSync = $("#btnSyncAllToLive");
  const btnExport = $("#btnExportDatabaseJs");

  if (btnSync) {
    btnSync.onclick = async function() {
      toast("Syncing all admin edits to live serverless database...");
      try {
        const res = await fetch('/api/products-crud?bulk=1', {
          method: 'POST',
          headers: getAdminHeaders(),
          body: JSON.stringify(P)
        });
        const data = await res.json();
        if (data.success) {
          toast(`Live Database Synced! ${P.length} products updated on live website ✓`);
        }
      } catch(err) {
        toast(`Synced ${P.length} products to local storage ✓`);
      }
    };
  }

  if (btnExport) {
    btnExport.onclick = function() {
      const code = `window.HX_PRODUCTS = ${JSON.stringify(P, null, 2)};`;
      const blob = new Blob([code], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'products.js';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast("Downloaded updated assets/products.js file ✓");
    };
  }
}

async function fetchLiveBackendProductsAdmin() {
  try {
    const res = await fetch('/api/products-crud');
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.products && Array.isArray(data.products) && data.products.length > 0) {
      const liveProducts = data.products.filter(p => p && p.id != null);
      const map = new Map();
      (P || []).forEach(p => { if (p && p.id != null) map.set(String(p.id), p); });
      liveProducts.forEach(p => {
        const key = String(p.id);
        const existing = map.get(key) || {};
        map.set(key, { ...existing, ...p });
      });
      const mergedList = Array.from(map.values()).filter(p => p && p.id != null);
      if (mergedList.length > 0) {
        P = mergedList;
        saveProductsDB(P);
        if (typeof renderAdminProducts === "function") renderAdminProducts();
        if (typeof populateAdminCatFilter === "function") populateAdminCatFilter();
      }
    }
  } catch(e) {}
}

document.addEventListener("DOMContentLoaded", () => {
  initAdminAuth();
  initAdminTabs();
  P = loadProductsDB();
  renderAdminProducts();
  fetchLiveBackendProductsAdmin();
  renderAdminOrders();
  renderAdminReviews();
  renderAdminCollaborations();
  populateAdminCatFilter();
  initImageUploadHandler();
  initVideoUploadHandler();
  initCollabForm();
  initCsvBulkUploader();
  initDatabaseSyncHub();

  const openAddBtn = $("#btnOpenAddModal");
  if (openAddBtn) openAddBtn.onclick = openAddModal;

  const productForm = $("#productForm");
  if (productForm) productForm.onsubmit = saveProduct;
});
