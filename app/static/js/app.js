const api = async (url, options = {}) => {
    const response = await fetch(url, {
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
        credentials: "same-origin",
        ...options,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Request failed");
    return data.data;
};

const money = value => `${window.currencySymbol || '\u20b9'}${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const compactMoney = value => `${window.currencySymbol || '\u20b9'}${Number(value || 0).toLocaleString("en-IN", { notation: "compact", maximumFractionDigits: 1 })}`;
const formData = form => Object.fromEntries(new FormData(form).entries());
const qs = params => new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v !== undefined)).toString();

let dashboardChartInstance = null;

function toast(message, type = "success") {
    const host = document.getElementById("toastHost");
    if (!host) return;
    const el = document.createElement("div");
    el.className = `toast align-items-center text-bg-${type === "error" ? "danger" : "dark"} border-0`;
    el.innerHTML = `<div class="d-flex"><div class="toast-body">${message}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
    host.appendChild(el);
    new bootstrap.Toast(el).show();
}

function setupShell() {
    document.querySelector(".mobile-menu")?.addEventListener("click", () => {
        document.querySelector(".sidebar")?.classList.toggle("open");
        document.querySelector(".admin-sidebar")?.classList.toggle("open");
    });
    document.addEventListener("click", event => {
        const sidebar = document.querySelector(".sidebar");
        const adminSidebar = document.querySelector(".admin-sidebar");
        const mobileMenu = document.querySelector(".mobile-menu");
        if (sidebar?.classList.contains("open") && !sidebar.contains(event.target) && !mobileMenu?.contains(event.target) && !event.target.closest(".mobile-menu")) {
            sidebar.classList.remove("open");
        }
        if (adminSidebar?.classList.contains("open") && !adminSidebar.contains(event.target) && !mobileMenu?.contains(event.target) && !event.target.closest(".mobile-menu")) {
            adminSidebar.classList.remove("open");
        }
    });
    const applyThemeIcon = () => {
        const icon = document.querySelector("#themeToggle i");
        if (!icon) return;
        icon.className = document.documentElement.dataset.theme === "dark" ? "bi bi-moon-stars" : "bi bi-sun";
    };
    document.getElementById("themeToggle")?.addEventListener("click", () => {
        const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        document.documentElement.dataset.theme = next;
        sessionStorage.setItem("smartfinance-theme", next);
        applyThemeIcon();
        
        // Dynamically update solid background colors of any active admin dropdowns in the DOM
        const bg = next === "light" ? "#ffffff" : "#131c2e";
        const border = next === "light" ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.08)";
        document.querySelectorAll(".admin-dropdown-menu").forEach(menu => {
            menu.style.setProperty("background", bg, "important");
            menu.style.setProperty("background-color", bg, "important");
            menu.style.setProperty("border", `1px solid ${border}`, "important");
        });
    });
    localStorage.removeItem("theme");
    localStorage.removeItem("smartfinance-theme");
    document.documentElement.dataset.theme = sessionStorage.getItem("smartfinance-theme") || "dark";
    applyThemeIcon();
    const showLogoutConfirm = (onConfirm) => {
        if (document.getElementById("logout-confirm-overlay")) return;

        const overlay = document.createElement("div");
        overlay.id = "logout-confirm-overlay";
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(7, 17, 31, 0.6);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;

        const card = document.createElement("div");
        card.style.cssText = `
            background: var(--surface-strong);
            border: 1px solid var(--line);
            border-radius: var(--radius-lg);
            padding: 32px;
            width: 90%;
            max-width: 420px;
            text-align: center;
            box-shadow: var(--shadow);
            transform: scale(0.9);
            transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        `;

        card.innerHTML = `
            <div style="
                width: 64px;
                height: 64px;
                background: rgba(255, 61, 112, 0.1);
                color: var(--pink);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 20px auto;
                font-size: 1.8rem;
                box-shadow: 0 0 20px rgba(255, 61, 112, 0.15);
            ">
                <i class="bi bi-box-arrow-right"></i>
            </div>
            <h3 style="
                color: var(--text);
                font-weight: 700;
                font-size: 1.3rem;
                margin: 0 0 10px 0;
            ">Confirm Logout</h3>
            <p style="
                color: var(--muted);
                font-size: 0.90rem;
                line-height: 1.5;
                margin: 0 0 28px 0;
            ">Are you sure you want to log out of your session? Unsaved changes may not be saved.</p>
            <div style="
                display: flex;
                gap: 12px;
                justify-content: center;
            ">
                <button id="logout-cancel-btn" style="
                    flex: 1;
                    background: var(--surface-soft);
                    border: 1px solid var(--line);
                    color: var(--text);
                    padding: 12px;
                    border-radius: var(--radius-md);
                    font-weight: 600;
                    font-size: 0.88rem;
                    cursor: pointer;
                    transition: all 0.2s;
                ">Cancel</button>
                <button id="logout-confirm-btn" style="
                    flex: 1;
                    background: linear-gradient(135deg, var(--pink), #e03260);
                    border: none;
                    color: white;
                    padding: 12px;
                    border-radius: var(--radius-md);
                    font-weight: 600;
                    font-size: 0.88rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 4px 12px rgba(255, 61, 112, 0.25);
                ">Log Out</button>
            </div>
        `;

        overlay.appendChild(card);
        document.body.appendChild(overlay);

        // Fade in
        requestAnimationFrame(() => {
            overlay.style.opacity = "1";
            card.style.transform = "scale(1)";
        });

        const closeOverlay = () => {
            overlay.style.opacity = "0";
            card.style.transform = "scale(0.9)";
            setTimeout(() => {
                overlay.remove();
            }, 300);
        };

        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) closeOverlay();
        });

        const cancelBtn = card.querySelector("#logout-cancel-btn");
        cancelBtn.addEventListener("click", closeOverlay);
        cancelBtn.addEventListener("mouseover", () => {
            cancelBtn.style.background = "var(--line)";
        });
        cancelBtn.addEventListener("mouseout", () => {
            cancelBtn.style.background = "var(--surface-soft)";
        });

        const confirmBtn = card.querySelector("#logout-confirm-btn");
        confirmBtn.addEventListener("click", () => {
            closeOverlay();
            onConfirm();
        });
        confirmBtn.addEventListener("mouseover", () => {
            confirmBtn.style.transform = "translateY(-1px)";
            confirmBtn.style.boxShadow = "0 6px 16px rgba(255, 61, 112, 0.35)";
        });
        confirmBtn.addEventListener("mouseout", () => {
            confirmBtn.style.transform = "none";
            confirmBtn.style.boxShadow = "0 4px 12px rgba(255, 61, 112, 0.25)";
        });
    };

    document.querySelectorAll("[data-logout]").forEach(button => button.addEventListener("click", () => {
        showLogoutConfirm(async () => {
            await api("/api/auth/logout", { method: "POST" });
            location.href = "/login";
        });
    }));
    document.getElementById("adminLogoutBtn")?.addEventListener("click", () => {
        showLogoutConfirm(async () => {
            await api("/api/auth/logout", { method: "POST" });
            location.href = "/admin/login";
        });
    });

    // Sidebar Collapsible Toggle & State Persistence
    const appShell = document.querySelector(".app-shell");
    if (appShell) {
        const collapsed = sessionStorage.getItem("smartfinance-sidebar-collapsed") === "true";
        appShell.classList.toggle("sidebar-collapsed", collapsed);
        
        document.getElementById("sidebarToggle")?.addEventListener("click", () => {
            const isCollapsed = appShell.classList.toggle("sidebar-collapsed");
            sessionStorage.setItem("smartfinance-sidebar-collapsed", isCollapsed ? "true" : "false");
        });
    }

    const adminShell = document.querySelector(".admin-shell");
    if (adminShell) {
        const collapsed = sessionStorage.getItem("smartfinance-admin-sidebar-collapsed") === "true";
        adminShell.classList.toggle("sidebar-collapsed", collapsed);
        
        document.getElementById("adminSidebarToggle")?.addEventListener("click", () => {
            const isCollapsed = adminShell.classList.toggle("sidebar-collapsed");
            sessionStorage.setItem("smartfinance-admin-sidebar-collapsed", isCollapsed ? "true" : "false");
        });
    }

    // Upgrade to Pro notification
    const showProUpgradeModal = () => {
        if (document.getElementById("pro-upgrade-overlay")) return;

        const overlay = document.createElement("div");
        overlay.id = "pro-upgrade-overlay";
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(7, 17, 31, 0.6);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;

        const card = document.createElement("div");
        card.style.cssText = `
            background: var(--surface-strong);
            border: 1px solid var(--line);
            border-radius: var(--radius-lg);
            padding: 32px;
            width: 90%;
            max-width: 460px;
            text-align: center;
            box-shadow: var(--shadow);
            transform: scale(0.9);
            transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            position: relative;
            overflow: hidden;
        `;

        const glow = document.createElement("div");
        glow.style.cssText = `
            position: absolute;
            top: -50px;
            left: 50%;
            transform: translateX(-50%);
            width: 150px;
            height: 100px;
            background: radial-gradient(circle, rgba(255, 184, 0, 0.2) 0%, rgba(255, 184, 0, 0) 70%);
            pointer-events: none;
        `;
        card.appendChild(glow);

        card.innerHTML += `
            <button id="pro-close-x" style="
                position: absolute;
                top: 16px;
                right: 16px;
                background: none;
                border: none;
                color: var(--muted);
                font-size: 1.25rem;
                cursor: pointer;
                transition: color 0.2s;
            "><i class="bi bi-x-lg"></i></button>
            
            <div style="
                width: 64px;
                height: 64px;
                background: rgba(255, 184, 0, 0.1);
                color: #ffb800;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 10px auto 20px auto;
                font-size: 2rem;
                box-shadow: 0 0 24px rgba(255, 184, 0, 0.2);
                border: 1px solid rgba(255, 184, 0, 0.2);
            ">
                <i class="bi bi-stars"></i>
            </div>
            
            <h3 style="
                color: var(--text);
                font-weight: 800;
                font-size: 1.5rem;
                margin: 0 0 8px 0;
                letter-spacing: -0.5px;
            ">SmartFinance Pro</h3>
            
            <div style="
                display: inline-block;
                background: rgba(255, 184, 0, 0.15);
                color: #ffb800;
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 0.75rem;
                font-weight: 700;
                text-transform: uppercase;
                margin-bottom: 20px;
                letter-spacing: 1px;
                border: 1px solid rgba(255, 184, 0, 0.2);
            ">Coming Soon</div>
            
            <p style="
                color: var(--muted);
                font-size: 0.92rem;
                line-height: 1.6;
                margin: 0 0 24px 0;
            ">We are currently building the ultimate financial dashboard experience. Get ready for next-level money management features:</p>
            
            <div style="
                text-align: left;
                background: var(--surface-soft);
                border: 1px solid var(--line);
                border-radius: var(--radius-md);
                padding: 18px 20px;
                margin-bottom: 28px;
            ">
                <div style="display: flex; align-items: start; gap: 12px; margin-bottom: 12px;">
                    <i class="bi bi-check-circle-fill" style="color: #ffb800; margin-top: 2px;"></i>
                    <div>
                        <strong style="color: var(--text); font-size: 0.88rem;">Advanced AI Forecasting</strong>
                        <div style="color: var(--muted); font-size: 0.8rem; margin-top: 2px;">Predict future net worth and cashflow trends based on spending patterns.</div>
                    </div>
                </div>
                <div style="display: flex; align-items: start; gap: 12px; margin-bottom: 12px;">
                    <i class="bi bi-check-circle-fill" style="color: #ffb800; margin-top: 2px;"></i>
                    <div>
                        <strong style="color: var(--text); font-size: 0.88rem;">Unlimited Wallets & Currencies</strong>
                        <div style="color: var(--muted); font-size: 0.8rem; margin-top: 2px;">Manage international assets with real-time automatic forex conversion.</div>
                    </div>
                </div>
                <div style="display: flex; align-items: start; gap: 12px;">
                    <i class="bi bi-check-circle-fill" style="color: #ffb800; margin-top: 2px;"></i>
                    <div>
                        <strong style="color: var(--text); font-size: 0.88rem;">Custom Export Formats</strong>
                        <div style="color: var(--muted); font-size: 0.8rem; margin-top: 2px;">Generate professional PDF statements and customize CSV columns.</div>
                    </div>
                </div>
            </div>
            
            <button id="pro-close-btn" style="
                width: 100%;
                background: linear-gradient(135deg, #ffb800, #e6a100);
                border: none;
                color: #07111f;
                padding: 14px;
                border-radius: var(--radius-md);
                font-weight: 700;
                font-size: 0.9rem;
                cursor: pointer;
                transition: all 0.2s;
                box-shadow: 0 4px 16px rgba(255, 184, 0, 0.25);
            ">Awesome, Got It!</button>
        `;

        overlay.appendChild(card);
        document.body.appendChild(overlay);

        // Fade in
        requestAnimationFrame(() => {
            overlay.style.opacity = "1";
            card.style.transform = "scale(1)";
        });

        const closeOverlay = () => {
            overlay.style.opacity = "0";
            card.style.transform = "scale(0.9)";
            setTimeout(() => {
                overlay.remove();
            }, 300);
        };

        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) closeOverlay();
        });

        card.querySelector("#pro-close-x").addEventListener("click", closeOverlay);
        card.querySelector("#pro-close-x").addEventListener("mouseover", function() { this.style.color = "var(--text)"; });
        card.querySelector("#pro-close-x").addEventListener("mouseout", function() { this.style.color = "var(--muted)"; });

        const closeBtn = card.querySelector("#pro-close-btn");
        closeBtn.addEventListener("click", closeOverlay);
        closeBtn.addEventListener("mouseover", () => {
            closeBtn.style.transform = "translateY(-1px)";
            closeBtn.style.boxShadow = "0 6px 20px rgba(255, 184, 0, 0.35)";
        });
        closeBtn.addEventListener("mouseout", () => {
            closeBtn.style.transform = "none";
            closeBtn.style.boxShadow = "0 4px 16px rgba(255, 184, 0, 0.25)";
        });
    };

    document.querySelectorAll(".btn-pro").forEach(button => button.addEventListener("click", () => {
        showProUpgradeModal();
    }));

    // Disable page refresh when clicking the brand logo or text on the dashboard
    document.querySelector(".brand-mark")?.addEventListener("click", (e) => {
        const currentPath = window.location.pathname;
        if (currentPath === "/dashboard" || currentPath === "/") {
            e.preventDefault();
        }
    });
}

function initials(name) {
    const parts = String(name || "User").trim().split(/\s+/).filter(Boolean);
    return (parts[0]?.[0] || "U").toUpperCase();
}

function setGreeting() {
    const greeting = document.getElementById("timeGreeting");
    if (!greeting) return;
    
    // Greeting message should only show on the dashboard page
    if (window.location.pathname !== "/dashboard" && window.location.pathname !== "/") {
        greeting.style.display = "none";
        return;
    }
    
    greeting.style.display = "";
    const hour = new Date().getHours();
    let label = "Good Night";
    if (hour >= 5 && hour < 12) label = "Good Morning";
    else if (hour >= 12 && hour < 17) label = "Good Afternoon";
    else if (hour >= 17 && hour < 21) label = "Good Evening";
    greeting.innerHTML = `${label}, <span>👋</span>`;
}

function applyAvatarTheme(theme = "sunset") {
    document.querySelectorAll("[data-profile-avatar]").forEach(avatar => {
        [...avatar.classList].filter(item => item.startsWith("avatar--")).forEach(item => avatar.classList.remove(item));
        avatar.classList.add(`avatar--${theme}`);
    });
    document.querySelectorAll("[data-avatar-choice]").forEach(button => {
        button.classList.toggle("active", button.dataset.avatarChoice === theme);
    });
}

function syncProfile(user) {
    const displayName = user?.name || "User";
    const role = user?.role || "user";
    document.querySelectorAll("[data-profile-name]").forEach(node => { node.textContent = displayName; });
    document.querySelectorAll("[data-profile-email]").forEach(node => { node.textContent = user?.email || ""; });
    document.querySelectorAll("[data-profile-role]").forEach(node => { node.textContent = role === "admin" ? "Admin" : "User"; });
    document.querySelectorAll("[data-profile-avatar]").forEach(node => { node.textContent = initials(displayName); });
    const input = document.getElementById("profileNameInput");
    if (input) input.value = displayName;
    const pageTitle = document.getElementById("pageTitle");
    if (pageTitle && location.pathname === "/dashboard") pageTitle.textContent = displayName;
    applyAvatarTheme(user?.avatar || "sunset");
}

async function setupProfile() {
    if (!document.querySelector("[data-profile-avatar]")) return;
    try {
        const data = await api("/api/auth/me");
        syncProfile(data.user);
    } catch (_error) {
        applyAvatarTheme("sunset");
    }

    document.querySelectorAll("[data-avatar-choice]").forEach(button => {
        button.addEventListener("click", async () => {
            const data = await api("/api/auth/me", { method: "PUT", body: JSON.stringify({ avatar: button.dataset.avatarChoice }) });
            syncProfile(data.user);
            toast("Avatar updated");
        });
    });

    document.getElementById("saveProfileName")?.addEventListener("click", async () => {
        const input = document.getElementById("profileNameInput");
        const name = input?.value.trim();
        if (!name) return toast("Name is required", "error");
        const data = await api("/api/auth/me", { method: "PUT", body: JSON.stringify({ name }) });
        syncProfile(data.user);
        toast("Profile updated");
    });
}

async function loadNotifications() {
    const menu = document.getElementById("notificationMenu");
    if (!menu) return;
    const data = await api("/api/notifications/");
    const count = document.getElementById("notificationCount");
    count.textContent = data.unread;
    count.classList.toggle("d-none", !data.unread);
    const sidebarCount = document.getElementById("sidebarNotificationCount");
    if (sidebarCount) {
        sidebarCount.textContent = data.unread;
        sidebarCount.classList.toggle("d-none", !data.unread);
    }
    menu.innerHTML = data.items.length ? data.items.map(item => `<button class="dropdown-item text-wrap notification-read" data-id="${item._id}"><strong>${item.title}</strong><br><small>${item.message}</small></button>`).join("") : `<span class="dropdown-item">No notifications</span>`;
    menu.querySelectorAll(".notification-read").forEach(btn => btn.addEventListener("click", () => api(`/api/notifications/${btn.dataset.id}/read`, { method: "PUT" }).then(loadNotifications)));
}

function setupAuth() {
    const login = document.getElementById("loginForm");
    login?.addEventListener("submit", async event => {
        event.preventDefault();
        try {
            await api("/api/auth/login", { method: "POST", body: JSON.stringify(formData(login)) });
            location.href = "/dashboard";
        } catch (error) { document.getElementById("authMessage").textContent = error.message; }
    });
    const adminLogin = document.getElementById("adminLoginForm");
    adminLogin?.addEventListener("submit", async event => {
        event.preventDefault();
        try {
            await api("/api/auth/admin/login", { method: "POST", body: JSON.stringify(formData(adminLogin)) });
            location.href = "/admin/dashboard";
        } catch (error) { document.getElementById("authMessage").textContent = error.message; }
    });
    const register = document.getElementById("registerForm");
    register?.addEventListener("submit", async event => {
        event.preventDefault();
        const passwordVal = document.getElementById("passwordInput")?.value;
        const confirmPasswordVal = document.getElementById("confirmPasswordInput")?.value;
        if (passwordVal !== confirmPasswordVal) {
            document.getElementById("authMessage").textContent = "Passwords do not match.";
            return;
        }
        try {
            await api("/api/auth/register", { method: "POST", body: JSON.stringify(formData(register)) });
            location.href = "/login";
        } catch (error) { document.getElementById("authMessage").textContent = error.message; }
    });
    const password = document.getElementById("passwordInput");
    const confirmPassword = document.getElementById("confirmPasswordInput");
    const submitBtn = document.getElementById("registerSubmitBtn");

    const updateSubmitBtnState = () => {
        if (!password || !confirmPassword || !submitBtn) return;
        const passVal = password.value;
        const confirmVal = confirmPassword.value;
        if (passVal && confirmVal && passVal === confirmVal) {
            submitBtn.classList.add("ready-to-submit");
            const authMsgEl = document.getElementById("authMessage");
            if (authMsgEl && authMsgEl.textContent === "Passwords do not match.") {
                authMsgEl.textContent = "";
            }
        } else {
            submitBtn.classList.remove("ready-to-submit");
        }
    };

    password?.addEventListener("input", () => {
        const checks = [/.{8,}/, /[A-Z]/, /[a-z]/, /\d/, /[^A-Za-z0-9]/].filter(rule => rule.test(password.value)).length;
        const bar = document.querySelector(".password-meter span");
        if (bar) {
            bar.style.width = `${checks * 20}%`;
            bar.style.background = checks >= 4 ? "var(--accent)" : checks >= 3 ? "var(--warning)" : "var(--danger)";
        }
        updateSubmitBtnState();
    });

    confirmPassword?.addEventListener("input", () => {
        updateSubmitBtnState();
    });
    document.getElementById("resetRequestForm")?.addEventListener("submit", async event => {
        event.preventDefault();
        const data = await api("/api/auth/password/reset-request", { method: "POST", body: JSON.stringify(formData(event.target)) });
        document.getElementById("authMessage").textContent = `Dev reset token: ${data.dev_reset_token}`;
    });
}

