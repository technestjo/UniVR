/**
 * AeroTwin XR - Premium CMS Admin Engine
 * Handles real-time editing, change tracking, and MongoDB synchronization.
 */

let activeCmsPage = 'home';
let cmsFullData = [];
let unsavedChanges = new Map(); // key -> { page, key, content }

// ─── CORE CMS LOGIC ───

/**
 * Load all content from the primary source (Atlas MongoDB)
 */
async function loadCmsContent() {
    const syncText = document.getElementById('cmsSyncText');
    const editor = document.getElementById('cmsEditor');
    
    try {
        syncText.innerText = 'Synchronizing...';
        unsavedChanges.clear();
        updateUnsavedIndicator();

        const res = await fetch('/api/admin/raw-content', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!res.ok) throw new Error('API_UNAVAILABLE');
        
        const rawData = await res.json();
        
        // Normalize and store
        cmsFullData = rawData.map(item => ({
            ...item,
            page: (item.page && item.page !== 'undefined' && item.page !== 'null') ? item.page : 'global'
        }));

        updateCmsSidebar();
        renderCmsPage(activeCmsPage);
        
        syncText.innerText = 'Synchronized with MongoDB Atlas. ✓';
        syncText.style.color = '#00ff88';
    } catch (err) {
        console.error("CMS Load Error:", err);
        syncText.innerText = 'Sync failed. Check connection.';
        syncText.style.color = '#ff3333';
        editor.innerHTML = `<div class="loading-state text-danger">Failed to connect to the CMS API. Ensure the server is running and you are logged in.</div>`;
    }
}

/**
 * Update Sidebar badges and active state
 */
function updateCmsSidebar() {
    const btns = document.querySelectorAll('.cms-sidebar-btn');
    btns.forEach(btn => {
        const p = btn.getAttribute('data-page');
        const count = cmsFullData.filter(item => item.page === p).length;
        btn.querySelector('.badge').innerText = count;
        btn.classList.toggle('active', p === activeCmsPage);
    });
}

/**
 * Switch the active page being edited
 */
function switchCmsPage(page, btn) {
    if (unsavedChanges.size > 0) {
        if (!confirm("You have unsaved changes on this page. Switch anyway?")) return;
    }
    
    activeCmsPage = page;
    unsavedChanges.clear();
    updateUnsavedIndicator();
    updateCmsSidebar();
    renderCmsPage(page);
}

/**
 * Render the editor grid for the active page
 */
