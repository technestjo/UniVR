/**
 * AeroTwin XR - TechNest Style CMS Engine
 * Structured, form-based, array-supporting logic.
 */

let activeTnPage = 'home';
let tnFullData = {}; // Object matching key -> content for easy access
let rawDataArray = [];

// ─── CMS SCHEMA DEFINITION ───
// This schema drives the entire UI exactly like the TechNest layout.
const TN_SCHEMA = {
    home: {
        title: "Home Page Content",
        sections: [
            {
                id: "home-hero",
                title: "Hero Section",
                type: "fixed",
                fields: [
                    { key: "index-hero-title", label: "Title", type: "text", width: "100%" },
                    { key: "index-hero-desc", label: "Subtitle", type: "textarea", width: "100%" },
                    { key: "index-btn-primary", label: "CTA 1", type: "text", width: "50%" },
                    { key: "index-btn-secondary", label: "CTA 2", type: "text", width: "50%" },
                    { key: "index-video-src", label: "Background Video URL (.mp4)", type: "text", width: "100%" }
                ]
            },
            {
                id: "home-features",
                title: "Platform Features",
                type: "array",
                arrayKey: "home-features-array",
                defaultItem: { title: "New Feature", desc: "Description...", icon: "⚡" },
                fields: [
                    { key: "title", label: "Title", type: "text", width: "100%" },
                    { key: "desc", label: "Description", type: "textarea", width: "100%" },
                    { key: "icon", label: "Icon Name / Emoji", type: "text", width: "50%" }
                ]
            },
            {
                id: "home-stats",
                title: "Impact Statistics",
                type: "array",
                arrayKey: "home-stats-array",
                defaultItem: { val: "100+", label: "New Stat" },
                fields: [
                    { key: "val", label: "Statistic Value", type: "text", width: "50%" },
                    { key: "label", label: "Label", type: "text", width: "50%" }
                ]
            },
            {
                id: "home-cta",
                title: "Bottom Action Banner",
                type: "fixed",
                fields: [
                    { key: "home-cta-title", label: "Banner Title", type: "text", width: "100%" },
                    { key: "home-cta-desc", label: "Banner Subtitle", type: "textarea", width: "100%" }
                ]
            }
        ]
    },
    features: {
        title: "Features Page Content",
        sections: [
            {
                id: "feat-hero",
                title: "Hero Section",
                type: "fixed",
                fields: [
                    { key: "features-hero-title", label: "Title", type: "text", width: "100%" },
                    { key: "features-hero-desc", label: "Subtitle", type: "textarea", width: "100%" }
                ]
            },
            {
                id: "feat-detailed",
                title: "Detailed Capabilities",
                type: "array",
                arrayKey: "features-detailed-array",
                defaultItem: { title: "System", desc: "Details", icon: "⚙️" },
                fields: [
                    { key: "title", label: "Title", type: "text", width: "100%" },
                    { key: "desc", label: "Description", type: "textarea", width: "100%" },
                    { key: "icon", label: "Icon Name", type: "text", width: "50%" }
                ]
            }
        ]
    },
    about: {
        title: "About Us Content",
        sections: [
            {
                id: "about-hero",
                title: "Hero Banner",
                type: "fixed",
                fields: [
                    { key: "about-hero-title", label: "Headline", type: "text", width: "100%" },
                    { key: "about-hero-desc", label: "Subtitle", type: "text", width: "100%" }
                ]
            },
            {
                id: "about-mission",
                title: "Our Mission Statement",
                type: "fixed",
                fields: [
                    { key: "about-mission-title", label: "Section Title", type: "text", width: "100%" },
                    { key: "about-mission-p1", label: "Paragraph 1", type: "textarea", width: "100%" },
                    { key: "about-mission-p2", label: "Paragraph 2", type: "textarea", width: "100%" },
                    { key: "about-mission-img", label: "Side Image URL", type: "text", width: "100%" }
                ]
            },
            {
                id: "about-team",
                title: "Our Team",
                type: "array",
                arrayKey: "about-team-array",
                defaultItem: { name: "Name", role: "Role", bio: "Bio..." },
                fields: [
                    { key: "name", label: "Name", type: "text", width: "50%" },
                    { key: "role", label: "Role", type: "text", width: "50%" },
                    { key: "bio", label: "Bio", type: "textarea", width: "100%" }
                ]
            }
        ]
    },
    pricing: {
        title: "Pricing Plans Content",
        sections: [
            {
                id: "price-hero",
                title: "Pricing Header",
                type: "fixed",
                fields: [
                    { key: "pricing-title", label: "Title", type: "text", width: "100%" }
                ]
            },
            {
                id: "price-tiers",
                title: "Subscription Tiers",
                type: "array",
                arrayKey: "pricing-tiers-array",
                defaultItem: { name: "New Plan", price: "$99", details: "Feature 1\nFeature 2" },
                fields: [
                    { key: "name", label: "Plan Name", type: "text", width: "50%" },
                    { key: "price", label: "Price", type: "text", width: "50%" },
                    { key: "details", label: "Features (One per line)", type: "textarea", width: "100%" }
                ]
            }
        ]
    },
    updates: {
        title: "Platform Updates Content",
        sections: [
            {
                id: "updates-hero",
                title: "Updates Header",
                type: "fixed",
                fields: [
                    { key: "updates-title", label: "Page Title", type: "text", width: "100%" },
                    { key: "updates-desc", label: "Description", type: "textarea", width: "100%" }
                ]
            },
            {
                id: "updates-list",
                title: "Release Notes",
                type: "array",
                arrayKey: "updates-array",
                defaultItem: { version: "Version 1.0", date: "Jan 1, 2026", badgeClass: "badge-green", badgeText: "LATEST", intro: "Main release info...", features: "Feature 1\nFeature 2", fixes: "Bug 1\nBug 2" },
                fields: [
                    { key: "version", label: "Version/Title", type: "text", width: "50%" },
                    { key: "date", label: "Release Date", type: "text", width: "50%" },
                    { key: "badgeText", label: "Badge Text (e.g. LATEST, STABLE)", type: "text", width: "50%" },
                    { key: "badgeClass", label: "Badge Color (badge-green, badge-orange, badge-red)", type: "text", width: "50%" },
                    { key: "intro", label: "Intro Paragraph", type: "textarea", width: "100%" },
                    { key: "features", label: "New Features (One per line)", type: "textarea", width: "100%" },
                    { key: "fixes", label: "Bug Fixes (One per line)", type: "textarea", width: "100%" }
                ]
            }
        ]
    },
    news: {
        title: "News & Blog Content",
        sections: [
            {
                id: "news-articles",
                title: "Latest Announcements",
                type: "array",
                arrayKey: "news-articles-array",
                defaultItem: { title: "New Update", date: "Jan 1, 2026", desc: "Short summary...", image: "assets/placeholder.jpg", fullContent: "Full details here..." },
                fields: [
                    { key: "title", label: "Article Title", type: "text", width: "100%" },
                    { key: "date", label: "Date", type: "text", width: "50%" },
                    { key: "image", label: "Image URL", type: "text", width: "50%" },
                    { key: "desc", label: "Short Summary", type: "textarea", width: "100%" },
                    { key: "fullContent", label: "Full Article Content", type: "textarea", width: "100%" }
                ]
            }
        ]
    },
    leaderboard: {
        title: "Leaderboard Content",
        sections: [
            {
                id: "lb-hero",
                title: "Leaderboard Header",
                type: "fixed",
                fields: [
                    { key: "leaderboard-visible", label: "Show Leaderboard Ranking Table?", type: "text", width: "100%", placeholder: "Type 'yes' to show, 'no' to hide" },
                    { key: "leaderboard-title", label: "Title", type: "text", width: "100%" },
                    { key: "leaderboard-desc", label: "Description", type: "textarea", width: "100%" }
                ]
            }
        ]
    },
    global: {
        title: "Global Website Settings",
        sections: [
            {
                id: "global-footer",
                title: "Footer Information",
                type: "fixed",
                fields: [
                    { key: "footer-copyright", label: "Copyright Text", type: "text", width: "100%" },
                    { key: "footer-status", label: "System Status Text", type: "text", width: "100%" }
                ]
            }
        ]
    }
};

