FROM ubuntu:16.04
MAINTAINER Bruno Perel

RUN apt-get update && \
    apt-get install -y g++ cmake make libncurses5-dev zlib1g zlib1g-dev \
                       git unzip perl wget openssl patch autoconf \
                       nodejs-legacy npm apache2 php7.0 libapache2-mod-php7.0

RUN cd /usr/src && git clone --recursive https://github.com/bperel/squt.git

RUN cd /usr/src/squt && sh install_squt.sh
