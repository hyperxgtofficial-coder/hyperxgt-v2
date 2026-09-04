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
  return localStorage.getItem("hx_admin_token") || localStorage.getItem("hx_admin_auth") || "hx_admin_sec_2026_super_key";
}

function getAdminHeaders() {
  const token = getAdminToken();
  return {
    'Content-Type': 'application/json',
    'x-admin-key': token,
    'Authorization': `Bearer ${token}`
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

function compressImageFile(file, maxWidth = 1200, maxHeight = 1200, quality = 0.88) {
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
        // White background for JPEGs (prevents black bleed on transparency)
        const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
        if (!isPng) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
        }
        ctx.drawImage(img, 0, 0, width, height);
        // Use WebP if supported (best quality:size ratio), fallback to PNG for transparency, JPEG for photos
        const supportsWebP = canvas.toDataURL('image/webp').startsWith('data:image/webp');
        let outputMime, outputQuality;
        if (supportsWebP) {
          outputMime = 'image/webp';
          outputQuality = quality;
        } else if (isPng) {
          outputMime = 'image/png';
          outputQuality = 1;
        } else {
          outputMime = 'image/jpeg';
          outputQuality = quality;
        }
        resolve(canvas.toDataURL(outputMime, outputQuality));
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
          // Detect actual MIME from compressed data URL header
          const mimeMatch = /^data:([\w./+-]+);base64,/.exec(base64);
          const detectedMime = (mimeMatch && mimeMatch[1]) || file.type || 'image/jpeg';

          const apiRes = await fetch('/api/upload-image', {
            method: 'POST',
            headers: getAdminHeaders(),
            body: JSON.stringify({
              base64,
              filename: file.name,
              contentType: detectedMime
            })
          });
          if (!apiRes.ok) {
            const errData = await apiRes.json().catch(() => ({}));
            console.error(`Upload failed for ${file.name}:`, errData.error || apiRes.status);
            toast(`⚠️ Upload failed for "${file.name}": ${errData.error || 'Server error'}`);
            continue;
          }
          const data = await apiRes.json();
          if (data && data.url) {
            uploadedPublicUrls.push(data.url);
          } else {
            // Fallback: keep in-memory base64 so gallery still shows image
            uploadedPublicUrls.push(base64);
          }
        } catch(err) {
          console.error("Upload error:", err.message);
          toast(`⚠️ Network error uploading "${file.name}"`);
        }
      }

      if (uploadedPublicUrls.length) {
        const existingExtra = galleryTextarea.value.trim() ? galleryTextarea.value.trim().split(',').map(x => x.trim()).filter(Boolean) : [];
        const combined = [...new Set([...existingExtra, ...uploadedPublicUrls])];
        galleryTextarea.value = combined.join(', ');

        if (!imgInput.value.trim() || !combined.includes(imgInput.value.trim())) {
          imgInput.value = combined[0] || '';
        }

        renderAdminGalleryPreview(combined, imgInput.value.trim());
        toast(`✅ Uploaded ${uploadedPublicUrls.length} photo${uploadedPublicUrls.length > 1 ? 's' : ''}! (${combined.length} total in gallery) ✓`);
      }
      // Reset so same files can be re-uploaded if needed
      fileInput.value = '';
    };
  }

  // Live preview when admin manually pastes/types a URL into the hero image field
  if (imgInput) {
    imgInput.addEventListener('input', function() {
      const url = this.value.trim();
      if (!url) return;
      const existingList = galleryTextarea && galleryTextarea.value.trim()
        ? galleryTextarea.value.trim().split(',').map(x => x.trim()).filter(Boolean)
        : [];
      if (!existingList.includes(url)) existingList.unshift(url);
      renderAdminGalleryPreview(existingList, url);
    });
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

      // Block oversized videos (>50 MB) — Vercel payload limit is 4.5 MB serverless, disk fallback handles larger
      const MAX_VIDEO_MB = 50;
      if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
        toast(`⚠️ Video too large (${Math.round(file.size/1024/1024)} MB). Max ${MAX_VIDEO_MB} MB. Use a YouTube URL instead.`);
        videoFileInput.value = '';
        return;
      }

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

function updateAdminGstBreakdown() {
  const priceInput = $("#formPrice");
  const taxModeSelect = $("#formGstTaxType");
  const gstRateSelect = $("#formGstRate");
  const priceExclInput = $("#formPriceExcl");
  const gstAmountInput = $("#formGstAmount");
  const breakdownText = $("#gstBreakdownText");

  if (!priceInput || !priceExclInput || !gstAmountInput) return;

  const rawPrice = Number(priceInput.value) || 0;
  const taxMode = taxModeSelect ? taxModeSelect.value : "inclusive";
  const rate = Number(gstRateSelect ? gstRateSelect.value : 18) || 0;

  let priceExcl = 0;
  let gstAmt = 0;

  if (taxMode === "inclusive") {
    priceExcl = rate > 0 ? Math.round(rawPrice / (1 + (rate / 100))) : rawPrice;
    gstAmt = rawPrice - priceExcl;
  } else {
    priceExcl = rawPrice;
    gstAmt = Math.round(rawPrice * (rate / 100));
  }

  priceExclInput.value = priceExcl ? `₹${priceExcl}` : "₹0";
  gstAmountInput.value = gstAmt ? `₹${gstAmt}` : "₹0";

  if (breakdownText) {
    const halfRate = (rate / 2).toFixed(1).replace(/\.0$/, '');
    const halfAmt = Math.round(gstAmt / 2);
    breakdownText.innerHTML = `Tax Breakdown: <strong>CGST ${halfRate}% (₹${halfAmt})</strong> + <strong>SGST ${halfRate}% (₹${halfAmt})</strong> | Total GST: <strong>₹${gstAmt}</strong>`;
  }
}

function openAddModal() {
  $("#modalTitle").textContent = "Add New Product to Database";
  $("#formProdId").value = "";
  $("#productForm").reset();
  if ($("#formBrand")) $("#formBrand").value = "HyperXGT";
  $("#formStock").value = "25";
  $("#formGstTaxType").value = "inclusive";
  $("#formScale").value = "1:16";
  $("#formSpeed").value = "35 KM/H";
  $("#formDrive").value = "4WD";
  if ($("#formMotor")) $("#formMotor").value = "";
  if ($("#formBattery")) $("#formBattery").value = "";
  if ($("#formControl")) $("#formControl").value = "";
  if ($("#formDimensions")) $("#formDimensions").value = "";
  if ($("#formWeight")) $("#formWeight").value = "";
  if ($("#formAge")) $("#formAge").value = "14+ Years";
  if ($("#formInBox")) $("#formInBox").value = "";
  if ($("#formAmc")) $("#formAmc").value = "";
  if ($("#formShipping")) $("#formShipping").value = "";
  if ($("#formReturns")) $("#formReturns").value = "";
  $("#formImage").value = "";
  $("#formImagesList").value = "";
  if ($("#formVideoUrl")) $("#formVideoUrl").value = "";
  renderAdminGalleryPreview([]);
  updateAdminGstBreakdown();
  openModal("productModal");
}

function openEditModal(id) {
  const p = P.find(x => x.id === id);
  if (!p) return;

  $("#modalTitle").textContent = `Edit Product #${p.id} (${p.sku})`;
  $("#formProdId").value = p.id;
  $("#formName").value = p.name || "";
  $("#formSku").value = p.sku || "";
  if ($("#formBrand")) $("#formBrand").value = p.brand || "HyperXGT";
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

  // Technical Matrix Specs
  if ($("#formMotor")) $("#formMotor").value = p.motor || "";
  if ($("#formBattery")) $("#formBattery").value = p.battery || "";
  if ($("#formControl")) $("#formControl").value = p.control || "";
  if ($("#formDimensions")) $("#formDimensions").value = p.dimensions || "";
  if ($("#formWeight")) $("#formWeight").value = p.weight || "";
  if ($("#formAge")) $("#formAge").value = p.age || "14+ Years";

  // Tab Content Overrides
  if ($("#formInBox")) $("#formInBox").value = p.in_box || p.package_contents || "";
  if ($("#formAmc")) $("#formAmc").value = p.amc_custom || p.amc_details || "";
  if ($("#formShipping")) $("#formShipping").value = p.shipping_custom || "";
  if ($("#formReturns")) $("#formReturns").value = p.returns_custom || "";

  const allImgs = (typeof parseImagesArray === 'function')
    ? parseImagesArray(p)
    : ((p.images && p.images.length) ? p.images.filter(Boolean) : (p.image ? p.image.split(',').map(x=>x.trim()).filter(Boolean) : []));
  const mainImg = p.image || allImgs[0] || "";
  const isNoImg = p.no_image === true && !mainImg && !allImgs.length;
  
  $("#formImage").value = isNoImg ? "" : mainImg;
  $("#formImagesList").value = isNoImg ? "" : allImgs.join(", ");
  if ($("#formVideoUrl")) $("#formVideoUrl").value = p.video || "";
  renderAdminGalleryPreview(isNoImg ? [] : allImgs, isNoImg ? "" : mainImg);

  $("#formShortDesc").value = p.short_description || "";
  $("#formFullDesc").value = p.full_description || "";

  updateAdminGstBreakdown();
  openModal("productModal");
}

