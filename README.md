### Setup

* Install Rust: 
`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
* Install Node.js 
* Make sure `npm` is in your `PATH` environment variable.
* Install Tauri CLI: `npm install -g @tauri-apps/cli`
* Install the node modules: `npm install`

### Build & run
To build and run the app during development, use `tauri dev`
This will open the app and let you debug it.

To run a release build during development (without building installers), use `tauri dev --release`

To build and run the app for production, use `tauri build`
This creates installer files (NSIS, WiX) and a standalone executable at `src-tauri/target/release/app.exe` that you can run directly.