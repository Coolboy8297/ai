# SM64CoopDX

Upstream project: https://github.com/coop-deluxe/sm64coopdx

## Source

The source files have been imported into this repository at [`sm64coopdx/sm64coopdx-main/`](./sm64coopdx-main/). The extra directory level is okay for storing the source.

## Browser status

This repository currently contains the native C/C++ source, not a browser build. GitHub Pages cannot run the native executable or compile this project automatically. A browser version needs a WebAssembly/Emscripten port, browser-compatible graphics/input/audio and file handling, and separate work for multiplayer networking. The existing upstream build workflow targets desktop platforms; it does not provide a ready-to-deploy web build.

The game also needs game data from a legally obtained Super Mario 64 ROM at build/runtime; this repository does not include that ROM. Do not upload or redistribute ROM files.

## Next step

Develop and test a dedicated WebAssembly target before enabling a playable GitHub Pages page. Until that target exists, there is no working browser game to link here.