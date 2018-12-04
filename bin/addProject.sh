#!/bin/bash
if [ "$1" = "" ]; then
    echo "You must supply a Node-RED github project name."
    echo "e.g. node-red-dashboard"
    echo "  or node-red-nodes"
    exit
fi
echo "Adding $1"
proj=$1

if [ ! -d .scratch ]
then
    mkdir .scratch
fi
cd .scratch

if [ ! -d $proj ]
then
    git clone https://github.com/node-red/$proj.git
    cd $proj
    git checkout master
    cd ..
else
    cd $proj
    git pull
    cd ..
fi
cd ..

mkdir -p catalogs/$proj
cp -R .scratch/$proj catalogs/
# ln -s .scratch/$proj catalogs/
