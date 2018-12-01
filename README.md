i18n-viewer for Node-RED project locale files
=============================================


A quick hack to help us see the various translations next to each other. The hosted version still relies on running a script on the server to pull in any updates to keep it in sync with git. There is a lot more it could do if anyone wanted to contribute.

It was never envisaged for people to run locally, so well done to @joerg_w for getting it going.

### Running locally

     git clone https://github.com/node-red/i18n-viewer`
     cd i18n-viewer
     npm install
     mkdir catalogs

copy or link your local project locales directory (directories) to catalogs, for example

    ln -s ~/projects/myNRnodeDirectory catalogs/myNRnodeDirectory

 then run

    node index.js

open your browser and connect to `http://localhost:2880`
