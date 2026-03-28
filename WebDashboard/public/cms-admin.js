/**
 * AeroTwin XR - Luxury CMS Admin Engine (V4)
 * Handles section-based rendering, visual grouping, and premium data management.
 */

let activeCmsPage = 'home';
let cmsFullData = [];
let unsavedChanges = new Map();

// Configuration for section grouping
const SECTION_MAP = {
    'hero': { title: 'Hero & Introduction', icon: '🚀' },
    'feat': { title: 'Product Features', icon: '💎' },
    'about': { title: 'Mission & History', icon: 'ℹ️' },
    'price': { title: 'Pricing & Licensing', icon: '💰' },
    'news': { title: 'Latest Updates', icon: '📰' },
    'stat': { title: 'System Growth & Stats', icon: '📊' },
    'contact': { title: 'Contact & Support', icon: '📧' },
    'foot': { title: 'Global Footer & Legal', icon: '⚖️' },
    'index': { title: 'Homepage Highlights', icon: '🏠' }
};

const PAGE_LABELS = {
    'home': '🏠 Homepage',
    'features': '🚀 Features',
    'about': 'ℹ️ About Us',
    'pricing': '💰 Pricing',
    'news': '📰 News Hub',
    'contact': '📧 Contact',
    'global': '🌐 Global / Footer'
};

// ─── CORE CMS LOGIC ───

async function loadCmsContent() {
    const editor = document.getElementById('cmsEditor');
    try {
        const res = await fetch('/api/admin/raw-content', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!res.ok) throw new Error('API_UNAVAILABLE');
        
        cmsFullData = await res.json();
        
        updateCmsSidebar();
        renderCmsPage(activeCmsPage);
    } catch (err) {
        console.error("CMS Load Error:", err);
        editor.innerHTML = `<div class="loading-state text-danger">Lost connection to Mission Control. Please re-authenticate.</div>`;
    }
}

function updateCmsSidebar() {
    const sidebar = document.getElementById('cmsPageSidebar');
    sidebar.innerHTML = '<div style="padding: 0 10px 15px; font-size: 11px; text-transform: uppercase; color: var(--text-dim); font-weight: 800; letter-spacing: 2px;">Core Divisions</div>';
    
    // Get unique pages from settings + data
    const pages = Object.keys(PAGE_LABELS);
    
    pages.forEach(p => {
        const count = cmsFullData.filter(item => item.page === p).length;
        const btn = document.createElement('button');
        btn.className = `cms-sidebar-btn ${p === activeCmsPage ? 'active' : ''}`;
        btn.innerHTML = `<span>${PAGE_LABELS[p]}</span> <span class="badge">${count}</span>`;
        btn.onclick = () => switchCmsPage(p);
        sidebar.appendChild(btn);
    });

    // Add Action Buttons
    const actionContainer = document.createElement('div');
    actionContainer.style.marginTop = 'auto';
    actionContainer.style.paddingTop = '20px';
    actionContainer.style.display = 'flex';
    actionContainer.style.flexDirection = 'column';
    actionContainer.style.gap = '10px';

    actionContainer.innerHTML = `
        <div style="font-size: 10px; color: var(--accent-cyan); font-weight: 800; text-transform: uppercase; opacity: 0.6;">Sync Operations</div>
        <button onclick="syncCmsDefaults()" class="btn-secondary" style="width: 100%; font-size: 11px; padding: 12px;">🔄 Re-Seed Defaults</button>
        <a href="index.html" target="_blank" class="btn-primary" style="width: 100%; font-size: 11px; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 5px; padding: 12px; border-radius: 12px;">🌐 Live Preview</a>
    `;
    sidebar.appendChild(actionContainer);
}

function switchCmsPage(page) {
    if (unsavedChanges.size > 0 && !confirm("Unsaved tactical data will be lost. Proceed?")) return;
    activeCmsPage = page;
    unsavedChanges.clear();
    updateUnsavedIndicator();
    updateCmsSidebar();
    renderCmsPage(page);
}

