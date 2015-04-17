#!/bin/bash

usage(){
	echo "Usage: $0 [--help | [--mysql-version=<custom MySQL version>] | [[--mysql-path=<existing MySQL path>] [--no-mysql-make] [--no-mysql-patch]]]"
	exit 1
}

SQUT_DIR=$PWD

DEFAULT_MYSQL_PATH=true
DO_PATCH=true
DO_MYSQL_MAKE=true
MYSQL_VERSION="5.0.96"
APACHE_CONF_FILE="/etc/apache2/apache2.conf"

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

# Download MySQL

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

# Patch MySQL

cd $MYSQL_FULL_DIR
if $DO_PATCH == true; then
	PATCH_FILE=$SQUT_DIR/parser/DBIx-MyParse-0.88/patches/$MYSQL_ARCHIVE_NAME.patch
	if [ ! -f "$PATCH_FILE" ]; then
		echo "FATAL : required patch file $PATCH_FILE doesn't exist !">&2
		exit;
	fi
	cat $PATCH_FILE | patch -p1
fi

OLD_CC=$CC
OLD_CXX=$CXX

# Configure and compile MySQL

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

# Generate the parser's Makefile

cd $SQUT_DIR/parser/DBIx-MyParse-0.88/
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
	# Compile the parser with the generated Makefile
	make install
	OUT=$?
	if [ $OUT -eq 0 ];then
		# Test the parser
		mkdir /tmp/myparse
		mkdir /tmp/myparse/test
		make test
		OUT=$?
		if [ $OUT -eq 0 ];then
			cd $SQUT_DIR/front-end
			chmod 666 error_output.log

			npm install
			npm install -g grunt-cli
			npm install grunt
			grunt
			OUT=$?
			if [ $OUT -eq 0 ];then
				# Add an alias in the Apache config
				if [ -e $APACHE_CONF_FILE ]; then
					if grep -q squt $APACHE_CONF_FILE; then
					  "It looks like squt already has an Apache alias, skipping the alias creation"
					else
						cat >> $APACHE_CONF_FILE <<-APACHE_ALIAS

						Alias /squt "$SQUT_DIR/front-end"
						<Directory "$SQUT_DIR/front-end">
							Options FollowSymLinks MultiViews
							AllowOverride all
							Order Allow,Deny
							Allow from all
						</Directory>
						APACHE_ALIAS
						
						sudo service apache2 restart
					fi
				else
					echo "The apache configuration $APACHE_CONF_FILE file does not exist or is not writeable, aborting the alias creation"
				fi
			fi
		else
			echo "The parser tests failed, aborting."
			exit
		fi
	fi
fi
