# Install common build tools for Blender on Windows
Write-Host "Starting build tools installer (attempting winget)..."
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  Write-Host "winget not found on this system. Please install winget or follow the README in the build_tools folder."
} else {
  Write-Host "winget found - attempting to install: Git, Python, CMake, Ninja, Visual Studio Build Tools"
  & winget install --id Git.Git -e --accept-package-agreements --accept-source-agreements; if ($LASTEXITCODE -ne 0) { Write-Host "Git install failed or already present (exit $LASTEXITCODE)" }
  & winget install --id Python.Python.3 -e --accept-package-agreements --accept-source-agreements; if ($LASTEXITCODE -ne 0) { Write-Host "Python install failed or already present (exit $LASTEXITCODE)" }
  & winget install --id Kitware.CMake -e --accept-package-agreements --accept-source-agreements; if ($LASTEXITCODE -ne 0) { Write-Host "CMake install failed or already present (exit $LASTEXITCODE)" }
  & winget install --id Kitware.Ninja -e --accept-package-agreements --accept-source-agreements; if ($LASTEXITCODE -ne 0) { Write-Host "Ninja install failed or already present (exit $LASTEXITCODE)" }
  & winget install --id Microsoft.VisualStudio.2022.BuildTools -e --accept-package-agreements --accept-source-agreements; if ($LASTEXITCODE -ne 0) { Write-Host "VS Build Tools install may require manual steps or elevated permissions (exit $LASTEXITCODE)" }
  Write-Host "Installer finished (some installs may require further configuration or reboot)."
}