function chart(id, type, data, options = {}) {
    const ctx = document.getElementById(id);
    if (!ctx || !window.Chart) return;
    const styles = getComputedStyle(document.documentElement);
    const text = styles.getPropertyValue("--text").trim();
    const muted = styles.getPropertyValue("--muted").trim();
    const line = styles.getPropertyValue("--line").trim();
    const defaultScales = {
        x: { grid: { color: line }, ticks: { color: muted } },
        y: { grid: { color: line }, ticks: { color: muted } },
    };
    const mergedScales = Object.fromEntries(
        Object.entries({ ...defaultScales, ...(options.scales || {}) }).map(([axis, axisOptions]) => [
            axis,
            {
                ...(defaultScales[axis] || {}),
                ...axisOptions,
                grid: { ...((defaultScales[axis] || {}).grid || {}), ...(axisOptions.grid || {}) },
                ticks: { ...((defaultScales[axis] || {}).ticks || {}), ...(axisOptions.ticks || {}) },
            },
        ])
    );
    return new Chart(ctx, {
        type,
        data,
        options: {
            responsive: true,
            interaction: { intersect: false, mode: "index" },
            plugins: {
                legend: { labels: { color: text, usePointStyle: true, pointStyle: "line" } },
                tooltip: {
                    backgroundColor: styles.getPropertyValue("--surface-strong").trim(),
                    titleColor: text,
                    bodyColor: text,
                    borderColor: line,
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                },
            },
            ...options,
            scales: mergedScales,
        },
    });
}

async function setupDashboard() {
    if (!document.getElementById("dashboardChart")) return;
    const today = new Date();
    const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const initial = await api(`/api/analytics/dashboard?${qs({ date: dateKey(today) })}`);
    renderDashboard(initial);
    setupPeriodSegment();
    const insights = await api("/api/analytics/insights");
    const insightHost = document.getElementById("insightList");
    if (insightHost && insights.items.length) {
        insightHost.innerHTML = insights.items.map((item, index) => {
            const tone = ["green", "orange", "blue", "pink"][index % 4];
            const icon = ["bi-graph-up-arrow", "bi-cart", "bi-piggy-bank", "bi-lightbulb"][index % 4];
            return `<div class="insight-item"><span class="mini-icon ${tone}"><i class="bi ${icon}"></i></span><div><strong>${item.title}</strong><p>${item.message}</p></div><i class="bi bi-arrow-up-right-circle"></i></div>`;
        }).join("");
    }
}

function renderIncomeExpenseChart(chartData, mode = window.dashboardPeriod || "month") {
    if (!chartData || !document.getElementById("dashboardChart")) return;
    const activeMode = mode;
    const activeData = chartData[activeMode] || chartData["month"] || chartData;
    if (!activeData || !activeData.labels) return;
    
    let labels = activeData.labels;
    let income = activeData.income;
    let expense = activeData.expense;
    
    if (activeMode !== "custom") {
        const period = activeMode === "day" ? 6 : activeMode === "week" ? 3 : 6;
        labels = labels.slice(-period);
        income = income.slice(-period);
        expense = expense.slice(-period);
    }
    const chartContext = document.getElementById("dashboardChart").getContext("2d");
    const incomeGradient = chartContext.createLinearGradient(0, 0, 0, 260);
    incomeGradient.addColorStop(0, "rgba(0, 209, 143, .28)");
    incomeGradient.addColorStop(1, "rgba(0, 209, 143, 0)");
    const expenseGradient = chartContext.createLinearGradient(0, 0, 0, 260);
    expenseGradient.addColorStop(0, "rgba(255, 61, 112, .26)");
    expenseGradient.addColorStop(1, "rgba(255, 61, 112, 0)");
    const maxPoint = Math.max(
        0,
        ...income,
        ...expense,
    );
    dashboardChartInstance?.destroy();
    dashboardChartInstance =
    chart("dashboardChart", "line", {
        labels,
        datasets: [
            { label: "Income", data: income, borderColor: "#00d18f", backgroundColor: incomeGradient, fill: true, tension: .28, cubicInterpolationMode: "monotone", borderWidth: 3, pointRadius: 3, pointHoverRadius: 5 },
            { label: "Expense", data: expense, borderColor: "#ff3d70", backgroundColor: expenseGradient, fill: true, tension: .28, cubicInterpolationMode: "monotone", borderWidth: 3, pointRadius: 3, pointHoverRadius: 5 },
        ],
    }, {
        maintainAspectRatio: false,
        layout: { padding: { top: 8, right: 8, bottom: 0, left: 0 } },
        scales: {
            x: { grid: { display: true }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 6 } },
            y: {
                beginAtZero: true,
                suggestedMax: maxPoint ? Math.ceil(maxPoint * 1.18) : 1000,
                ticks: { callback: compactMoney, maxTicksLimit: 5 },
            },
        },
    });
}