function renderCmsPage(page) {
    const container = document.getElementById('cmsEditor');
    const search = document.getElementById('cmsSearch').value.toLowerCase();
    container.innerHTML = '';
    
    let filtered = cmsFullData.filter(item => item.page === page);
    if (search) {
        filtered = filtered.filter(i => i.key.includes(search) || (i.content || '').toLowerCase().includes(search));
    }

    if (filtered.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 100px; color: var(--text-dim); font-family: var(--font-heading);">NO DATA IN THIS DIVISION</div>`;
        return;
    }

    // Group items into sections
    const groups = {};
    filtered.forEach(item => {
        const prefix = item.key.split('-')[0].substring(0, 4); // basic heuristic
        const sectionKey = Object.keys(SECTION_MAP).find(k => item.key.startsWith(k)) || 'other';
        if (!groups[sectionKey]) groups[sectionKey] = [];
        groups[sectionKey].push(item);
    });

    // Render groups
    Object.keys(groups).forEach(sKey => {
        const config = SECTION_MAP[sKey] || { title: 'Other Content', icon: '📂' };
        const section = document.createElement('div');
        section.className = 'cms-section-group';
        
        section.innerHTML = `
            <div class="cms-section-header">
                <div class="cms-section-icon">${config.icon}</div>
                <div class="cms-section-title">${config.title}</div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 15px;"></div>
        `;
        
        const list = section.querySelector('div:last-child');
        groups[sKey].forEach(item => list.appendChild(createPremiumCard(item)));
        
        container.appendChild(section);
    });
}

function createPremiumCard(item) {
    const card = document.createElement('div');
    card.className = 'cms-premium-card';
    
    // Label normalization
    let label = item.key.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const isLong = item.content && item.content.length > 50;

    card.innerHTML = `
        <div class="cms-meta">
            <span class="cms-friendly-label">${label}</span>
            <span class="cms-tech-key">${item.key}</span>
        </div>
        <div class="cms-input-wrapper">
            ${isLong ? 
                `<textarea class="cms-luxury-input cms-luxury-textarea" oninput="trackChange('${item.key}', this.value)">${item.content}</textarea>` :
                `<input type="text" class="cms-luxury-input" value="${item.content}" oninput="trackChange('${item.key}', this.value)">`
            }
        </div>
        <div class="cms-card-actions">
            <button class="btn-icon" onclick="deleteEntry('${item.key}')" style="color: #ff3333; font-size: 11px; opacity: 0.5;">🗑 Delete Entry</button>
        </div>
    `;
    return card;
}

function trackChange(key, val) {
    const original = cmsFullData.find(i => i.key === key);
    if (original.content === val) unsavedChanges.delete(key);
    else unsavedChanges.set(key, { ...original, content: val });
    updateUnsavedIndicator();
}

function updateUnsavedIndicator() {
    const indicator = document.getElementById('cmsFloatingActions');
    const count = document.getElementById('cmsUnsavedCount');
    if (unsavedChanges.size > 0) {
        indicator.classList.add('visible');
        count.innerText = `${unsavedChanges.size} Updates Staged`;
    } else {
        indicator.classList.remove('visible');
    }
}

async function saveCmsContent() {
    const btn = document.querySelector('#cmsFloatingActions .btn-primary');
    const originalText = btn.innerText;
    try {
        btn.innerText = 'Syncing...';
        btn.disabled = true;

        const updatedMap = new Map();
        cmsFullData.forEach(i => updatedMap.set(i.key, i));
        unsavedChanges.forEach((v, k) => updatedMap.set(k, v));

        const res = await fetch('/api/admin/content', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ items: Array.from(updatedMap.values()) })
        });

        if (res.ok) {
            cmsFullData = Array.from(updatedMap.values());
            unsavedChanges.clear();
            updateUnsavedIndicator();
            updateCmsSidebar();
            btn.innerText = '✅ Synced';
            setTimeout(() => { btn.innerText = originalText; btn.disabled = false; }, 2000);
        }
    } catch (err) {
        alert("Sync failed. Check connection.");
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

async function deleteEntry(key) {
    if (!confirm(`Delete ${key} permanently from database?`)) return;
    const res = await fetch(`/api/admin/content/${key}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (res.ok) loadCmsContent();
}

function addNewCmsRow() {
    const key = prompt("Enter Unique Key (e.g., home-hero-title):");
    if (!key || cmsFullData.some(i => i.key === key)) return alert("Invalid or duplicate key.");
    const newItem = { page: activeCmsPage, key: key, content: "" };
    cmsFullData.unshift(newItem);
    renderCmsPage(activeCmsPage);
}

async function syncCmsDefaults() {
    if (!confirm("Re-seeding will wipe existing content and apply defaults. Continue?")) return;
    await fetch('/api/admin/seed', { headers: { 'Authorization': `Bearer ${authToken}` } });
    loadCmsContent();
}
