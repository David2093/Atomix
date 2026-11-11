# ATOMIX Core / WebAssembly

The site uses the JavaScript engine until the Emscripten output exists and loads successfully. It reports the active engine in the Quantum Lab; the source C++ files alone are not presented as a running WebAssembly module.

Requirements: CMake 3.20+, a C++17 compiler, and the Emscripten SDK (`emcmake` / `emcc`). From the project root:

```sh
emcmake cmake -S cpp -B cpp/build
cmake --build cpp/build --config Release
```

The target writes `wasm/atomix-core.js` and `wasm/atomix-core.wasm`. Rebuild the Vite output after compiling so the configured Vite copy step places the files in `dist/wasm/`.

Exports cover particle updates, pairwise force calculation, molecular bond distances and a Coulomb electric-field calculation. The JavaScript wrapper uses the same array-based API when the compiled module is unavailable.
