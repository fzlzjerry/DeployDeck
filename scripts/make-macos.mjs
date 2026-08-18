import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { builtinModules } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { build } from "vite";

const root = process.cwd();
const outRoot = path.join(root, "out");
const arch = process.arch === "x64" ? "x64" : "arm64";
const appName = "DeployDeck";
const version = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
const appDir = path.join(outRoot, `${appName}-darwin-${arch}`);
const appPath = path.join(appDir, `${appName}.app`);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
}

fs.rmSync(path.join(root, ".vite"), { recursive: true, force: true });
fs.mkdirSync(path.join(root, ".vite/build"), { recursive: true });

await build({
  configFile: path.join(root, "vite.main.config.ts"),
  mode: "production",
  build: {
    lib: {
      entry: path.join(root, "src/main/main.ts"),
      fileName: () => "main.js",
      formats: ["cjs"],
    },
    outDir: ".vite/build",
    emptyOutDir: false,
    sourcemap: false,
    rollupOptions: {
      external: ["electron", ...builtinModules, ...builtinModules.map((name) => `node:${name}`)],
    },
  },
  define: {
    MAIN_WINDOW_VITE_DEV_SERVER_URL: "undefined",
    MAIN_WINDOW_VITE_NAME: JSON.stringify("main_window"),
  },
});

await build({
  configFile: path.join(root, "vite.preload.config.ts"),
  mode: "production",
  build: {
    lib: {
      entry: path.join(root, "src/preload/preload.ts"),
      fileName: () => "preload.js",
      formats: ["cjs"],
    },
    outDir: ".vite/build",
    emptyOutDir: false,
    rollupOptions: {
      external: ["electron", ...builtinModules, ...builtinModules.map((name) => `node:${name}`)],
    },
  },
});

await build({
  configFile: path.join(root, "vite.renderer.config.ts"),
  mode: "production",
  base: "./",
  build: {
    outDir: ".vite/renderer/main_window",
    emptyOutDir: true,
  },
});

const require = createRequire(import.meta.url);
const electronPath = path.dirname(require.resolve("electron/package.json"));
const electronDist = path.join(electronPath, "dist");
if (!fs.existsSync(path.join(electronDist, "Electron.app"))) {
  throw new Error("The local Electron binary is missing. Run npm install and retry.");
}

fs.rmSync(outRoot, { recursive: true, force: true });
fs.mkdirSync(appDir, { recursive: true });
run("ditto", [path.join(electronDist, "Electron.app"), appPath]);

const contents = path.join(appPath, "Contents");
const resources = path.join(contents, "Resources");
const macOS = path.join(contents, "MacOS");
fs.renameSync(path.join(macOS, "Electron"), path.join(macOS, appName));
const iconSource = path.join(root, "assets/icon.icns");
if (fs.existsSync(iconSource)) {
  fs.copyFileSync(iconSource, path.join(resources, "electron.icns"));
  fs.copyFileSync(iconSource, path.join(resources, "icon.icns"));
}

const appResources = path.join(resources, "app");
fs.mkdirSync(appResources, { recursive: true });
fs.writeFileSync(
  path.join(appResources, "package.json"),
  JSON.stringify({ name: "deploydeck", productName: appName, version, main: ".vite/build/main.js" }, null, 2),
);
run("ditto", [path.join(root, ".vite"), path.join(appResources, ".vite")]);

fs.writeFileSync(
  path.join(contents, "Info.plist"),
  `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key>
  <string>${appName}</string>
  <key>CFBundleExecutable</key>
  <string>${appName}</string>
  <key>CFBundleIconFile</key>
  <string>icon.icns</string>
  <key>CFBundleIdentifier</key>
  <string>com.morax.deploydeck</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>${appName}</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>${version}</string>
  <key>CFBundleVersion</key>
  <string>${version}</string>
  <key>LSApplicationCategoryType</key>
  <string>public.app-category.developer-tools</string>
  <key>LSMinimumSystemVersion</key>
  <string>12.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSSupportsAutomaticGraphicsSwitching</key>
  <true/>
</dict>
</plist>
`,
);

if (process.argv.includes("--package-only")) {
  console.log(`Created ${appPath}`);
  process.exit(0);
}

const zipPath = path.join(outRoot, "make", `zip/darwin/${arch}`, `${appName}-darwin-${arch}-${version}.zip`);
fs.mkdirSync(path.dirname(zipPath), { recursive: true });
run("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", appPath, zipPath]);

const dmgDir = path.join(outRoot, "make", `dmg/darwin/${arch}`);
fs.mkdirSync(dmgDir, { recursive: true });
const dmgPath = path.join(dmgDir, `${appName}-${version}-${arch}.dmg`);
const stage = fs.mkdtempSync(path.join(os.tmpdir(), "deploydeck-dmg-"));
run("ditto", [appPath, path.join(stage, `${appName}.app`)]);
run("hdiutil", [
  "create",
  "-volname",
  appName,
  "-srcfolder",
  stage,
  "-ov",
  "-format",
  "UDZO",
  dmgPath,
]);
fs.rmSync(stage, { recursive: true, force: true });

console.log(`Created ${appPath}`);
console.log(`Created ${zipPath}`);
console.log(`Created ${dmgPath}`);
