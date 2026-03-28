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

        // Apply dynamically to the DOM
        const elements = document.querySelectorAll('[data-cms]');
        let appliedCount = 0;

        elements.forEach(el => {
            const key = el.getAttribute('data-cms');
            if (cmsData[key]) {
                // If it's an image, replace the source
                if (el.tagName === 'IMG') {
                    el.src = cmsData[key];
                    el.onerror = function() {
                        console.warn('CMS: Image failed to load for key: ' + key);
                    };
                } 
                // If it's a link, we check if the CMS value is JSON (text + href) or just text
                else if (el.tagName === 'A') {
                    try {
                        const linkData = JSON.parse(cmsData[key]);
                        if(linkData.text) el.innerHTML = linkData.text;
                        if(linkData.href) el.href = linkData.href;
                    } catch(e) {
                        el.innerHTML = cmsData[key]; 
                    }
                } 
                // Everything else (h1, p, span, div)
                else {
                    el.innerHTML = cmsData[key];
                }
                appliedCount++;
            }
        });

        console.log(`CMS: Successfully applied ${appliedCount} dynamic elements to the page.`);

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