function renderDashboard(data) {
    window.dashboardData = data;
    ["balance", "total_income", "total_expenses", "monthly_savings"].forEach(key => {
        const value = document.querySelector(`[data-kpi-value="${key}"]`);
        if (value) value.textContent = money(data[key]);
        const trend = document.querySelector(`[data-kpi-trend="${key}"]`);
        if (trend) {
            const item = data.trends[key] || { direction: "flat", label: "0%" };
            const icon = item.direction === "up" ? "bi-caret-up-fill" : item.direction === "down" ? "bi-caret-down-fill" : "bi-dash-lg";
            trend.className = `trend ${item.direction}`;
            trend.innerHTML = `<i class="bi ${icon}"></i> ${item.label} <span>vs last month</span>`;
        }
    });
    const health = data.health || { score: 0, status: "Fair", message: "No data." };
    document.getElementById("healthGauge")?.style.setProperty("--score", health.score);
    const score = document.getElementById("healthScore");
    if (score) score.textContent = health.score;
    const status = document.getElementById("healthStatus");
    if (status) status.textContent = health.status;
    const message = document.getElementById("healthMessage");
    if (message) message.textContent = health.message;
    renderBudgetAlerts({ items: data.budget_alerts || [] }, document.getElementById("budgetAlerts"));
    
    // Dynamically update the budget ring as a multi-segment Doughnut chart
    const budgetCanvas = document.getElementById("budgetUtilizationChart");
    if (budgetCanvas && window.Chart) {
        const budgetAlerts = data.budget_alerts || [];
        const labels = [];
        const values = [];
        const colors = [];
        
        const chartColors = {
            green: "#00d18f",
            orange: "#ff9f43",
            blue: "#2088ff",
            pink: "#ff3d70",
            violet: "#7c3cff",
            gold: "#ffc107",
            rose: "#e11d48",
            cyan: "#0284c7",
            teal: "#0d9488"
        };
        
        function hexToRgba(hex, alpha) {
            hex = hex.replace("#", "");
            let r = parseInt(hex.substring(0, 2), 16);
            let g = parseInt(hex.substring(2, 4), 16);
            let b = parseInt(hex.substring(4, 6), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
        
        const overallItem = budgetAlerts.find(b => b.category === "Overall");
        const categoryBudgets = budgetAlerts.filter(b => b.category !== "Overall");
        
        let categoriesSpentSum = 0;
        categoryBudgets.forEach(b => {
            categoriesSpentSum += b.spent || 0;
        });
        
        // 1. Process category budgets (Spent & Remaining)
        categoryBudgets.forEach(b => {
            const limit = b.amount || 0;
            const spent = b.spent || 0;
            const remaining = Math.max(0, limit - spent);
            const baseColor = chartColors[b.tone] || "#00d18f";
            
            if (spent > 0) {
                labels.push(`${b.category} (Spent)`);
                values.push(spent);
                colors.push(baseColor);
            }
            if (remaining > 0) {
                labels.push(`${b.category} (Remaining)`);
                values.push(remaining);
                colors.push(hexToRgba(baseColor, 0.15));
            }
        });
        
        // 2. Process Overall/Other Expenses (Spent & Remaining)
        const totalExpenses = data.total_expenses || 0;
        const otherSpent = Math.max(0, totalExpenses - categoriesSpentSum);
        const otherLimit = overallItem ? (overallItem.amount || 0) : 0;
        const otherRemaining = Math.max(0, otherLimit - otherSpent);
        const overallColor = overallItem ? (chartColors[overallItem.tone] || "#7c3cff") : "#7c3cff";
        
        if (otherSpent > 0) {
            labels.push(`Other Expenses (Spent)`);
            values.push(otherSpent);
            colors.push(overallColor);
        }
        if (otherRemaining > 0) {
            labels.push(`Other Expenses (Remaining)`);
            values.push(otherRemaining);
            colors.push(hexToRgba(overallColor, 0.15));
        }
        
        if (values.length === 0) {
            labels.push("No Expenses");
            values.push(1);
            colors.push("rgba(113, 128, 168, .12)");
        }
        
        if (window.budgetChartInstance) {
            window.budgetChartInstance.destroy();
        }
        
        window.budgetChartInstance = new Chart(budgetCanvas, {
            type: "doughnut",
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                cutout: "75%",
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: "#111827", // Slate-900 custom background
                        titleColor: "#f9fafb",       // readable white titles
                        bodyColor: "#f3f4f6",        // readable white body
                        borderColor: "rgba(255, 255, 255, 0.15)",
                        borderWidth: 1,
                        padding: 10,
                        cornerRadius: 8,
                        callbacks: {
                            label: function(context) {
                                const val = context.raw;
                                return ` ${context.label}: \u20b9${Number(val || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
                            }
                        }
                    }
                }
            }
        });
    }
    const budgetCenterText = document.querySelector(".budget-center strong");
    if (budgetCenterText) {
        budgetCenterText.textContent = `${Math.round(data.budget_utilization || 0)}%`;
    }

    renderIncomeExpenseChart(data.chart);
}

function setupPeriodSegment() {
    const popover = document.getElementById("customRangePopover");
    const buttons = document.querySelectorAll("[data-chart-mode]");
    if (!buttons.length) return;
    window.dashboardPeriod = window.dashboardPeriod || "month";
    buttons.forEach(button => {
        button.addEventListener("click", () => {
            buttons.forEach(item => item.classList.remove("active"));
            button.classList.add("active");
            window.dashboardPeriod = button.dataset.chartMode;
            if (button.dataset.chartMode === "custom") {
                popover?.classList.toggle("open");
            } else {
                popover?.classList.remove("open");
                renderIncomeExpenseChart(window.dashboardData?.chart, button.dataset.chartMode);
            }
        });
    });
    document.addEventListener("click", event => {
        if (!event.target.closest(".period-control-wrap")) popover?.classList.remove("open");
    });
    setupCustomRangePicker();
}

function setupCustomRangePicker() {
    const popover = document.getElementById("customRangePopover");
    if (!popover) return;
    if (popover.dataset.ready === "true") return;
    popover.dataset.ready = "true";

    popover.querySelectorAll("[data-custom-shortcut]").forEach(button => {
        button.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const shortcut = button.dataset.customShortcut;
            popover.classList.remove("open");

            try {
                // Keep Custom active in segment control
                const segments = document.querySelectorAll("[data-chart-mode]");
                segments.forEach(btn => btn.classList.remove("active"));
                const customBtn = document.querySelector('[data-chart-mode="custom"]');
                if (customBtn) {
                    customBtn.classList.add("active");
                }
                window.dashboardPeriod = "custom";

                // Fetch new dashboard details for the chosen range/period
                const res = await api(`/api/analytics/dashboard?${qs({ period: shortcut })}`);
                renderDashboard(res);
            } catch (err) {
                console.error("Error executing custom shortcut:", err);
            }
        });
    });
}

function setupDashboardCalendar() {
    const dateRange = document.getElementById("dashboardDateRange")?.querySelector("span");
    const calendars = [document.getElementById("topCalendar"), document.getElementById("dashboardCalendar")].filter(Boolean);
    const today = new Date();
    let visible = new Date(today.getFullYear(), today.getMonth(), 1);
    let selected = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const sameDay = (a, b) =>
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();

    const formatMonth = date => date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const formatRange = date => {
        const start = new Date(date.getFullYear(), date.getMonth(), 1);
        const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        return `${start.toLocaleDateString("en-US", { month: "short" })} ${start.getDate()} - ${end.toLocaleDateString("en-US", { month: "short" })} ${end.getDate()}, ${end.getFullYear()}`;
    };

    if (dateRange) dateRange.textContent = formatRange(visible);
    if (!calendars.length) return;

    const render = () => {
        if (dateRange) dateRange.textContent = formatRange(visible);
        calendars.forEach(calendar => {
            const title = calendar.querySelector("[data-calendar-title]");
            const grid = calendar.querySelector("[data-calendar-grid]");
            if (!title || !grid) return;
            title.textContent = formatMonth(visible);

            const firstDay = new Date(visible.getFullYear(), visible.getMonth(), 1);
            const start = new Date(firstDay);
            start.setDate(firstDay.getDate() - firstDay.getDay());

            const cells = dayLabels.map(day => `<span>${day}</span>`);
            for (let index = 0; index < 42; index += 1) {
                const cellDate = new Date(start);
                cellDate.setDate(start.getDate() + index);
                const isMuted = cellDate.getMonth() !== visible.getMonth();
                const isToday = sameDay(cellDate, today);
                const isSelected = sameDay(cellDate, selected);
                cells.push(`<button class="${isMuted ? "muted" : ""} ${isToday ? "marked" : ""} ${isSelected ? "selected" : ""}" type="button" data-time="${cellDate.getTime()}">${cellDate.getDate()}</button>`);
            }

            grid.innerHTML = cells.join("");
            grid.querySelectorAll("button").forEach(button => {
                button.addEventListener("click", async () => {
                    selected = new Date(Number(button.dataset.time));
                    visible = new Date(selected.getFullYear(), selected.getMonth(), 1);
                    render();
                    if (document.getElementById("dashboardChart")) {
                        const key = `${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, "0")}-${String(selected.getDate()).padStart(2, "0")}`;
                        renderDashboard(await api(`/api/analytics/dashboard?${qs({ date: key })}`));
                    }
                });
            });
        });
    };

    calendars.forEach(calendar => {
        calendar.querySelector("[data-calendar-prev]")?.addEventListener("click", () => {
            visible = new Date(visible.getFullYear(), visible.getMonth() - 1, 1);
            render();
        });
        calendar.querySelector("[data-calendar-next]")?.addEventListener("click", () => {
            visible = new Date(visible.getFullYear(), visible.getMonth() + 1, 1);
            render();
        });
    });

    render();
}

let transactionPage = 1;
let currentViewMode = localStorage.getItem("smartfinance-txn-view") || "list";
let transactionIdToDelete = null;
let transactionIdToEdit = null;

// Category to Icon Mapper
const categoryIconMap = {
    "food": { icon: "bi-cup-hot", tone: "orange" },
    "food & drink": { icon: "bi-cup-hot", tone: "orange" },
    "travel": { icon: "bi-car-front", tone: "gold" },
    "transport": { icon: "bi-car-front", tone: "gold" },
    "shopping": { icon: "bi-bag", tone: "pink" },
    "bills": { icon: "bi-receipt", tone: "blue" },
    "entertainment": { icon: "bi-ticket-perforated", tone: "violet" },
    "healthcare": { icon: "bi-heart-pulse", tone: "rose" },
    "education": { icon: "bi-book", tone: "cyan" },
    "salary": { icon: "bi-cash-coin", tone: "green" },
    "freelancing": { icon: "bi-briefcase", tone: "teal" },
    "business": { icon: "bi-building", tone: "violet" },
    "investments": { icon: "bi-graph-up-arrow", tone: "green" },
    "other": { icon: "bi-card-list", tone: "blue" }
};

const categoryEmojiMap = {
    "Food": "🍔 Food",
    "Travel": "✈️ Travel",
    "Shopping": "🛍️ Shopping",
    "Bills": "🧾 Bills",
    "Entertainment": "🎬 Entertainment",
    "Healthcare": "🏥 Healthcare",
    "Education": "📚 Education",
    "Salary": "💰 Salary",
    "Freelancing": "💼 Freelancing",
    "Business": "🏢 Business",
    "Investments": "📈 Investments",
    "Scholarship": "🎓 Scholarship",
    "Other": "💳 Other"
};


const expenseCategories = ["Food", "Travel", "Shopping", "Bills", "Entertainment", "Healthcare", "Education", "Other"];
const incomeCategories = ["Salary", "Freelancing", "Business", "Investments", "Scholarship", "Other"];

async function loadCategories() {
    try {
        const res = await api("/api/categories/");
        if (res && res.expense && res.income) {
            window.fullCategories = res;
            
            // Update the global lists
            expenseCategories.splice(0, expenseCategories.length, ...res.expense.map(c => c.name));
            incomeCategories.splice(0, incomeCategories.length, ...res.income.map(c => c.name));
            
            // Register mappings
            res.expense.forEach(c => {
                categoryIconMap[c.name.toLowerCase().trim()] = { icon: c.icon, tone: c.color };
                categoryEmojiMap[c.name] = (c.emoji || "") + " " + c.name;
            });
            res.income.forEach(c => {
                categoryIconMap[c.name.toLowerCase().trim()] = { icon: c.icon, tone: c.color };
                categoryEmojiMap[c.name] = (c.emoji || "") + " " + c.name;
            });
            
            // Update category selector on Transactions filter
            const filterCategory = document.getElementById("filterCategory");
            if (filterCategory) {
                const prevVal = filterCategory.value;
                const allCats = [...expenseCategories, ...incomeCategories];
                filterCategory.innerHTML = '<option value="">🏷️ All Categories</option>' +
                    allCats.map(cat => `<option value="${cat}">${categoryEmojiMap[cat] || cat}</option>`).join("");
                filterCategory.value = prevVal;
            }

            // Update category selector on Budgets modal
            const budgetCategorySelect = document.getElementById("budgetCategorySelect");
            if (budgetCategorySelect) {
                const prevVal = budgetCategorySelect.value;
                budgetCategorySelect.innerHTML = '<option value="Overall">All categories (overall)</option>' +
                    expenseCategories.map(cat => `<option value="${cat}">${categoryEmojiMap[cat] || cat}</option>`).join("");
                if (prevVal) budgetCategorySelect.value = prevVal;
            }
        }
    } catch (err) {
        console.error("Failed to load categories:", err);
    }
}


function getCategoryIconInfo(category, type) {
    const cat = (category || "").toLowerCase().trim();
    return categoryIconMap[cat] || (type === "income" ? { icon: "bi-cash-stack", tone: "green" } : { icon: "bi-credit-card", tone: "pink" });
}

function updateCategoryUI(type) {
    const select = document.getElementById("txnCategorySelect");
    const isExpense = type === "expense";
    const categories = isExpense ? expenseCategories : incomeCategories;
    
    if (select) {
        select.innerHTML = '<option value="" disabled selected>Select Category...</option>' +
            categories.map(cat => `<option value="${cat}">${categoryEmojiMap[cat] || cat}</option>`).join("");
    }
    
    const pillsWrap = document.getElementById("quickCategoryPills");
    if (pillsWrap) {
        const popular = isExpense ? ["Food", "Travel", "Shopping", "Bills"] : ["Salary", "Freelancing", "Business"];
        pillsWrap.innerHTML = popular.map(cat => `<button type="button" data-pill-cat="${cat}">${cat}</button>`).join("");
        
        pillsWrap.querySelectorAll("[data-pill-cat]").forEach(pill => {
            pill.addEventListener("click", () => {
                pillsWrap.querySelectorAll("[data-pill-cat]").forEach(p => p.classList.remove("active"));
                pill.classList.add("active");
                if (select) {
                    select.value = pill.dataset.pillCat;
                }
            });
        });
    }
}

function prefillAndOpenModal(txn, isEdit = false) {
    const form = document.getElementById("transactionForm");
    if (!form) return;
    
    // Set modal title and action label
    const titleEl = document.getElementById("modalTitle");
    if (titleEl) titleEl.textContent = isEdit ? "Edit Transaction" : "Add Transaction";
    
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.textContent = isEdit ? "Update Transaction" : "Save Transaction";
    
    // Set edit mode ID
    transactionIdToEdit = isEdit ? txn._id : null;
    
    // Populate fields
    form.elements["amount"].value = txn.amount || "";
    form.elements["description"].value = txn.description || "";
    form.elements["wallet"].value = txn.wallet || window.defaultWallet || "Default";
    
    // Date
    const dateInput = document.getElementById("txnDateInput");
    if (dateInput) {
        dateInput.value = txn.date ? txn.date.slice(0, 10) : new Date().toISOString().slice(0, 10);
    }
    
    // Update Type segment active buttons
    const backdrop = document.getElementById("transactionModalBackdrop");
    backdrop?.querySelectorAll(".transaction-type-segment button").forEach(b => {
        b.classList.toggle("active", b.dataset.txnType === txn.type);
    });
    const typeInput = document.getElementById("txnTypeInput");
    if (typeInput) typeInput.value = txn.type;
    
    // Update Categories dropdown based on type
    updateCategoryUI(txn.type);
    
    // Set selected category value
    const select = document.getElementById("txnCategorySelect");
    if (select) select.value = txn.category || "Other";
    
    // Active category pill highlights
    const pillsWrap = document.getElementById("quickCategoryPills");
    pillsWrap?.querySelectorAll("[data-pill-cat]").forEach(p => {
        p.classList.toggle("active", p.dataset.pillCat === txn.category);
    });
    
    // Show modal
    backdrop?.classList.add("open");
}

function getDateRange(value) {
    const now = new Date();
    let start = null;
    let end = null;
    
    if (value === "today") {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    } else if (value === "yesterday") {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (value === "last-7-days") {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    } else if (value === "this-month") {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    } else if (value === "last-month") {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    
    return {
        start_date: start ? start.toISOString() : "",
        end_date: end ? end.toISOString() : ""
    };
}

let transactionsChartInstance = null;

async function loadTransactionsChart(mode = "month") {
    const canvas = document.getElementById("transactionsChart");
    if (!canvas || !window.Chart) return;

    try {
        const today = new Date();
        const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        const data = await api(`/api/analytics/dashboard?${qs({ date: dateKey(today) })}`);
        
        if (!data || !data.chart) return;
        
        const activeData = data.chart[mode] || data.chart["month"];
        if (!activeData || !activeData.labels) return;

        let labels = activeData.labels;
        let income = activeData.income;
        let expense = activeData.expense;

        // Take last period points (just like renderIncomeExpenseChart)
        const period = mode === "day" ? 6 : mode === "week" ? 3 : 6;
        labels = labels.slice(-period);
        income = income.slice(-period);
        expense = expense.slice(-period);

        const chartContext = canvas.getContext("2d");
        const incomeGradient = chartContext.createLinearGradient(0, 0, 0, 220);
        incomeGradient.addColorStop(0, "rgba(0, 209, 143, .28)");
        incomeGradient.addColorStop(1, "rgba(0, 209, 143, 0)");
        
        const expenseGradient = chartContext.createLinearGradient(0, 0, 0, 220);
        expenseGradient.addColorStop(0, "rgba(255, 61, 112, .26)");
        expenseGradient.addColorStop(1, "rgba(255, 61, 112, 0)");
        
        const maxPoint = Math.max(0, ...income, ...expense);

        transactionsChartInstance?.destroy();

        // Create new chart
        transactionsChartInstance = chart("transactionsChart", "line", {
            labels,
            datasets: [
                { label: "Income", data: income, borderColor: "#00d18f", backgroundColor: incomeGradient, fill: true, tension: .28, cubicInterpolationMode: "monotone", borderWidth: 3, pointRadius: 3, pointHoverRadius: 5 },
                { label: "Expense", data: expense, borderColor: "#ff3d70", backgroundColor: expenseGradient, fill: true, tension: .28, cubicInterpolationMode: "monotone", borderWidth: 3, pointRadius: 3, pointHoverRadius: 5 },
            ],
        }, {
            maintainAspectRatio: false,
            layout: { padding: { top: 8, right: 8, bottom: 0, left: 0 } },
            scales: {
                x: { grid: { display: true }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 6 } },
                y: {
                    beginAtZero: true,
                    suggestedMax: maxPoint ? Math.ceil(maxPoint * 1.18) : 1000,
                    ticks: { callback: compactMoney, maxTicksLimit: 5 },
                },
            },
        });

        // Compute net total of this chart view
        const totalInc = income.reduce((a, b) => a + b, 0);
        const totalExp = expense.reduce((a, b) => a + b, 0);
        const net = totalInc - totalExp;
        
        const pill = document.getElementById("chartBalancePill");
        if (pill) {
            pill.textContent = `Net: ${net >= 0 ? "+" : ""}${money(net)}`;
            pill.className = `chart-balance-pill ${net >= 0 ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'}`;
        }

    } catch (err) {
        console.error("Error loading transactions chart:", err);
    }
}

async function loadTransactions() {
    const listContainer = document.getElementById("txnListView");
    const gridContainer = document.getElementById("txnGridView");
    if (!listContainer && !gridContainer) return;

    const search = document.getElementById("transactionSearch")?.value || "";
    const type = document.getElementById("filterType")?.value || "";
    const category = document.getElementById("filterCategory")?.value || "";
    const wallet = document.getElementById("filterWallet")?.value || "";
    const timeVal = document.getElementById("filterTime")?.value || "";
    const perPage = document.getElementById("perPageSelect")?.value || "20";
    
    const { start_date, end_date } = getDateRange(timeVal);

    const queryParams = {
        page: transactionPage,
        limit: perPage,
        search,
        type,
        category,
        wallet,
        start_date,
        end_date
    };

    try {
        const data = await api(`/api/transactions/?${qs(queryParams)}`);
        window.loadedTransactions = data.items || [];
        
        // Update stats
        const stats = data.stats || { total_expense: 0, total_income: 0, net_balance: 0 };
        document.getElementById("statsTotalExpense").textContent = `Exp: ${money(stats.total_expense)}`;
        document.getElementById("statsTotalIncome").textContent = `Inc: ${money(stats.total_income)}`;
        
        const netEl = document.getElementById("statsNetBalance");
        netEl.textContent = `Net: ${stats.net_balance >= 0 ? "+" : ""}${money(stats.net_balance)}`;
        netEl.className = `badge ${stats.net_balance >= 0 ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger"}`;

        // Grid stats totals
        const gridTotalExp = document.getElementById("gridTotalExpense");
        const gridTotalInc = document.getElementById("gridTotalIncome");
        if (gridTotalExp) gridTotalExp.textContent = money(stats.total_expense);
        if (gridTotalInc) gridTotalInc.textContent = money(stats.total_income);

        // Update count text
        const totalCount = data.total || 0;
        const startIdx = totalCount > 0 ? (transactionPage - 1) * perPage + 1 : 0;
        const endIdx = Math.min(transactionPage * perPage, totalCount);
        document.getElementById("txnTotalCount").textContent = `Showing ${startIdx} to ${endIdx} of ${totalCount} transactions`;
        
        // Update pagination page info
        const pageEl = document.getElementById("pageInfo");
        if (pageEl) {
            const maxPage = Math.ceil(totalCount / perPage) || 1;
            pageEl.textContent = `Page ${transactionPage} of ${maxPage}`;
        }

        // Render List View (Table)
        const tableBody = document.getElementById("transactionTable");
        if (tableBody) {
            if (data.items.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No transactions found.</td></tr>`;
            } else {
                tableBody.innerHTML = data.items.map(item => {
                    const formattedDate = (item.date || "").slice(0, 10);
                    const isIncome = item.type === "income";
                    return `<tr>
                        <td><input type="checkbox" class="form-check-input select-txn" data-id="${item._id}"></td>
                        <td><span class="badge ${isIncome ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'}">${item.category}</span></td>
                        <td>${item.description || ""}</td>
                        <td><span class="text-muted"><i class="bi bi-wallet2 small me-1"></i>${item.wallet || 'Default'}</span></td>
                        <td class="fw-bold ${isIncome ? 'text-success' : 'text-danger'}">${isIncome ? '+' : '-'}${money(item.amount)}</td>
                        <td>${formattedDate}</td>
                        <td style="text-align: right;">
                            <button class="btn btn-sm btn-ghost edit-transaction me-1" data-id="${item._id}"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-sm btn-ghost delete-transaction" data-id="${item._id}"><i class="bi bi-trash"></i></button>
                        </td>
                    </tr>`;
                }).join("");
            }
        }

        // Render Grid View (Split columns)
        const expenseList = document.getElementById("gridExpenseList");
        const incomeList = document.getElementById("gridIncomeList");
        if (expenseList && incomeList) {
            const expenses = data.items.filter(item => item.type === "expense");
            const incomes = data.items.filter(item => item.type === "income");

            if (expenses.length === 0) {
                expenseList.innerHTML = `<p class="empty-state py-3 text-center">No expenses in this period.</p>`;
            } else {
                expenseList.innerHTML = expenses.map(item => {
                    const iconInfo = getCategoryIconInfo(item.category, item.type);
                    const formattedDate = (item.date || "").slice(0, 10);
                    const walletText = item.wallet && item.wallet !== "Default" ? ` · ${item.wallet}` : "";
                    return `<div class="transaction-item reveal p-3 border rounded-3 position-relative" style="grid-template-columns: 36px minmax(0, 1fr) auto auto; background: var(--surface-soft); border-color: var(--line) !important;">
                        <span class="mini-icon ${iconInfo.tone}"><i class="bi ${iconInfo.icon}"></i></span>
                        <div class="ms-1">
                            <h6 class="fw-bold mb-0 text-truncate" style="max-width: 140px;">${item.category}</h6>
                            <small class="text-muted text-truncate d-inline-block" style="max-width: 150px;">${item.description || item.category}${walletText} · ${formattedDate}</small>
                        </div>
                        <strong class="text-danger fw-bold mt-1" style="margin-right: 56px;">-${money(item.amount)}</strong>
                        <div class="position-absolute end-0 top-50 translate-middle-y me-2 d-flex gap-1 align-items-center">
                            <button class="btn btn-sm btn-ghost edit-transaction border-0 bg-transparent text-muted p-1" data-id="${item._id}"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-sm btn-ghost delete-transaction border-0 bg-transparent text-muted p-1" data-id="${item._id}"><i class="bi bi-trash"></i></button>
                        </div>
                    </div>`;
                }).join("");
            }

            if (incomes.length === 0) {
                incomeList.innerHTML = `<p class="empty-state py-3 text-center">No income in this period.</p>`;
            } else {
                incomeList.innerHTML = incomes.map(item => {
                    const iconInfo = getCategoryIconInfo(item.category, item.type);
                    const formattedDate = (item.date || "").slice(0, 10);
                    const walletText = item.wallet && item.wallet !== "Default" ? ` · ${item.wallet}` : "";
                    return `<div class="transaction-item reveal p-3 border rounded-3 position-relative" style="grid-template-columns: 36px minmax(0, 1fr) auto auto; background: var(--surface-soft); border-color: var(--line) !important;">
                        <span class="mini-icon ${iconInfo.tone}"><i class="bi ${iconInfo.icon}"></i></span>
                        <div class="ms-1">
                            <h6 class="fw-bold mb-0 text-truncate" style="max-width: 140px;">${item.category || '-'}</h6>
                            <small class="text-muted text-truncate d-inline-block" style="max-width: 150px;">${item.description || item.category}${walletText} · ${formattedDate}</small>
                        </div>
                        <strong class="text-success fw-bold mt-1" style="margin-right: 56px;">+${money(item.amount)}</strong>
                        <div class="position-absolute end-0 top-50 translate-middle-y me-2 d-flex gap-1 align-items-center">
                            <button class="btn btn-sm btn-ghost edit-transaction border-0 bg-transparent text-muted p-1" data-id="${item._id}"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-sm btn-ghost delete-transaction border-0 bg-transparent text-muted p-1" data-id="${item._id}"><i class="bi bi-trash"></i></button>
                        </div>
                    </div>`;
                }).join("");
            }
        }

        // Toggle layout visibility based on currentViewMode
        if (currentViewMode === "grid") {
            if (listContainer) listContainer.style.display = "none";
            if (gridContainer) gridContainer.style.display = "flex";
            document.getElementById("btnViewList")?.classList.remove("active");
            document.getElementById("btnViewGrid")?.classList.add("active");
        } else {
            if (listContainer) listContainer.style.display = "block";
            if (gridContainer) gridContainer.style.display = "none";
            document.getElementById("btnViewList")?.classList.add("active");
            document.getElementById("btnViewGrid")?.classList.remove("active");
        }

        // Set delete buttons click listeners
        document.querySelectorAll(".delete-transaction").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                transactionIdToDelete = btn.dataset.id;
                document.getElementById("deleteConfirmModalBackdrop")?.classList.add("open");
            });
        });

        // Set edit buttons click listeners
        document.querySelectorAll(".edit-transaction").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const txn = (window.loadedTransactions || []).find(t => t._id === id);
                if (txn) {
                    prefillAndOpenModal(txn, true);
                }
            });
        });

    } catch (err) {
        console.error("Error loading transactions:", err);
    }
}

function setupTransactions() {
    const form = document.getElementById("transactionForm");
    const backdrop = document.getElementById("transactionModalBackdrop");
    const openBtn = document.getElementById("openAddTxnBtn");
    const openBtnTop = document.getElementById("openAddTxnBtnTop");
    const closeBtn = document.getElementById("closeAddTxnBtn");
    const select = document.getElementById("txnCategorySelect");
    const typeInput = document.getElementById("txnTypeInput");
    
    // Delete Confirmation modal hooks
    const deleteBackdrop = document.getElementById("deleteConfirmModalBackdrop");
    const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
    const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");

    cancelDeleteBtn?.addEventListener("click", () => {
        deleteBackdrop?.classList.remove("open");
        transactionIdToDelete = null;
    });

    deleteBackdrop?.addEventListener("click", (e) => {
        if (e.target === deleteBackdrop) {
            deleteBackdrop.classList.remove("open");
            transactionIdToDelete = null;
        }
    });

    confirmDeleteBtn?.addEventListener("click", async () => {
        if (transactionIdToDelete) {
            try {
                await api(`/api/transactions/${transactionIdToDelete}`, { method: "DELETE" });
                toast("Transaction deleted");
                deleteBackdrop?.classList.remove("open");
                transactionIdToDelete = null;
                loadTransactions();
                loadTransactionsChart();
            } catch (err) {
                toast(err.message || "Failed to delete transaction", "error");
            }
        }
    });
    

    if (select) {
        select.addEventListener("change", () => {
            const pillsWrap = document.getElementById("quickCategoryPills");
            pillsWrap?.querySelectorAll("[data-pill-cat]").forEach(p => {
                p.classList.toggle("active", p.dataset.pillCat === select.value);
            });
        });
    }

    // Modal segmented buttons toggle
    backdrop?.querySelectorAll(".transaction-type-segment button").forEach(btn => {
        btn.addEventListener("click", () => {
            backdrop.querySelectorAll(".transaction-type-segment button").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const type = btn.dataset.txnType;
            if (typeInput) typeInput.value = type;
            updateCategoryUI(type);
        });
    });

    const openModal = () => {
        form?.reset();
        transactionIdToEdit = null;
        
        const titleEl = document.getElementById("modalTitle");
        if (titleEl) titleEl.textContent = "Add Transaction";
        
        const submitBtn = form?.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.textContent = "Save Transaction";
        
        // Default to today
        const dateInput = document.getElementById("txnDateInput");
        if (dateInput) {
            dateInput.value = new Date().toISOString().slice(0, 10);
        }
        
        // Reset type segmented tabs to 'expense'
        backdrop.querySelectorAll(".transaction-type-segment button").forEach(b => {
            b.classList.toggle("active", b.dataset.txnType === "expense");
        });
        if (typeInput) typeInput.value = "expense";
        
        updateCategoryUI("expense");
        backdrop?.classList.add("open");
    };

    // Open Modal from both buttons
    openBtn?.addEventListener("click", openModal);
    openBtnTop?.addEventListener("click", openModal);

    // Close Modal
    const closeModal = () => backdrop?.classList.remove("open");
    closeBtn?.addEventListener("click", closeModal);
    backdrop?.addEventListener("click", (e) => {
        if (e.target === backdrop) closeModal();
    });

    form?.addEventListener("submit", async event => {
        event.preventDefault();
        try {
            const payload = formData(form);
            if (transactionIdToEdit) {
                await api(`/api/transactions/${transactionIdToEdit}`, { method: "PUT", body: JSON.stringify(payload) });
                toast("Transaction updated");
            } else {
                await api("/api/transactions/", { method: "POST", body: JSON.stringify(payload) });
                toast("Transaction saved");
            }
            form.reset();
            closeModal();
            loadTransactions();
            loadTransactionsChart();
        } catch (err) {
            toast(err.message || "Failed to save transaction", "error");
        }
    });

    document.getElementById("parserForm")?.addEventListener("submit", async event => {
        event.preventDefault();
        try {
            const parsed = await api("/api/transactions/parse", { method: "POST", body: JSON.stringify(formData(event.target)) });
            event.target.reset();
            toast("Message parsed. Please review and save the transaction.");
            prefillAndOpenModal(parsed, false);
        } catch (err) {
            toast(err.message || "Failed to parse message", "error");
        }
    });

    // Smart Parser File Upload
    const parserUploadBtn = document.getElementById("parserUploadBtn");
    const parserFileInput = document.getElementById("parserFileInput");
    const parserForm = document.getElementById("parserForm");
    const parserTextarea = parserForm?.querySelector('textarea[name="message"]');

    parserUploadBtn?.addEventListener("click", () => {
        parserFileInput?.click();
    });

    parserFileInput?.addEventListener("change", async (event) => {
        if (!parserFileInput.files || parserFileInput.files.length === 0) return;
        const file = parserFileInput.files[0];
        const filename = file.name.toLowerCase();

        if (filename.endsWith(".txt")) {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (parserTextarea) {
                    parserTextarea.value = e.target.result;
                    // Trigger the form submit
                    parserForm?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
                }
            };
            reader.readAsText(file);
        } else if (filename.endsWith(".pdf")) {
            const formDataPayload = new FormData();
            formDataPayload.append("file", file);

            try {
                toast("Parsing PDF statement...");
                const response = await fetch("/api/transactions/parse-file", {
                    method: "POST",
                    body: formDataPayload,
                    credentials: "same-origin"
                });
                const resData = await response.json();
                if (!response.ok) throw new Error(resData.message || "PDF parse failed");
                
                toast("PDF parsed. Please review and save the transaction.");
                prefillAndOpenModal(resData.data, false);
            } catch (err) {
                toast(err.message || "Failed to parse PDF", "error");
            }
        } else {
            toast("Unsupported file format. Please upload a .txt or .pdf file.", "error");
        }
        // Clear value so the same file can be uploaded again if needed
        parserFileInput.value = "";
    });

    // Views Toggle
    const btnViewList = document.getElementById("btnViewList");
    const btnViewGrid = document.getElementById("btnViewGrid");
    
    btnViewList?.addEventListener("click", () => {
        currentViewMode = "list";
        localStorage.setItem("smartfinance-txn-view", "list");
        loadTransactions();
    });
    
    btnViewGrid?.addEventListener("click", () => {
        currentViewMode = "grid";
        localStorage.setItem("smartfinance-txn-view", "grid");
        loadTransactions();
    });

    // Populate filter categories dropdown
    const filterCategory = document.getElementById("filterCategory");
    if (filterCategory) {
        const allCategories = [...new Set([...expenseCategories, ...incomeCategories])];
        filterCategory.innerHTML = '<option value="">🏷️ All Categories</option>' +
            allCategories.map(cat => `<option value="${cat}">${categoryEmojiMap[cat] || cat}</option>`).join("");
    }

    // Filters event listeners
    document.getElementById("transactionSearch")?.addEventListener("input", () => { transactionPage = 1; loadTransactions(); });
    document.getElementById("filterType")?.addEventListener("change", () => { transactionPage = 1; loadTransactions(); });
    document.getElementById("filterCategory")?.addEventListener("change", () => { transactionPage = 1; loadTransactions(); });
    document.getElementById("filterWallet")?.addEventListener("change", () => { transactionPage = 1; loadTransactions(); });
    document.getElementById("filterTime")?.addEventListener("change", () => { transactionPage = 1; loadTransactions(); });
    document.getElementById("perPageSelect")?.addEventListener("change", () => { transactionPage = 1; loadTransactions(); });

    // Reset Filters Confirmation Modal Hooks
    const resetBackdrop = document.getElementById("resetConfirmModalBackdrop");
    const cancelResetBtn = document.getElementById("cancelResetBtn");
    const confirmResetBtn = document.getElementById("confirmResetBtn");

    document.getElementById("resetFiltersBtn")?.addEventListener("click", () => {
        resetBackdrop?.classList.add("open");
    });

    cancelResetBtn?.addEventListener("click", () => {
        resetBackdrop?.classList.remove("open");
    });

    resetBackdrop?.addEventListener("click", (e) => {
        if (e.target === resetBackdrop) {
            resetBackdrop.classList.remove("open");
        }
    });

    confirmResetBtn?.addEventListener("click", () => {
        const searchInput = document.getElementById("transactionSearch");
        const typeSelect = document.getElementById("filterType");
        const catSelect = document.getElementById("filterCategory");
        const walletSelect = document.getElementById("filterWallet");
        const timeSelect = document.getElementById("filterTime");
        
        if (searchInput) searchInput.value = "";
        if (typeSelect) typeSelect.value = "";
        if (catSelect) catSelect.value = "";
        if (walletSelect) walletSelect.value = "";
        if (timeSelect) timeSelect.value = "";
        
        transactionPage = 1;
        loadTransactions();
        
        resetBackdrop?.classList.remove("open");
        toast("Filters reset successfully");
    });

    // Refresh button
    document.getElementById("refreshTxnsBtn")?.addEventListener("click", () => {
        loadTransactions();
        loadTransactionsChart();
        toast("Refreshed transactions");
    });

    // CSV Import Button
    const importBtn = document.getElementById("importTxnsBtn");
    const importInput = document.getElementById("importFileInput");
    
    importBtn?.addEventListener("click", () => {
        importInput?.click();
    });
    
    importInput?.addEventListener("change", async () => {
        if (!importInput.files || importInput.files.length === 0) return;
        const file = importInput.files[0];
        const filename = file.name.toLowerCase();
        
        if (filename.endsWith(".csv")) {
            const formDataPayload = new FormData();
            formDataPayload.append("file", file);
            
            try {
                const response = await fetch("/api/transactions/import", {
                    method: "POST",
                    body: formDataPayload,
                    credentials: "same-origin"
                });
                const resData = await response.json();
                if (!response.ok) throw new Error(resData.message || "Import failed");
                
                toast(resData.message || "Import completed successfully!");
                importInput.value = ""; // Reset
                loadTransactions();
                loadTransactionsChart();
            } catch (err) {
                toast(err.message || "Failed to import CSV", "error");
                importInput.value = ""; // Reset
            }
        } else if (filename.endsWith(".txt")) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const parsed = await api("/api/transactions/parse", {
                        method: "POST",
                        body: JSON.stringify({ message: e.target.result })
                    });
                    toast("Message parsed. Please review and save the transaction.");
                    prefillAndOpenModal(parsed, false);
                } catch (err) {
                    toast(err.message || "Failed to parse message", "error");
                }
            };
            reader.readAsText(file);
            importInput.value = ""; // Reset
        } else if (filename.endsWith(".pdf")) {
            const formDataPayload = new FormData();
            formDataPayload.append("file", file);

            try {
                toast("Parsing PDF statement...");
                const response = await fetch("/api/transactions/parse-file", {
                    method: "POST",
                    body: formDataPayload,
                    credentials: "same-origin"
                });
                const resData = await response.json();
                if (!response.ok) throw new Error(resData.message || "PDF parse failed");
                
                toast("PDF parsed. Please review and save the transaction.");
                prefillAndOpenModal(resData.data, false);
            } catch (err) {
                toast(err.message || "Failed to parse PDF", "error");
            }
            importInput.value = ""; // Reset
        } else {
            toast("Unsupported file format. Please upload a .csv, .txt, or .pdf file.", "error");
            importInput.value = ""; // Reset
        }
    });

    // CSV Export Button
    const exportBtn = document.getElementById("exportTxnsBtn");
    exportBtn?.addEventListener("click", () => {
        const search = document.getElementById("transactionSearch")?.value || "";
        const type = document.getElementById("filterType")?.value || "";
        const category = document.getElementById("filterCategory")?.value || "";
        const wallet = document.getElementById("filterWallet")?.value || "";
        const timeVal = document.getElementById("filterTime")?.value || "";
        
        const { start_date, end_date } = getDateRange(timeVal);
        
        const exportUrl = `/api/transactions/export?${qs({
            search,
            type,
            category,
            wallet,
            start_date,
            end_date
        })}`;
        
        window.open(exportUrl, "_blank");
    });

    // Chart tab segment setup
    const chartTabs = document.querySelectorAll("#chartPeriodSegment button");
    chartTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            chartTabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            const mode = tab.dataset.chartTab;
            loadTransactionsChart(mode);
        });
    });
    
    document.getElementById("prevPage")?.addEventListener("click", () => {
        if (transactionPage > 1) {
            transactionPage--;
            loadTransactions();
        }
    });
    
    document.getElementById("nextPage")?.addEventListener("click", () => {
        const perPage = document.getElementById("perPageSelect")?.value || "20";
        const countText = document.getElementById("txnTotalCount").textContent;
        const match = countText.match(/of\s+(\d+)\s+transactions/);
        if (match) {
            const totalCount = parseInt(match[1]);
            const maxPage = Math.ceil(totalCount / perPage) || 1;
            if (transactionPage < maxPage) {
                transactionPage++;
                loadTransactions();
            }
        } else {
            transactionPage++;
            loadTransactions();
        }
    });
    
    loadTransactions();
    loadTransactionsChart();
}

function renderBudgetAlerts(data, host) {
    if (!host) return;
    if (host.classList.contains("budget-list")) {
        host.innerHTML = data.items.slice(0, 3).map((item, index) => {
            const tone = item.tone || ["green", "orange", "blue", "pink"][index % 4];
            const icon = item.icon || ["bi-cup-hot", "bi-bag", "bi-airplane", "bi-ticket-perforated"][index % 4];
            return `<div class="budget-row"><span class="mini-icon ${tone}"><i class="bi ${icon}"></i></span><strong>${item.category}</strong><small>${money(item.spent)} / ${money(item.amount)}</small><b>${item.usage}%</b></div>`;
        }).join("") || `<p class="empty-state">No budgets created.</p>`;
        return;
    }
    host.innerHTML = data.items.map(item => `<div class="budget-item"><strong>${item.category}</strong><div class="progress my-2"><div class="progress-bar" style="width:${Math.min(item.usage, 100)}%"></div></div><small>Budget ${money(item.amount)} | Spent ${money(item.spent)} | ${item.usage}% used${item.exceeded_by ? ` | Exceeded by ${money(item.exceeded_by)}` : ""}</small></div>`).join("") || "No budgets created.";
    document.getElementById("budgetPopup")?.classList.toggle("danger", data.items.some(item => item.usage >= 100));
}

let budgetIdToDelete = null;
let budgetIdToEdit = null;

async function loadBudgets() {
    const emptyState = document.getElementById("emptyBudgetsState");
    const listPanel = document.getElementById("budgetsListPanel");
    const container = document.getElementById("budgetsContainer");
    
    if (!container) return;
    
    try {
        const resData = await api("/api/budgets/");
        const items = resData?.items || [];
        window.loadedBudgets = items;
        
        let totalBudget = 0;
        let totalSpent = 0;
        
        items.forEach(item => {
            totalBudget += item.amount || 0;
            totalSpent += item.spent || 0;
        });
        
        const remaining = totalBudget - totalSpent;
        
        // Update stats cards
        const totalBudgetVal = document.getElementById("totalBudgetVal");
        const totalSpentVal = document.getElementById("totalSpentVal");
        const remainingVal = document.getElementById("remainingVal");
        
        if (totalBudgetVal) totalBudgetVal.textContent = money(totalBudget);
        if (totalSpentVal) totalSpentVal.textContent = money(totalSpent);
        if (remainingVal) {
            remainingVal.textContent = money(remaining);
            remainingVal.className = remaining >= 0 ? "text-success fw-bold" : "text-danger fw-bold";
        }
        
        if (items.length === 0) {
            if (emptyState) emptyState.classList.remove("d-none");
            if (listPanel) listPanel.classList.add("d-none");
        } else {
            if (emptyState) emptyState.classList.add("d-none");
            if (listPanel) listPanel.classList.remove("d-none");
            
            container.innerHTML = items.map(item => {
                const isOverall = !item.category || item.category === "Overall" || (item.category && item.category.includes("Overall"));
                const catText = isOverall ? "Overall Budget" : (categoryEmojiMap[item.category] || item.category);
                
                // Exceeded status or on track status
                let badgeClass = "bg-success-subtle text-success";
                let statusText = "On Track";
                if (item.usage >= 100) {
                    badgeClass = "bg-danger-subtle text-danger";
                    statusText = "Exceeded";
                } else if (item.usage >= 80) {
                    badgeClass = "bg-warning-subtle text-warning";
                    statusText = "Warning";
                }
                
                const progressColorStyle = item.severity === "danger" ? "background-color: var(--pink) !important;" : item.severity === "orange" ? "background-color: var(--orange) !important;" : "background-color: var(--green) !important;";
                
                const remaining = item.amount - item.spent;
                const remainingText = remaining >= 0 ? `${money(remaining)} left` : `${money(Math.abs(remaining))} over limit`;
                
                return `<div class="p-3 border rounded-3 mb-3" style="background: var(--surface); border-color: var(--line) !important;">
                    <div class="d-flex align-items-center justify-content-between">
                        <div>
                            <h4 class="fw-bold m-0" style="font-size: 1.15rem; color: var(--text);">${catText}</h4>
                            <small class="text-muted" style="font-size: 0.8rem;">${item.period || 'monthly'}</small>
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            <span class="badge ${badgeClass}" style="font-size: 0.78rem; padding: 5px 10px; border-radius: 6px;">${statusText}</span>
                            <button class="btn btn-sm btn-ghost edit-budget border-0 bg-transparent text-muted p-1" data-id="${item._id}" style="font-size: 0.95rem;"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-sm btn-ghost delete-budget border-0 bg-transparent text-muted p-1" data-id="${item._id}" style="font-size: 0.95rem; color: var(--pink) !important;"><i class="bi bi-trash"></i></button>
                        </div>
                    </div>
                    
                    <div class="d-flex justify-content-between align-items-center mt-3" style="font-size: 0.92rem;">
                        <span><strong class="fw-bold">${money(item.spent)}</strong> spent</span>
                        <span class="text-muted">of ${money(item.amount)}</span>
                    </div>
                    
                    <div class="progress mt-2" style="height: 10px; border-radius: 5px;">
                        <div class="progress-bar" role="progressbar" style="width: ${Math.min(item.usage, 100)}%; border-radius: 5px; ${progressColorStyle}"></div>
                    </div>
                    
                    <div class="d-flex justify-content-between align-items-center mt-2" style="font-size: 0.82rem; color: var(--muted);">
                        <span>${item.usage}% used</span>
                        <span>${remainingText}</span>
                    </div>
                </div>`;
            }).join("");
            
            // Set delete buttons click listeners
            container.querySelectorAll(".delete-budget").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    budgetIdToDelete = btn.dataset.id;
                    document.getElementById("deleteBudgetConfirmModalBackdrop")?.classList.add("open");
                });
            });
            
            // Set edit buttons click listeners
            container.querySelectorAll(".edit-budget").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const id = btn.dataset.id;
                    const item = (window.loadedBudgets || []).find(b => b._id === id);
                    if (item) {
                        prefillAndOpenBudgetModal(item, true);
                    }
                });
            });
        }
    } catch (err) {
        console.error("Error loading budgets:", err);
    }
}

function prefillAndOpenBudgetModal(budget, isEdit = false) {
    const modal = document.getElementById("budgetModalBackdrop");
    const form = document.getElementById("budgetForm");
    if (!modal || !form) return;
    
    const titleEl = document.getElementById("budgetModalTitle");
    const subtitleEl = document.getElementById("budgetModalSubtitle");
    const submitBtn = document.getElementById("submitBudgetBtn");
    
    if (titleEl) titleEl.textContent = isEdit ? "Edit Budget" : "New Budget";
    if (subtitleEl) subtitleEl.textContent = isEdit ? "Modify your category spending limit" : "Set a spending limit for a category";
    if (submitBtn) submitBtn.textContent = isEdit ? "Save" : "Create";
    
    budgetIdToEdit = isEdit ? budget._id : null;
    
    // Populate form fields
    const select = document.getElementById("budgetCategorySelect");
    const amountInput = document.getElementById("budgetAmountInput");
    const periodSelect = document.getElementById("budgetPeriodSelect");
    
    if (select) select.value = budget.category || "Overall";
    if (amountInput) amountInput.value = budget.amount || "";
    if (periodSelect) periodSelect.value = budget.period || "monthly";
    
    modal.classList.add("open");
}

function setupBudgets() {
    const form = document.getElementById("budgetForm");
    const backdrop = document.getElementById("budgetModalBackdrop");
    const openBtnTop = document.getElementById("openAddBudgetBtnTop");
    const openBtnCenter = document.getElementById("openAddBudgetBtnCenter");
    const closeBtn = document.getElementById("closeBudgetModalBtn");
    
    // Delete Confirmation modal hooks
    const deleteBackdrop = document.getElementById("deleteBudgetConfirmModalBackdrop");
    const cancelDeleteBtn = document.getElementById("cancelDeleteBudgetBtn");
    const confirmDeleteBtn = document.getElementById("confirmDeleteBudgetBtn");
    
    if (!form && !openBtnCenter) return; // Not on Budgets page
    
    cancelDeleteBtn?.addEventListener("click", () => {
        deleteBackdrop?.classList.remove("open");
        budgetIdToDelete = null;
    });

    deleteBackdrop?.addEventListener("click", (e) => {
        if (e.target === deleteBackdrop) {
            deleteBackdrop.classList.remove("open");
            budgetIdToDelete = null;
        }
    });

    confirmDeleteBtn?.addEventListener("click", async () => {
        if (budgetIdToDelete) {
            try {
                await api(`/api/budgets/${budgetIdToDelete}`, { method: "DELETE" });
                toast("Budget deleted");
                deleteBackdrop?.classList.remove("open");
                budgetIdToDelete = null;
                loadBudgets();
            } catch (err) {
                toast(err.message || "Failed to delete budget", "error");
            }
        }
    });
    
    const openModal = () => {
        form?.reset();
        budgetIdToEdit = null;
        
        const titleEl = document.getElementById("budgetModalTitle");
        const subtitleEl = document.getElementById("budgetModalSubtitle");
        const submitBtn = document.getElementById("submitBudgetBtn");
        
        if (titleEl) titleEl.textContent = "New Budget";
        if (subtitleEl) subtitleEl.textContent = "Set a spending limit for a category";
        if (submitBtn) submitBtn.textContent = "Create";
        
        const select = document.getElementById("budgetCategorySelect");
        if (select) select.value = "Overall";
        
        backdrop?.classList.add("open");
    };
    
    openBtnTop?.addEventListener("click", openModal);
    openBtnCenter?.addEventListener("click", openModal);
    
    const closeModal = () => backdrop?.classList.remove("open");
    closeBtn?.addEventListener("click", closeModal);
    backdrop?.addEventListener("click", (e) => {
        if (e.target === backdrop) closeModal();
    });
    
    form?.addEventListener("submit", async event => {
        event.preventDefault();
        try {
            const payload = formData(form);
            if (budgetIdToEdit) {
                await api(`/api/budgets/${budgetIdToEdit}`, { method: "PUT", body: JSON.stringify(payload) });
                toast("Budget updated");
            } else {
                await api("/api/budgets/", { method: "POST", body: JSON.stringify(payload) });
                toast("Budget created");
            }
            
            form.reset();
            closeModal();
            loadBudgets();
        } catch (err) {
            toast(err.message || "Failed to save budget", "error");
        }
    });
    
    loadBudgets();
}

let goalIdToDelete = null;
let goalIdToEdit = null;

const goalColors = ["violet", "green", "orange", "blue", "pink", "gold", "teal", "cyan"];
const goalIcons = ["bi-trophy", "bi-airplane", "bi-laptop", "bi-house", "bi-shield-fill-check", "bi-bicycle", "bi-music-note-beamed", "bi-book"];

async function loadGoals() {
    const emptyState = document.getElementById("emptyGoalsState");
    const listPanel = document.getElementById("goalsListPanel");
    const container = document.getElementById("goalsContainer");

    if (!container) return;

    try {
        const resData = await api("/api/goals/");
        const items = resData?.items || [];
        window.loadedGoals = items;

        let totalTarget = 0;
        let totalSaved = 0;
        let achieved = 0;

        items.forEach(item => {
            totalTarget += item.target_amount || 0;
            totalSaved += item.current_amount || 0;
            if ((item.current_amount || 0) >= (item.target_amount || 1)) achieved++;
        });

        // Update KPI stats
        const totalGoalsEl = document.getElementById("totalGoalsVal");
        const totalTargetEl = document.getElementById("totalTargetVal");
        const totalSavedEl = document.getElementById("totalSavedVal");
        const totalAchievedEl = document.getElementById("totalAchievedVal");

        if (totalGoalsEl) totalGoalsEl.textContent = items.length;
        if (totalTargetEl) totalTargetEl.textContent = money(totalTarget);
        if (totalSavedEl) totalSavedEl.textContent = money(totalSaved);
        if (totalAchievedEl) totalAchievedEl.textContent = achieved;

        if (items.length === 0) {
            if (emptyState) emptyState.classList.remove("d-none");
            if (listPanel) listPanel.classList.add("d-none");
        } else {
            if (emptyState) emptyState.classList.add("d-none");
            if (listPanel) listPanel.classList.remove("d-none");

            container.innerHTML = items.map((item, index) => {
                const completion = Math.min(Math.round((item.current_amount || 0) / (item.target_amount || 1) * 100), 100);
                const isAchieved = (item.current_amount || 0) >= (item.target_amount || 1);
                const remaining = Math.max(0, (item.target_amount || 0) - (item.current_amount || 0));

                const tone = goalColors[index % goalColors.length];
                const icon = goalIcons[index % goalIcons.length];

                let badgeClass = "bg-success-subtle text-success";
                let statusText = "On Track";
                if (isAchieved) {
                    badgeClass = "bg-info-subtle text-info";
                    statusText = "🎉 Achieved";
                } else if (completion >= 75) {
                    badgeClass = "bg-warning-subtle text-warning";
                    statusText = "Almost There";
                }

                const progressColor = isAchieved ? "var(--green)" : completion >= 75 ? "var(--orange)" : `var(--${tone})`;

                // Target date display
                let targetDateHtml = "";
                if (item.target_date) {
                    const targetDate = new Date(item.target_date);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const diffDays = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));
                    const formattedDate = targetDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
                    let daysLabel = "";
                    let daysColor = "var(--muted)";
                    if (!isAchieved) {
                        if (diffDays < 0) {
                            daysLabel = `<span style="color: var(--pink); font-weight: 700;"> • ${Math.abs(diffDays)}d overdue</span>`;
                        } else if (diffDays === 0) {
                            daysLabel = `<span style="color: var(--orange); font-weight: 700;"> • Due today!</span>`;
                        } else if (diffDays <= 30) {
                            daysLabel = `<span style="color: var(--orange); font-weight: 700;"> • ${diffDays}d left</span>`;
                        } else {
                            daysLabel = `<span style="color: var(--muted);"> • ${diffDays}d left</span>`;
                        }
                    }
                    targetDateHtml = `<small style="font-size: 0.78rem; color: var(--muted);"><i class="bi bi-calendar3" style="margin-right:4px;"></i>${formattedDate}${daysLabel}</small>`;
                }

                const toneHex = {violet:"#7c3cff",green:"#00d18f",orange:"#ff9f43",blue:"#4cc9f0",pink:"#ff5d73",gold:"#f4b942",teal:"#00b4a6",cyan:"#22d3ee"}[tone] || "#7c3cff";
                return `<div class="p-3 border rounded-3 goal-card" data-id="${item._id}" style="background: var(--surface); border-color: var(--line) !important; cursor: pointer; transition: transform 0.2s ease, box-shadow 0.2s ease;" onmouseenter="this.style.transform='translateY(-3px)';this.style.boxShadow='0 8px 24px ${toneHex}30'" onmouseleave="this.style.transform='';this.style.boxShadow=''">
                    <div class="d-flex align-items-center justify-content-between">
                        <div class="d-flex align-items-center gap-3">
                            <div class="d-flex align-items-center justify-content-center" style="width: 44px; height: 44px; border-radius: 50%; background: var(--surface-soft); border: 1px solid var(--line); flex-shrink: 0;">
                                <i class="bi ${icon}" style="font-size: 1.1rem; color: var(--${tone});"></i>
                            </div>
                            <div>
                                <h4 class="fw-bold m-0" style="font-size: 1.05rem; color: var(--text);">${item.name}</h4>
                                <small class="text-muted" style="font-size: 0.8rem;">${money(item.current_amount || 0)} saved of ${money(item.target_amount || 0)}</small>
                                ${targetDateHtml ? `<div class="mt-1">${targetDateHtml}</div>` : ""}
                            </div>
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            <span class="badge ${badgeClass}" style="font-size: 0.78rem; padding: 5px 10px; border-radius: 6px;">${statusText}</span>
                            <button class="btn btn-sm btn-ghost border-0 bg-transparent text-muted p-1" title="Edit goal" style="font-size: 0.95rem;"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-sm btn-ghost delete-goal border-0 bg-transparent text-muted p-1" data-id="${item._id}" style="font-size: 0.95rem; color: #ef4444 !important;" title="Delete goal"><i class="bi bi-trash"></i></button>
                        </div>
                    </div>

                    <div class="progress mt-3" style="height: 10px; border-radius: 5px; background: var(--surface-soft);">
                        <div class="progress-bar" role="progressbar" style="width: ${completion}%; border-radius: 5px; background-color: ${progressColor}; transition: width 0.6s ease;"></div>
                    </div>

                    <div class="d-flex justify-content-between align-items-center mt-2" style="font-size: 0.82rem; color: var(--muted);">
                        <span>${completion}% complete</span>
                        <span>${isAchieved ? "Goal reached! 🎉" : money(remaining) + " to go"}</span>
                    </div>
                </div>`;
            }).join("");

            // Delete button — stop propagation so card click doesn't fire
            container.querySelectorAll(".delete-goal").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    goalIdToDelete = btn.dataset.id;
                    document.getElementById("deleteGoalConfirmModalBackdrop")?.classList.add("open");
                });
            });

            // Entire card click = open edit modal
            container.querySelectorAll(".goal-card").forEach(card => {
                card.addEventListener("click", () => {
                    const id = card.dataset.id;
                    const item = (window.loadedGoals || []).find(g => g._id === id);
                    if (item) prefillAndOpenGoalModal(item, true);
                });
            });
        }
    } catch (err) {
        console.error("Error loading goals:", err);
    }
}

function prefillAndOpenGoalModal(goal, isEdit = false) {
    const modal = document.getElementById("goalModalBackdrop");
    const form = document.getElementById("goalForm");
    if (!modal || !form) return;

    const titleEl = document.getElementById("goalModalTitle");
    const subtitleEl = document.getElementById("goalModalSubtitle");
    const submitBtn = document.getElementById("submitGoalBtn");

    if (titleEl) titleEl.textContent = isEdit ? "Edit Goal" : "New Goal";
    if (subtitleEl) subtitleEl.textContent = isEdit ? "Update your savings milestone" : "Set a savings milestone to aim for";
    if (submitBtn) submitBtn.textContent = isEdit ? "Save" : "Create";

    goalIdToEdit = isEdit ? goal._id : null;

    const nameInput = document.getElementById("goalNameInput");
    const targetInput = document.getElementById("goalTargetInput");
    const currentInput = document.getElementById("goalCurrentInput");
    const dateInput = document.getElementById("goalTargetDateInput");

    if (nameInput) nameInput.value = goal.name || "";
    if (targetInput) targetInput.value = goal.target_amount || "";
    if (currentInput) currentInput.value = goal.current_amount || 0;
    if (dateInput) dateInput.value = goal.target_date ? goal.target_date.split("T")[0] : "";

    // Trigger live progress bar immediately
    const target = parseFloat(goal.target_amount) || 0;
    const current = parseFloat(goal.current_amount) || 0;
    const pct = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;
    const remaining = Math.max(0, target - current);
    const preview = document.getElementById("goalProgressPreview");
    const bar = document.getElementById("goalProgressBar");
    const label = document.getElementById("goalProgressLabel");
    const subtext = document.getElementById("goalProgressSubtext");
    let barColor = "#7c3cff";
    if (pct >= 100) barColor = "#00d18f";
    else if (pct >= 75) barColor = "#ff9f43";
    if (preview) preview.style.display = target > 0 ? "block" : "none";
    if (bar) { bar.style.width = `${pct}%`; bar.style.backgroundColor = barColor; }
    if (label) label.textContent = `${pct}%`;
    if (subtext) {
        subtext.textContent = pct >= 100
            ? "🎉 Goal Achieved!"
            : `₹${Number(remaining).toLocaleString("en-IN", { maximumFractionDigits: 0 })} more to go`;
        subtext.style.color = pct >= 100 ? "#00d18f" : "";
    }

    modal.classList.add("open");
}

function setupGoals() {
    const form = document.getElementById("goalForm");
    const backdrop = document.getElementById("goalModalBackdrop");
    const openBtnTop = document.getElementById("openAddGoalBtnTop");
    const openBtnCenter = document.getElementById("openAddGoalBtnCenter");
    const closeBtn = document.getElementById("closeGoalModalBtn");

    const deleteBackdrop = document.getElementById("deleteGoalConfirmModalBackdrop");
    const cancelDeleteBtn = document.getElementById("cancelDeleteGoalBtn");
    const confirmDeleteBtn = document.getElementById("confirmDeleteGoalBtn");

    if (!form && !openBtnCenter) return; // Not on Goals page

    cancelDeleteBtn?.addEventListener("click", () => {
        deleteBackdrop?.classList.remove("open");
        goalIdToDelete = null;
    });

    deleteBackdrop?.addEventListener("click", (e) => {
        if (e.target === deleteBackdrop) {
            deleteBackdrop.classList.remove("open");
            goalIdToDelete = null;
        }
    });

    confirmDeleteBtn?.addEventListener("click", async () => {
        if (goalIdToDelete) {
            try {
                await api(`/api/goals/${goalIdToDelete}`, { method: "DELETE" });
                toast("Goal deleted");
                deleteBackdrop?.classList.remove("open");
                goalIdToDelete = null;
                loadGoals();
            } catch (err) {
                toast(err.message || "Failed to delete goal", "error");
            }
        }
    });

    const openModal = () => {
        form?.reset();
        goalIdToEdit = null;

        const titleEl = document.getElementById("goalModalTitle");
        const subtitleEl = document.getElementById("goalModalSubtitle");
        const submitBtn = document.getElementById("submitGoalBtn");
        const currentInput = document.getElementById("goalCurrentInput");

        if (titleEl) titleEl.textContent = "New Goal";
        if (subtitleEl) subtitleEl.textContent = "Set a savings milestone to aim for";
        if (submitBtn) submitBtn.textContent = "Create";
        if (currentInput) currentInput.value = 0;

        updateGoalProgress();
        backdrop?.classList.add("open");
    };

    const closeModal = () => backdrop?.classList.remove("open");

    openBtnTop?.addEventListener("click", openModal);
    openBtnCenter?.addEventListener("click", openModal);
    closeBtn?.addEventListener("click", closeModal);
    backdrop?.addEventListener("click", (e) => {
        if (e.target === backdrop) closeModal();
    });

    // Live progress bar update
    function updateGoalProgress() {
        const targetInput = document.getElementById("goalTargetInput");
        const currentInput = document.getElementById("goalCurrentInput");
        const preview = document.getElementById("goalProgressPreview");
        const bar = document.getElementById("goalProgressBar");
        const label = document.getElementById("goalProgressLabel");
        const subtext = document.getElementById("goalProgressSubtext");

        const target = parseFloat(targetInput?.value) || 0;
        const current = parseFloat(currentInput?.value) || 0;

        if (target <= 0) {
            if (preview) preview.style.display = "none";
            return;
        }

        const pct = Math.min(Math.round((current / target) * 100), 100);
        const remaining = Math.max(0, target - current);

        let barColor = "#7c3cff";
        if (pct >= 100) barColor = "#00d18f";
        else if (pct >= 75) barColor = "#ff9f43";

        if (preview) preview.style.display = "block";
        if (bar) { bar.style.width = `${pct}%`; bar.style.backgroundColor = barColor; }
        if (label) label.textContent = `${pct}%`;
        if (subtext) {
            subtext.textContent = pct >= 100
                ? "🎉 Goal Achieved!"
                : `₹${Number(remaining).toLocaleString("en-IN", { maximumFractionDigits: 0 })} more to go`;
            subtext.style.color = pct >= 100 ? "#00d18f" : "";
        }
    }

    document.getElementById("goalTargetInput")?.addEventListener("input", updateGoalProgress);
    document.getElementById("goalCurrentInput")?.addEventListener("input", updateGoalProgress);

    form?.addEventListener("submit", async event => {
        event.preventDefault();
        try {
            const payload = formData(form);
            if (goalIdToEdit) {
                await api(`/api/goals/${goalIdToEdit}`, { method: "PUT", body: JSON.stringify(payload) });
                toast("Goal updated");
            } else {
                await api("/api/goals/", { method: "POST", body: JSON.stringify(payload) });
                toast("Goal created");
            }
            form.reset();
            closeModal();
            loadGoals();
        } catch (err) {
            toast(err.message || "Failed to save goal", "error");
        }
    });

    loadGoals();
}

async function setupAnalytics() {
    if (!document.getElementById("spendingChart")) return;

    const data = await api("/api/analytics/");

    // ── Helper: animated number counter ─────────────────
    function animateValue(el, target, isCurrency = true, duration = 900) {
        if (!el) return;
        const start = 0;
        const startTime = performance.now();
        const update = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(start + (target - start) * eased);
            el.textContent = isCurrency
                ? "₹" + current.toLocaleString("en-IN")
                : current.toLocaleString("en-IN");
            if (progress < 1) requestAnimationFrame(update);
        };
        requestAnimationFrame(update);
    }

    // ── Hero KPIs ────────────────────────────────────────
    const totalIncome  = data.monthly_income.values.reduce((a, b) => a + b, 0);
    const totalSpent   = data.monthly_spending.values.reduce((a, b) => a + b, 0);
    const netSavings   = totalIncome - totalSpent;
    const savingsRate  = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;

    setTimeout(() => {
        animateValue(document.getElementById("anTotalIncome"), Math.round(totalIncome));
        animateValue(document.getElementById("anTotalSpent"),  Math.round(totalSpent));
        animateValue(document.getElementById("anNetSavings"),  Math.round(netSavings));

        const rateEl = document.getElementById("anSavingsRate");
        if (rateEl) rateEl.textContent = `${savingsRate}% savings rate`;
        rateEl?.style && (rateEl.style.color = savingsRate >= 20 ? "#00d18f" : savingsRate >= 10 ? "#ff9f43" : "#ff5d73");

        // Top category
        const cats = data.category_expenses;
        if (cats.labels.length) {
            const maxIdx = cats.values.indexOf(Math.max(...cats.values));
            const topEl  = document.getElementById("anTopCat");
            const topAmt = document.getElementById("anTopCatAmt");
            if (topEl) topEl.textContent = cats.labels[maxIdx] || "—";
            if (topAmt) topAmt.textContent = "₹" + Math.round(cats.values[maxIdx]).toLocaleString("en-IN") + " spent";
        }
    }, 300);

    // ── AI Insights panel ────────────────────────────────
    const insights = [];
    if (totalIncome > 0 && savingsRate >= 20)
        insights.push({ icon: "bi-graph-up-arrow", color: "#00d18f", bg: "#00d18f22", title: "Strong savings!", text: `You're saving ${savingsRate}% of your income. Keep it up!` });
    else if (totalIncome > 0 && savingsRate < 10)
        insights.push({ icon: "bi-exclamation-triangle", color: "#ff9f43", bg: "#ff9f4322", title: "Low savings rate", text: `Only ${savingsRate}% saved. Try cutting non-essentials.` });

    if (totalSpent > totalIncome)
        insights.push({ icon: "bi-emoji-frown", color: "#ff5d73", bg: "#ff5d7322", title: "Spending > Income", text: "You spent more than you earned this period. Review your expenses." });
    else
        insights.push({ icon: "bi-emoji-smile", color: "#00d18f", bg: "#00d18f22", title: "In the green!", text: "Your income covers your expenses. Solid financial health." });

    const cats2 = data.category_expenses;
    if (cats2.labels.length) {
        const maxIdx2 = cats2.values.indexOf(Math.max(...cats2.values));
        insights.push({ icon: "bi-tag", color: "#a78bfa", bg: "#7c3cff22", title: "Top spending", text: `${cats2.labels[maxIdx2]} is your biggest expense category.` });
    }

    const insightsEl = document.getElementById("anInsights");
    if (insightsEl && insights.length) {
        insightsEl.innerHTML = insights.slice(0, 3).map((ins, i) => `
            <div class="an-insight-item" style="transition-delay:${i * 100}ms">
                <div class="an-insight-icon" style="background:${ins.bg}; color:${ins.color}"><i class="bi ${ins.icon}"></i></div>
                <div><strong>${ins.title}</strong><p>${ins.text}</p></div>
            </div>`).join("");
        setTimeout(() => insightsEl.querySelectorAll(".an-insight-item").forEach(el => el.classList.add("visible")), 500);
    }

    // ── Chart.js gradient helper ─────────────────────────
    function makeGradient(ctx, color1, color2) {
        const grad = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
        grad.addColorStop(0, color1);
        grad.addColorStop(1, color2);
        return grad;
    }

    const defaultOpts = (title) => ({
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 1000, easing: "easeOutQuart" },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: "rgba(15,15,30,0.92)",
                borderColor: "rgba(255,255,255,0.08)",
                borderWidth: 1,
                titleColor: "#fff",
                bodyColor: "rgba(255,255,255,0.7)",
                padding: 10,
                cornerRadius: 10,
                callbacks: {
                    label: (ctx) => " ₹" + Number(ctx.parsed.y ?? ctx.parsed).toLocaleString("en-IN")
                }
            }
        },
        scales: {
            x: { grid: { color: "rgba(255,255,255,0.04)" }, ticks: { color: "rgba(255,255,255,0.45)", font: { size: 11 } } },
            y: { grid: { color: "rgba(255,255,255,0.04)" }, ticks: { color: "rgba(255,255,255,0.45)", font: { size: 11 }, callback: v => "₹" + (v >= 1000 ? Math.round(v/1000) + "k" : v) } }
        }
    });

    // ── Income vs Expense chart ──────────────────────────
    const iveCanvas  = document.getElementById("comparisonChart");
    const iveCtx     = iveCanvas?.getContext("2d");
    if (iveCtx) {
        window.iveChart = new Chart(iveCtx, {
            type: "bar",
            data: {
                labels: data.income_vs_expense.labels,
                datasets: [
                    { label: "Income",  data: data.income_vs_expense.income,  backgroundColor: "#00d18fcc", borderRadius: 6, borderSkipped: false },
                    { label: "Expense", data: data.income_vs_expense.expense, backgroundColor: "#ff5d73cc", borderRadius: 6, borderSkipped: false }
                ]
            },
            options: {
                ...defaultOpts("Income vs Expense"),
                plugins: {
                    ...defaultOpts().plugins,
                    legend: { display: true, labels: { color: "rgba(255,255,255,0.6)", boxWidth: 12, padding: 14, font: { size: 11 } } }
                }
            }
        });
    }

    // ── Spending Trend ───────────────────────────────────
    const spCanvas = document.getElementById("spendingChart");
    const spCtx    = spCanvas?.getContext("2d");
    if (spCtx) {
        const spGrad = makeGradient(spCtx, "#ff5d7340", "#ff5d7302");
        new Chart(spCtx, {
            type: "line",
            data: {
                labels: data.monthly_spending.labels,
                datasets: [{
                    label: "Spending",
                    data: data.monthly_spending.values,
                    borderColor: "#ff5d73",
                    backgroundColor: spGrad,
                    tension: 0.45, fill: true,
                    pointBackgroundColor: "#ff5d73",
                    pointRadius: 4, pointHoverRadius: 7,
                    borderWidth: 2.5
                }]
            },
            options: defaultOpts("Spending")
        });
    }

    // ── Income Trend ─────────────────────────────────────
    const inCanvas = document.getElementById("incomeChart");
    const inCtx    = inCanvas?.getContext("2d");
    if (inCtx) {
        const inGrad = makeGradient(inCtx, "#00d18f40", "#00d18f02");
        new Chart(inCtx, {
            type: "line",
            data: {
                labels: data.monthly_income.labels,
                datasets: [{
                    label: "Income",
                    data: data.monthly_income.values,
                    borderColor: "#00d18f",
                    backgroundColor: inGrad,
                    tension: 0.45, fill: true,
                    pointBackgroundColor: "#00d18f",
                    pointRadius: 4, pointHoverRadius: 7,
                    borderWidth: 2.5
                }]
            },
            options: defaultOpts("Income")
        });
    }

    // ── Category Donut ───────────────────────────────────
    const catColors = ["#7c3cff","#00d18f","#ff9f43","#ff5d73","#4cc9f0","#f4b942","#22d3ee","#b8f36d"];
    const catCanvas = document.getElementById("categoryChart");
    const catCtx    = catCanvas?.getContext("2d");
    if (catCtx && data.category_expenses.labels.length) {
        new Chart(catCtx, {
            type: "doughnut",
            data: {
                labels: data.category_expenses.labels,
                datasets: [{ data: data.category_expenses.values, backgroundColor: catColors, borderWidth: 2, borderColor: "rgba(0,0,0,0.3)", hoverOffset: 8 }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                cutout: "68%",
                animation: { animateRotate: true, duration: 1200, easing: "easeOutQuart" },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: "rgba(15,15,30,0.92)", borderColor: "rgba(255,255,255,0.08)", borderWidth: 1,
                        titleColor: "#fff", bodyColor: "rgba(255,255,255,0.7)", padding: 10, cornerRadius: 10,
                        callbacks: { label: ctx => " ₹" + Number(ctx.parsed).toLocaleString("en-IN") }
                    }
                }
            }
        });

        // Custom legend
        const legendEl = document.getElementById("categoryLegend");
        if (legendEl) {
            const total = data.category_expenses.values.reduce((a,b) => a+b, 0);
            legendEl.innerHTML = data.category_expenses.labels.map((lbl, i) => {
                const pct = total > 0 ? Math.round((data.category_expenses.values[i] / total) * 100) : 0;
                return `<div style="display:flex;align-items:center;gap:8px;">
                    <span style="width:10px;height:10px;border-radius:50%;background:${catColors[i % catColors.length]};flex-shrink:0;"></span>
                    <span style="font-size:0.8rem;color:var(--text);flex:1;">${lbl}</span>
                    <span style="font-size:0.78rem;color:var(--muted);font-weight:700;">${pct}%</span>
                </div>`;
            }).join("");
        }
    } else if (catCtx) {
        catCtx.canvas.parentElement.innerHTML = `<p style="color:var(--muted);text-align:center;padding:40px 0;font-size:0.9rem;">No expense data yet</p>`;
    }

    // ── Budget Utilization ───────────────────────────────
    const budCanvas = document.getElementById("budgetChart");
    const budCtx    = budCanvas?.getContext("2d");
    if (budCtx && data.budget_utilization.labels.length) {
        new Chart(budCtx, {
            type: "bar",
            data: {
                labels: data.budget_utilization.labels,
                datasets: [{ label: "Budget", data: data.budget_utilization.values, backgroundColor: catColors, borderRadius: 8, borderSkipped: false }]
            },
            options: { ...defaultOpts("Budget"), plugins: { ...defaultOpts().plugins, legend: { display: false } } }
        });
    } else if (budCtx) {
        budCtx.canvas.parentElement.innerHTML = `<p style="color:var(--muted);text-align:center;padding:40px 0;font-size:0.9rem;">No budgets created yet</p>`;
    }

    // ── Savings Goals animated bars ──────────────────────
    const stack = document.getElementById("savingsProgressStack");
    if (stack && data.savings_growth.labels.length) {
        const goalColors2 = ["#7c3cff","#00d18f","#ff9f43","#4cc9f0","#ff5d73","#22d3ee"];
        stack.innerHTML = data.savings_growth.labels.map((name, i) => {
            const pct = Math.min(Math.round(data.savings_growth.values[i]), 100);
            const col = goalColors2[i % goalColors2.length];
            return `<div class="goal-progress-row">
                <div class="gp-head">
                    <span class="gp-name">${name}</span>
                    <span class="gp-pct" style="color:${col}">${pct}%</span>
                </div>
                <div class="gp-bar-track"><div class="gp-bar-fill" data-pct="${pct}" style="background:${col};"></div></div>
                <div class="gp-sub">${pct >= 100 ? "🎉 Goal achieved!" : pct + "% of target reached"}</div>
            </div>`;
        }).join("");

        // Animate bars after render
        setTimeout(() => {
            stack.querySelectorAll(".gp-bar-fill").forEach(bar => {
                bar.style.width = bar.dataset.pct + "%";
            });
        }, 600);
    } else if (stack) {
        stack.innerHTML = `<p style="color:var(--muted);font-size:0.9rem;padding:20px 0;">No savings goals yet.</p>`;
    }

    // ── Scroll reveal for cards ──────────────────────────
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, idx) => {
            if (entry.isIntersecting) {
                setTimeout(() => entry.target.classList.add("visible"), idx * 80);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll(".an-card").forEach(card => observer.observe(card));
}

function setupReports() {
    const form = document.getElementById("reportForm");
    if (!form) return;

    const emptyState = document.getElementById("reportEmptyState");
    const noDataState = document.getElementById("reportNoDataState");
    const dataTable = document.getElementById("reportDataTable");
    const tableBody = document.getElementById("reportTableBody");
    const searchWrap = document.getElementById("reportSearchWrap");
    const searchInput = document.getElementById("reportSearch");
    const previewSubtitle = document.getElementById("reportPreviewSubtitle");
    const printBtn = document.getElementById("printReportBtn");

    let reportRows = [];

    function renderReportTable(rowsToRender) {
        if (!tableBody) return;
        if (rowsToRender.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted"><i class="bi bi-search me-2"></i>No matching transactions found</td></tr>`;
            return;
        }

        tableBody.innerHTML = rowsToRender.map(row => {
            const dateVal = row[0] || "";
            const typeVal = row[1] || "";
            const catVal = row[2] || "";
            const descVal = row[3] || "";
            const amtVal = parseFloat(row[4]) || 0;
            const balVal = parseFloat(row[5]) || 0;

            let dateHtml = "";
            if (dateVal) {
                const dateObj = new Date(dateVal);
                const formattedDate = isNaN(dateObj.getTime())
                    ? dateVal
                    : dateObj.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
                dateHtml = `<span class="text-nowrap"><i class="bi bi-calendar-event me-2 text-muted"></i>${formattedDate}</span>`;
            }

            let typeHtml = "";
            if (typeVal.toLowerCase() === "income") {
                typeHtml = `<span class="badge-income">Income</span>`;
            } else if (typeVal.toLowerCase() === "expense") {
                typeHtml = `<span class="badge-expense">Expense</span>`;
            } else {
                typeHtml = `<span class="badge bg-secondary">${typeVal}</span>`;
            }

            const catHtml = catVal ? `<span class="chip-category"><i class="bi bi-tag-fill me-1 small"></i>${catVal}</span>` : "—";
            const amtClass = typeVal.toLowerCase() === "income" ? "text-amount-income" : "text-amount-expense";
            const amtSign = typeVal.toLowerCase() === "income" ? "+" : "-";
            const amtHtml = `<span class="${amtClass}">${amtSign} ${money(amtVal)}</span>`;
            const balHtml = `<span class="text-muted fw-semibold">${money(balVal)}</span>`;

            return `<tr>
                <td>${dateHtml}</td>
                <td>${typeHtml}</td>
                <td>${catHtml}</td>
                <td class="text-wrap" style="max-width: 250px;">${descVal || "—"}</td>
                <td class="text-end">${amtHtml}</td>
                <td class="text-end">${balHtml}</td>
            </tr>`;
        }).join("");
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();
        try {
            const data = await api(`/api/reports/?${qs(formData(form))}`);
            const allRows = data?.rows || [];
            
            if (allRows.length <= 1) {
                reportRows = [];
                if (emptyState) emptyState.classList.add("d-none");
                if (noDataState) noDataState.classList.remove("d-none");
                if (dataTable) dataTable.style.display = "none";
                if (searchWrap) searchWrap.classList.add("d-none");
                if (previewSubtitle) previewSubtitle.textContent = "0 transactions found.";
                return;
            }

            reportRows = allRows.slice(1);

            if (emptyState) emptyState.classList.add("d-none");
            if (noDataState) noDataState.classList.add("d-none");
            if (dataTable) dataTable.style.display = "table";
            if (searchWrap) searchWrap.classList.remove("d-none");
            if (searchInput) searchInput.value = "";
            if (previewSubtitle) {
                const count = reportRows.length;
                previewSubtitle.textContent = `Showing ${count} transaction${count === 1 ? "" : "s"} based on your criteria.`;
            }

            renderReportTable(reportRows);
        } catch (err) {
            console.error("Error fetching report:", err);
            toast(err.message || "Failed to load report preview", "error");
        }
    });

    if (searchInput) {
        searchInput.addEventListener("input", () => {
            const q = searchInput.value.toLowerCase().trim();
            if (!q) {
                renderReportTable(reportRows);
                if (previewSubtitle) {
                    previewSubtitle.textContent = `Showing ${reportRows.length} transaction${reportRows.length === 1 ? "" : "s"} based on your criteria.`;
                }
                return;
            }

            const filtered = reportRows.filter(row => {
                const dateVal = String(row[0] || "").toLowerCase();
                const typeVal = String(row[1] || "").toLowerCase();
                const catVal = String(row[2] || "").toLowerCase();
                const descVal = String(row[3] || "").toLowerCase();
                const amtVal = String(row[4] || "").toLowerCase();
                
                return dateVal.includes(q) || 
                       typeVal.includes(q) || 
                       catVal.includes(q) || 
                       descVal.includes(q) || 
                       amtVal.includes(q);
            });

            renderReportTable(filtered);
            if (previewSubtitle) {
                previewSubtitle.textContent = `Found ${filtered.length} matching transaction${filtered.length === 1 ? "" : "s"} of ${reportRows.length} total.`;
            }
        });
    }

    document.querySelectorAll("[data-export]").forEach(btn => btn.addEventListener("click", () => {
        location.href = `/api/reports/export?${qs({ ...formData(form), format: btn.dataset.export })}`;
    }));

    if (printBtn) {
        printBtn.addEventListener("click", () => {
            window.print();
        });
    }
}

async function setupAdmin() {
    const host = document.getElementById("adminMetrics");
    if (!host) return;
    try {
        const data = await api("/api/admin/summary");
        const metrics = [
            ["Users", data.total_users, "bi-people", "purple"],
            ["Transactions", data.total_transactions, "bi-activity", "blue"],
            ["Revenue Tracked", money(data.total_revenue_tracked), "bi-currency-exchange", "emerald"],
            ["Net Balance", money(data.net_balance_tracked), "bi-cash-coin", "indigo"]
        ];
        host.innerHTML = metrics.map(([label, value, icon, color]) => `
            <article class="metric-card ${color}">
                <div class="metric-icon-wrap"><i class="bi ${icon}"></i></div>
                <div class="metric-info">
                    <span>${label}</span>
                    <strong>${value}</strong>
                </div>
            </article>
        `).join("");
        const table = document.getElementById("adminTable");
        if (table) table.innerHTML = data.user_analytics.map(row => `<tr><td>${row._id}</td><td>${row.count}</td><td>${money(row.volume)}</td></tr>`).join("") || `<tr><td colspan="3">No activity yet.</td></tr>`;

        // Chart: User Growth
        if(document.getElementById("userGrowthChart")) {
            const growthLabels = Object.keys(data.user_growth || {});
            const growthData = Object.values(data.user_growth || {});
            chart("userGrowthChart", "line", {
                labels: growthLabels,
                datasets: [{ label: "New Users", data: growthData, borderColor: "#6366f1", backgroundColor: "rgba(99, 102, 241, 0.08)", fill: true, tension: 0.4 }]
            });
        }

        // Chart: Activity Flow
        if(document.getElementById("activityFlowChart")) {
            const activityLabels = Object.keys(data.activity_timeline || {});
            const incomeData = activityLabels.map(k => data.activity_timeline[k].income);
            const expenseData = activityLabels.map(k => data.activity_timeline[k].expense);
            chart("activityFlowChart", "bar", {
                labels: activityLabels,
                datasets: [
                    { label: "Income", data: incomeData, backgroundColor: "#10b981", borderRadius: 4 },
                    { label: "Expense", data: expenseData, backgroundColor: "#ef4444", borderRadius: 4 }
                ]
            });
        }

        // Chart: Category Breakdown
        if(document.getElementById("categoryBreakdownChart")) {
            const categories = Object.entries(data.category_totals || {}).sort((a,b) => b[1] - a[1]).slice(0, 8);
            chart("categoryBreakdownChart", "doughnut", {
                labels: categories.map(c => c[0]),
                datasets: [{ data: categories.map(c => c[1]), backgroundColor: ["#6366f1", "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#14b8a6", "#64748b"] }]
            });
        }

        const toggle = document.getElementById("adminMaintenanceToggle");
        if (toggle) {
            const maint = await api("/api/admin/maintenance");
            toggle.checked = maint.enabled;
            toggle.onchange = async (e) => {
                const isEnabling = e.target.checked;
                if (isEnabling) {
                    if (!confirm("WARNING: Enabling Maintenance Mode will block all non-admin users from accessing the application immediately. Are you sure you want to proceed?")) {
                        e.target.checked = false;
                        return;
                    }
                }
                try {
                    await api("/api/admin/maintenance", { method: "POST", body: JSON.stringify({ enabled: isEnabling }) });
                    toast(isEnabling ? "Maintenance mode enabled." : "Maintenance mode disabled.", "success");
                } catch (err) {
                    toast(err.message, "danger");
                    e.target.checked = !isEnabling;
                }
            };
        }

        const alertsHost = document.getElementById("adminAlertsList");
        if (alertsHost) {
            window.loadAdminAlerts = async () => {
                const alertsData = await api("/api/admin/alerts");
                document.getElementById("adminAlertCount").textContent = alertsData.items.length;
                alertsHost.innerHTML = alertsData.items.map(alert => `
                    <div class="d-flex align-items-center justify-content-between p-3 border-bottom security-alert-item" style="border-color: var(--line) !important;">
                        <div class="d-flex align-items-center gap-3">
                            <div class="rounded-circle bg-danger bg-opacity-10 text-danger p-2"><i class="bi bi-exclamation-triangle-fill"></i></div>
                            <div>
                                <div class="fw-semibold text-white">High Value Transaction</div>
                                <div class="small text-muted">${alert.user_email} · ${money(alert.amount)} · ${(alert.date || "").slice(0, 10)}</div>
                            </div>
                        </div>
                        <button class="btn btn-sm btn-outline-secondary" onclick="dismissAdminAlert('${alert.id}')"><i class="bi bi-check2"></i> Resolve</button>
                    </div>
                `).join("") || `<div class="text-muted small py-3 text-center">No anomalies detected.</div>`;
            };
            window.dismissAdminAlert = async (id) => {
                try {
                    await api(`/api/admin/alerts/${id}/dismiss`, { method: "POST" });
                    loadAdminAlerts();
                } catch(e) { toast(e.message, "danger"); }
            };
            loadAdminAlerts();
        }
    } catch (error) {
        host.innerHTML = `<article class="panel">Admin access required.</article>`;
    }
}

async function setupAdminUsers() {
    const table = document.getElementById("adminUsersTable");
    if (!table) return;
    const exportBtn = document.getElementById("adminExportUsersBtn");
    if (exportBtn) exportBtn.onclick = () => location.href = "/api/admin/users/export";
    
    try {
        const data = await api("/api/admin/users");
        let allUsers = data.items || [];
        
        const renderUsersTable = (usersToRender) => {
            const isLight = document.documentElement.dataset.theme === 'light';
            const dropdownBg = isLight ? '#ffffff' : '#131c2e';
            const dropdownBorder = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)';

            document.getElementById("adminUserCount").textContent = `${usersToRender.length} users registered`;
            table.innerHTML = usersToRender.map((user, index) => {
                const initial = (user.name || user.email || "U").trim().charAt(0).toUpperCase();
                const roleBadge = user.role === 'admin' 
                    ? `<span class="badge-pill admin-role-badge"><i class="bi bi-shield-check"></i> Admin</span>`
                    : `<span class="badge-pill user-role-badge"><i class="bi bi-person"></i> User</span>`;
                const statusBadge = user.status === 'suspended'
                    ? `<span class="badge-pill type-expense"><i class="bi bi-pause-circle"></i> Suspended</span>`
                    : `<span class="badge-pill type-income"><i class="bi bi-check-circle"></i> Active</span>`;
                return `
                    <tr class="animated-row" style="animation-delay: ${index * 0.05}s;">
                        <td>
                            <div class="d-flex align-items-center gap-2">
                                <span class="avatar-circle-sm">${initial}</span>
                                <span class="fw-semibold">${user.name || 'Anonymous'}</span>
                            </div>
                        </td>
                        <td class="text-muted">${user.email}</td>
                        <td>${roleBadge}</td>
                        <td>${statusBadge}</td>
                        <td class="fw-bold text-accent">${user.transactions}</td>
                        <td><span class="date-chip"><i class="bi bi-calendar-event"></i> ${(user.created_at || "").slice(0, 10)}</span></td>
                        <td>
                            <div class="dropdown">
                                <button class="btn btn-sm btn-outline-secondary dropdown-toggle d-flex align-items-center gap-1" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                    <i class="bi bi-gear-fill"></i> Manage
                                </button>
                                <ul class="dropdown-menu dropdown-menu-end admin-dropdown-menu shadow" style="background: ${dropdownBg} !important; background-color: ${dropdownBg} !important; border: 1px solid ${dropdownBorder} !important; opacity: 1 !important;">
                                    <li><button class="dropdown-item" onclick="toggleUserRole('${user._id}', '${user.role === 'admin' ? 'user' : 'admin'}')"><i class="bi bi-shield-check me-2 text-primary"></i> Change to ${user.role === 'admin' ? 'User' : 'Admin'}</button></li>
                                    <li><button class="dropdown-item" onclick="toggleUserStatus('${user._id}', '${user.status === 'suspended' ? 'active' : 'suspended'}')"><i class="bi ${user.status === 'suspended' ? 'bi-check-circle-fill text-success' : 'bi-pause-circle-fill text-warning'} me-2"></i> ${user.status === 'suspended' ? 'Activate Account' : 'Suspend Account'}</button></li>
                                    <li><button class="dropdown-item" onclick="resetUserPassword('${user._id}')"><i class="bi bi-key-fill me-2 text-info"></i> Reset Password</button></li>
                                    <li><hr class="dropdown-divider"></li>
                                    <li><button class="dropdown-item text-danger" onclick="deleteUser('${user._id}')"><i class="bi bi-trash-fill me-2"></i> Delete User</button></li>
                                </ul>
                            </div>
                        </td>
                    </tr>
                `;
            }).join("") || `<tr><td colspan="7" class="text-center p-4 text-muted">No users found.</td></tr>`;
        };

        // Initial render
        renderUsersTable(allUsers);

        // Bind search input filter
        const searchInput = document.getElementById("adminUserSearch");
        if (searchInput) {
            searchInput.addEventListener("input", () => {
                const query = searchInput.value.toLowerCase().trim();
                const filtered = allUsers.filter(user => 
                    (user.name || "").toLowerCase().includes(query) || 
                    (user.email || "").toLowerCase().includes(query)
                );
                renderUsersTable(filtered);
            });
        }

    } catch (err) {
        console.error("Failed to load admin users:", err);
    }
}

window.toggleUserRole = async (id, role) => {
    try {
        await api(`/api/admin/users/${id}/role`, { method: "POST", body: JSON.stringify({ role }) });
        setupAdminUsers();
    } catch (e) { toast(e.message, "danger"); }
};
window.toggleUserStatus = async (id, status) => {
    try {
        await api(`/api/admin/users/${id}/status`, { method: "POST", body: JSON.stringify({ status }) });
        setupAdminUsers();
    } catch (e) { toast(e.message, "danger"); }
};
window.resetUserPassword = async (id) => {
    if(!confirm("Reset password to Temp123! ?")) return;
    try {
        await api(`/api/admin/users/${id}/reset-password`, { method: "POST" });
        toast("Password reset to Temp123!", "success");
    } catch (e) { toast(e.message, "danger"); }
};
window.deleteUser = async (id) => {
    if(!confirm("Are you sure? This deletes ALL user data!")) return;
    try {
        await api(`/api/admin/users/${id}`, { method: "DELETE" });
        setupAdminUsers();
    } catch (e) { toast(e.message, "danger"); }
};

let adminTransactionPage = 1;
async function loadAdminTransactions() {
    const table = document.getElementById("adminTransactionsTable");
    if (!table) return;
    const type = document.getElementById("adminTransactionType").value;
    const exportBtn = document.getElementById("adminExportTxBtn");
    if (exportBtn) exportBtn.onclick = () => location.href = "/api/admin/transactions/export";
    
    const data = await api(`/api/admin/transactions?${qs({ page: adminTransactionPage, type })}`);
    table.innerHTML = data.items.map((item, index) => {
        const typeBadge = item.type === "income" 
            ? `<span class="badge-pill type-income"><i class="bi bi-arrow-up-right-circle"></i> Income</span>`
            : `<span class="badge-pill type-expense"><i class="bi bi-arrow-down-left-circle"></i> Expense</span>`;
        const amountClass = item.type === "income" ? "amount-income" : "amount-expense";
        const categoryEmoji = categoryEmojiMap[item.category] || `🏷️ ${item.category}`;
        return `
            <tr class="animated-row" style="animation-delay: ${index * 0.03}s;">
                <td><span class="date-chip"><i class="bi bi-calendar3"></i> ${(item.date || "").slice(0, 10)}</span></td>
                <td><span class="mono-badge">${item.user_id}</span></td>
                <td class="fw-semibold">${item.description}</td>
                <td><span class="category-pill">${categoryEmoji}</span></td>
                <td>${typeBadge}</td>
                <td class="fw-bold ${amountClass}">${money(item.amount)}</td>
            </tr>
        `;
    }).join("") || `<tr><td colspan="6" class="text-center p-4 text-muted">No transactions found.</td></tr>`;
    document.getElementById("adminTransactionPage").textContent = `Page ${data.page}`;
}

function setupAdminTransactions() {
    if (!document.getElementById("adminTransactionsTable")) return;
    document.getElementById("adminTransactionType").addEventListener("change", () => { adminTransactionPage = 1; loadAdminTransactions(); });
    document.getElementById("adminPrevPage").addEventListener("click", () => { adminTransactionPage = Math.max(1, adminTransactionPage - 1); loadAdminTransactions(); });
    document.getElementById("adminNextPage").addEventListener("click", () => { adminTransactionPage += 1; loadAdminTransactions(); });
    loadAdminTransactions();
}

async function setupAdminReports() {
    const host = document.getElementById("adminReportSummary");
    if (!host) return;
    const data = await api("/api/admin/summary");
    const reports = [
        ["Total Registered Users", data.total_users, "bi-people", "purple"],
        ["Total Recorded Transactions", data.total_transactions, "bi-database", "blue"],
        ["Total Volume Tracked", money(data.total_revenue_tracked), "bi-currency-exchange", "emerald"],
        ["Platform Net Balance", money(data.net_balance_tracked), "bi-cash-coin", "indigo"]
    ];
    host.innerHTML = reports.map(([label, value, icon, color]) => `
        <div class="insight-item ${color}">
            <span class="mini-icon"><i class="bi ${icon}"></i></span>
            <div class="insight-info">
                <strong>${label}</strong>
                <p class="mb-0">${value}</p>
            </div>
        </div>
    `).join("");
}

function setupLandingCounters() {
    document.querySelectorAll("[data-count]").forEach(el => {
        const target = Number(el.dataset.count);
        let current = 0;
        const step = Math.max(1, Math.ceil(target / 40));
        const timer = setInterval(() => {
            current += step;
            el.textContent = Math.min(current, target);
            if (current >= target) clearInterval(timer);
        }, 24);
    });
}

function setupSettings() {
    // Modal mappings for interactive settings cards
    const modalMappings = [
        { btn: "btnOpenProfileModal", backdrop: "profileModalBackdrop", closeBtn: "closeProfileModalBtn", cancelBtn: "cancelProfileModalBtn" },
        { btn: "btnOpenPasswordModal", backdrop: "passwordModalBackdrop", closeBtn: "closePasswordModalBtn", cancelBtn: "cancelPasswordModalBtn" },
        { btn: "btnOpenCurrencyModal", backdrop: "currencyModalBackdrop", closeBtn: "closeCurrencyModalBtn", cancelBtn: "cancelCurrencyModalBtn" },
        { btn: "btnOpenBudgetModal", backdrop: "budgetLimitModalBackdrop", closeBtn: "closeBudgetModalBtn", cancelBtn: "cancelBudgetModalBtn" },
        { btn: "btnOpenAiModal", backdrop: "aiToneModalBackdrop", closeBtn: "closeAiModalBtn", cancelBtn: "cancelAiModalBtn" }
    ];

    modalMappings.forEach(mapping => {
        const btn = document.getElementById(mapping.btn);
        const backdrop = document.getElementById(mapping.backdrop);
        const closeBtn = document.getElementById(mapping.closeBtn);
        const cancelBtn = document.getElementById(mapping.cancelBtn);

        if (btn && backdrop) {
            btn.addEventListener("click", () => {
                backdrop.classList.add("open");
            });

            const close = () => {
                backdrop.classList.remove("open");
            };

            closeBtn?.addEventListener("click", close);
            cancelBtn?.addEventListener("click", close);

            backdrop.addEventListener("click", (e) => {
                if (e.target === backdrop) {
                    close();
                }
            });
        }
    });

    // Handle opening modals via URL parameters (e.g. ?open=password)
    const urlParams = new URLSearchParams(window.location.search);
    const openParam = urlParams.get("open");
    if (openParam) {
        if (openParam === "profile") document.getElementById("profileModalBackdrop")?.classList.add("open");
        if (openParam === "password") document.getElementById("passwordModalBackdrop")?.classList.add("open");
        if (openParam === "currency") document.getElementById("currencyModalBackdrop")?.classList.add("open");
        if (openParam === "budget") document.getElementById("budgetLimitModalBackdrop")?.classList.add("open");
        if (openParam === "ai") document.getElementById("aiToneModalBackdrop")?.classList.add("open");
        if (openParam === "category") document.getElementById("categoryModalBackdrop")?.classList.add("open");
    }

    const profileForm = document.getElementById("profileSettingsForm");
    if (profileForm) {
        profileForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const payload = {
                name: document.getElementById("settingName").value,
                profession: document.getElementById("settingProfession").value,
                monthly_income_goal: parseFloat(document.getElementById("settingIncomeGoal").value || 0),
                risk_profile: document.getElementById("settingRiskProfile").value
            };
            
            try {
                const res = await api("/api/auth/me", {
                    method: "PUT",
                    body: JSON.stringify(payload)
                });
                if (res) {
                    toast("Profile details updated successfully!");
                    document.getElementById("profileModalBackdrop")?.classList.remove("open");
                    setTimeout(() => location.reload(), 800);
                }
            } catch (err) {
                toast(err.message || "Failed to update profile settings", "error");
            }
        });
    }

    const passwordForm = document.getElementById("changePasswordForm");
    if (passwordForm) {
        passwordForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const currentPassword = document.getElementById("currentPasswordInput").value;
            const newPassword = document.getElementById("newPasswordInput").value;
            const confirmNewPassword = document.getElementById("confirmNewPasswordInput").value;
            
            if (newPassword !== confirmNewPassword) {
                toast("New passwords do not match", "error");
                return;
            }
            
            try {
                await api("/api/auth/change-password", {
                    method: "POST",
                    body: JSON.stringify({
                        current_password: currentPassword,
                        new_password: newPassword
                    })
                });
                toast("Password updated successfully!");
                passwordForm.reset();
                document.getElementById("passwordModalBackdrop")?.classList.remove("open");
            } catch (err) {
                toast(err.message || "Failed to update password", "error");
            }
        });
    }

    const currencyForm = document.getElementById("currencySettingsForm");
    if (currencyForm) {
        currencyForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const payload = {
                currency: document.getElementById("settingCurrency").value,
                default_wallet: document.getElementById("settingDefaultWallet").value
            };
            
            try {
                const res = await api("/api/auth/me", {
                    method: "PUT",
                    body: JSON.stringify(payload)
                });
                if (res) {
                    toast("Currency & wallet settings updated successfully!");
                    document.getElementById("currencyModalBackdrop")?.classList.remove("open");
                    setTimeout(() => location.reload(), 800);
                }
            } catch (err) {
                toast(err.message || "Failed to update currency settings", "error");
            }
        });
    }

    const budgetForm = document.getElementById("budgetSettingsForm");
    if (budgetForm) {
        budgetForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const payload = {
                budget_warning_threshold: parseInt(document.getElementById("settingBudgetThreshold").value || 80)
            };
            
            try {
                const res = await api("/api/auth/me", {
                    method: "PUT",
                    body: JSON.stringify(payload)
                });
                if (res) {
                    toast("Budget warning threshold updated successfully!");
                    document.getElementById("budgetLimitModalBackdrop")?.classList.remove("open");
                    setTimeout(() => location.reload(), 800);
                }
            } catch (err) {
                toast(err.message || "Failed to update budget warning threshold", "error");
            }
        });
    }

    const aiForm = document.getElementById("aiSettingsForm");
    if (aiForm) {
        aiForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const payload = {
                ai_tone: document.getElementById("settingAiTone").value
            };
            
            try {
                const res = await api("/api/auth/me", {
                    method: "PUT",
                    body: JSON.stringify(payload)
                });
                if (res) {
                    toast("AI advisor tone updated successfully!");
                    document.getElementById("aiToneModalBackdrop")?.classList.remove("open");
                    setTimeout(() => location.reload(), 800);
                }
            } catch (err) {
                toast(err.message || "Failed to update AI advisor tone", "error");
            }
        });
    }
    
    // Category management
    const categoryList = document.getElementById("categoryListContainer");
    if (categoryList) {
        let activeTab = "expense"; // default
        
        const expenseTabBtn = document.getElementById("expenseTabBtn");
        const incomeTabBtn = document.getElementById("incomeTabBtn");
        
        const renderCategoryList = () => {
            const list = activeTab === "expense" ? (window.fullCategories?.expense || []) : (window.fullCategories?.income || []);
            categoryList.innerHTML = list.map(c => {
                const deleteBtn = c.is_custom 
                    ? `<button class="btn btn-sm btn-ghost delete-cat-btn border-0 bg-transparent text-danger p-1" data-id="${c._id}" type="button"><i class="bi bi-trash"></i></button>`
                    : `<span class="badge bg-secondary-subtle text-muted" style="font-size: 0.72rem;">System</span>`;
                    
                return `<div class="category-list-item reveal">
                    <div class="d-flex align-items-center gap-3">
                        <span class="mini-icon ${c.color}" style="width: 32px; height: 32px; font-size: 0.9rem;"><i class="bi ${c.icon}"></i></span>
                        <div>
                            <strong class="d-block" style="font-size: 0.95rem; color: var(--text);">${c.name}</strong>
                            <small class="text-muted" style="font-size: 0.78rem;">${activeTab === "expense" ? 'Expense' : 'Income'}</small>
                        </div>
                    </div>
                    <div>
                        ${deleteBtn}
                    </div>
                </div>`;
            }).join("");
            
            // Bind delete buttons
            categoryList.querySelectorAll(".delete-cat-btn").forEach(btn => {
                btn.addEventListener("click", async () => {
                    const catId = btn.dataset.id;
                    if (confirm("Are you sure you want to delete this custom category?")) {
                        try {
                            await api(`/api/categories/${catId}`, { method: "DELETE" });
                            toast("Category deleted");
                            await loadCategories();
                            renderCategoryList();
                        } catch (err) {
                            toast(err.message || "Failed to delete category", "error");
                        }
                    }
                });
            });
        };
        
        expenseTabBtn?.addEventListener("click", () => {
            activeTab = "expense";
            expenseTabBtn.classList.add("active", "fw-bold");
            expenseTabBtn.style.setProperty("border-bottom", "2px solid var(--accent)", "important");
            expenseTabBtn.style.color = "var(--text)";
            
            incomeTabBtn.classList.remove("active", "fw-bold");
            incomeTabBtn.style.setProperty("border-bottom", "none", "important");
            incomeTabBtn.style.color = "var(--muted)";
            
            renderCategoryList();
        });
        
        incomeTabBtn?.addEventListener("click", () => {
            activeTab = "income";
            incomeTabBtn.classList.add("active", "fw-bold");
            incomeTabBtn.style.setProperty("border-bottom", "2px solid var(--accent)", "important");
            incomeTabBtn.style.color = "var(--text)";
            
            expenseTabBtn.classList.remove("active", "fw-bold");
            expenseTabBtn.style.setProperty("border-bottom", "none", "important");
            expenseTabBtn.style.color = "var(--muted)";
            
            renderCategoryList();
        });
        
        // Modal hooks
        const modal = document.getElementById("categoryModalBackdrop");
        const openBtn = document.getElementById("openAddCategoryBtn");
        const closeBtn = document.getElementById("closeCategoryModalBtn");
        const cancelBtn = document.getElementById("cancelCategoryModalBtn");
        
        const openModal = () => {
            document.getElementById("categoryForm")?.reset();
            
            // Set default active color and icon
            document.querySelectorAll(".color-grid .color-dot").forEach(dot => {
                dot.classList.toggle("active", dot.dataset.color === "violet");
            });
            document.getElementById("selectedColorVal").value = "violet";
            
            document.querySelectorAll(".icon-grid .icon-choice").forEach(ic => {
                ic.classList.toggle("active", ic.dataset.icon === "bi-tag");
            });
            document.getElementById("selectedIconVal").value = "bi-tag";
            
            modal?.classList.add("open");
        };
        
        openBtn?.addEventListener("click", openModal);
        
        const closeModal = () => modal?.classList.remove("open");
        closeBtn?.addEventListener("click", closeModal);
        cancelBtn?.addEventListener("click", closeModal);
        
        modal?.addEventListener("click", (e) => {
            if (e.target === modal) closeModal();
        });
        
        // Populate color options
        const colorGrid = modal.querySelector(".color-grid");
        const colorTones = ["violet", "blue", "pink", "green", "gold", "rose", "cyan", "teal", "orange"];
        const toneHexMap = {
            violet: "#7c3aed", blue: "#2563eb", pink: "#e11d48", green: "#059669",
            gold: "#f59e0b", rose: "#fda4af", cyan: "#0284c7", teal: "#0d9488", orange: "#f97316"
        };
        if (colorGrid) {
            colorGrid.innerHTML = colorTones.map(tone => {
                return `<div class="color-dot ${tone === 'violet' ? 'active' : ''}" data-color="${tone}" style="background: ${toneHexMap[tone]};"></div>`;
            }).join("");
            
            colorGrid.querySelectorAll(".color-dot").forEach(dot => {
                dot.addEventListener("click", () => {
                    colorGrid.querySelectorAll(".color-dot").forEach(d => d.classList.remove("active"));
                    dot.classList.add("active");
                    document.getElementById("selectedColorVal").value = dot.dataset.color;
                });
            });
        }
        
        // Populate icon options
        const iconGrid = modal.querySelector(".icon-grid");
        const categoryIcons = [
            "bi-tag", "bi-bag", "bi-house-door", "bi-car-front", "bi-airplane", "bi-cup-hot", 
            "bi-basket", "bi-cart3", "bi-gift", "bi-heart", "bi-book", 
            "bi-mortarboard", "bi-briefcase", "bi-scissors", "bi-music-note", "bi-controller", 
            "bi-telephone", "bi-wifi", "bi-lightning", "bi-droplet", "bi-capsule", 
            "bi-activity", "bi-bus-front", "bi-train-front", "bi-fuel-pump", "bi-currency-dollar", 
            "bi-piggy-bank", "bi-wallet2", "bi-credit-card", "bi-cash-stack"
        ];
        if (iconGrid) {
            iconGrid.innerHTML = categoryIcons.map(icon => {
                return `<div class="icon-choice ${icon === 'bi-tag' ? 'active' : ''}" data-icon="${icon}"><i class="bi ${icon}" style="font-size: 1.15rem;"></i></div>`;
            }).join("");
            
            iconGrid.querySelectorAll(".icon-choice").forEach(ic => {
                ic.addEventListener("click", () => {
                    iconGrid.querySelectorAll(".icon-choice").forEach(i => i.classList.remove("active"));
                    ic.classList.add("active");
                    document.getElementById("selectedIconVal").value = ic.dataset.icon;
                });
            });
        }
        
        // Submit Category form
        const categoryForm = document.getElementById("categoryForm");
        categoryForm?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const payload = {
                name: document.getElementById("categoryNameInput").value,
                type: categoryForm.elements["type"].value,
                color: document.getElementById("selectedColorVal").value,
                icon: document.getElementById("selectedIconVal").value
            };
            
            try {
                const res = await api("/api/categories/", {
                    method: "POST",
                    body: JSON.stringify(payload)
                });
                if (res) {
                    toast("Category created successfully!");
                    closeModal();
                    await loadCategories();
                    renderCategoryList();
                }
            } catch (err) {
                toast(err.message || "Failed to create category", "error");
            }
        });
        
        // Wait, render initial list if loaded
        if (window.fullCategories) {
            renderCategoryList();
        } else {
            // Load and render
            loadCategories().then(renderCategoryList);
        }
    }
}


