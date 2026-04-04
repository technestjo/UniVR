const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');

const standardNav = \    <nav id="navbar">
        <a href="index.html" class="nav-logo">
            <img src="logo.png" alt="AeroTwin Logo">
            AeroTwin XR
        </a>
        <ul class="nav-links">
            <li><a href="index.html" class="nav-home">Home</a></li>
            <li><a href="news.html" class="nav-news">News</a></li>
            <li><a href="about.html" class="nav-about">About</a></li>
            <li><a href="features.html" class="nav-features">Features</a></li>
            <li><a href="guide.html" class="nav-guide">Guide</a></li>
            <li><a href="leaderboard.html" class="nav-leaderboard">Leaderboard</a></li>
            <li><a href="doctor-portal.html" class="nav-join-link" style="color: var(--accent-cyan); font-weight: 800; border: 1px solid var(--accent-cyan); padding: 5px 15px; border-radius: 5px; margin-right: 10px;">JOIN</a></li>
            <li><a href="pricing.html" class="btn-get-started">Get Started</a></li>
        </ul>
    </nav>\;

const standardFooter = \    <footer class="main-footer" data-cms="global-footer">
        <div class="footer-grid">
            <div class="footer-brand">
                <div class="footer-logo-box">
                    <img src="logo.png" alt="AeroTwin Logo">
                    <span>AEROTWIN XR<br>MISSION SYSTEMS</span>
                </div>
            </div>
            <div class="footer-col">
                <h4>Navigation</h4>
                <ul>
                    <li><a href="index.html">Home</a></li>
                    <li><a href="news.html">News</a></li>
                    <li><a href="about.html">About</a></li>
                    <li><a href="features.html">Features</a></li>
                    <li><a href="guide.html">Guide</a></li>
                </ul>
            </div>
            <div class="footer-col">
                <h4>Resources</h4>
                <ul>
                    <li><a href="support.html">Support</a></li>
                    <li><a href="contact.html">Contact Us</a></li>
                    <li><a href="faq.html">FAQs</a></li>
                    <li><a href="updates.html">Updates</a></li>
                </ul>
            </div>
            <div class="footer-col">
                <h4>Legal</h4>
                <ul>
                    <li><a href="privacy.html">Privacy Policy</a></li>
                    <li><a href="terms.html">Terms of Service</a></li>
                    <li><a href="#">Cookie Policy</a></li>
                    <li><a href="#">Licensing</a></li>
                </ul>
            </div>
        </div>
        <div class="footer-bottom">
            <div class="footer-bottom-logo">AEROTWIN</div>
            <div class="footer-icons">
                <span>??</span> <span>??</span> <span>??</span> <span>??</span>
            </div>
            <div class="footer-copy">
                <span>Copyright © 2026</span>
                <a href="privacy.html">Privacy Policy</a>
                <a href="terms.html">Terms of Service</a>
            </div>
        </div>
    </footer>\;

const files = ['index.html', 'about.html', 'contact.html', 'faq.html', 'features.html', 'guide.html', 'leaderboard.html', 'news.html', 'pricing.html', 'privacy.html', 'support.html', 'terms.html', 'updates.html'];

files.forEach(file => {
    const filePath = path.join(publicDir, file);
    if (!fs.existsSync(filePath)) return;
    
    let content = fs.readFileSync(filePath, 'utf8');

    // 1. Replace CSS cache buster
    content = content.replace(/href="style\.css\?.*?"/g, 'href="style.css?v=5"');

    // 2. Replace Nav
    // Using regex to grab from <nav ...> to </nav>
    content = content.replace(/<nav[\s\S]*?<\/nav>/, standardNav);
    
    // 3. Set Active Class
    const fileBase = file.split('.')[0]; 
    if(fileBase !== 'index') {
        const classTarget = 'nav-' + fileBase;
        // make sure there's no rogue 'class="active"' if we just pasted it, but standardNav has none except home
        // actually standardNav above doesn't have active class. We'll add it.
        const regexActive = new RegExp('(class="' + classTarget + '")', 'g');
        content = content.replace(regexActive, '\ active');
    } else {
        content = content.replace(/class="nav-home"/, 'class="nav-home active"');
    }

    // 4. Replace Footer
    content = content.replace(/<footer[\s\S]*?<\/footer>/, standardFooter);

    fs.writeFileSync(filePath, content);
    console.log('Fixed:', file);
});
