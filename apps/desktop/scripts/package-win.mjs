import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import packager from "@electron/packager";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(__dirname, "..");
const releaseDir = path.join(appDir, "release");
const stagingDir = path.join(releaseDir, "staging");
const onlyDir = process.argv.includes("--dir");

async function main() {
  rmSync(releaseDir, { recursive: true, force: true });
  mkdirSync(stagingDir, { recursive: true });

  const sourcePackage = JSON.parse(readFileSync(path.join(appDir, "package.json"), "utf8"));

  cpSync(path.join(appDir, "dist"), path.join(stagingDir, "dist"), { recursive: true });
  cpSync(path.join(appDir, "resources"), path.join(stagingDir, "resources"), { recursive: true });

  writeFileSync(
    path.join(stagingDir, "package.json"),
    JSON.stringify(
      {
        name: "plane-desktop",
        version: sourcePackage.version,
        private: true,
        main: "./dist/main.js",
        dependencies: sourcePackage.dependencies ?? {},
      },
      null,
      2
    )
  );

  copyModuleWithDependencies(appDir, stagingDir, "node-notifier", new Set());

  const packagedApps = await packager({
    dir: stagingDir,
    name: "Plane",
    executableName: "Plane",
    platform: "win32",
    arch: "x64",
    out: releaseDir,
    overwrite: true,
    icon: path.join(stagingDir, "resources", "icon.png"),
    electronVersion: sourcePackage.devDependencies.electron,
    prune: false,
    appCopyright: "Plane Software Inc.",
    appVersion: sourcePackage.version,
  });

  const packagedAppPath = packagedApps[0];
  if (!packagedAppPath) {
    throw new Error("Packaging failed: no output app path returned.");
  }

  rmSync(stagingDir, { recursive: true, force: true });

  const planeExePath = path.join(packagedAppPath, "Plane.exe");
  console.log(`Ready: ${planeExePath}`);

  if (!onlyDir) {
    const sevenZip = find7z();
    if (sevenZip) {
      const portableExePath = path.join(releaseDir, "Plane-Portable.exe");
      execFileSync(sevenZip, ["a", "-sfx", portableExePath, path.join(packagedAppPath, "*")], {
        stdio: "inherit",
      });
      console.log(`Portable exe: ${portableExePath}`);
    } else {
      console.log("7-Zip not found, skipped portable exe. Use Plane.exe from the app folder above.");
    }
  }
}

function resolveModulePath(rootDir, moduleName) {
  const localPath = path.join(rootDir, "node_modules", moduleName);
  if (existsSync(localPath)) {
    return localPath;
  }

  const workspaceRootPath = path.join(rootDir, "..", "..", "node_modules", moduleName);
  if (existsSync(workspaceRootPath)) {
    return workspaceRootPath;
  }

  return null;
}

function copyModuleWithDependencies(rootDir, targetDir, moduleName, copied) {
  if (copied.has(moduleName)) {
    return;
  }

  const sourcePath = resolveModulePath(rootDir, moduleName);
  if (!sourcePath) {
    return;
  }

  copied.add(moduleName);

  const destinationPath = path.join(targetDir, "node_modules", moduleName);
  mkdirSync(path.dirname(destinationPath), { recursive: true });
  cpSync(sourcePath, destinationPath, { recursive: true, dereference: true });

  const packageJsonPath = path.join(sourcePath, "package.json");
  if (!existsSync(packageJsonPath)) {
    return;
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  for (const dependencyName of Object.keys(packageJson.dependencies ?? {})) {
    copyModuleWithDependencies(rootDir, targetDir, dependencyName, copied);
  }
}

function find7z() {
  const candidates = ["C:\\Program Files\\7-Zip\\7z.exe", "C:\\Program Files (x86)\\7-Zip\\7z.exe"];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
