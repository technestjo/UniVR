// ─── AEROTWIN XR DYNAMIC CMS ENGINE ───
// Enhanced CMS system with real-time content loading from MongoDB

// Configuration
const CMS_CONFIG = {
    contentEndpoint: '/api/content',
    refreshInterval: 5000, // Refresh every 5 seconds
    enableAutoRefresh: true
};

// Cache for CMS data
let cmsDataCache = {};
let lastUpdateTime = 0;

/**
 * Fetch CMS content from server
 */
async function fetchCMSContent() {
    try {
        const res = await fetch(CMS_CONFIG.contentEndpoint);
        if (!res.ok) {
            console.warn('CMS: Failed to fetch content (Status: ' + res.status + ')');
            return null;
        }
        
        const data = await res.json();
        cmsDataCache = data;
        lastUpdateTime = Date.now();
        return data;
    } catch (err) {
        console.error('CMS Error: Failed to fetch content from server', err);
        return null;
    }
}

/**
 * Apply CMS content to DOM elements
 */
async function applyCMS() {
    try {
        // Fetch content if cache is empty or expired
        let cmsData = cmsDataCache;
        if (Object.keys(cmsData).length === 0) {
            cmsData = await fetchCMSContent();
            if (!cmsData) {
                console.log('CMS: No content available. Using default HTML.');
                return;
            }
        }

        const cmsCount = Object.keys(cmsData).length;
        
        if (cmsCount === 0) {
            console.log("CMS: No content found in database. Using default hardcoded HTML.");
            return;
        }

        // Apply dynamically to standard elements
        const elements = document.querySelectorAll('[data-cms]');
        let appliedCount = 0;

        elements.forEach(el => {
            const key = el.getAttribute('data-cms');
            if (cmsData[key]) {
                if (el.tagName === 'IMG') {
                    el.src = cmsData[key];
                } else if (el.tagName === 'A') {
                    // Quick check if it's a URL or text
                    if(cmsData[key].startsWith('http') || cmsData[key].startsWith('/')) {
                        el.href = cmsData[key];
                    } else {
                        el.innerHTML = cmsData[key];
                    }
                } else {
                    el.innerHTML = cmsData[key];
                }
                appliedCount++;
            }
        });

        // Apply dynamically to Array elements (TechNest style lists)
        const arrayElements = document.querySelectorAll('[data-cms-array]');
        let arrayCount = 0;

        arrayElements.forEach(el => {
            const key = el.getAttribute('data-cms-array');
            if (cmsData[key]) {
                try {
                    const items = JSON.parse(cmsData[key]);
                    if (Array.isArray(items)) {
                        // Store original template in a data attribute if not already done
                        if (!el.hasAttribute('data-cms-template')) {
                            el.setAttribute('data-cms-template', el.innerHTML);
                        }
                        
                        const template = el.getAttribute('data-cms-template');
                        let finalHtml = '';
                        
                        items.forEach(item => {
                            let itemStr = template;
                            // Replace all {{key}} with actual value
                            Object.keys(item).forEach(k => {
                                let val = item[k] || '';
                                // Special handling: If the key is "details" or contains "list", auto-wrap newlines in <li>
                                if (k === 'details' && val.includes('\n')) {
                                    val = val.split('\n').filter(l => l.trim() !== '').map(l => `<li>${l}</li>`).join('');
                                }
                                const regex = new RegExp(`{{${k}}}`, 'g');
                                itemStr = itemStr.replace(regex, val);
                            });
                            finalHtml += itemStr;
                        });
                        
                        el.innerHTML = finalHtml;
                        arrayCount++;
                    }
                } catch(e) {
                    console.error("CMS: Failed to parse array for " + key, e);
                }
            }
        });

        console.log(`CMS: Applied ${appliedCount} text elements and ${arrayCount} array elements.`);


    } catch(err) {
        console.error('CMS Error: Failed to apply content to DOM', err);
    }
}

/**
 * Refresh CMS content and update DOM
 */
async function refreshCMS() {
    const newData = await fetchCMSContent();
    if (newData && JSON.stringify(newData) !== JSON.stringify(cmsDataCache)) {
        console.log('CMS: Content updated. Reapplying...');
        applyCMS();
    }
}

/**
 * Start auto-refresh of CMS content
 */
function startAutoRefresh() {
    if (CMS_CONFIG.enableAutoRefresh) {
        setInterval(refreshCMS, CMS_CONFIG.refreshInterval);
        console.log('CMS: Auto-refresh enabled (' + CMS_CONFIG.refreshInterval + 'ms)');
    }
}

// Run immediately when DOM is parsed
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        applyCMS();
        startAutoRefresh();
    });
} else {
    applyCMS();
    startAutoRefresh();
}

// Expose functions globally for admin panel
window.CMS = {
    refresh: refreshCMS,
    getCache: () => cmsDataCache,
    updateConfig: (newConfig) => Object.assign(CMS_CONFIG, newConfig)
};