// ── Global reveal observer (all pages) ──────────────────
function initRevealObserver() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("in-view");
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.08, rootMargin: "0px 0px -30px 0px" });

    document.querySelectorAll(".reveal").forEach(el => observer.observe(el));
}

// ── Animated number counter for KPI cards ───────────────
function animateKpiCounters() {
    document.querySelectorAll("[data-kpi-value]").forEach(el => {
        const raw = el.textContent.replace(/[₹,]/g, "").trim();
        const num = parseFloat(raw);
        if (isNaN(num)) return;

        const isCurrency = el.textContent.includes("₹") || el.textContent.includes("$") || el.textContent.includes("€") || el.textContent.includes("£") || el.textContent.includes("¥");
        const isNeg = num < 0;
        const absNum = Math.abs(num);
        const duration = 900;
        const startTime = performance.now();

        const tick = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = absNum * eased;
            const formatted = current.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            el.textContent = (isCurrency ? (window.currencySymbol || "₹") : "") + (isNeg ? "-" : "") + formatted;
            if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    });
}

// ── Staggered animation re-trigger after dynamic content ─
function restaggerChildren(containerId, animName, baseDelayMs = 60, stepMs = 70) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const children = container.children;
    Array.from(children).forEach((child, i) => {
        child.style.animation = "none";
        child.offsetHeight; // reflow
        child.style.animation = "";
        child.style.animationDelay = (baseDelayMs + i * stepMs) + "ms";
    });
}

