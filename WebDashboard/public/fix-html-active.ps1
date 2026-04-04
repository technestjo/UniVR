$files = "index.html", "about.html", "contact.html", "faq.html", "features.html", "guide.html", "leaderboard.html", "news.html", "pricing.html", "privacy.html", "support.html", "terms.html", "updates.html"
$publicDir = "c:\Users\aliqa\uniVR\WebDashboard\public"

foreach ($file in $files) {
    $filePath = Join-Path $publicDir $file
    if (Test-Path $filePath) {
        $content = Get-Content -Raw -Path $filePath
        
        # Strip out the malformed active injection
        $fileBase = $file.Split('.')[0]
        if ($fileBase -ne "index") {
            # Find the line like: class="nav-guide" active"
            # And change to: class="nav-guide active"
            $badClass = 'class="nav-' + $fileBase + '" active"'
            $goodClass = 'class="nav-' + $fileBase + ' active"'
            $content = $content -replace $badClass, $goodClass
        }

        Set-Content -Path $filePath -Value $content
    }
}
