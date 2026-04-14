Backend tools

This folder contains Python and Node helpers used by the Electron main process.

Main groups

- Build/clone scripts (`backend/build/`)
	- `clone_and_compile.py`: clone + compile flow with detailed progress markers.
	- `build_cloned.py`: compile an already cloned Blender source tree.
	- `simple_clone.py`: clone-only helper.
	- `check_tools.py`: detect/install required Windows build dependencies.

- Blend file metadata and preview (`backend/blend/`)
	- `info.py`: extract render metadata from a `.blend` using Blender Python API.
	- `preview.py`: generate PNG preview for recent files (fast preview path + robust fallback).
	- `render_headless.py`: headless render execution helper.

- Library/config/core helpers
	- `backend/build/info_extractor.py`: parse `blender -v` output and write `.blinfo`.
	- `backend/build/library_scanner.py`: scan a Blender library folder and detect executables/builds.
	- `backend/config/config_manager.py`: config CRUD utilities.

- Node helpers
	- `backend/integrations/blender_scanner.js`
	- `backend/integrations/steam_warp.js`
	- `backend/integrations/discord_rpc_manager.js`
	- `backend/network/download_blender.py`
	- `backend/network/fetch_blender_versions.py`

Shared utility modules

- `utils/ipc_output.py`: normalized `BL_*` marker output helpers.
- `utils/windows_tools.py`: shared Windows helpers (`pwsh`, VS toolchain, CMake discovery).
- `utils/file_utils.py`: common file/path/title utilities.

Compatibility layer

- Legacy root-level wrappers were removed.
- Electron/script call sites must target domain folders directly (`backend/build/*`, `backend/blend/*`, `backend/network/*`, `backend/integrations/*`).

Conventions

- Progress output uses `BL_*` markers consumed by Electron.
- Keep scripts executable as standalone CLIs (no runtime dependency on Electron).
- Prefer shared helpers in `backend/utils/` over duplicating subprocess/path logic.