async function setupInsights() {
    const circle = document.getElementById("healthScoreCircle");
    if (!circle) return;

    const scoreVal = document.getElementById("healthScoreVal");
    const badge = document.getElementById("healthBadge");
    const incomeEl = document.getElementById("healthIncome");
    const expenseEl = document.getElementById("healthExpense");
    const rateEl = document.getElementById("healthSavingsRate");
    const insightsList = document.getElementById("insightsList");
    const chatBox = document.getElementById("advisorChat");

    let userIncome = 0;
    let userExpense = 0;
    let userSavingsRate = 0;

    try {
        const [analyticsData, insightsData] = await Promise.all([
            api("/api/analytics/"),
            api("/api/analytics/insights")
        ]);

        const monthlyIncomeValues = analyticsData?.monthly_income?.values || [];
        const monthlyExpenseValues = analyticsData?.monthly_spending?.values || [];

        userIncome = monthlyIncomeValues.reduce((a, b) => a + b, 0);
        userExpense = monthlyExpenseValues.reduce((a, b) => a + b, 0);
        const netSavings = userIncome - userExpense;
        userSavingsRate = userIncome > 0 ? Math.round((netSavings / userIncome) * 100) : 0;

        if (incomeEl) incomeEl.textContent = money(userIncome);
        if (expenseEl) expenseEl.textContent = money(userExpense);
        if (rateEl) rateEl.textContent = `${userSavingsRate}%`;

        let score = 50;
        if (userIncome > 0) {
            score += Math.min(30, Math.max(0, userSavingsRate * 1.5));
            const expenseRatio = userExpense / userIncome;
            if (expenseRatio < 0.5) score += 20;
            else if (expenseRatio < 0.7) score += 10;
            else if (expenseRatio > 1) score -= 20;
        }
        
        const warningCount = (insightsData?.items || []).filter(item => item.severity === "warning").length;
        score -= warningCount * 10;
        score = Math.min(100, Math.max(10, Math.round(score)));

        setTimeout(() => {
            const circumference = 414.69;
            const offset = circumference - (score / 100) * circumference;
            circle.style.strokeDashoffset = offset;
            
            let current = 0;
            const timer = setInterval(() => {
                current += 1;
                if (scoreVal) scoreVal.textContent = current;
                if (current >= score) {
                    clearInterval(timer);
                    if (scoreVal) scoreVal.textContent = score;
                }
            }, 15);
        }, 300);

        if (badge) {
            badge.className = "health-badge";
            if (score >= 80) {
                badge.textContent = "Excellent";
                badge.classList.add("bg-success", "text-white");
            } else if (score >= 60) {
                badge.textContent = "Good";
                badge.classList.add("bg-info", "text-white");
            } else if (score >= 40) {
                badge.textContent = "Fair";
                badge.classList.add("bg-warning", "text-dark");
            } else {
                badge.textContent = "Needs Review";
                badge.classList.add("bg-danger", "text-white");
            }
        }

        const items = insightsData?.items || [];
        if (insightsList) {
            if (items.length === 0) {
                insightsList.innerHTML = `<div class="text-center py-4 text-muted">No recommendations found. Add some transactions to enable alerts.</div>`;
            } else {
                insightsList.innerHTML = items.map(item => {
                    let toneClass = "theme-info";
                    let iconClass = "bi-info-circle";
                    
                    if (item.severity === "warning") {
                        toneClass = "theme-warning";
                        iconClass = "bi-exclamation-triangle-fill";
                    } else if (item.severity === "success") {
                        toneClass = "theme-success";
                        iconClass = "bi-check-circle-fill";
                    }
                    
                    return `<div class="insight-card-item ${toneClass}">
                        <div class="insight-card-icon"><i class="bi ${iconClass}"></i></div>
                        <div>
                            <h4 class="fw-bold mb-1" style="font-size: 0.95rem; color: var(--text);">${item.title}</h4>
                            <p class="text-muted mb-0" style="font-size: 0.85rem;">${item.message}</p>
                        </div>
                    </div>`;
                }).join("");
            }
        }

    } catch (err) {
        console.error("Error loading insights dashboard:", err);
        if (insightsList) {
            insightsList.innerHTML = `<div class="text-center py-4 text-danger">Failed to load recommendations: ${err.message}</div>`;
        }
    }

    // 5. Multi-session Chat History System
    const userEmail = document.querySelector("[data-profile-email]")?.textContent.trim() || "";
    const userSuffix = userEmail ? "_" + btoa(userEmail).replace(/=/g, "") : "";
    const CHAT_SESSIONS_KEY = "smartfinance_chat_sessions" + userSuffix;
    const CHAT_ACTIVE_KEY = "smartfinance_active_session" + userSuffix;
    let activeSessionId = null;

    function getAllSessions() {
        try {
            const data = localStorage.getItem(CHAT_SESSIONS_KEY);
            return data ? JSON.parse(data) : [];
        } catch(e) { return []; }
    }

    function saveAllSessions(sessions) {
        try { localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(sessions)); } catch(e) {}
    }

    function generateSessionId() {
        return "chat_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
    }

    function getCurrentChatMessages() {
        if (!chatBox) return [];
        const msgs = [];
        chatBox.querySelectorAll(".chat-msg").forEach(el => {
            msgs.push({
                sender: el.classList.contains("chat-msg-user") ? "user" : "advisor",
                html: el.innerHTML
            });
        });
        return msgs;
    }

    function getSessionPreview(msgs) {
        // Get the first user message as preview
        const userMsg = msgs.find(m => m.sender === "user");
        if (userMsg) {
            const temp = document.createElement("div");
            temp.innerHTML = userMsg.html;
            const text = temp.textContent || temp.innerText || "";
            return text.substring(0, 60) + (text.length > 60 ? "..." : "");
        }
        return "New conversation";
    }

    function saveCurrentSession() {
        if (!chatBox) return;
        const msgs = getCurrentChatMessages();
        const hasUserMsg = msgs.some(m => m.sender === "user");
        if (!hasUserMsg) return; // Don't save empty/welcome-only chats

        const sessions = getAllSessions();
        const existingIdx = sessions.findIndex(s => s.id === activeSessionId);
        const sessionData = {
            id: activeSessionId,
            timestamp: existingIdx >= 0 ? sessions[existingIdx].timestamp : Date.now(),
            updatedAt: Date.now(),
            preview: getSessionPreview(msgs),
            messages: msgs
        };

        if (existingIdx >= 0) {
            sessions[existingIdx] = sessionData;
        } else {
            sessions.unshift(sessionData);
        }
        saveAllSessions(sessions);
        try { localStorage.setItem(CHAT_ACTIVE_KEY, activeSessionId); } catch(e) {}
    }

    function loadSession(sessionId) {
        if (!chatBox) return;
        const sessions = getAllSessions();
        const session = sessions.find(s => s.id === sessionId);
        if (!session || !session.messages.length) return;

        chatBox.innerHTML = "";
        session.messages.forEach(m => {
            const el = document.createElement("div");
            el.className = `chat-msg chat-msg-${m.sender}`;
            el.innerHTML = m.html;
            chatBox.appendChild(el);
        });
        chatBox.scrollTop = chatBox.scrollHeight;
        activeSessionId = sessionId;
        try { localStorage.setItem(CHAT_ACTIVE_KEY, sessionId); } catch(e) {}
    }

    function startNewChat() {
        // Save current session first if it has user messages
        saveCurrentSession();
        // Create new session
        activeSessionId = generateSessionId();
        if (chatBox) {
            chatBox.innerHTML = `<div class="chat-msg chat-msg-advisor">Hello! I am your SmartFinance AI Advisor. Click one of the questions below, and I will analyze your local transactions to generate a personalized report.</div>`;
        }
        try { localStorage.setItem(CHAT_ACTIVE_KEY, activeSessionId); } catch(e) {}
        // Close history panel if open
        const panel = document.getElementById("chatHistoryPanel");
        if (panel) panel.style.display = "none";
    }

    function deleteSession(sessionId) {
        let sessions = getAllSessions();
        sessions = sessions.filter(s => s.id !== sessionId);
        saveAllSessions(sessions);
        // If deleted the active session, start a new one
        if (sessionId === activeSessionId) {
            startNewChat();
        }
        renderHistoryPanel();
    }

    function clearAllSessions() {
        saveAllSessions([]);
        startNewChat();
        renderHistoryPanel();
    }

    function formatTimeAgo(ts) {
        const diff = Date.now() - ts;
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return "Just now";
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    }

    function renderHistoryPanel() {
        const listEl = document.getElementById("chatHistoryList");
        if (!listEl) return;

        const sessions = getAllSessions();
        if (sessions.length === 0) {
            listEl.innerHTML = `
                <div class="chat-history-empty">
                    <i class="bi bi-chat-left-dots" style="font-size: 2rem; opacity: 0.3;"></i>
                    <p>No previous chats yet</p>
                </div>`;
            return;
        }

        // Sort by updatedAt descending
        sessions.sort((a, b) => (b.updatedAt || b.timestamp) - (a.updatedAt || a.timestamp));

        listEl.innerHTML = sessions.map(s => {
            const isActive = s.id === activeSessionId;
            const msgCount = s.messages.filter(m => m.sender === "user").length;
            return `
                <div class="chat-history-item ${isActive ? 'active' : ''}" data-session-id="${s.id}">
                    <div class="chat-history-item-info" data-action="load" data-session-id="${s.id}">
                        <div class="chat-history-item-preview">${s.preview || "Conversation"}</div>
                        <div class="chat-history-item-meta">
                            <i class="bi bi-chat-dots me-1"></i>${msgCount} message${msgCount !== 1 ? 's' : ''} · ${formatTimeAgo(s.updatedAt || s.timestamp)}
                        </div>
                    </div>
                    <button class="chat-history-item-delete" data-action="delete" data-session-id="${s.id}" title="Delete">
                        <i class="bi bi-trash3"></i>
                    </button>
                </div>`;
        }).join("");

        // Wire up click events
        listEl.querySelectorAll("[data-action='load']").forEach(el => {
            el.addEventListener("click", () => {
                saveCurrentSession(); // save current first
                loadSession(el.dataset.sessionId);
                document.getElementById("chatHistoryPanel").style.display = "none";
            });
        });
        listEl.querySelectorAll("[data-action='delete']").forEach(el => {
            el.addEventListener("click", (e) => {
                e.stopPropagation();
                deleteSession(el.dataset.sessionId);
            });
        });
    }

    // Initialize: restore last active session or start new
    (function initChatHistory() {
        const savedActiveId = localStorage.getItem(CHAT_ACTIVE_KEY);
        const sessions = getAllSessions();
        if (savedActiveId && sessions.find(s => s.id === savedActiveId)) {
            activeSessionId = savedActiveId;
            loadSession(savedActiveId);
        } else {
            activeSessionId = generateSessionId();
        }
        // Also migrate old single-session format if exists
        const oldData = localStorage.getItem("smartfinance_chat_history");
        if (oldData) {
            try {
                const oldMsgs = JSON.parse(oldData);
                if (Array.isArray(oldMsgs) && oldMsgs.some(m => m.sender === "user")) {
                    const migratedSession = {
                        id: "migrated_" + Date.now(),
                        timestamp: Date.now() - 60000,
                        updatedAt: Date.now() - 60000,
                        preview: getSessionPreview(oldMsgs),
                        messages: oldMsgs
                    };
                    const currentSessions = getAllSessions();
                    currentSessions.push(migratedSession);
                    saveAllSessions(currentSessions);
                }
                localStorage.removeItem("smartfinance_chat_history");
            } catch(e) {}
        }
    })();

    // Wire up buttons
    const historyToggleBtn = document.getElementById("historyToggleBtn");
    const historyPanel = document.getElementById("chatHistoryPanel");
    const historyCloseBtn = document.getElementById("historyCloseBtn");
    const newChatBtn = document.getElementById("newChatBtn");
    const clearAllHistoryBtn = document.getElementById("clearAllHistoryBtn");

    if (historyToggleBtn && historyPanel) {
        historyToggleBtn.addEventListener("click", () => {
            const isOpen = historyPanel.style.display !== "none";
            if (isOpen) {
                historyPanel.style.display = "none";
            } else {
                renderHistoryPanel();
                historyPanel.style.display = "flex";
            }
        });
    }
    if (historyCloseBtn) historyCloseBtn.addEventListener("click", () => { historyPanel.style.display = "none"; });
    if (newChatBtn) newChatBtn.addEventListener("click", startNewChat);
    if (clearAllHistoryBtn) clearAllHistoryBtn.addEventListener("click", clearAllSessions);

    // 6. Chat Advisor presets
    document.querySelectorAll(".chat-preset-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const preset = btn.dataset.preset;
            const questionText = btn.textContent.trim();
            appendChatMessage(questionText, "user");
            handleAdvisorResponse(preset, questionText);
        });
    });

    const inputForm = document.getElementById("chatInputForm");
    const inputText = document.getElementById("chatInputText");
    if (inputForm && inputText) {
        inputForm.addEventListener("submit", event => {
            event.preventDefault();
            const text = inputText.value.trim();
            if (!text) return;
            inputText.value = "";
            
            let preset = "general";
            const lowerText = text.toLowerCase();
            if (lowerText.includes("save") || lowerText.includes("saving") || lowerText.includes("invest") || lowerText.includes("bachat")) {
                preset = "savings";
            } else if (lowerText.includes("spend") || lowerText.includes("expense") || lowerText.includes("kharach") || lowerText.includes("buy")) {
                preset = "spending";
            } else if (lowerText.includes("budget") || lowerText.includes("limit")) {
                preset = "budget";
            }
            
            appendChatMessage(text, "user");
            handleAdvisorResponse(preset, text);
        });
    }

    async function handleAdvisorResponse(preset, questionText) {
        const typingEl = document.createElement("div");
        typingEl.className = "advisor-typing";
        typingEl.id = "advisorTyping";
        typingEl.innerHTML = `<span class="dot-pulse"></span><span class="dot-pulse"></span><span class="dot-pulse"></span>`;
        chatBox.appendChild(typingEl);
        chatBox.scrollTop = chatBox.scrollHeight;

        // Lock input while waiting
        const sendBtn = inputForm ? inputForm.querySelector("button[type=submit]") : null;
        if (inputText) inputText.disabled = true;
        if (sendBtn) sendBtn.disabled = true;

        try {
            const res = await api("/api/analytics/chat", {
                method: "POST",
                body: JSON.stringify({ message: questionText, preset: preset })
            });

            const typingIndicator = document.getElementById("advisorTyping");
            if (typingIndicator) typingIndicator.remove();
            
            if (res && res.reply) {
                appendChatMessage(res.reply, "advisor");
            } else {
                appendChatMessage("I am having trouble processing that right now. Please try again.", "advisor");
            }
        } catch (err) {
            console.error("AI chat error:", err);
            const typingIndicator = document.getElementById("advisorTyping");
            if (typingIndicator) typingIndicator.remove();
            appendChatMessage("⚠️ Could not reach AI Advisor. Please check your connection.", "advisor");
        } finally {
            if (inputText) { inputText.disabled = false; inputText.focus(); }
            if (sendBtn) sendBtn.disabled = false;
        }
    }

    /**
     * Render a chat message with basic Markdown support:
     * **bold**, *italic*, - bullet lists, 1. numbered lists, line breaks
     */
    function renderMarkdown(text) {
        // Escape HTML first for safety (except our own tags)
        let html = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        // Bold and italic
        html = html.replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>");
        html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
        html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");

        // Process lines
        const lines = html.split("\n");
        const outputLines = [];
        let inList = false;
        let listTag = "";

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Bullet list item
            const bulletMatch = line.match(/^[-*•]\s+(.+)/);
            // Numbered list item
            const numberedMatch = line.match(/^\d+\.\s+(.+)/);

            if (bulletMatch) {
                if (!inList || listTag !== "ul") {
                    if (inList) outputLines.push(`</${listTag}>`);
                    outputLines.push(`<ul style="margin:6px 0 6px 18px;padding:0;">`);
                    inList = true; listTag = "ul";
                }
                outputLines.push(`<li style="margin-bottom:3px;">${bulletMatch[1]}</li>`);
            } else if (numberedMatch) {
                if (!inList || listTag !== "ol") {
                    if (inList) outputLines.push(`</${listTag}>`);
                    outputLines.push(`<ol style="margin:6px 0 6px 18px;padding:0;">`);
                    inList = true; listTag = "ol";
                }
                outputLines.push(`<li style="margin-bottom:3px;">${numberedMatch[1]}</li>`);
            } else {
                if (inList) { outputLines.push(`</${listTag}>`); inList = false; listTag = ""; }
                if (line === "") {
                    outputLines.push(`<br>`);
                } else {
                    outputLines.push(`<span>${line}</span><br>`);
                }
            }
        }
        if (inList) outputLines.push(`</${listTag}>`);

        return outputLines.join("").replace(/(<br>)+$/, "");
    }

    function appendChatMessage(text, sender) {
        if (!chatBox) return;
        const msg = document.createElement("div");
        msg.className = `chat-msg chat-msg-${sender}`;
        if (sender === "advisor") {
            msg.innerHTML = renderMarkdown(text);
        } else {
            // User messages: just escape HTML, no markdown rendering needed
            msg.textContent = text;
        }
        chatBox.appendChild(msg);
        chatBox.scrollTop = chatBox.scrollHeight;
        // Save updated history to localStorage
        saveCurrentSession();
    }
}