function renderCmsPage(page) {
    const container = document.getElementById('cmsEditor');
    const search = document.getElementById('cmsSearch').value.toLowerCase();
    container.innerHTML = '';
    
    let filtered = cmsFullData.filter(item => item.page === page);
    
    if (search) {
        filtered = filtered.filter(i => 
            i.key.toLowerCase().includes(search) || 
            (i.content || '').toLowerCase().includes(search)
        );
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align:center; padding: 60px; color: var(--text-dim);">
                <div style="font-size: 44px; margin-bottom: 20px; opacity: 0.3;">🔍</div>
                <h3 style="letter-spacing: 1px; color: rgba(255,255,255,0.3);">NO CONTENT FOUND</h3>
                <p style="font-size: 13px; opacity: 0.5;">Add a new entry or try a different search.</p>
            </div>`;
        return;
    }

    filtered.forEach(item => {
        container.appendChild(createCmsCard(item));
    });
}

/**
 * Create a premium card for a CMS entry
 */
function createCmsCard(item) {
    const card = document.createElement('div');
    card.className = 'cms-card';
    
    // Friendly Label Logic
    let friendlyLabel = item.key.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    if (friendlyLabel.toLowerCase().includes('hero')) friendlyLabel = '🚀 ' + friendlyLabel;
    if (friendlyLabel.toLowerCase().includes('desc')) friendlyLabel = '📝 ' + friendlyLabel;
    if (friendlyLabel.toLowerCase().includes('btn')) friendlyLabel = '🖱️ ' + friendlyLabel;

    const isLongText = item.content && item.content.length > 50;

    card.innerHTML = `
        <div class="cms-card-header">
            <span class="cms-card-title">${friendlyLabel}</span>
            <span class="cms-card-key">${item.key}</span>
        </div>
        
        <div class="cms-input-group">
            <label class="cms-label">Current Content</label>
            ${isLongText ? 
                `<textarea class="cms-field textarea" oninput="trackCmsChange('${item.key}', this.value)">${item.content}</textarea>` :
                `<input type="text" class="cms-field" value="${item.content}" oninput="trackCmsChange('${item.key}', this.value)">`
            }
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: auto;">
            <div class="cms-page-badge">${item.page}</div>
            <button class="btn-icon" onclick="deleteCmsEntry('${item.key}')" style="background: rgba(255,255,255,0.05); color: var(--text-dim); padding: 5px 10px; font-size: 12px; border: 1px solid rgba(255,255,255,0.1);">🗑 Delete</button>
        </div>
    `;

    return card;
}

/**
 * Track changes in real-time
 */
function trackCmsChange(key, newValue) {
    const originalItem = cmsFullData.find(i => i.key === key);
    if (!originalItem) return;

    if (originalItem.content === newValue) {
        unsavedChanges.delete(key);
    } else {
        unsavedChanges.set(key, { page: originalItem.page, key: key, content: newValue });
    }

    updateUnsavedIndicator();
}

/**
 * Update the floating save bar
 */
function updateUnsavedIndicator() {
    const indicator = document.getElementById('cmsFloatingActions');
    const countText = document.getElementById('cmsUnsavedCount');
    
    if (unsavedChanges.size > 0) {
        indicator.classList.add('visible');
        countText.innerText = `${unsavedChanges.size} items modified`;
    } else {
        indicator.classList.remove('visible');
    }
}

/**
 * Save all changes to MongoDB
 */
async function saveCmsContent() {
    const saveBtn = document.querySelector('#cmsFloatingActions .btn-primary');
    const originalText = saveBtn.innerText;
    
    try {
        saveBtn.innerText = 'Deploying...';
        saveBtn.disabled = true;

        // Prepare full dataset (Originals + Changes)
        const updatedItemsMap = new Map();
        cmsFullData.forEach(item => updatedItemsMap.set(item.key, item));
        unsavedChanges.forEach((change, key) => updatedItemsMap.set(key, change));

        const allItems = Array.from(updatedItemsMap.values());

        const res = await fetch('/api/admin/content', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ items: allItems })
        });

        const result = await res.json();
        if (result.success) {
            cmsFullData = allItems;
            unsavedChanges.clear();
            updateUnsavedIndicator();
            updateCmsSidebar();
            
            // Show Success Notification
            saveBtn.innerText = '✅ Deployed!';
            setTimeout(() => {
                saveBtn.innerText = originalText;
                saveBtn.disabled = false;
            }, 2000);

            // Refresh public CMS cache if possible
            if (window.CMS && window.CMS.refresh) window.CMS.refresh();
        } else {
            throw new Error('SAVE_FAILED');
        }
    } catch (err) {
        console.error("CMS Save Error:", err);
        alert("Failed to save changes. Check your internet connection or login status.");
        saveBtn.innerText = originalText;
        saveBtn.disabled = false;
    }
}

/**
 * Delete an entry
 */
async function deleteCmsEntry(key) {
    if (!confirm(`Are you sure you want to delete "${key}"? This is permanent.`)) return;

    try {
        const res = await fetch(`/api/admin/content/${key}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        const result = await res.json();
        if (result.success) {
            cmsFullData = cmsFullData.filter(i => i.key !== key);
            unsavedChanges.delete(key);
            updateUnsavedIndicator();
            updateCmsSidebar();
            renderCmsPage(activeCmsPage);
        }
    } catch (err) {
        alert("Delete failed.");
    }
}

/**
 * Add a new empty entry
 */
function addNewCmsRow() {
    const key = prompt("Enter a unique KEY_ID (e.g., home-new-title):");
    if (!key) return;

    if (cmsFullData.some(i => i.key === key)) {
        return alert("Key already exists!");
    }

    const newItem = { page: activeCmsPage, key: key, content: "" };
    cmsFullData.unshift(newItem); // Add to top
    renderCmsPage(activeCmsPage);
    
    // Focus the new input
    setTimeout(() => {
        const firstField = document.querySelector('.cms-field');
        if (firstField) firstField.focus();
    }, 100);
}

/**
 * Sync Defaults Shortcut
 */
async function syncCmsDefaults() {
    if (!confirm("Reset all content to database defaults? Unsaved changes will be lost.")) return;
    loadCmsContent();
}