// ─── INITIALIZATION ───

async function loadCmsContent() {
    try {
        const res = await fetch('/api/admin/raw-content', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!res.ok) throw new Error('API Error');
        
        rawDataArray = await res.json();
        
        // Convert array to fast accessible dictionary
        tnFullData = {};
        rawDataArray.forEach(item => {
            tnFullData[item.key] = item.content;
        });

        tnRenderPage(activeTnPage);
    } catch (err) {
        console.error("CMS Load Failed:", err);
        document.getElementById('tnFormContainer').innerHTML = '<div style="color:red; padding:20px;">Failed to load. Check console.</div>';
    }
}

// ─── RENDERING ENGINE ───

function tnSwitchPage(pageId) {
    activeTnPage = pageId;

    // Update Sidebar UI
    document.querySelectorAll('.cms-sub-btn').forEach(btn => btn.classList.remove('active'));
    
    // Safely add active class if button exists
    const activeBtn = document.querySelector(`.cms-sub-btn[onclick="tnSwitchPage('${pageId}')"]`);
    if (activeBtn) activeBtn.classList.add('active');

    tnRenderPage(pageId);
}

function tnRenderPage(pageId) {
    const config = TN_SCHEMA[pageId];
    if (!config) return;

    // Set Page Title
    document.getElementById('tnPageTitle').innerText = config.title;

    const container = document.getElementById('tnFormContainer');
    container.innerHTML = ''; // Clear

    config.sections.forEach(section => {
        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'tn-section';
        
        // Build Header
        let headerHtml = `<div class="tn-section-header"><h2>${section.title}</h2>`;
        if (section.type === 'array') {
            headerHtml += `<button class="tn-btn-pill" onclick="tnAddArrayItem('${pageId}', '${section.id}')">+ Add Service</button>`;
        }
        headerHtml += `</div>`;
        sectionDiv.innerHTML = headerHtml;

        // Build Body
        const bodyDiv = document.createElement('div');
        bodyDiv.className = 'tn-section-body';
        bodyDiv.id = `tn-sec-body-${section.id}`;
        
        if (section.type === 'fixed') {
            bodyDiv.innerHTML = buildFieldsHtml(section.fields, tnFullData);
            bodyDiv.innerHTML += `<button class="tn-btn-save" onclick="tnSaveSection('${section.id}')">💾 Save Changes</button>`;
        } else if (section.type === 'array') {
            bodyDiv.innerHTML = buildArrayHtml(section);
            bodyDiv.innerHTML += `<div style="margin-top:20px;"><button class="tn-btn-save" onclick="tnSaveArraySection('${section.id}')">💾 Save Array Changes</button></div>`;
        }

        sectionDiv.appendChild(bodyDiv);
        container.appendChild(sectionDiv);
    });
}

