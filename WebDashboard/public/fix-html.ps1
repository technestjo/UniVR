$files = "index.html", "about.html", "contact.html", "faq.html", "features.html", "guide.html", "leaderboard.html", "news.html", "pricing.html", "privacy.html", "support.html", "terms.html", "updates.html"
$publicDir = "c:\Users\aliqa\uniVR\WebDashboard\public"

$standardNav = @"
    <nav id="navbar">
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
    </nav>
"@

$standardFooter = @"
    <footer class="main-footer" data-cms="global-footer">
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
                <span>📡</span> <span>⚙️</span> <span>☁️</span> <span>✈️</span>
            </div>
            <div class="footer-copy">
                <span>Copyright © 2026</span>
                <a href="privacy.html">Privacy Policy</a>
                <a href="terms.html">Terms of Service</a>
            </div>
        </div>
    </footer>
"@

foreach ($file in $files) {
    $filePath = Join-Path $publicDir $file
    if (Test-Path $filePath) {
        $content = Get-Content -Raw -Path $filePath
        
        # 1. Update CSS version
        $content = $content -replace 'href="style\.css(\?[^"]*)?"', 'href="style.css?v=5"'

        # 2. Add Active Class to Standard Nav string inline
        $fileBase = $file.Split('.')[0]
        $navForThisFile = $standardNav
        
        if ($fileBase -ne "index") {
            $classTarget = "class=""nav-$fileBase"""
            $navForThisFile = $navForThisFile -replace $classTarget, "$classTarget active"""
        } else {
            $navForThisFile = $navForThisFile -replace 'class="nav-home"', 'class="nav-home active"'
        }

        # 3. Replace Nav Block
        # If file doesn't have <nav> it might skip, so let's match anything that looks like <nav ... </nav>
        $content = $content -replace '(?s)<nav\b[^>]*>.*?</nav>', $navForThisFile
        
        # 4. Replace Footer Block
        # If some files don't have a footer, we should probably append it? The user said "sure footer is visible in all pages".
        # Let's replace if exists
        if ($content -match '(?s)<footer\b[^>]*>.*?</footer>') {
            $content = $content -replace '(?s)<footer\b[^>]*>.*?</footer>', $standardFooter
        } else {
            # Inject before script or body
            $content = $content -replace '(?s)(<script[^>]*>|</body>)', "$standardFooter`n`$1"
        }

        Set-Content -Path $filePath -Value $content
        Write-Host "Fixed: $file"
    } else {
        Write-Host "Not Found: $file"
    }
}
