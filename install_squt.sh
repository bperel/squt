#!/bin/bash
DIR=$PWD
MYSQL_DL_DIR="/usr/src/";
MYSQL_ARCHIVE_PREFIX="mysql-";
MYSQL_VERSION="5.0.51a"
MYSQL_ARCHIVE_NAME=$MYSQL_ARCHIVE_PREFIX$MYSQL_VERSION;

cd $MYSQL_DL_DIR
wget http://downloads.mysql.com/archives/mysql-5.0/$MYSQL_ARCHIVE_NAME.tar.gz
tar xvzf $MYSQL_ARCHIVE_NAME.tar.gz
rm $MYSQL_ARCHIVE_NAME.tar.gz

cd $MYSQL_ARCHIVE_NAME
cat $DIR/parser/DBIx-MyParse-0.88/mysql.patch | patch -p1

export CC="gcc -fPIC"
export CXX="g++ -fPIC"
./configure --with-embedded-server --enable-shared
make
cd sql/share
make install

cd $DIR/parser/DBIx-MyParse-0.88/
PERL_MM_USE_DEFAULT=1 perl -MCPAN -e 'install JSON::PP'
perl Makefile.PL $MYSQL_DL_DIR$MYSQL_ARCHIVE_NAME
OUT=$?

if [ $OUT -eq 0 ];then
	make install
	OUT=$?
	if [ $OUT -eq 0 ];then
		mkdir /tmp/myparse
		mkdir /tmp/myparse/test
		make test

		export CC="gcc"
		export CXX="g++"

		chmod 666 $DIR/front-end/error_output.log
	fi
fi