// ─── FIELD BUILDERS ───

function buildFieldsHtml(fields, sourceData, arrayIndex = null) {
    let html = `<div class="tn-flex-row">`;
    fields.forEach(field => {
        const fieldId = arrayIndex !== null ? `field-${field.key}-${arrayIndex}` : field.key;
        const val = sourceData ? (sourceData[field.key] || '') : '';
        const width = field.width || "100%";
        
        html += `<div class="tn-form-group" style="width: calc(${width} - 10px);">`;
        html += `<label>${field.label}</label>`;
        if (field.type === 'textarea') {
            html += `<textarea id="${fieldId}" data-key="${field.key}">${escapeHtml(val)}</textarea>`;
        } else {
            html += `<input type="text" id="${fieldId}" data-key="${field.key}" value="${escapeHtml(val)}">`;
        }
        html += `</div>`;
    });
    html += `</div>`;
    return html;
}

function buildArrayHtml(section) {
    const rawVal = tnFullData[section.arrayKey];
    let items = [];
    try { items = rawVal ? JSON.parse(rawVal) : []; } catch(e) {}

    let html = '';
    items.forEach((item, index) => {
        html += `
            <div class="tn-array-item" id="arr-item-${section.id}-${index}">
                ${buildFieldsHtml(section.fields, item, `${section.id}-${index}`)}
                <div style="margin-top: 15px;">
                    <button class="tn-btn-delete" onclick="tnDeleteArrayItem('${section.id}', ${index})">🗑 Delete</button>
                </div>
            </div>
        `;
    });

    if (items.length === 0) {
        html += `<div class="tn-empty-state">No items created yet. Click "+ Add Service" above.</div>`;
    }

    return html;
}

