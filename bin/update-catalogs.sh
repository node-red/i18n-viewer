#!/bin/bash

if [ ! -d .scratch ]
then
    mkdir .scratch
fi

cd .scratch

if [ ! -d node-red ]
then
    git clone https://github.com/node-red/node-red.git
    cd node-red
    git checkout dev
    cd ..
else
    cd node-red
    git pull
    cd ..
fi
cd ..

rm -rf catalogs
mkdir catalogs

mkdir -p catalogs/@node-red/editor-client
cp -R .scratch/node-red/packages/node_modules/@node-red/editor-client/locales catalogs/@node-red/editor-client/

mkdir -p catalogs/@node-red/runtime
cp -R .scratch/node-red/packages/node_modules/@node-red/runtime/locales catalogs/@node-red/editor-client/

mkdir -p catalogs/@node-red/nodes
cp -R .scratch/node-red/packages/node_modules/@node-red/nodes/locales catalogs/@node-red/nodes/
