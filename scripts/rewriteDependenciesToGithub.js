const path = require("path");
const { readdir, readFile, writeFile, lstat } = require("fs/promises");
const { argv } = require("process");

const releaseName = argv[2];
if (!releaseName) throw Error("provide release name as first argument");

if (releaseName === "undo") {
  toNormal();
} else {
  toGithub();
}

async function toGithub() {
  const tarballUrlPrefix =
    "https://github.com/mitschabaude/webassemblyjs/releases/download/" +
    releaseName +
    "/";
  const rootDir = await findWorkspaceDir();
  // const { version } = await readJson(rootDir, "lerna.json");
  const packages = await getWorkspacePackages(rootDir, "packages");

  for (const pkg of Object.values(packages)) {
    const { version, name } = pkg.json;
    pkg.tarballUrl = tarballUrlPrefix + packageNameToTarName(name, version);
  }

  for (const pkg of Object.values(packages)) {
    const { dependencies, devDependencies, peerDependencies } = pkg.json;
    for (const deps of [dependencies, devDependencies, peerDependencies]) {
      for (const dep in deps) {
        if (dep in packages) {
          deps[dep] = packages[dep].tarballUrl;
        }
      }
    }
    await writeJson(pkg.json, pkg.dir, "package.json");
  }

  console.log(Object.values(packages)[0]);
}

async function toNormal() {
  const rootDir = await findWorkspaceDir();
  const { version } = await readJson(rootDir, "lerna.json");
  const packages = await getWorkspacePackages(rootDir, "packages");

  for (const pkg of Object.values(packages)) {
    const { dependencies, devDependencies, peerDependencies } = pkg.json;
    for (const deps of [dependencies, devDependencies, peerDependencies]) {
      for (const dep in deps) {
        if (dep in packages) {
          deps[dep] = version;
        }
      }
    }
    await writeJson(pkg.json, pkg.dir, "package.json");
  }

  console.log(Object.values(packages)[0]);
}

function packageNameToTarName(name, version) {
  return name.replace(/@/g, "").replace(/\//g, "-") + "-" + version + ".tgz";
}

async function getWorkspacePackages(...pathToPackages) {
  const packages = {}; // {name: {dir}}
  const packageFolders = await readdir(path.resolve(...pathToPackages));
  for (const folderName of packageFolders) {
    const dir = path.resolve(...pathToPackages, folderName);
    if (!(await lstat(dir)).isDirectory()) continue;
    const json = await getPackageJson(dir);
    packages[json.name] = { dir, json };
  }
  return packages;
}

async function findWorkspaceDir() {
  for (
    let cwd = path.resolve(".");
    cwd !== "/";
    cwd = path.resolve(cwd, "..")
  ) {
    const packageJson = await getPackageJson(cwd);
    if (packageJson?.workspaces) {
      return cwd;
    }
  }
}

async function getPackageJson(dir) {
  const files = await readdir(dir);
  if (!files.includes("package.json")) return null;
  return await readJson(dir, "package.json");
}

async function readJson(...filePaths) {
  return JSON.parse(
    await readFile(path.resolve(...filePaths), { encoding: "utf-8" })
  );
}
async function writeJson(json, ...filePaths) {
  await writeFile(
    path.resolve(...filePaths),
    JSON.stringify(json, undefined, 2) + "\n",
    {
      encoding: "utf-8",
    }
  );
}
