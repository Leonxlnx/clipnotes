$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.IO.Path]::Combine($env:USERPROFILE, "Desktop", "ClipNotes.lnk")
$Shortcut = $WshShell.CreateShortcut($DesktopPath)
$Shortcut.TargetPath = "C:\Users\User\.gemini\antigravity\scratch\clipnotes\start.bat"
$Shortcut.WorkingDirectory = "C:\Users\User\.gemini\antigravity\scratch\clipnotes"
$Shortcut.IconLocation = "C:\Users\User\.gemini\antigravity\scratch\clipnotes\icon.ico,0"
$Shortcut.WindowStyle = 7
$Shortcut.Description = "ClipNotes"
$Shortcut.Save()
Write-Host "Desktop shortcut created with custom icon!"