// ─── ARRAY MANAGEMENT ───

function tnAddArrayItem(pageId, sectionId) {
    const config = TN_SCHEMA[pageId].sections.find(s => s.id === sectionId);
    let items = [];
    try { items = tnFullData[config.arrayKey] ? JSON.parse(tnFullData[config.arrayKey]) : []; } catch(e){}
    
    items.push({...config.defaultItem});
    tnFullData[config.arrayKey] = JSON.stringify(items);
    tnRenderPage(pageId); // Re-render to show new item
}

function tnDeleteArrayItem(sectionId, idx) {
    // Find section config
    let config = null;
    Object.values(TN_SCHEMA).forEach(p => p.sections.forEach(s => { if(s.id === sectionId) config = s; }));
    
    let items = [];
    try { items = tnFullData[config.arrayKey] ? JSON.parse(tnFullData[config.arrayKey]) : []; } catch(e){}
    items.splice(idx, 1);
    tnFullData[config.arrayKey] = JSON.stringify(items);
    tnRenderPage(activeTnPage);
}

// ─── SAVE LOGIC ───

async function tnSaveSection(sectionId) {
    // Find schema
    let config = null;
    let pageKey = activeTnPage;
    Object.keys(TN_SCHEMA).forEach(pK => TN_SCHEMA[pK].sections.forEach(s => { if(s.id === sectionId) { config = s; pageKey = pK; } }));

    const bodyDiv = document.getElementById(`tn-sec-body-${sectionId}`);
    const updates = [];

    config.fields.forEach(f => {
        const input = bodyDiv.querySelector(`[data-key="${f.key}"]`);
        if (input) {
            updates.push({ page: pageKey, key: f.key, content: input.value });
            tnFullData[f.key] = input.value; // Update local cache
        }
    });

    await executeSave(updates, sectionId);
}

async function tnSaveArraySection(sectionId) {
    // Find schema
    let config = null;
    let pageKey = activeTnPage;
    Object.keys(TN_SCHEMA).forEach(pK => TN_SCHEMA[pK].sections.forEach(s => { if(s.id === sectionId) { config = s; pageKey = pK; } }));
    
    const bodyDiv = document.getElementById(`tn-sec-body-${sectionId}`);
    const itemDivs = bodyDiv.querySelectorAll('.tn-array-item');
    
    const newArray = [];
    itemDivs.forEach((itemDiv) => {
        let obj = {};
        config.fields.forEach(f => {
            const input = itemDiv.querySelector(`[data-key="${f.key}"]`);
            if (input) obj[f.key] = input.value;
        });
        newArray.push(obj);
    });

    const jsonStr = JSON.stringify(newArray);
    tnFullData[config.arrayKey] = jsonStr;

    await executeSave([{ page: pageKey, key: config.arrayKey, content: jsonStr }], sectionId);
}

async function executeSave(updatesArray, sectionId) {
    const btn = document.querySelector(`#tn-sec-body-${sectionId} .tn-btn-save`);
    const origTxt = btn.innerText;
    btn.innerText = 'Syncing...';
    btn.disabled = true;

    try {
        const res = await fetch('/api/admin/content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ items: updatesArray })
        });
        
        if(res.ok) {
            btn.style.background = '#10b981'; // Success Green
            btn.innerText = '✅ Saved';
        } else {
            throw new Error('Save Failed');
        }
    } catch (err) {
        btn.style.background = '#ef4444';
        btn.innerText = '❌ Failed';
    }

    setTimeout(() => {
        btn.style.background = '';
        btn.innerText = origTxt;
        btn.disabled = false;
    }, 2000);
}

function escapeHtml(unsafe) {
    if (!unsafe) return "";
    return unsafe.toString()
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

// Hook into existing admin.html init if available
if(typeof loadCmsContent !== 'undefined' && authToken) {
    loadCmsContent();
}
