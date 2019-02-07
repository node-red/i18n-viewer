i18n-viewer for Node-RED project locale files
=============================================

A quick hack to help us see the various translations next to each other. The
hosted version still relies on running a script on the server to pull in any
updates to keep it in sync with git. There is a lot more it could do if anyone
wanted to contribute.


### Running locally

     git clone https://github.com/node-red/i18n-viewer`
     cd i18n-viewer
     npm install
     node index.js

Then open http://localhost:2880

### Configuring

The application uses the file `settings.ini` to identify what git repos it should
display the translations from. It is preconfigured for the main `node-red` and
`node-red-dashboard` repos. It's structure allows the tool to track multiple branches
of the same repo.

```yaml
---
node-red:
  url: https://github.com/node-red/node-red.git
  branches:
    dev:
      paths:
      - packages/node_modules/@node-red/editor-client/locales
      - packages/node_modules/@node-red/runtime/locales
      - packages/node_modules/@node-red/nodes/locales
node-red-dashboard:
  url: https://github.com/node-red/node-red-dashboard.git
  branches:
    master:
      paths:
      - nodes/locales
```

To pull down these repos and copy over their locale files, run the tool

     node bin/update-catalogs.js

The catalog files will be copied into the `catalogs` directory in the root of
the application. It assumes everything under the paths provided should be copied
and that'll only be the json message catalogs and html help pages.

### Adding local project files

**Currently, this project does not support local project files**



**Ignore the rest of this readme for now!**

Adding in local project files that are not currently on a remote git repo is a bit
of a hack at the moment.

**Todo:** Update `bin/update-catalogs.js` to support local project files.
