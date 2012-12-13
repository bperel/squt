#!/bin/bash
DIR=$PWD

cd ..
wget http://downloads.mysql.com/archives/mysql-5.0/mysql-5.0.45.tar.gz
tar xvzf mysql-5.0.45.tar.gz
rm mysql-5.0.45.tar.gz

cd mysql-5.0.45
cat ../squt/parser/DBIx-MyParse-0.88/mysql.patch | patch -p1

./configure --with-embedded-server --enable-shared
make
cd sql/share
make install

cd $DIR/parser/DBIx-MyParse-0.88/
perl Makefile.PL

make install
mkdir /tmp/myparse
mkdir /tmp/myparse/test
make test