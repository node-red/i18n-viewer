const express = require('express');
const serveStatic = require('serve-static');
const bodyParser = require('body-parser');
const path = require("path");
const fs = require("fs-extra");
const app = express();
const yaml = require('js-yaml');
const clone = require('clone');
const klaw = require('klaw');


const DEFAULT_SETTINGS = path.resolve(path.join(__dirname,"settings.ini"));
const CATALOG_DIR = path.join(__dirname,'catalogs');

var defaultConfig = yaml.safeLoad(fs.readFileSync(DEFAULT_SETTINGS,'utf8'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.use("/",serveStatic(path.join(__dirname,'public')));

app.get("/catalogs", function(req,res) {
    // getFiles(CATALOG_DIR).then(result => {
    getCatalogs().then(result => {
        res.json(result);
    }).catch(err => {
        res.status(400).json({error:"unexpected_error", message:err.toString()});
    })
})
app.get("/catalog/:repo/:branch/*",(req,res) => {
    getCatalog2(req.params.repo,req.params.branch,req.params[0]).then(result => {
        res.json(result);
    }).catch(err => {
        console.log(err);
        res.status(400).json({error:"unexpected_error", message:err.toString()});
    })
})
app.get("/catalog/*", function(req,res) {
    getCatalog(req.params[0]).then(result => {
        res.json(result);
    }).catch(err => {
        res.status(400).json({error:"unexpected_error", message:err.toString()});
    })
})

app.listen(process.env.PORT||2880);
console.log("Listening on http://localhost:"+(process.env.PORT||2880));

async function getCatalog2(repo,branch,file) {
    const parts = /^(.*locales)\/([^/]+)\/(.*)/.exec(file);
    if (!parts) {
        throw new Error("Not a valid catalog path");
    }

    const catalogBasePath = path.join(CATALOG_DIR,repo,branch,parts[1]);
    const languages = await getLanguages(catalogBasePath,parts[2]);
    // const content = await fs.readFile(catalogPath,'utf8')
    const result = {};
    for (let i=0;i<languages.length;i++) {
        let filePath = path.join(catalogBasePath,languages[i],parts[3]);
        try {
            result[languages[i]] = await fs.readFile(filePath,'utf8');
            if (/.json$/.test(filePath)) {
                result[languages[i]] = JSON.parse(result[languages[i]] );
            }
        } catch(err) {

        }
    }
    return result;
}

async function getLanguages(catalogPath,filter) {
    const files = await fs.readdir(catalogPath);
    const langs = [];
    for (let i=0; i<files.length; i++) {
        if (files[i][0] !== ".") {
            let stat = await fs.stat(path.join(catalogPath,files[i]));
            if (stat.isDirectory()) {
                if (!filter || files[i] === filter || filter === '*' || filter.indexOf(files[i]) !== -1) {
                    langs.push(files[i]);
                }
            }
        }
    }
    return langs;
}
function getCatalog(catalog) {
    var basename = path.basename(catalog);
    var dirname = path.dirname(catalog);
    return getFiles(path.join(CATALOG_DIR,dirname), dirname).then(result => {
        var catalog = {};
        for (locale in result.dirs) {
            if (result.dirs.hasOwnProperty(locale)) {
                if (result.dirs[locale].files.indexOf(basename) > -1) {
                    try {
                        catalog[locale] = JSON.parse(fs.readFileSync(path.join(CATALOG_DIR,dirname,locale,basename)));
                    } catch(err) {

                    }
                }
            }
        }
        return catalog
    })

}

async function getCatalogs() {
    const result = clone(defaultConfig);
    for (let repo in defaultConfig) {
        if (defaultConfig.hasOwnProperty(repo)) {
            for (let branch in defaultConfig[repo].branches) {
                if (defaultConfig[repo].branches.hasOwnProperty(branch)) {
                    var paths = defaultConfig[repo].branches[branch].paths;
                    delete result[repo].branches[branch].paths;
                    result[repo].branches[branch].catalogs = {};
                    for (let i=0;i<paths.length;i++) {
                        let catalogBasePath = path.join(CATALOG_DIR,repo,branch,paths[i]);
                        var languages = await getLanguages(catalogBasePath);
                        for (let j=0;j<languages.length;j++) {
                            var files = await walkFiles(path.join(catalogBasePath,languages[j]));
                            files.forEach(f=> {
                                f = path.join(paths[i],'*',f);
                                result[repo].branches[branch].catalogs[f] = result[repo].branches[branch].catalogs[f] || [];
                                result[repo].branches[branch].catalogs[f].push(languages[j])
                            })
                        }
                    }
                }
            }
        }
    }
    return result;
}

async function walkFiles(dir) {
    return new Promise((resolve,reject) => {
        const items = [] // files, directories, symlinks, etc
        klaw(dir)
            .on('data', item => !item.stats.isDirectory()?items.push(item.path.substring(dir.length+1)):null)
            .on('end', () => { resolve(items )})
            .on('error', err => { console.log(err); reject(err)})

    });
}


function getFiles(dir,trimmedDir) {
    trimmedDir = trimmedDir || "";
    var result = {name:trimmedDir,catalogs:{}};
    return new Promise((resolve,reject) => {
        var promises = [];
        fs.readdir(dir, (err, files) => {
            if (err) {
                return reject(err);
            }
            files.forEach(file => {
                if (file.charAt(0) !== '.') {
                    var stat = fs.statSync(path.join(dir, file));
                    if (stat.isFile()) {
                        result.files = result.files||[];
                        result.files.push(file);
                    } else if (stat.isDirectory()) {
                        promises.push(getFiles(path.join(dir,file),path.join(trimmedDir,file)).then(subdirResult => {
                            if (file === 'locales') {
                                let localeFiles = {};
                                locales = Object.keys(subdirResult.dirs||{});
                                locales.forEach(locale => {
                                    subdirResult.dirs[locale].files.forEach(messageFile => {
                                        if ((messageFile.substr(-5) === ".json") && (subdirResult.name.indexOf("node_modules") === -1)) {
                                            var fullPath = path.join(subdirResult.name,messageFile);
                                            localeFiles[fullPath] = localeFiles[fullPath] || [];
                                            localeFiles[fullPath].push(locale);
                                        }
                                    })
                                });
                                result.catalogs = localeFiles;
                            // } else if (subdirResult.hasOwnProperty('catalogs')) {
                            //     result = {
                            //         catalogs: subdirResult.catalogs,
                            //         name: subdirResult.trimmedDir
                            //     }
                            } else {
                                result.catalogs = Object.assign({},result.catalogs,subdirResult.catalogs);
                                result.dirs = result.dirs ||{};
                                result.dirs[file] = subdirResult;
                            }
                        }));
                    }
                }
            });
            resolve(Promise.all(promises).then(() => {
                if (trimmedDir !== "") {
                    return result
                } else {
                    return result.catalogs
                }
            }))
        })
    });
}
