const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const buildDir = path.join(root, "build");

fs.rmSync(buildDir, { recursive: true, force: true });
fs.mkdirSync(buildDir, { recursive: true });

const copyTargets = [
  [path.join("src", "services", "wallpaperService.js"), path.join("src", "services", "wallpaperService.js")],
  ["html", "html"],
  ["views", "views"],
  [path.join("public", "css"), path.join("public", "css")],
  [path.join("public", "js"), path.join("public", "js")],
  [path.join("public", "vendor"), path.join("public", "vendor")],
  [path.join("public", "gemini-svg.svg"), path.join("public", "gemini-svg.svg")],
  [path.join("public", "default-avatar.svg"), path.join("public", "default-avatar.svg")],
];

for (const [source, destination] of copyTargets) {
  const sourcePath = path.join(root, source);
  const destinationPath = path.join(buildDir, destination);
  if (fs.existsSync(sourcePath)) {
    fs.cpSync(sourcePath, destinationPath, { recursive: true });
  }
}

const manifest = {
  generatedAt: new Date().toISOString(),
  sources: copyTargets.map(([source, destination]) => ({ source, destination })),
};
fs.writeFileSync(
  path.join(buildDir, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

const htmlSourceDir = path.join(root, "html");
const htmlFiles = fs.readdirSync(htmlSourceDir).filter((file) => file.endsWith(".html"));
if (htmlFiles.length === 0) {
  throw new Error("No HTML sources found in html/");
}

const requiredOutputs = htmlFiles.map((file) => path.join("html", file)).concat([
  "views/admin/dashboard.ejs",
  "views/auth/login.ejs",
  "views/auth/register.ejs",
  "public/css/panel.css",
  "public/js/panel.js",
  "public/vendor/xterm.min.js",
  path.join("src", "services", "wallpaperService.js"),
]);
for (const output of requiredOutputs) {
  if (!fs.existsSync(path.join(buildDir, output))) {
    throw new Error(`Missing build output: ${output}`);
  }
}

const forbiddenDuplicates = [
  "public/dashboard.html",
  "public/login.html",
  "public/register.html",
  "public/app.js",
  "public/styles.css",
  "views/dashboard.ejs",
  "views/login.ejs",
  "views/register.ejs",
];
for (const duplicate of forbiddenDuplicates) {
  if (fs.existsSync(path.join(buildDir, duplicate))) {
    throw new Error(`Stale duplicate in build output: ${duplicate}`);
  }
}

console.log(`Build completed: ${path.relative(root, buildDir)}/`);