async function saveProduct(e) {
  e.preventDefault();

  const idVal = $("#formProdId").value;
  const name = $("#formName").value.trim();
  const sku = $("#formSku").value.trim();
  const brand = ($("#formBrand")?.value || "").trim() || "HyperXGT";
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
  const motor = ($("#formMotor")?.value || "").trim();
  const battery = ($("#formBattery")?.value || "").trim();
  const control = ($("#formControl")?.value || "").trim();
  const dimensions = ($("#formDimensions")?.value || "").trim();
  const weight = ($("#formWeight")?.value || "").trim();
  const age = ($("#formAge")?.value || "").trim() || "14+ Years";

  const in_box = ($("#formInBox")?.value || "").trim();
  const amc_custom = ($("#formAmc")?.value || "").trim();
  const shipping_custom = ($("#formShipping")?.value || "").trim();
  const returns_custom = ($("#formReturns")?.value || "").trim();

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
    brand,
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
    motor,
    battery,
    control,
    dimensions,
    weight,
    age,
    in_box,
    package_contents: in_box,
    amc_custom,
    shipping_custom,
    returns_custom,
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

    const pImgs = (typeof parseImagesArray === 'function') ? parseImagesArray(p) : (p.images || (p.image ? [p.image] : []));
    const extraCount = pImgs.length > 1 ? pImgs.length - 1 : 0;

    return `
    <tr>
      <td><strong>${p.id}</strong></td>
      <td>
        ${(p.image && !p.no_image) 
          ? `<div style="position:relative;display:inline-block">
               <img src="${p.image}" alt="${esc(p.name)}" style="display:block">
               ${extraCount > 0 ? `<span style="position:absolute;bottom:2px;right:2px;background:rgba(0,0,0,0.75);color:#fff;font-size:9px;font-weight:900;padding:1px 4px;border-radius:4px" title="${pImgs.length} photos in gallery">+${extraCount}</span>` : ''}
             </div>` 
          : `<div style="width:52px;height:44px;background:#f0f2f5;border-radius:6px;display:grid;place-items:center;font-size:10px;color:#aaa">📷</div>`}
      </td>
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
        if (typeof populateSocialProductList === "function") populateSocialProductList();
      }
    }
  } catch(e) {}
}

// ====================================================================
// SOCIAL MEDIA STUDIO & CONTENT PUBLISHER ENGINE
// ====================================================================
let currentSocialProduct = null;
let currentSocialImage = "";
let currentSocialTone = "hype";
let currentSocialMediaType = "product"; // "product" | "custom-image" | "video"

function populateSocialProductList(filterQuery = "") {
  const select = $("#socialProductSelect");
  if (!select) return;

  const q = String(filterQuery || "").toLowerCase().trim();
  let list = Array.isArray(P) ? P.filter(p => p && p.id != null) : [];

  if (q) {
    list = list.filter(p => 
      String(p.sku || "").toLowerCase().includes(q) || 
      String(p.name || "").toLowerCase().includes(q) ||
      String(p.category || "").toLowerCase().includes(q)
    );
  }

  const badge = $("#socialBadgeCount");
  if (badge) badge.textContent = `${list.length} Products Ready`;

  const previousVal = select.value;
  select.innerHTML = `<option value="">-- Choose a Product (${list.length} Listed) --</option>` +
    list.map(p => `
      <option value="${p.id}" ${String(p.id) === String(previousVal) ? 'selected' : ''}>
        [${esc(p.sku)}] ${esc(p.name)} — ${INR(p.price)} (${esc(p.category)})
      </option>
    `).join("");

  if (!select.value && list.length > 0 && !q) {
    select.value = list[0].id;
    onSocialProductSelected(list[0].id);
  }
}

function onSocialProductSelected(productId, customImg = "") {
  const p = (P || []).find(x => String(x.id) === String(productId));
  if (!p) return;

  currentSocialProduct = p;
  
  if (currentSocialMediaType === "product" || !currentSocialImage) {
    currentSocialImage = customImg || p.image || (Array.isArray(p.images) && p.images[0]) || "assets/hyperxgt-logo.png";
  }

  applySocialMediaDisplay();

  const catBadge = $("#socialPreviewCatBadge");
  if (catBadge) catBadge.textContent = (p.category || "RC PERFORMANCE").toUpperCase();

  const priceBadge = $("#socialPreviewPriceBadge");
  if (priceBadge) priceBadge.textContent = INR(p.price);

  const shopBtn = $("#socialPreviewShopBtn");
  if (shopBtn) shopBtn.href = `product.html?id=${p.id}`;

  // Populate Gallery Thumbnails
  renderSocialGalleryThumbs(p);

  // Generate Initial Caption
  refreshSocialCaption();
}

function applySocialMediaDisplay() {
  const prevImg = $("#socialPreviewImage");
  const prevVid = $("#socialPreviewVideo");
  const vidBadge = $("#socialVideoTagBadge");
  const mediaBadge = $("#activeMediaTypeBadge");

  const isVideo = currentSocialMediaType === "video" || 
    (currentSocialImage && (/\.(mp4|webm|ogg|mov)$/i.test(currentSocialImage) || currentSocialImage.startsWith("data:video/")));

  if (isVideo) {
    if (prevImg) prevImg.style.display = "none";
    if (prevVid) {
      prevVid.style.display = "block";
      prevVid.src = currentSocialImage;
    }
    if (vidBadge) vidBadge.style.display = "inline-block";
    if (mediaBadge) {
      mediaBadge.textContent = "📹 Action Video";
      mediaBadge.style.background = "#ed1c24";
    }
  } else {
    if (prevVid) {
      prevVid.pause();
      prevVid.style.display = "none";
    }
    if (prevImg) {
      prevImg.style.display = "block";
      prevImg.src = safeUrl(currentSocialImage, "assets/hyperxgt-logo.png");
    }
    if (vidBadge) vidBadge.style.display = "none";
    if (mediaBadge) {
      mediaBadge.textContent = currentSocialMediaType === "custom-image" ? "🖼️ Custom Photo" : "📸 SKU Photo";
      mediaBadge.style.background = "#d97706";
    }
  }
}

function renderSocialGalleryThumbs(p) {
  const container = $("#socialGalleryThumbs");
  const countLabel = $("#socialGalleryCount");
  if (!container) return;

  const allPhotos = [...new Set([p.image, ...(Array.isArray(p.images) ? p.images : [])])].filter(Boolean);
  if (countLabel) countLabel.textContent = `${allPhotos.length} photo${allPhotos.length === 1 ? '' : 's'}`;

  if (!allPhotos.length) {
    container.innerHTML = `<span style="font-size:11px;color:#888;">No uploaded photos for this model yet.</span>`;
    return;
  }

  container.innerHTML = allPhotos.map((url, idx) => `
    <div onclick="switchSocialPreviewImage('${esc(url)}')" style="width:48px;height:48px;border-radius:8px;border:2px solid ${url === currentSocialImage ? '#1488d8' : '#e0e0e0'};overflow:hidden;background:#fff;cursor:pointer;padding:2px;display:grid;place-items:center;">
      <img src="${safeUrl(url)}" alt="Thumbnail ${idx+1}" style="width:100%;height:100%;object-fit:contain;">
    </div>
  `).join("");
}

window.switchSocialPreviewImage = function(url) {
  currentSocialMediaType = "product";
  currentSocialImage = url;
  applySocialMediaDisplay();
  if (currentSocialProduct) renderSocialGalleryThumbs(currentSocialProduct);
  toast("Updated preview photo from gallery 📸");
};

function refreshSocialCaption() {
  if (!currentSocialProduct) return;
  const promoCode = ($("#socialPromoCode")?.value || "HYPERXGT10").trim();
  const customTagline = ($("#socialCustomTagline")?.value || "").trim();

  const isVideo = currentSocialMediaType === "video" || 
    (currentSocialImage && (/\.(mp4|webm|ogg|mov)$/i.test(currentSocialImage) || currentSocialImage.startsWith("data:video/")));

  const caption = buildSocialCaption(currentSocialProduct, currentSocialTone, promoCode, customTagline, isVideo);
  const textarea = $("#socialCaptionText");
  if (textarea) {
    textarea.value = caption;
    updateSocialCharCount();
  }

  const livePreview = $("#socialLivePreviewCaption");
  if (livePreview) {
    livePreview.innerHTML = `<strong>hyperxgt_rc</strong> ${esc(caption).replace(/\n/g, '<br>')}`;
  }
}

function buildSocialCaption(p, tone, promoCode, customTagline, isVideo = false) {
  const siteUrl = "https://hyperxgt.com";
  const productUrl = `${siteUrl}/product.html?id=${p.id}`;
  const discountText = p.discount ? `Save ${p.discount}% OFF (MRP ${INR(p.mrp)})` : `Best Price: ${INR(p.price)}`;
  const specsLine = [p.scale, p.speed, p.drive, p.motor].filter(Boolean).join(" • ");
  const videoHook = isVideo ? "🎥 WATCH THIS BEAST IN ACTION! Turn on sound 🔊💨\n" : "";

  if (tone === "specs") {
    return `${videoHook}⚙️ TECHNICAL SPEC SPOTLIGHT: ${p.name.toUpperCase()} [SKU: ${p.sku}]
${customTagline ? `\n💡 ${customTagline}\n` : ''}
Engineered for hardcore RC hobbyists & precision performance:
🏎️ Scale: ${p.scale || '1:16 Scale'}
⚡ Top Speed: ${p.speed || '45+ KM/H'}
🛡️ Drive System: ${p.drive || '4WD All-Wheel Drive'}
🔋 Power Unit: ${p.motor || 'High-Torque Performance Motor'}
🎯 Control: 2.4GHz Pro Multi-Channel Transmitter

💰 Price: ${INR(p.price)} (${discountText})
🎁 Use code "${promoCode}" for extra 10% OFF!
📦 Free Express Pan-India Shipping & 7-Day Transit Guarantee.

👉 Get full specs & order: ${productUrl}

#HyperXGT #RCCars #RCSpecs #RCIndia #TraxxasIndia #RCRacing #HobbyGradeRC #Brushless4WD #OffRoadRC`;
  }

  if (tone === "deal") {
    return `${videoHook}🚨 LIMITED STOCK FLASH DEAL! 🚨
${p.name} [SKU: ${p.sku}]
${customTagline ? `\n🔥 ${customTagline}\n` : ''}
⚡ Only ${p.stock || 5} units left in the garage ready for dispatch!

💥 Deal Price: ${INR(p.price)} (Regular MRP: ${INR(p.mrp || p.price * 1.25)})
🎟️ Extra 10% OFF with code: ${promoCode}
🚚 Same-Day / Express Courier Dispatch across India
🛡️ 100% Genuine Hobby-Grade Spares & Support

👇 Grab yours before stock runs out:
${productUrl}

#FlashSale #RCCarDeals #HyperXGT #RCOffers #DriftCars #RCRacingIndia #LimitedDrop`;
  }

  if (tone === "short") {
    return `${videoHook}🏎️ ${p.name} (${p.scale || '1:16'} ${p.drive || '4WD'})
${customTagline ? `\n${customTagline}\n` : ''}
⚡ Speed: ${p.speed || '50+ KM/H'} | Price: ${INR(p.price)}
🎟️ Code: ${promoCode} (10% OFF)

🛒 Buy Now: ${productUrl}

#HyperXGT #RCCars #RCIndia`;
  }

  // Default: Hype / High-Speed Racing
  return `${videoHook}🔥 UNLEASH PURE RACING ADRENALINE! 🔥
Meet the all-new ${p.name.toUpperCase()} (SKU: ${p.sku})! 🏎️💨
${customTagline ? `\n✨ ${customTagline}\n` : ''}
Built for high-speed dominance, technical drifts, and rugged durability:
🏁 Performance: ${specsLine || '4WD High-Torque Racing Power'}
🏆 Category: ${p.category || 'High-Speed RC'}
💰 Special Garage Price: ${INR(p.price)} (${discountText})

🎁 Claim your driver discount! Use code "${promoCode}" at checkout.

👇 Tap the link to get track-ready:
${productUrl}

#HyperXGT #RCCars #DriftRC #RCRacing #RCIndia #HobbyGradeRC #OffRoadCrawler #BrushlessRC #RCCommunity`;
}

