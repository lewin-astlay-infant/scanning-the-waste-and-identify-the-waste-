/* js/app.js
   Handles login routing, simulated API calls (with localStorage fallback),
   training hub progress, e-commerce cart, QR scan and report handling.
*/

(function () {
  // ---------- Configuration & Mock Data ----------
  const MOCK_ADMIN = { username: "Levi", password: "1234" };
  const MOCK_USERS = {
    worker: [{ username: "worker1", password: "workerpass", name: "Hari" }],
    citizen: [{ username: "citizen1", password: "citizenpass", name: "Asha" }],
    buyer: [{ username: "buyer1", password: "buyerpwd", name: "RecycleCo" }],
    driver: [{ username: "driver1", password: "driverpwd", name: "Rohit" }]
  };

  // LocalStorage keys
  const LS_KEYS = {
    SCANS: "gc_scans",
    REPORTS: "gc_reports",
    TRAINING: "gc_training_progress",
    CART: "gc_cart",
    VEHICLES: "gc_vehicles"
  };

  // Initialize mock vehicles if not present
  function seedVehicles() {
    if (!localStorage.getItem(LS_KEYS.VEHICLES)) {
      const vehicles = [
        { id: "truck-101", label: "Truck 101", lat: 28.6139, lng: 77.2090 }, // Delhi approx
        { id: "truck-102", label: "Truck 102", lat: 19.0760, lng: 72.8777 }  // Mumbai approx
      ];
      localStorage.setItem(LS_KEYS.VEHICLES, JSON.stringify(vehicles));
    }
  }
  seedVehicles();

  // ---------- Utility Helpers ----------
  function el(id) { return document.getElementById(id); }
  function notify(msg, type = "info") {
    // Simple toast using alert for now — replace with fancier UI as needed
    console.log("[NOTIFY]", type, msg);
    // if there's a message element on login page show it
    const msgEl = document.querySelector(".message");
    if (msgEl) { msgEl.textContent = msg; if (type === "error") msgEl.style.color = "#d32f2f"; else msgEl.style.color = "#2e7d32"; }
  }

  function saveToLS(key, item) {
    const arr = JSON.parse(localStorage.getItem(key) || "[]");
    arr.push(item);
    localStorage.setItem(key, JSON.stringify(arr));
  }

  // ---------- Login Logic ----------
  function handleLogin(e) {
    e.preventDefault();
    const userType = el("userType").value;
    const username = el("username").value.trim();
    const password = el("password").value;

    if (!userType) return notify("Please select a user type", "error");
    if (!username || !password) return notify("Enter username and password", "error");

    // Admin check
    if (userType === "admin") {
      if (username === MOCK_ADMIN.username && password === MOCK_ADMIN.password) {
        notify("Admin login successful", "success");
        return setTimeout(() => window.location.href = "admin.html", 400);
      } else {
        return notify("Admin credentials invalid", "error");
      }
    }

    // Generic check against mock DB
    const users = MOCK_USERS[userType] || [];
    const found = users.find(u => (u.username === username || u.username === username.toLowerCase()) && u.password === password);
    if (found) {
      notify(`${userType} login successful — Welcome ${found.name}`, "success");
      // route to appropriate page
      setTimeout(() => {
        switch (userType) {
          case "worker": window.location.href = "worker.html"; break;
          case "citizen": window.location.href = "citizen.html"; break;
          case "buyer": window.location.href = "ecommerce.html"; break;
          case "driver": window.location.href = "driver.html"; break;
          default: window.location.href = "index.html";
        }
      }, 350);
      return;
    }

    // If citizen trying to login but not found, offer sign-up + OTP verification
    if (userType === "citizen") {
      return startCitizenSignup(username, password);
    }

    notify("Invalid credentials for selected user type", "error");
  }

  // ---------- Citizen signup with "OTP" (client-side simulation) ----------
  function startCitizenSignup(username, password) {
    // Minimal inline modal simulation using prompt
    const wants = confirm("User not found. Would you like to sign up as a new citizen?");
    if (!wants) return notify("Signup canceled", "error");

    // Ask phone or email
    const emailOrPhone = prompt("Enter phone or email for verification:");
    if (!emailOrPhone) return notify("Verification contact required", "error");

    // simulate sending OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    alert(`Simulated OTP sent to ${emailOrPhone} — OTP: ${otp}`);
    const got = prompt("Enter the OTP you received:");
    if (got !== otp) return notify("OTP mismatch — signup failed", "error");

    // Save basic user to mock DB (persist to localStorage in real app)
    MOCK_USERS.citizen.push({ username, password, name: username });
    notify("Citizen account created — logging in...", "success");
    setTimeout(() => window.location.href = "citizen.html", 400);
  }

  // ---------- QR Scan Simulation & Storage ----------
  async function simulateQRScan(payload = null) {
    // payload typically: { userId, binId, wasteCategory, timestamp, photoBase64? }
    const data = payload || {
      userId: "local_user",
      binId: "bin_" + Math.floor(Math.random() * 9999),
      wasteCategory: ["dry", "wet", "e-waste", "hazardous"][Math.floor(Math.random()*4)],
      timestamp: new Date().toISOString()
    };

    // try to POST to local server endpoint /api/waste/scan
    try {
      const res = await fetch("/api/waste/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("HTTP error " + res.status);
      const resp = await res.json();
      notify("Scan submitted to server", "success");
      return resp;
    } catch (err) {
      // fallback: store to localStorage queue
      saveToLS(LS_KEYS.SCANS, data);
      notify("Offline: Scan saved locally (will sync when server available)", "info");
      return { ok: false, offlineSaved: true, data };
    }
  }

  // ---------- Submit Waste Report ----------
  async function submitReport(report) {
    // report shape: { userId, type, description, location, photos:[...], timestamp }
    const payload = Object.assign({ timestamp: new Date().toISOString() }, report);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("HTTP error " + res.status);
      const json = await res.json();
      notify("Report submitted", "success");
      return json;
    } catch (err) {
      saveToLS(LS_KEYS.REPORTS, payload);
      notify("Offline: Report stored locally (will sync when server available)", "info");
      return { ok: false, offlineSaved: true, payload };
    }
  }

  // ---------- Training hub (persist progress) ----------
  function markLessonComplete(lessonId) {
    const progress = JSON.parse(localStorage.getItem(LS_KEYS.TRAINING) || "{}");
    progress[lessonId] = { completedAt: new Date().toISOString() };
    localStorage.setItem(LS_KEYS.TRAINING, JSON.stringify(progress));
    notify("Lesson marked complete", "success");
  }

  function getTrainingProgress() {
    return JSON.parse(localStorage.getItem(LS_KEYS.TRAINING) || "{}");
  }

  // ---------- Ecommerce / Scrap Shop ----------
  function getCart() {
    return JSON.parse(localStorage.getItem(LS_KEYS.CART) || "[]");
  }
  function addToCart(item) {
    const cart = getCart();
    cart.push(item);
    localStorage.setItem(LS_KEYS.CART, JSON.stringify(cart));
    notify("Added to cart", "success");
  }
  function clearCart() {
    localStorage.removeItem(LS_KEYS.CART);
    notify("Cart cleared", "info");
  }

  async function purchaseWithPoints(userId, items, pointsBalance = 1000) {
    // simple simulation: check price, deduct points, POST to /api/transaction/purchase
    const totalPoints = items.reduce((s, it) => s + (it.pricePoints || 0), 0);
    if (totalPoints > pointsBalance) {
      return notify("Insufficient points for this purchase", "error");
    }
    const payload = { userId, items, totalPoints, timestamp: new Date().toISOString() };
    try {
      const res = await fetch("/api/transaction/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("HTTP error " + res.status);
      const json = await res.json();
      clearCart();
      notify("Purchase successful", "success");
      return json;
    } catch (err) {
      // fallback
      notify("Purchase queued (offline). It will be processed later.", "info");
      saveToLS("gc_pending_purchases", payload);
      return { ok: false, queued: true, payload };
    }
  }

  // ---------- Inventory view helpers ----------
  function saveInventoryScan(photoDataUrl, meta) {
    // saves uploaded scan photo and meta to inventory queue
    const item = Object.assign({}, { id: "inv_" + Date.now(), photo: photoDataUrl }, meta);
    saveToLS("gc_inventory", item);
    notify("Inventory scan saved locally", "success");
    return item;
  }

  // ---------- Public API (expose to pages) ----------
  window.GCApp = {
    simulateQRScan,
    submitReport,
    markLessonComplete,
    getTrainingProgress,
    addToCart,
    getCart,
    clearCart,
    purchaseWithPoints,
    saveInventoryScan,
    getLocalScans: () => JSON.parse(localStorage.getItem(LS_KEYS.SCANS) || "[]"),
    getLocalReports: () => JSON.parse(localStorage.getItem(LS_KEYS.REPORTS) || "[]"),
    LS_KEYS
  };

  // Attach event listeners on login page
  document.addEventListener("DOMContentLoaded", function () {
    const loginForm = document.getElementById("loginForm");
    if (loginForm) loginForm.addEventListener("submit", handleLogin);

    // If page includes elements to simulate QR or report (like index example), wire them
    const simulateBtn = document.querySelector('[data-action="simulate-scan"]');
    if (simulateBtn) simulateBtn.addEventListener("click", async function () {
      const res = await simulateQRScan();
      console.log("simulateQRScan result", res);
      alert("Simulated scan done. Check console/localStorage for saved data.");
    });

    const reportBtn = document.querySelector('[data-action="submit-report"]');
    if (reportBtn) reportBtn.addEventListener("click", async function () {
      // gather minimal report fields if present
      const desc = document.querySelector("#report-desc") ? document.querySelector("#report-desc").value : "Auto report";
      const payload = { userId: "local_user", type: "overflowing", description: desc, location: "Unknown" };
      const res = await submitReport(payload);
      console.log("submitReport result", res);
      if (res.offlineSaved) {
        alert("Report saved offline (localStorage).");
      } else {
        alert("Report submitted to server.");
      }
    });

    // Training buttons (if present)
    document.querySelectorAll('[data-action="complete-lesson"]').forEach(btn => {
      btn.addEventListener("click", function () {
        const lessonId = this.getAttribute("data-lesson");
        markLessonComplete(lessonId);
        this.textContent = "Completed ✓";
        this.disabled = true;
      });
    });

    // E-commerce add-to-cart buttons
    document.querySelectorAll('[data-action="add-to-cart"]').forEach(btn => {
      btn.addEventListener("click", function () {
        const itemJson = this.getAttribute("data-item");
        if (!itemJson) return;
        try {
          const item = JSON.parse(itemJson);
          addToCart(item);
        } catch (err) {
          console.error("Invalid data-item JSON", err);
        }
      });
    });

    // Purchase button
    const purchaseBtn = document.querySelector('[data-action="purchase-points"]');
    if (purchaseBtn) purchaseBtn.addEventListener("click", async () => {
      const userId = purchaseBtn.getAttribute("data-user") || "local_user";
      const cart = getCart();
      await purchaseWithPoints(userId, cart);
    });

    // Inventory upload if input present
    const invInput = document.querySelector('input[type="file"][data-inventory="true"]');
    if (invInput) {
      invInput.addEventListener("change", function (ev) {
        const file = ev.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (e) {
          saveInventoryScan(e.target.result, { filename: file.name, uploadedAt: new Date().toISOString() });
          alert("Inventory photo saved locally.");
        };
        reader.readAsDataURL(file);
      });
    }
  });

})(); // IIFE
