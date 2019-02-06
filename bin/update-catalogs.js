const yaml = require('js-yaml');
const fs = require('fs-extra');
const path = require('path');
const klaw = require('klaw');
const { exec } = require('child_process');

const DEFAULT_SETTINGS = path.resolve(path.join(__dirname,"..","settings.ini"));
const SCRATCH_DIR = path.resolve(path.join(__dirname,"..",".scratch"));

const CATALOG_DIR = path.resolve(path.join(__dirname,"..","catalogs"));

var defaultConfig = yaml.safeLoad(fs.readFileSync(DEFAULT_SETTINGS,'utf8'));

fs.ensureDir(SCRATCH_DIR).then(() => {
    let promiseChain = Promise.resolve();
    for (let name in defaultConfig) {
        if (defaultConfig.hasOwnProperty(name)) {
            defaultConfig[name].name = name;
            promiseChain = promiseChain.then(() =>
                updateProject(defaultConfig[name])
            )
        }
    }
    return promiseChain;
}).then(() => {
    console.log("done");
}).catch(err => {
    console.log(err.stack);
    process.exit(1);
})

async function updateProject(project) {
    const projectDir = path.join(SCRATCH_DIR,project.name);
    const exists = await fs.pathExists(projectDir);
    if (exists) {
        await pullProject(projectDir)
    } else {
        await fs.ensureDir(projectDir);
        await cloneProject(projectDir,project)
    }
    let promiseChain = Promise.resolve();
    for (let branch in project.branches) {
        if (project.branches.hasOwnProperty(branch)) {
            promiseChain = promiseChain.then(() =>
                updateProjectBranch(projectDir,project,branch)
            )
        }
    }
    return promiseChain;
}

async function updateProjectBranch(projectDir, project, branch) {
    await checkoutBranch(projectDir,branch);
    if (project.branches[branch].paths) {
        const projectCatalogDir = path.join(CATALOG_DIR,project.name,branch);
        await fs.ensureDir(projectCatalogDir);
        for (let i = 0; i < project.branches[branch].paths.length; i++) {
            let f = project.branches[branch].paths[i];
            let source = path.join(projectDir,f);
            let stat = await fs.stat(source);
            let dest = path.join(projectCatalogDir,f);
            if (stat.isDirectory()) {
                await fs.ensureDir(dest);
            } else if (stat.isFile()) {
                // Ensure the dir of the file exists
                await fs.ensureDir(path.join(projectCatalogDir,path.dirname(f)));
            }
            await scanProjectPath(projectDir,f, dest);
            // await fs.copy(source,dest,{overwrite:false})
        }
    }
}

async function scanProjectPath(projectDir,projectFile, dest) {
    const source = path.join(projectDir,projectFile);
    return new Promise((resolve,reject) => {
        const items = [] // files, directories, symlinks, etc
        klaw(source)
            .on('data', item => !item.stats.isDirectory()?items.push(item.path.substring(source.length)):null)
            .on('end', () => { copyProjectPaths(projectDir, projectFile,items,dest).then(resolve);})
            .on('error', err => { console.log(err); reject(err)})

    });
}

async function copyProjectPaths(projectDir, projectFile, items, destDir) {
    for (var i=0;i<items.length;i++) {
        let source = path.join(projectDir,projectFile,items[i]);
        let dest = path.join(destDir,items[i]);
        console.log(source,"->",dest)
        await fs.copy(source,dest);
    }
}
function run(cmd,cwd) {
    return new Promise((resolve,reject) => {
        exec(cmd,{cwd:cwd},(err,stdout,stderr) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        })
    });
}
function cloneProject(projectDir,project) {
    console.log("Cloning",project.url)
    return run('git clone '+project.url+' .',projectDir);
}
function checkoutBranch(projectDir,branch) {
    console.log("Checkout branch",branch)
    return run('git checkout '+branch,projectDir);
}
function pullProject(projectDir) {
    console.log("Pulling",projectDir)
    return run('git pull',projectDir);
}
