## squt (it's like SQL, but cUTe)

squt is a Perl and PHP/JS Web application aiming at graphically representing MySQL queries in a graph form.

![squt example](https://raw.github.com/wiki/bperel/squt/images/squt_example.png)


## Installation

#### Using Docker

```bash
docker run -d --name squt-box -p 8010:80 bperel/squt /usr/sbin/apache2ctl -D FOREGROUND
```

squt will then be available through port 8010 of your machine : [http://localhost:8010/squt](http://localhost:8010/squt/)

#### Directly on a Debian/Ubuntu system or through Cygwin

If you prefer a step-by-step installation have a look at the [Installation guide](../../wiki/Installation-Guide).


## Features

Basically, squt works with most SELECT queries. It doesn't like nested subqueries that much though.

Head over to the [Features](../../wiki/Features) page for more details.

## Demo

[Here is the demo](http://dedibox2-bperel.ddns.net:8010/squt/) :-)


## Understanding and collaborating

Head over to the [How it works](../../wiki/How-it-works) page for a quick explanation of architecture of squt.

Pull requests are always appreciated.


[<img alt="Licence Creative Commons" style="border-width:0" src="http://i.creativecommons.org/l/by-sa/3.0/fr/88x31.png" />](http://creativecommons.org/licenses/by-sa/3.0/legalcode)