function setupNavbarSearch() {
    const globalSearch = document.getElementById("globalSearch");
    if (!globalSearch) return;

    // Focus search input when pressing Ctrl+K or Cmd+K
    document.addEventListener("keydown", (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
            e.preventDefault();
            globalSearch.focus();
        }
    });

    // Close autocomplete dropdown on click outside
    document.addEventListener("click", (e) => {
        if (e.target && typeof e.target.closest === "function") {
            if (!e.target.closest(".search-pill")) {
                document.querySelector(".search-autocomplete-dropdown")?.remove();
            }
        }
    });

    const searchOptions = [
        { title: "Dashboard", url: "/dashboard", icon: "bi-house-door", type: "nav" },
        { title: "Transactions", url: "/transactions", icon: "bi-card-checklist", type: "nav" },
        { title: "Budgets", url: "/budgets", icon: "bi-wallet2", type: "nav" },
        { title: "Savings Goals", url: "/goals", icon: "bi-bullseye", type: "nav" },
        { title: "Investments", url: "/investments", icon: "bi-graph-up-arrow", type: "nav" },
        { title: "Analytics", url: "/analytics", icon: "bi-bar-chart", type: "nav" },
        { title: "Reports", url: "/reports", icon: "bi-file-earmark-text", type: "nav" },
        { title: "AI Insights", url: "/insights", icon: "bi-stars", type: "nav" },
        { title: "Settings Dashboard", url: "/settings", icon: "bi-gear", type: "nav" },
        { title: "Profile Details", url: "/settings?open=profile", icon: "bi-person-circle", type: "setting" },
        { title: "Change Password", url: "/settings?open=password", icon: "bi-shield-lock", type: "setting" },
        { title: "Currency & Wallet Settings", url: "/settings?open=currency", icon: "bi-currency-exchange", type: "setting" },
        { title: "Budget Threshold Warning", url: "/settings?open=budget", icon: "bi-bell-fill", type: "setting" },
        { title: "AI Advisor Tone", url: "/settings?open=ai", icon: "bi-stars", type: "setting" },
        { title: "Add Custom Category", url: "/settings?open=category", icon: "bi-tags-fill", type: "setting" },
        { title: "Chat with Creator", url: "/chat", icon: "bi-chat-left-text", type: "nav" }
    ];

    globalSearch.addEventListener("input", () => {
        const query = globalSearch.value.toLowerCase().trim();

        // Remove existing dropdown first
        document.querySelector(".search-autocomplete-dropdown")?.remove();

        // Apply local page filters (hides/shows items on page directly)
        applyLocalPageFilters(query);

        if (!query) return;

        // Find matches
        const matches = searchOptions.filter(opt => opt.title.toLowerCase().includes(query));
        if (matches.length === 0) return;

        const dropdown = document.createElement("div");
        dropdown.className = "search-autocomplete-dropdown";

        // Group matches
        const navMatches = matches.filter(m => m.type === "nav");
        const settingMatches = matches.filter(m => m.type === "setting");

        let html = "";
        if (navMatches.length > 0) {
            html += `<div class="search-autocomplete-header">Navigation</div>`;
            navMatches.forEach(item => {
                html += `<a href="${item.url}" class="search-autocomplete-item">
                    <i class="bi ${item.icon}"></i>
                    <span>${item.title}</span>
                </a>`;
            });
        }

        if (settingMatches.length > 0) {
            html += `<div class="search-autocomplete-header">Settings Shortcuts</div>`;
            settingMatches.forEach(item => {
                html += `<a href="${item.url}" class="search-autocomplete-item">
                    <i class="bi ${item.icon}"></i>
                    <span>${item.title}</span>
                </a>`;
            });
        }

        dropdown.innerHTML = html;

        // Bind clicks on links to open settings modals instantly if already on settings page
        const isSettingsPage = window.location.pathname.includes("/settings");
        if (isSettingsPage) {
            dropdown.querySelectorAll(".search-autocomplete-item").forEach(el => {
                const href = el.getAttribute("href");
                if (href.includes("/settings?open=")) {
                    el.addEventListener("click", (e) => {
                        e.preventDefault();
                        dropdown.remove();
                        globalSearch.value = "";
                        // Clear active list filters
                        applyLocalPageFilters("");
                        
                        const openParam = href.split("=")[1];
                        // Close all modal backdrops first
                        document.querySelectorAll(".modal-backdrop").forEach(backdrop => backdrop.classList.remove("open"));
                        // Open the target modal
                        if (openParam === "profile") document.getElementById("profileModalBackdrop")?.classList.add("open");
                        if (openParam === "password") document.getElementById("passwordModalBackdrop")?.classList.add("open");
                        if (openParam === "currency") document.getElementById("currencyModalBackdrop")?.classList.add("open");
                        if (openParam === "budget") document.getElementById("budgetLimitModalBackdrop")?.classList.add("open");
                        if (openParam === "ai") document.getElementById("aiToneModalBackdrop")?.classList.add("open");
                        if (openParam === "category") document.getElementById("categoryModalBackdrop")?.classList.add("open");
                    });
                }
            });
        }

        document.querySelector(".search-pill")?.appendChild(dropdown);
    });

    function applyLocalPageFilters(query) {
        // 2. Settings page local search & filter logic
        const categoryListContainer = document.getElementById("categoryListContainer");
        const isSettingsPage = !!categoryListContainer || !!document.getElementById("btnOpenProfileModal");
        if (isSettingsPage) {
            // Filter settings cards
            document.querySelectorAll(".setting-item-card").forEach(card => {
                const text = card.textContent.toLowerCase();
                if (text.includes(query)) {
                    card.style.setProperty("display", "flex", "important");
                } else {
                    card.style.setProperty("display", "none", "important");
                }
            });

            // Filter Category items
            if (categoryListContainer) {
                categoryListContainer.querySelectorAll(".category-list-item").forEach(item => {
                    const text = item.textContent.toLowerCase();
                    if (text.includes(query)) {
                        item.style.setProperty("display", "flex", "important");
                    } else {
                        item.style.setProperty("display", "none", "important");
                    }
                });
            }
            return;
        }

        // 3. Budgets page local search & filter logic
        const budgetsContainer = document.getElementById("budgetsContainer");
        if (budgetsContainer) {
            const children = budgetsContainer.children;
            Array.from(children).forEach(child => {
                const text = child.textContent.toLowerCase();
                if (text.includes(query)) {
                    child.style.setProperty("display", "block", "important");
                } else {
                    child.style.setProperty("display", "none", "important");
                }
            });
            return;
        }

        // 4. Savings Goals page local search & filter logic
        const goalsContainer = document.getElementById("goalsContainer");
        if (goalsContainer) {
            const children = goalsContainer.children;
            Array.from(children).forEach(child => {
                const text = child.textContent.toLowerCase();
                if (text.includes(query)) {
                    child.style.setProperty("display", "block", "important");
                } else {
                    child.style.setProperty("display", "none", "important");
                }
            });
            return;
        }

        // 5. Investments page local search & filter logic
        const investmentsList = document.getElementById("investmentsList");
        if (investmentsList) {
            investmentsList.querySelectorAll("tr").forEach(row => {
                const text = row.textContent.toLowerCase();
                if (text.includes(query)) {
                    row.style.display = "";
                } else {
                    row.style.display = "none";
                }
            });
            return;
        }

        // 6. Dashboard page local search & filter logic (Recent Transactions, Budgets, Goals, AI Insights)
        const recentTransactionList = document.getElementById("recentTransactionList");
        if (recentTransactionList) {
            recentTransactionList.querySelectorAll(".transaction-item").forEach(item => {
                const text = item.textContent.toLowerCase();
                if (text.includes(query)) {
                    item.style.setProperty("display", "flex", "important");
                } else {
                    item.style.setProperty("display", "none", "important");
                }
            });
        }

        const budgetAlerts = document.getElementById("budgetAlerts");
        if (budgetAlerts) {
            budgetAlerts.querySelectorAll(".budget-row").forEach(item => {
                const text = item.textContent.toLowerCase();
                if (text.includes(query)) {
                    item.style.setProperty("display", "flex", "important");
                } else {
                    item.style.setProperty("display", "none", "important");
                }
            });
        }

        const goalsPanel = document.querySelector(".goals-panel .goal-stack");
        if (goalsPanel) {
            goalsPanel.querySelectorAll(".goal-row").forEach(item => {
                const text = item.textContent.toLowerCase();
                if (text.includes(query)) {
                    item.style.setProperty("display", "flex", "important");
                } else {
                    item.style.setProperty("display", "none", "important");
                }
            });
        }

        const insightList = document.getElementById("insightList");
        if (insightList) {
            insightList.querySelectorAll(".insight-item").forEach(item => {
                const text = item.textContent.toLowerCase();
                if (text.includes(query)) {
                    item.style.setProperty("display", "flex", "important");
                } else {
                    item.style.setProperty("display", "none", "important");
                }
            });
        }
    }
}

