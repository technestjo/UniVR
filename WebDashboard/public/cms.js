// ─── AEROTWIN XR DYNAMIC CMS ENGINE ───

// This script fetches the latest content from the MongoDB dictionary 
// and dynamically replaces the innerHTML of elements marked with data-cms="key".

async function applyCMS() {
    try {
        // Fetch raw JSON map from the backend
        const res = await fetch('/api/content');
        if (!res.ok) return;
        
        const cmsData = await res.json();
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
        console.error("CMS Error: Failed to fetch dynamic content from database.", err);
    }
}

// Run immediately when DOM is parsed
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyCMS);
} else {
    applyCMS();
}
