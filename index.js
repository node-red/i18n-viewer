const express = require('express');
const serveStatic = require('serve-static');
const bodyParser = require('body-parser');
const path = require("path");
const fs = require("fs");
const app = express();

const CATALOG_DIR = path.join(__dirname,'catalogs');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.use("/",serveStatic(path.join(__dirname,'public')));

app.get("/catalogs", function(req,res) {
    getFiles(CATALOG_DIR).then(result => {
        res.json(result);
    }).catch(err => {
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

function getCatalog(catalog) {
    var basename = path.basename(catalog);
    var dirname = path.dirname(catalog);
    return getFiles(path.join(CATALOG_DIR,dirname), dirname).then(result => {
        var catalog = {};
        for (locale in result.dirs) {
            if (result.dirs.hasOwnProperty(locale)) {
                if (result.dirs[locale].files.indexOf(basename) > -1) {
                    catalog[locale] = JSON.parse(fs.readFileSync(path.join(CATALOG_DIR,dirname,locale,basename)));
                }
            }
        }
        return catalog
    })

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
                                        var fullPath = path.join(subdirResult.name,messageFile);
                                        localeFiles[fullPath] = localeFiles[fullPath] || [];
                                        localeFiles[fullPath].push(locale);
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