function setupAdminNavbarSearch() {
    const adminGlobalSearch = document.getElementById("adminGlobalSearch");
    if (!adminGlobalSearch) return;

    // Focus search input when pressing Ctrl+K or Cmd+K
    document.addEventListener("keydown", (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
            e.preventDefault();
            adminGlobalSearch.focus();
        }
    });

    // Close autocomplete dropdown on click outside
    document.addEventListener("click", (e) => {
        if (e.target && typeof e.target.closest === "function") {
            if (!e.target.closest(".search-pill")) {
                document.querySelector(".search-autocomplete-dropdown")?.remove();
            }
        }
    });

    const adminSearchOptions = [
        { title: "Overview", url: "/admin/dashboard", icon: "bi-command" },
        { title: "Users", url: "/admin/users", icon: "bi-people" },
        { title: "Transactions", url: "/admin/transactions", icon: "bi-database-check" },
        { title: "Reports", url: "/admin/reports", icon: "bi-file-earmark-bar-graph" },
        { title: "Exit to User App", url: "/dashboard", icon: "bi-arrow-left-circle" }
    ];

    adminGlobalSearch.addEventListener("input", () => {
        const query = adminGlobalSearch.value.toLowerCase().trim();

        // Remove existing dropdown first
        document.querySelector(".search-autocomplete-dropdown")?.remove();

        if (!query) return;

        // Find matches
        const matches = adminSearchOptions.filter(opt => opt.title.toLowerCase().includes(query));
        if (matches.length === 0) return;

        const dropdown = document.createElement("div");
        dropdown.className = "search-autocomplete-dropdown";

        let html = "";
        html += `<div class="search-autocomplete-header">Operations</div>`;
        matches.forEach(item => {
            html += `<a href="${item.url}" class="search-autocomplete-item">
                <i class="bi ${item.icon}"></i>
                <span>${item.title}</span>
            </a>`;
        });

        dropdown.innerHTML = html;
        adminGlobalSearch.closest(".search-pill")?.appendChild(dropdown);
    });
}

