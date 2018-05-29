FROM ttaranto/docker-nginx-php7
MAINTAINER Bruno Perel

RUN apt-get update
RUN apt-get install -y g++ cmake make libncurses5-dev zlib1g zlib1g-dev \
                       git unzip perl wget openssl patch autoconf \
                       npm

COPY ./install_squt.sh /home
COPY ./parser /usr/src/squt
COPY ./front-end /var/www/public

RUN cd /home && sh install_squt.sh
