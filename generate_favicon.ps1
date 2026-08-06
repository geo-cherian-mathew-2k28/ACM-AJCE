$srcPath = 'd:\ACM\acm-vit-reference-full\public\brand\acm-ajce-light.png'
$outPath = 'd:\ACM\acm-vit-reference-full\public\favicon.png'

Add-Type -AssemblyName System.Drawing

$img = [System.Drawing.Image]::FromFile($srcPath)
$size = 512
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)

$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

# Dark branded round badge
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 10, 11, 20))
$g.FillEllipse($brush, 8, 8, $size - 16, $size - 16)

# Purple ring
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 184, 167, 255), 14)
$g.DrawEllipse($pen, 16, 16, $size - 32, $size - 32)

$maxBox = 360
$aspect = $img.Width / $img.Height
$drawW = $maxBox
$drawH = [int]($maxBox / $aspect)

if ($drawH -gt $maxBox) {
    $drawH = $maxBox
    $drawW = [int]($maxBox * $aspect)
}

$posX = [int](($size - $drawW) / 2)
$posY = [int](($size - $drawH) / 2)

$g.DrawImage($img, $posX, $posY, $drawW, $drawH)

$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
$img.Dispose()
Write-Host "Favicon generated cleanly"