function timeAgo(dateInput) {
    const date = new Date(dateInput);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "yesterday";
    return `${days}d ago`;
}

async function loadNotifications() {
    const listContainer = document.getElementById("notificationList");
    const countBadge = document.getElementById("notificationCount");
    const markAllBtn = document.getElementById("markAllReadBtn");
    
    if (!listContainer) return;

    try {
        const data = await api("/api/notifications/");
        // Only show unread notifications in the dropdown menu
        const items = (data.items || []).filter(item => !item.is_read);
        const unreadCount = data.unread || 0;

        // Update Badge
        if (unreadCount > 0) {
            countBadge.textContent = unreadCount;
            countBadge.classList.remove("d-none");
        } else {
            countBadge.classList.add("d-none");
        }

        // Render items
        if (items.length === 0) {
            listContainer.innerHTML = `
                <div class="notification-empty">
                    <i class="bi bi-bell-slash"></i>
                    <span>All caught up! No notifications.</span>
                </div>
            `;
            if (markAllBtn) markAllBtn.style.display = "none";
            return;
        }

        if (markAllBtn) {
            markAllBtn.style.display = unreadCount > 0 ? "block" : "none";
            markAllBtn.onclick = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const unreadItems = listContainer.querySelectorAll(".notification-item.unread");
                const promises = Array.from(unreadItems).map(el => {
                    const id = el.dataset.id;
                    return api(`/api/notifications/${id}/read`, { method: "PUT" });
                });
                
                if (promises.length > 0) {
                    try {
                        await Promise.all(promises);
                        loadNotifications();
                    } catch (err) {
                        console.error("Failed to mark all read:", err);
                    }
                }
            };
        }

        listContainer.innerHTML = items.map(item => {
            const severity = item.severity || "info";
            const isUnread = !item.is_read;
            
            let icon = "bi-info-circle-fill";
            if (severity === "warning") icon = "bi-exclamation-triangle-fill";
            else if (severity === "danger") icon = "bi-x-circle-fill";
            else if (severity === "success") icon = "bi-check-circle-fill";

            return `
                <div class="notification-item ${isUnread ? 'unread' : ''}" data-id="${item._id}">
                    <div class="notification-icon-wrap ${severity}">
                        <i class="bi ${icon}"></i>
                    </div>
                    <div class="notification-content">
                        <div class="notification-title">${item.title || "Notification"}</div>
                        <div class="notification-desc">${item.message || ""}</div>
                        <div class="notification-time">${timeAgo(item.created_at)}</div>
                    </div>
                </div>
            `;
        }).join("");

        // Add click events to items
        listContainer.querySelectorAll(".notification-item").forEach(el => {
            el.addEventListener("click", async () => {
                const id = el.dataset.id;
                if (el.classList.contains("unread")) {
                    try {
                        await api(`/api/notifications/${id}/read`, { method: "PUT" });
                        el.classList.remove("unread");
                        loadNotifications();
                    } catch (err) {
                        console.error("Failed to mark read:", err);
                    }
                }
            });
        });

    } catch (err) {
        console.error("Failed to load notifications:", err);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    setupNavbarSearch();
    setupAdminNavbarSearch();
    setupShell();
    setGreeting();
    setupProfile();
    setupAuth();
    loadNotifications();
    setInterval(loadNotifications, 60000);
    
    // Dynamically load custom categories before initializing transactions and budgets
    await loadCategories();
    
    setupDashboard();
    setupDashboardCalendar();
    setupTransactions();
    setupBudgets();
    setupGoals();
    setupAnalytics();
    setupReports();
    setupInsights();
    setupSettings();
    setupAdmin();
    setupAdminUsers();
    setupAdminTransactions();
    setupAdminReports();
    setupLandingCounters();

    // Global reveal observer
    initRevealObserver();

    // KPI counter animation on dashboard
    setTimeout(animateKpiCounters, 400);

    // Re-observe after any dynamic content renders
    setTimeout(initRevealObserver, 1200);
});

