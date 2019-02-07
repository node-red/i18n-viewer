const yaml = require('js-yaml');
const fs = require('fs-extra');
const path = require('path');
const klaw = require('klaw');
const { exec } = require('child_process');

const SKIP_GIT = (process.argv[2] === '--skip-git');
const SKIP_COPY = (process.argv[2] === '--skip-copy');

const NOW = Date.now();

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
    if (project.local) {
        console.log("Not updating local project",project.name);
    } else {
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
}

async function updateProjectBranch(projectDir, project, branch) {
    await checkoutBranch(projectDir,branch);
    if (SKIP_COPY) {
        return
    }
    if (project.branches[branch].paths) {
        const projectCatalogDir = path.join(CATALOG_DIR,project.name,branch);
        await fs.ensureDir(projectCatalogDir);
        for (let i = 0; i < project.branches[branch].paths.length; i++) {
            let f = project.branches[branch].paths[i];
            if (!/locales\/?$/.test(f)) {
                console.log("Not a locales path:",f)
                continue;
            }
            let source = path.join(projectDir,f);
            let stat = await fs.stat(source);
            let dest = path.join(projectCatalogDir,f);
            if (stat.isDirectory()) {
                await fs.ensureDir(dest);
            } else if (stat.isFile()) {
                // Ensure the dir of the file exists
                await fs.ensureDir(path.join(projectCatalogDir,path.dirname(f)));
                await fs.ensureDir(path.join(projectHistoryDir,path.dirname(f)));
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
    console.log("----")
    console.log("  - ",projectDir)
    console.log("  - ",projectFile)
    console.log("  - ",destDir)
    // projectFile *should* end with /locales at this point

    for (var i=0;i<items.length;i++) {
        let source = path.join(projectDir,projectFile,items[i]);
        let dest = path.join(destDir,items[i]);
        let parts = items[i].split("/");
        let lang = parts.shift();
        while(parts.length > 0 && lang=='') { lang = parts.shift() }
        let historyFile = path.join(destDir,'*',parts.join('/'));
        console.log(source,"->",historyFile)
        await updateFileHistory(projectDir,projectFile,items[i],lang,historyFile)
    }
}

async function updateFileHistory(projectDir, projectFile, item, lang, historyFile) {
    let history = {};
    try {
        history = JSON.parse(fs.readFileSync(historyFile));
    } catch(err) {
        // no existing history
        await fs.ensureDir(path.dirname(historyFile));
    }
    try {
        let content = fs.readFileSync(path.join(projectDir,projectFile,item),'utf8');
        if (/\.json$/.test(item)) {
            content = JSON.parse(content);
            let data = flattenObject(content);
            let keys = Object.keys(data);
            keys.forEach(k => {
                history[k] = history[k] || {};
                if (history[k].hasOwnProperty(lang)) {
                    if (history[k][lang].v !== data[k]) {
                        history[k][lang].v = data[k];
                        history[k][lang].u = NOW;
                    }
                } else {
                    history[k][lang] = {
                        v: data[k],
                        u: NOW
                    }
                }
            });
        } else {
            history['text'] = history['text'] || {};
            if (history['text'].hasOwnProperty(lang)) {
                if (history['text'][lang].v !== content) {
                    history['text'][lang].v = content;
                    history['text'][lang].u = NOW;
                }
            } else {
                history['text'][lang] = {
                    v: content,
                    u: NOW
                }
            }
        }
        await fs.writeFile(historyFile,JSON.stringify(history));
    } catch(err) {
        console.log(err);
    }

}


function run(cmd,cwd) {
    if (SKIP_GIT) {
        return Promise.resolve();
    }
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

function flattenObject(obj) {
    var results = {};
    for (var k in obj) {
        if (obj.hasOwnProperty(k)) {
            if (typeof obj[k] === 'string') {
                results[k] = obj[k];
            } else {
                var subProps = flattenObject(obj[k]);
                for (var kk in subProps) {
                    if (subProps.hasOwnProperty(kk)) {
                        results[k+"."+kk] = subProps[kk];
                    }
                }
            }
        }
    }
    return results;
}