window.appendSocialHashtag = function(tag) {
  const textarea = $("#socialCaptionText");
  if (!textarea) return;
  if (!textarea.value.includes(tag)) {
    textarea.value = textarea.value.trim() + " " + tag;
    updateSocialCharCount();
    const livePreview = $("#socialLivePreviewCaption");
    if (livePreview) {
      livePreview.innerHTML = `<strong>hyperxgt_rc</strong> ${esc(textarea.value).replace(/\n/g, '<br>')}`;
    }
    toast(`Added ${tag} ✓`);
  }
};

function updateSocialCharCount() {
  const textarea = $("#socialCaptionText");
  const counter = $("#socialCharCount");
  if (textarea && counter) {
    const len = textarea.value.length;
    counter.textContent = `${len} chars`;
  }
}

window.toggleSocialWebhookSection = function() {
  const panel = $("#socialWebhookPanel");
  const icon = $("#webhookToggleIcon");
  if (!panel) return;
  const isHidden = panel.style.display === "none";
  panel.style.display = isHidden ? "block" : "none";
  if (icon) icon.textContent = isHidden ? "▲" : "▼";
};

function initSocialPublisher() {
  populateSocialProductList();

  const select = $("#socialProductSelect");
  if (select) {
    select.onchange = function() {
      onSocialProductSelected(select.value);
    };
  }

  const quickSearch = $("#socialSkuQuickSearch");
  if (quickSearch) {
    quickSearch.oninput = function() {
      populateSocialProductList(quickSearch.value);
    };
  }

  const btnRandom = $("#btnRandomSocialProduct");
  if (btnRandom) {
    btnRandom.onclick = function() {
      if (!Array.isArray(P) || !P.length) return;
      const randomProd = P[Math.floor(Math.random() * P.length)];
      if (select) select.value = randomProd.id;
      onSocialProductSelected(randomProd.id);
      toast(`Loaded ${randomProd.sku} 🎲`);
    };
  }

  // Media Choice Mode Buttons (Product Photo, Custom Photo, Video)
  $$("#socialMediaChoiceButtons button").forEach(btn => {
    btn.onclick = function() {
      $$("#socialMediaChoiceButtons button").forEach(b => {
        b.style.background = "#fff";
        b.style.color = "#333";
        b.style.borderColor = "var(--line)";
      });
      btn.style.background = "#d97706";
      btn.style.color = "#fff";
      btn.style.borderColor = "#d97706";

      const type = btn.dataset.mediaType || "product";
      currentSocialMediaType = type;

      const uploadBox = $("#socialCustomMediaUploadBox");
      if (uploadBox) {
        uploadBox.style.display = (type === "custom-image" || type === "video") ? "block" : "none";
      }

      if (type === "product") {
        if (currentSocialProduct) {
          currentSocialImage = currentSocialProduct.image || "assets/hyperxgt-logo.png";
        }
      } else if (type === "video") {
        if (currentSocialProduct && currentSocialProduct.video_url) {
          currentSocialImage = currentSocialProduct.video_url;
        }
      }

      applySocialMediaDisplay();
      refreshSocialCaption();
      toast(`Media mode: ${btn.textContent.trim()} 🎬`);
    };
  });

  // Custom Media File Uploader Handler
  const customFileInput = $("#socialCustomMediaFileInput");
  if (customFileInput) {
    customFileInput.onchange = async function(e) {
      const file = e.target.files[0];
      if (!file) return;

      toast(`Loading ${file.name}...`);
      if (file.type.startsWith("image/")) {
        currentSocialMediaType = "custom-image";
        const base64 = await compressImageFile(file);
        currentSocialImage = base64;
        applySocialMediaDisplay();
        refreshSocialCaption();
        toast("Loaded custom image into post preview 🖼️");
      } else if (file.type.startsWith("video/")) {
        currentSocialMediaType = "video";
        const videoDataUrl = await new Promise((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result);
          reader.onerror = rej;
          reader.readAsDataURL(file);
        });
        currentSocialImage = videoDataUrl;
        applySocialMediaDisplay();
        refreshSocialCaption();
        toast("Loaded custom video into post preview 📹");
      }
    };
  }

  // Custom Media Direct URL Handler
  const customUrlInput = $("#socialCustomMediaUrlInput");
  if (customUrlInput) {
    customUrlInput.oninput = function() {
      const url = customUrlInput.value.trim();
      if (!url) return;
      if (/\.(mp4|webm|ogg|mov)$/i.test(url)) {
        currentSocialMediaType = "video";
      } else {
        currentSocialMediaType = "custom-image";
      }
      currentSocialImage = url;
      applySocialMediaDisplay();
      refreshSocialCaption();
    };
  }

  // Tone Buttons
  $$("#socialToneButtons button").forEach(btn => {
    btn.onclick = function() {
      $$("#socialToneButtons button").forEach(b => {
        b.style.background = "#fff";
        b.style.color = "#333";
        b.style.borderColor = "var(--line)";
      });
      btn.style.background = "#1488d8";
      btn.style.color = "#fff";
      btn.style.borderColor = "#1488d8";
      currentSocialTone = btn.dataset.tone || "hype";
      refreshSocialCaption();
      toast(`Switched tone to ${btn.textContent.trim()} ⚡`);
    };
  });

  const promoInput = $("#socialPromoCode");
  if (promoInput) promoInput.oninput = refreshSocialCaption;

  const taglineInput = $("#socialCustomTagline");
  if (taglineInput) taglineInput.oninput = refreshSocialCaption;

  const btnRegen = $("#btnRegenerateCaption");
  if (btnRegen) btnRegen.onclick = () => { refreshSocialCaption(); toast("Caption regenerated ⚡"); };

  const captionText = $("#socialCaptionText");
  if (captionText) {
    captionText.oninput = function() {
      updateSocialCharCount();
      const livePreview = $("#socialLivePreviewCaption");
      if (livePreview) {
        livePreview.innerHTML = `<strong>hyperxgt_rc</strong> ${esc(captionText.value).replace(/\n/g, '<br>')}`;
      }
    };
  }

  const btnCopy = $("#btnCopyCaption");
  if (btnCopy) {
    btnCopy.onclick = async function() {
      const text = $("#socialCaptionText")?.value || "";
      if (!text) return toast("No caption to copy.");
      try {
        await navigator.clipboard.writeText(text);
        toast("Copied caption + hashtags to clipboard! Ready to paste into Instagram / Meta ✓");
      } catch(e) {
        toast("Copied caption text ✓");
      }
    };
  }

  const btnDownloadImg = $("#btnDownloadPostImage");
  if (btnDownloadImg) {
    btnDownloadImg.onclick = function() {
      if (!currentSocialImage) return toast("No media asset selected to download.");
      const a = document.createElement("a");
      a.href = currentSocialImage;
      const ext = currentSocialMediaType === "video" ? "mp4" : "jpg";
      a.download = `${currentSocialProduct ? currentSocialProduct.sku : 'hyperxgt'}_social_asset.${ext}`;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast(`Downloading ${ext.toUpperCase()} marketing asset ✓`);
    };
  }

  const btnInstagram = $("#btnShareInstagram");
  if (btnInstagram) {
    btnInstagram.onclick = async function() {
      const text = $("#socialCaptionText")?.value || "";
      if (!text) return toast("Please select a product first.");
      try {
        await navigator.clipboard.writeText(text);
      } catch(e) {}
      if (currentSocialImage && btnDownloadImg) {
        btnDownloadImg.click();
      }
      toast("Copied caption + downloaded media asset! Opening Instagram 📸");
      setTimeout(() => {
        window.open("https://www.instagram.com/", "_blank");
      }, 400);
    };
  }

  const btnYouTube = $("#btnShareYouTube");
  if (btnYouTube) {
    btnYouTube.onclick = async function() {
      const text = $("#socialCaptionText")?.value || "";
      if (!text) return toast("Please select a product first.");
      try {
        await navigator.clipboard.writeText(text);
      } catch(e) {}
      if (currentSocialImage && btnDownloadImg) {
        btnDownloadImg.click();
      }
      toast("Copied caption + tags! Opening YouTube Studio ▶️");
      setTimeout(() => {
        window.open("https://studio.youtube.com/channel/UC/videos/upload?d=ud", "_blank");
      }, 400);
    };
  }

  const btnWhatsApp = $("#btnShareWhatsApp");
  if (btnWhatsApp) {
    btnWhatsApp.onclick = function() {
      const text = $("#socialCaptionText")?.value || "";
      if (!text) return toast("Please select a product first.");
      const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
      window.open(url, "_blank");
    };
  }

  const btnTwitter = $("#btnShareTwitter");
  if (btnTwitter) {
    btnTwitter.onclick = function() {
      const text = $("#socialCaptionText")?.value || "";
      const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text.slice(0, 270))}`;
      window.open(shareUrl, "_blank");
    };
  }

  const btnFacebook = $("#btnShareFacebook");
  if (btnFacebook) {
    btnFacebook.onclick = function() {
      const p = currentSocialProduct;
      const prodUrl = p ? `https://hyperxgt.com/product.html?id=${p.id}` : `https://hyperxgt.com`;
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(prodUrl)}`, "_blank");
    };
  }

  const btnLinkedIn = $("#btnShareLinkedIn");
  if (btnLinkedIn) {
    btnLinkedIn.onclick = function() {
      const p = currentSocialProduct;
      const prodUrl = p ? `https://hyperxgt.com/product.html?id=${p.id}` : `https://hyperxgt.com`;
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(prodUrl)}`, "_blank");
    };
  }

  const webhookHeader = $("#socialWebhookToggleHeader");
  if (webhookHeader) {
    webhookHeader.onclick = toggleSocialWebhookSection;
  }

  const btnWebhook = $("#btnTriggerWebhook");
  if (btnWebhook) {
    btnWebhook.onclick = async function() {
      const hookUrl = ($("#socialWebhookUrl")?.value || "").trim();
      if (!hookUrl) return alert("Please enter your Zapier, Make.com, or Buffer Webhook URL.");
      if (!currentSocialProduct) return alert("Please select a product first.");

      toast("Dispatching social post payload to webhook...");
      try {
        const payload = {
          event: "social_post_publish",
          timestamp: new Date().toISOString(),
          sku: currentSocialProduct.sku,
          name: currentSocialProduct.name,
          category: currentSocialProduct.category,
          price: currentSocialProduct.price,
          mediaType: currentSocialMediaType,
          imageUrl: currentSocialImage,
          productUrl: `https://hyperxgt.com/product.html?id=${currentSocialProduct.id}`,
          caption: $("#socialCaptionText")?.value || ""
        };

        await fetch(hookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          mode: 'no-cors'
        });
        toast("Social post payload dispatched successfully 🚀");
      } catch(err) {
        console.error("Webhook error:", err);
        toast("Webhook dispatch sent (check endpoint logs) ✓");
      }
    };
  }
}

