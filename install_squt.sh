#!/bin/bash

usage(){
	echo "Usage: $0 [--help | [--mysql-version=<custom MySQL version>] | [[--mysql-path=<existing MySQL path>] [--no-mysql-make] [--no-mysql-patch]]]"
	exit 1
}

DIR=$PWD

DEFAULT_MYSQL_PATH=true
DO_PATCH=true
DO_MYSQL_MAKE=true
MYSQL_VERSION="5.0.96"

while :
do
    case $1 in
        --mysql-path=*)
            MYSQL_FULL_DIR=${1#*=} 
        	MYSQL_FULL_DIR=${MYSQL_FULL_DIR%/}
        	MYSQL_ARCHIVE_NAME=${MYSQL_FULL_DIR##*/}
			DEFAULT_MYSQL_PATH=false
            shift
            ;;
        --mysql-version=*)
            MYSQL_VERSION=${1#*=}
            shift
            ;;
		--no-mysql-patch)
			DO_PATCH=false
            shift
            ;;
		--no-mysql-make)
			DO_MYSQL_MAKE=false
            shift
            ;;
		--help)
			usage
			exit
            ;;
        --) # End of all options
            shift
            break
            ;;
        -*)
            echo "FATAL: Unknown option (ignored): $1" >&2
            usage
            shift
            ;;
        *)  # no more options. Stop while loop
            break
            ;;
    esac
done


if $DEFAULT_MYSQL_PATH == true; then
	MYSQL_DL_DIR="/usr/src/"
	MYSQL_ARCHIVE_PREFIX="mysql-"
	MYSQL_ARCHIVE_NAME=$MYSQL_ARCHIVE_PREFIX$MYSQL_VERSION
	MYSQL_FULL_DIR=$MYSQL_DL_DIR$MYSQL_ARCHIVE_NAME
	MYSQL_FULL_ARCHIVE_NAME=$MYSQL_ARCHIVE_NAME.tar.gz
	
	cd $MYSQL_DL_DIR
	wget https://dev.mysql.com/get/Downloads/MySQL-5.0/$MYSQL_FULL_ARCHIVE_NAME
	OUT=$?
	if [ $OUT -ne 0 ]; then
		exit;
	fi
	tar xvzf $MYSQL_FULL_ARCHIVE_NAME
	rm $MYSQL_FULL_ARCHIVE_NAME
else
	if [ ! -d "$MYSQL_FULL_DIR" ]; then
		echo "FATAL : $MYSQL_FULL_DIR doesn't exist !">&2
		exit;
	else
		echo "Using existing MySQL installation $MYSQL_FULL_DIR"
	fi
fi

cd $MYSQL_FULL_DIR
if $DO_PATCH == true; then
	PATCH_FILE=$DIR/parser/DBIx-MyParse-0.88/patches/$MYSQL_ARCHIVE_NAME.patch
	if [ ! -f "$PATCH_FILE" ]; then
		echo "FATAL : required patch file $PATCH_FILE doesn't exist !">&2
		exit;
	fi
	cat $PATCH_FILE | patch -p1
fi

OLD_CC=$CC
OLD_CXX=$CXX

if $DO_MYSQL_MAKE == true; then
	export CC="gcc -fPIC"
	export CXX="g++ -fPIC"
	
	./configure --with-embedded-server --enable-shared
	OUT=$?
	if [ $OUT -ne 0 ]; then
		exit;
	fi
	make
	OUT=$?
	if [ $OUT -ne 0 ]; then
		exit;
	fi
	cd sql/share
	make install
	OUT=$?
	if [ $OUT -ne 0 ]; then
		exit;
	fi
fi

cd $DIR/parser/DBIx-MyParse-0.88/
PERL_MM_USE_DEFAULT=1 perl -MCPAN -e 'install JSON::PP'
OUT=$?
if [ $OUT -ne 0 ]; then
	exit;
fi

perl Makefile.PL $MYSQL_FULL_DIR
OUT=$?

export CC="$OLD_CC"
export CXX="$OLD_CXX"

if [ $OUT -eq 0 ];then
	make install
	OUT=$?
	if [ $OUT -eq 0 ];then
		mkdir /tmp/myparse
		mkdir /tmp/myparse/test
		make test

		cd $DIR/front-end
		chmod 666 error_output.log
		
		npm install
		npm install -g grunt
		npm install -g grunt-cli
		grunt
	fi
fi