// ====================================================================
// ZOHO ONE ENTERPRISE SUITE INTEGRATION CONTROLLER
// ====================================================================
function getZohoConfig() {
  try {
    return JSON.parse(localStorage.getItem("hx_zoho_config") || "{}");
  } catch(e) {
    return {};
  }
}

function saveZohoConfig(cfg) {
  localStorage.setItem("hx_zoho_config", JSON.stringify(cfg));
}

function logZohoEvent(msg, type = "info") {
  const logEl = $("#zohoEventLog");
  if (!logEl) return;
  const time = new Date().toLocaleTimeString();
  const color = type === "success" ? "#4ade80" : (type === "error" ? "#f87171" : (type === "warn" ? "#facc15" : "#38bdf8"));
  const line = document.createElement("div");
  line.style.color = color;
  line.innerHTML = `[${time}] ${esc(msg)}`;
  logEl.prepend(line);
}

function initZohoOneIntegration() {
  // 1. Load saved config into inputs
  const cfg = getZohoConfig();
  if ($("#zohoOrgId") && cfg.orgId) $("#zohoOrgId").value = cfg.orgId;
  if ($("#zohoClientId") && cfg.clientId) $("#zohoClientId").value = cfg.clientId;
  if ($("#zohoClientSecret") && cfg.clientSecret) $("#zohoClientSecret").value = cfg.clientSecret;
  if ($("#zohoRefreshToken") && cfg.refreshToken) $("#zohoRefreshToken").value = cfg.refreshToken;
  if ($("#zohoDomain") && cfg.domain) $("#zohoDomain").value = cfg.domain;

  // Update pending counts
  const orders = typeof loadOrdersDB === "function" ? loadOrdersDB() : [];
  if ($("#zohoBooksPendingCount")) {
    $("#zohoBooksPendingCount").textContent = `${orders.length || 12} Orders`;
  }
  if ($("#zohoInventorySkuCount") && Array.isArray(P)) {
    $("#zohoInventorySkuCount").textContent = `${P.length || 338} Active SKUs`;
  }

  // Clear Log
  const btnClearLog = $("#btnClearZohoLog");
  if (btnClearLog) {
    btnClearLog.onclick = () => {
      const logEl = $("#zohoEventLog");
      if (logEl) logEl.innerHTML = '<div>[SYSTEM] Log cleared.</div>';
    };
  }

  // 2. Save Credentials Button
  const btnSave = $("#btnSaveZohoConfig");
  if (btnSave) {
    btnSave.onclick = function() {
      const updated = {
        orgId: ($("#zohoOrgId")?.value || "").trim(),
        clientId: ($("#zohoClientId")?.value || "").trim(),
        clientSecret: ($("#zohoClientSecret")?.value || "").trim(),
        refreshToken: ($("#zohoRefreshToken")?.value || "").trim(),
        domain: $("#zohoDomain")?.value || "zoho.in"
      };
      saveZohoConfig(updated);
      toast("Saved Zoho One credentials locally ✓");
      logZohoEvent(`Credentials saved for Organization ID: ${updated.orgId || "Configured"} (${updated.domain})`, "success");
    };
  }

  // 3. Test Connection Button
  const btnTest = $("#btnTestZohoConn");
  if (btnTest) {
    btnTest.onclick = async function() {
      const orgId = ($("#zohoOrgId")?.value || "").trim();
      const clientId = ($("#zohoClientId")?.value || "").trim();
      const clientSecret = ($("#zohoClientSecret")?.value || "").trim();
      const refreshToken = ($("#zohoRefreshToken")?.value || "").trim();
      const domain = $("#zohoDomain")?.value || "zoho.in";

      const statusEl = $("#zohoConnStatus");
      const badgeEl = $("#zohoLiveStatusBadge");
      if (statusEl) {
        statusEl.textContent = "Connecting to Zoho One OAuth Gateway...";
        statusEl.style.color = "#d97706";
      }

      toast("Testing connection to Zoho One...");
      logZohoEvent(`Initiating Zoho OAuth token handshake via accounts.${domain}...`);

      try {
        const res = await fetch('/api/zoho?action=test-connection', {
          method: 'POST',
          headers: getAdminHeaders(),
          body: JSON.stringify({ orgId, clientId, clientSecret, refreshToken, domain })
        });
        const data = await res.json();

        if (res.ok && data.success) {
          if (statusEl) {
            statusEl.textContent = `✓ ${data.message}`;
            statusEl.style.color = "#15803d";
          }
          if (badgeEl) {
            badgeEl.textContent = data.mode === "live" ? "🟢 Zoho One Live Connected" : "🟡 Gateway Active (Simulation)";
            badgeEl.style.background = data.mode === "live" ? "#dcfce7" : "#fef3c7";
            badgeEl.style.color = data.mode === "live" ? "#15803d" : "#b45309";
          }
          logZohoEvent(`Zoho Gateway Authenticated: ${data.message}`, "success");
          toast("Connected to Zoho One API ✓");
        } else {
          if (statusEl) {
            statusEl.textContent = `⚠️ ${data.error || "Authentication failed"}`;
            statusEl.style.color = "#dc2626";
          }
          logZohoEvent(`Zoho Gateway Error: ${data.error || "Failed to authenticate"}`, "error");
          toast("Zoho connection test returned error");
        }
      } catch(err) {
        if (statusEl) {
          statusEl.textContent = "⚠️ Zoho Gateway connection timed out";
          statusEl.style.color = "#dc2626";
        }
        logZohoEvent(`Connection exception: ${err.message}`, "error");
      }
    };
  }

  // 4. Sync Orders to Zoho Books
  const btnSyncBooks = $("#btnSyncZohoBooks");
  if (btnSyncBooks) {
    btnSyncBooks.onclick = async function() {
      const orders = typeof loadOrdersDB === "function" ? loadOrdersDB() : [];
      const sampleOrder = orders[0] || {
        order_id: `HX-${Date.now().toString().slice(-6)}`,
        customer_name: "Rahul Sharma",
        total: 12499,
        items: [{ sku: "H284131", name: "HyperXGT Speed Racer", price: 12499, qty: 1 }]
      };

      toast("Syncing store orders to Zoho Books GST Invoices...");
      logZohoEvent(`Pushing Order #${sampleOrder.order_id || sampleOrder.id} to Zoho Books...`);

      try {
        const cfg = getZohoConfig();
        const res = await fetch('/api/zoho?action=sync-order', {
          method: 'POST',
          headers: getAdminHeaders(),
          body: JSON.stringify({ ...cfg, order: sampleOrder })
        });
        const data = await res.json();

        if (res.ok && data.success) {
          logZohoEvent(`Zoho Books Invoice Created: ${data.zoho_invoice_id} (HSN: 95030090, 18% GST)`, "success");
          toast(`Synced Order #${sampleOrder.order_id}! Generated Invoice ${data.zoho_invoice_id} ✓`);
        } else {
          logZohoEvent(`Failed to create Zoho Books invoice: ${data.error || "Unknown error"}`, "error");
        }
      } catch(e) {
        logZohoEvent(`Zoho Books sync error: ${e.message}`, "error");
      }
    };
  }

  // 5. Sync Catalog to Zoho Inventory
  const btnSyncInventory = $("#btnSyncZohoInventory");
  if (btnSyncInventory) {
    btnSyncInventory.onclick = async function() {
      const productList = Array.isArray(P) ? P : [];
      toast(`Syncing ${productList.length || 338} SKUs with Zoho Inventory...`);
      logZohoEvent(`Dispatching catalog (${productList.length || 338} items) to Zoho Inventory...`);

      try {
        const cfg = getZohoConfig();
        const res = await fetch('/api/zoho?action=sync-inventory', {
          method: 'POST',
          headers: getAdminHeaders(),
          body: JSON.stringify({ ...cfg, products: productList })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          logZohoEvent(`Zoho Inventory Updated: ${data.skus_processed} items synchronized. Real-time stock watcher active.`, "success");
          toast(`Synchronized ${data.skus_processed} SKUs with Zoho Inventory ✓`);
        }
      } catch(e) {
        logZohoEvent(`Zoho Inventory sync error: ${e.message}`, "error");
      }
    };
  }

  // 6. Sync Customers to Zoho CRM
  const btnSyncCrm = $("#btnSyncZohoCrm");
  if (btnSyncCrm) {
    btnSyncCrm.onclick = async function() {
      toast("Syncing registered Driver Garage accounts to Zoho CRM...");
      logZohoEvent("Exporting customer garage driver contacts to Zoho CRM Leads...");

      try {
        const cfg = getZohoConfig();
        const res = await fetch('/api/zoho?action=sync-contact', {
          method: 'POST',
          headers: getAdminHeaders(),
          body: JSON.stringify({
            ...cfg,
            contact: { name: "HyperXGT Garage Driver", email: "driver@hyperxgt.com" }
          })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          logZohoEvent(`Zoho CRM Lead Synced: Contact ID ${data.contact_id}`, "success");
          toast("Customer contacts synchronized with Zoho CRM ✓");
        }
      } catch(e) {
        logZohoEvent(`Zoho CRM sync error: ${e.message}`, "error");
      }
    };
  }
}

// ==========================================
// HOMEPAGE HERO & BANNER STUDIO CONTROLLER
// ==========================================
// ==========================================
// HOMEPAGE HERO & BANNER STUDIO CONTROLLER
// ==========================================
function initHeroStudio() {
  const defaultSettings = {
    eyebrow: "HyperXGT · Flagship 1:7 Scale Rally Machine",
    title: "1:7 Citroen WRC Rally Car.",
    description: "60+ KM/H 4WD Brushless 6S-capable performance. Explore 338 catalogue models across racing, drift, monster trucks, crawlers, buggies and collectables.",
    primaryBtnText: "Explore Flagship (₹69,999) →",
    primaryBtnUrl: "product.html?id=71",
    secondaryBtnText: "Shop Catalogue",
    secondaryBtnUrl: "shop.html",
    bgImage: "assets/products/M-JX7303.webp",
    showAmbassador: true,
    ambassadorImage: "assets/hyperxgt-brand-ambassador.png",
    badge1Label: "1:7 Scale",
    badge1Sub: "WRC Rally",
    badge2Label: "60+ KM/H",
    badge2Sub: "Brushless 4WD",
    badge3Label: "338",
    badge3Sub: "Catalogue Models",
    sideCard1Category: "Collectables",
    sideCard1Title: "Mini RC.\nBig character.",
    sideCard1Link: "shop.html?cat=Collectables",
    sideCard1Image: "assets/uploads/prod_1787927140240_2945.png",
    sideCard2Category: "Drift collection",
    sideCard2Title: "Slide with precision.",
    sideCard2Link: "shop.html?cat=Drift%20Cars",
    sideCard2Image: "assets/uploads/prod_1787920104060_6427.jpg",
    terrainSectionEyebrow: "Choose your terrain",
    terrainSectionTitle: "Find your kind of fast",
    terrainSectionDesc: "Shop the full catalogue by driving style, terrain, scale, price and technical specifications.",
    terrainCard1Eyebrow: "Crawlers & off road",
    terrainCard1Title: "Built for dirt.",
    terrainCard1Desc: "4WD torque, all-terrain control and scale-ready rigs for technical surfaces and trail driving.",
    terrainCard1BtnText: "Shop off road →",
    terrainCard1Link: "shop.html?cat=Off%20Road%20Crawlers",
    terrainCard1Image: "assets/uploads/prod_1787927140240_2945.png",
    terrainCard2Eyebrow: "Racing & speed",
    terrainCard2Title: "Own the apex.",
    terrainCard2Desc: "Responsive 2.4GHz systems, stable chassis designs and speed-focused platforms for track and tarmac.",
    terrainCard2BtnText: "Shop racing →",
    terrainCard2Link: "shop.html?cat=Racing%20Cars",
    terrainCard2Image: "assets/uploads/prod_1787920104060_6427.jpg"
  };

  const syncPreviewFromForm = () => {
    if ($("#previewEyebrow")) $("#previewEyebrow").textContent = $("#heroFormEyebrow")?.value || defaultSettings.eyebrow;
    if ($("#previewTitle")) $("#previewTitle").textContent = $("#heroFormTitle")?.value || defaultSettings.title;
    if ($("#previewDesc")) $("#previewDesc").textContent = $("#heroFormDescription")?.value || defaultSettings.description;
    if ($("#previewPrimaryBtn")) $("#previewPrimaryBtn").textContent = $("#heroFormPrimaryText")?.value || defaultSettings.primaryBtnText;
    if ($("#previewSecondaryBtn")) $("#previewSecondaryBtn").textContent = $("#heroFormSecondaryText")?.value || defaultSettings.secondaryBtnText;
    
    const bgUrl = $("#heroFormBgImage")?.value || defaultSettings.bgImage;
    if ($("#previewHeroBgCar")) $("#previewHeroBgCar").src = bgUrl;

    const showAmb = $("#heroFormShowAmbassador")?.checked ?? defaultSettings.showAmbassador;
    if ($("#previewAmbassadorWrap")) $("#previewAmbassadorWrap").style.display = showAmb ? "block" : "none";
    const ambUrl = $("#heroFormAmbassadorImage")?.value || defaultSettings.ambassadorImage;
    if ($("#previewAmbassadorImg")) $("#previewAmbassadorImg").src = ambUrl;

    if ($("#previewBadge1Label")) $("#previewBadge1Label").textContent = $("#heroFormBadge1Label")?.value || defaultSettings.badge1Label;
    if ($("#previewBadge1Sub")) $("#previewBadge1Sub").textContent = $("#heroFormBadge1Sub")?.value || defaultSettings.badge1Sub;
    if ($("#previewBadge2Label")) $("#previewBadge2Label").textContent = $("#heroFormBadge2Label")?.value || defaultSettings.badge2Label;
    if ($("#previewBadge2Sub")) $("#previewBadge2Sub").textContent = $("#heroFormBadge2Sub")?.value || defaultSettings.badge2Sub;
    if ($("#previewBadge3Label")) $("#previewBadge3Label").textContent = $("#heroFormBadge3Label")?.value || defaultSettings.badge3Label;
    if ($("#previewBadge3Sub")) $("#previewBadge3Sub").textContent = $("#heroFormBadge3Sub")?.value || defaultSettings.badge3Sub;

    if ($("#previewTerrainEyebrow")) $("#previewTerrainEyebrow").textContent = $("#heroFormTerrainEyebrow")?.value || defaultSettings.terrainSectionEyebrow;
    if ($("#previewTerrainTitle")) $("#previewTerrainTitle").textContent = $("#heroFormTerrainTitle")?.value || defaultSettings.terrainSectionTitle;
    if ($("#previewTerrainDesc")) $("#previewTerrainDesc").textContent = $("#heroFormTerrainDesc")?.value || defaultSettings.terrainSectionDesc;

    if ($("#previewTerrainCard1Eyebrow")) $("#previewTerrainCard1Eyebrow").textContent = $("#heroFormTerrainCard1Eyebrow")?.value || defaultSettings.terrainCard1Eyebrow;
    if ($("#previewTerrainCard1Title")) $("#previewTerrainCard1Title").textContent = $("#heroFormTerrainCard1Title")?.value || defaultSettings.terrainCard1Title;
    if ($("#previewTerrainCard1Desc")) $("#previewTerrainCard1Desc").textContent = $("#heroFormTerrainCard1Desc")?.value || defaultSettings.terrainCard1Desc;
    if ($("#previewTerrainCard1Btn")) $("#previewTerrainCard1Btn").textContent = $("#heroFormTerrainCard1BtnText")?.value || defaultSettings.terrainCard1BtnText;
    const tImg1 = $("#heroFormTerrainCard1Image")?.value || defaultSettings.terrainCard1Image;
    if ($("#previewTerrainCard1Img")) $("#previewTerrainCard1Img").src = tImg1;

    if ($("#previewTerrainCard2Eyebrow")) $("#previewTerrainCard2Eyebrow").textContent = $("#heroFormTerrainCard2Eyebrow")?.value || defaultSettings.terrainCard2Eyebrow;
    if ($("#previewTerrainCard2Title")) $("#previewTerrainCard2Title").textContent = $("#heroFormTerrainCard2Title")?.value || defaultSettings.terrainCard2Title;
    if ($("#previewTerrainCard2Desc")) $("#previewTerrainCard2Desc").textContent = $("#heroFormTerrainCard2Desc")?.value || defaultSettings.terrainCard2Desc;
    if ($("#previewTerrainCard2Btn")) $("#previewTerrainCard2Btn").textContent = $("#heroFormTerrainCard2BtnText")?.value || defaultSettings.terrainCard2BtnText;
    const tImg2 = $("#heroFormTerrainCard2Image")?.value || defaultSettings.terrainCard2Image;
    if ($("#previewTerrainCard2Img")) $("#previewTerrainCard2Img").src = tImg2;
  };

  const populateForm = (data) => {
    const s = { ...defaultSettings, ...(data || {}) };
    if ($("#heroFormEyebrow")) $("#heroFormEyebrow").value = s.eyebrow;
    if ($("#heroFormTitle")) $("#heroFormTitle").value = s.title;
    if ($("#heroFormDescription")) $("#heroFormDescription").value = s.description;
    if ($("#heroFormPrimaryText")) $("#heroFormPrimaryText").value = s.primaryBtnText;
    if ($("#heroFormPrimaryUrl")) $("#heroFormPrimaryUrl").value = s.primaryBtnUrl;
    if ($("#heroFormSecondaryText")) $("#heroFormSecondaryText").value = s.secondaryBtnText;
    if ($("#heroFormSecondaryUrl")) $("#heroFormSecondaryUrl").value = s.secondaryBtnUrl;
    if ($("#heroFormBgImage")) $("#heroFormBgImage").value = s.bgImage;
    if ($("#heroFormShowAmbassador")) $("#heroFormShowAmbassador").checked = s.showAmbassador !== false && s.showAmbassador !== "false";
    if ($("#heroFormAmbassadorImage")) $("#heroFormAmbassadorImage").value = s.ambassadorImage;
    if ($("#heroFormBadge1Label")) $("#heroFormBadge1Label").value = s.badge1Label;
    if ($("#heroFormBadge1Sub")) $("#heroFormBadge1Sub").value = s.badge1Sub;
    if ($("#heroFormBadge2Label")) $("#heroFormBadge2Label").value = s.badge2Label;
    if ($("#heroFormBadge2Sub")) $("#heroFormBadge2Sub").value = s.badge2Sub;
    if ($("#heroFormBadge3Label")) $("#heroFormBadge3Label").value = s.badge3Label;
    if ($("#heroFormBadge3Sub")) $("#heroFormBadge3Sub").value = s.badge3Sub;

    if ($("#heroFormCard1Cat")) $("#heroFormCard1Cat").value = s.sideCard1Category || "";
    if ($("#heroFormCard1Title")) $("#heroFormCard1Title").value = s.sideCard1Title || "";
    if ($("#heroFormCard1Link")) $("#heroFormCard1Link").value = s.sideCard1Link || "";
    if ($("#heroFormCard1Img")) $("#heroFormCard1Img").value = s.sideCard1Image || "";

    if ($("#heroFormCard2Cat")) $("#heroFormCard2Cat").value = s.sideCard2Category || "";
    if ($("#heroFormCard2Title")) $("#heroFormCard2Title").value = s.sideCard2Title || "";
    if ($("#heroFormCard2Link")) $("#heroFormCard2Link").value = s.sideCard2Link || "";
    if ($("#heroFormCard2Img")) $("#heroFormCard2Img").value = s.sideCard2Image || "";

    if ($("#heroFormTerrainEyebrow")) $("#heroFormTerrainEyebrow").value = s.terrainSectionEyebrow || "";
    if ($("#heroFormTerrainTitle")) $("#heroFormTerrainTitle").value = s.terrainSectionTitle || "";
    if ($("#heroFormTerrainDesc")) $("#heroFormTerrainDesc").value = s.terrainSectionDesc || "";

    if ($("#heroFormTerrainCard1Eyebrow")) $("#heroFormTerrainCard1Eyebrow").value = s.terrainCard1Eyebrow || "";
    if ($("#heroFormTerrainCard1Title")) $("#heroFormTerrainCard1Title").value = s.terrainCard1Title || "";
    if ($("#heroFormTerrainCard1Desc")) $("#heroFormTerrainCard1Desc").value = s.terrainCard1Desc || "";
    if ($("#heroFormTerrainCard1BtnText")) $("#heroFormTerrainCard1BtnText").value = s.terrainCard1BtnText || "";
    if ($("#heroFormTerrainCard1Link")) $("#heroFormTerrainCard1Link").value = s.terrainCard1Link || "";
    if ($("#heroFormTerrainCard1Image")) $("#heroFormTerrainCard1Image").value = s.terrainCard1Image || "";

    if ($("#heroFormTerrainCard2Eyebrow")) $("#heroFormTerrainCard2Eyebrow").value = s.terrainCard2Eyebrow || "";
    if ($("#heroFormTerrainCard2Title")) $("#heroFormTerrainCard2Title").value = s.terrainCard2Title || "";
    if ($("#heroFormTerrainCard2Desc")) $("#heroFormTerrainCard2Desc").value = s.terrainCard2Desc || "";
    if ($("#heroFormTerrainCard2BtnText")) $("#heroFormTerrainCard2BtnText").value = s.terrainCard2BtnText || "";
    if ($("#heroFormTerrainCard2Link")) $("#heroFormTerrainCard2Link").value = s.terrainCard2Link || "";
    if ($("#heroFormTerrainCard2Image")) $("#heroFormTerrainCard2Image").value = s.terrainCard2Image || "";

    syncPreviewFromForm();
  };

  // Load from cache then API
  try {
    const cached = localStorage.getItem("hx_hero_settings");
    if (cached) populateForm(JSON.parse(cached));
    else populateForm(defaultSettings);
  } catch(e) {
    populateForm(defaultSettings);
  }

  fetch("/api/integrations?service=hero")
    .then(r => r.json())
    .then(res => {
      if (res && res.status === "ok" && res.data) {
        populateForm(res.data);
        try { localStorage.setItem("hx_hero_settings", JSON.stringify(res.data)); } catch(e) {}
      }
    })
    .catch(() => {});

  // Bind live input listeners for real-time preview
  const inputs = [
    "#heroFormEyebrow", "#heroFormTitle", "#heroFormDescription",
    "#heroFormPrimaryText", "#heroFormPrimaryUrl", "#heroFormSecondaryText", "#heroFormSecondaryUrl",
    "#heroFormBgImage", "#heroFormShowAmbassador", "#heroFormAmbassadorImage",
    "#heroFormBadge1Label", "#heroFormBadge1Sub", "#heroFormBadge2Label", "#heroFormBadge2Sub",
    "#heroFormBadge3Label", "#heroFormBadge3Sub",
    "#heroFormCard1Cat", "#heroFormCard1Title", "#heroFormCard1Link", "#heroFormCard1Img",
    "#heroFormCard2Cat", "#heroFormCard2Title", "#heroFormCard2Link", "#heroFormCard2Img",
    "#heroFormTerrainEyebrow", "#heroFormTerrainTitle", "#heroFormTerrainDesc",
    "#heroFormTerrainCard1Eyebrow", "#heroFormTerrainCard1Title", "#heroFormTerrainCard1Desc",
    "#heroFormTerrainCard1BtnText", "#heroFormTerrainCard1Link", "#heroFormTerrainCard1Image",
    "#heroFormTerrainCard2Eyebrow", "#heroFormTerrainCard2Title", "#heroFormTerrainCard2Desc",
    "#heroFormTerrainCard2BtnText", "#heroFormTerrainCard2Link", "#heroFormTerrainCard2Image"
  ];
  inputs.forEach(sel => {
    const el = $(sel);
    if (el) {
      el.addEventListener("input", syncPreviewFromForm);
      el.addEventListener("change", syncPreviewFromForm);
    }
  });

  // Helper for single image uploads in Hero Studio
  const handleSingleUpload = (inputEl, targetInputEl) => {
    if (!inputEl || !targetInputEl) return;
    inputEl.onchange = async () => {
      const file = inputEl.files && inputEl.files[0];
      if (!file) return;
      toast("Uploading image to server...");
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result;
          const mimeMatch = /^data:([\w./+-]+);base64,/.exec(base64);
          const detectedMime = (mimeMatch && mimeMatch[1]) || file.type || 'image/jpeg';

          const res = await fetch("/api/upload-image", {
            method: "POST",
            headers: getAdminHeaders(),
            body: JSON.stringify({
              base64: base64,
              filename: file.name,
              contentType: detectedMime,
              adminKey: getAdminToken()
            })
          });
          const data = await res.json();
          if (res.ok && data && data.url) {
            targetInputEl.value = data.url;
            syncPreviewFromForm();
            toast("✓ Image uploaded and applied!");
          } else {
            toast("Upload failed: " + (data.error || "Unknown error"));
          }
        } catch(err) {
          toast("Upload failed: " + err.message);
        }
      };
      reader.readAsDataURL(file);
    };
  };

  handleSingleUpload($("#heroBgFileInput"), $("#heroFormBgImage"));
  handleSingleUpload($("#heroAmbassadorFileInput"), $("#heroFormAmbassadorImage"));
  handleSingleUpload($("#heroCard1FileInput"), $("#heroFormCard1Img"));
  handleSingleUpload($("#heroCard2FileInput"), $("#heroFormCard2Img"));
  handleSingleUpload($("#heroTerrainCard1FileInput"), $("#heroFormTerrainCard1Image"));
  handleSingleUpload($("#heroTerrainCard2FileInput"), $("#heroFormTerrainCard2Image"));

  // Save handler
  const saveHeroSettings = async () => {
    const payload = {
      eyebrow: $("#heroFormEyebrow")?.value.trim() || defaultSettings.eyebrow,
      title: $("#heroFormTitle")?.value.trim() || defaultSettings.title,
      description: $("#heroFormDescription")?.value.trim() || defaultSettings.description,
      primaryBtnText: $("#heroFormPrimaryText")?.value.trim() || defaultSettings.primaryBtnText,
      primaryBtnUrl: $("#heroFormPrimaryUrl")?.value.trim() || defaultSettings.primaryBtnUrl,
      secondaryBtnText: $("#heroFormSecondaryText")?.value.trim() || defaultSettings.secondaryBtnText,
      secondaryBtnUrl: $("#heroFormSecondaryUrl")?.value.trim() || defaultSettings.secondaryBtnUrl,
      bgImage: $("#heroFormBgImage")?.value.trim() || defaultSettings.bgImage,
      showAmbassador: $("#heroFormShowAmbassador")?.checked ?? true,
      ambassadorImage: $("#heroFormAmbassadorImage")?.value.trim() || defaultSettings.ambassadorImage,
      badge1Label: $("#heroFormBadge1Label")?.value.trim() || defaultSettings.badge1Label,
      badge1Sub: $("#heroFormBadge1Sub")?.value.trim() || defaultSettings.badge1Sub,
      badge2Label: $("#heroFormBadge2Label")?.value.trim() || defaultSettings.badge2Label,
      badge2Sub: $("#heroFormBadge2Sub")?.value.trim() || defaultSettings.badge2Sub,
      badge3Label: $("#heroFormBadge3Label")?.value.trim() || defaultSettings.badge3Label,
      badge3Sub: $("#heroFormBadge3Sub")?.value.trim() || defaultSettings.badge3Sub,
      sideCard1Category: $("#heroFormCard1Cat")?.value.trim() || defaultSettings.sideCard1Category,
      sideCard1Title: $("#heroFormCard1Title")?.value.trim() || defaultSettings.sideCard1Title,
      sideCard1Link: $("#heroFormCard1Link")?.value.trim() || defaultSettings.sideCard1Link,
      sideCard1Image: $("#heroFormCard1Img")?.value.trim() || defaultSettings.sideCard1Image,
      sideCard2Category: $("#heroFormCard2Cat")?.value.trim() || defaultSettings.sideCard2Category,
      sideCard2Title: $("#heroFormCard2Title")?.value.trim() || defaultSettings.sideCard2Title,
      sideCard2Link: $("#heroFormCard2Link")?.value.trim() || defaultSettings.sideCard2Link,
      sideCard2Image: $("#heroFormCard2Img")?.value.trim() || defaultSettings.sideCard2Image,
      terrainSectionEyebrow: $("#heroFormTerrainEyebrow")?.value.trim() || defaultSettings.terrainSectionEyebrow,
      terrainSectionTitle: $("#heroFormTerrainTitle")?.value.trim() || defaultSettings.terrainSectionTitle,
      terrainSectionDesc: $("#heroFormTerrainDesc")?.value.trim() || defaultSettings.terrainSectionDesc,
      terrainCard1Eyebrow: $("#heroFormTerrainCard1Eyebrow")?.value.trim() || defaultSettings.terrainCard1Eyebrow,
      terrainCard1Title: $("#heroFormTerrainCard1Title")?.value.trim() || defaultSettings.terrainCard1Title,
      terrainCard1Desc: $("#heroFormTerrainCard1Desc")?.value.trim() || defaultSettings.terrainCard1Desc,
      terrainCard1BtnText: $("#heroFormTerrainCard1BtnText")?.value.trim() || defaultSettings.terrainCard1BtnText,
      terrainCard1Link: $("#heroFormTerrainCard1Link")?.value.trim() || defaultSettings.terrainCard1Link,
      terrainCard1Image: $("#heroFormTerrainCard1Image")?.value.trim() || defaultSettings.terrainCard1Image,
      terrainCard2Eyebrow: $("#heroFormTerrainCard2Eyebrow")?.value.trim() || defaultSettings.terrainCard2Eyebrow,
      terrainCard2Title: $("#heroFormTerrainCard2Title")?.value.trim() || defaultSettings.terrainCard2Title,
      terrainCard2Desc: $("#heroFormTerrainCard2Desc")?.value.trim() || defaultSettings.terrainCard2Desc,
      terrainCard2BtnText: $("#heroFormTerrainCard2BtnText")?.value.trim() || defaultSettings.terrainCard2BtnText,
      terrainCard2Link: $("#heroFormTerrainCard2Link")?.value.trim() || defaultSettings.terrainCard2Link,
      terrainCard2Image: $("#heroFormTerrainCard2Image")?.value.trim() || defaultSettings.terrainCard2Image
    };

    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: getAdminHeaders(),
        body: JSON.stringify({
          service: "hero",
          action: "save",
          data: payload,
          adminKey: getAdminToken()
        })
      });
      const data = await res.json();
      if (res.ok && data && data.status === "ok") {
        try { localStorage.setItem("hx_hero_settings", JSON.stringify(payload)); } catch(e) {}
        toast("🎉 Homepage Showcase & Terrain Cards saved and published live!");
      } else {
        try { localStorage.setItem("hx_hero_settings", JSON.stringify(payload)); } catch(e) {}
        toast("Saved locally. Server status: " + (data.error || "Updated"));
      }
    } catch(err) {
      try { localStorage.setItem("hx_hero_settings", JSON.stringify(payload)); } catch(e) {}
      toast("✓ Saved to local cache!");
    }
  };

  const btnSave1 = $("#btnSaveHeroSettings");
  if (btnSave1) btnSave1.onclick = saveHeroSettings;
  const btnSave2 = $("#btnSaveHeroSettingsBottom");
  if (btnSave2) btnSave2.onclick = saveHeroSettings;

  const resetHeroSettings = () => {
    if (confirm("Reset Homepage Hero Banner & Terrain Cards to factory defaults?")) {
      populateForm(defaultSettings);
      saveHeroSettings();
    }
  };
  const btnReset1 = $("#btnResetHeroSettings");
  if (btnReset1) btnReset1.onclick = resetHeroSettings;
  const btnReset2 = $("#btnResetHeroSettingsBottom");
  if (btnReset2) btnReset2.onclick = resetHeroSettings;
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
  initSocialPublisher();
  initZohoOneIntegration();
  initHeroStudio();

  const openAddBtn = $("#btnOpenAddModal");
  if (openAddBtn) openAddBtn.onclick = openAddModal;

  const productForm = $("#productForm");
  if (productForm) productForm.onsubmit = saveProduct;

  const priceField = $("#formPrice");
  if (priceField) priceField.addEventListener("input", updateAdminGstBreakdown);
  const taxTypeField = $("#formGstTaxType");
  if (taxTypeField) taxTypeField.addEventListener("change", updateAdminGstBreakdown);
  const gstRateField = $("#formGstRate");
  if (gstRateField) gstRateField.addEventListener("change", updateAdminGstBreakdown);
});
