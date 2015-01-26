## squt (it's like SQL, but cUTe)

squt is a Perl and PHP/JS Web application aiming at graphically representing MySQL queries in a graph form.

![squt example](https://raw.github.com/wiki/bperel/squt/images/squt_example.png)


## Installation

#### Using Vagrant (64-bit hosts only)

* Download and install [Virtualbox](https://www.virtualbox.org/wiki/Downloads) if not already done
* Download and install [Vagrant](https://www.vagrantup.com/downloads.html) if not already done.

Both of them should be in your PATH environment variable.

Then se our Vagrant box :
```
vagrant init bperel/squt-wheezy
vagrant up
```

squt will then be available through port 8000 of your machine : [http://localhost:8000/squt/front-end/squt.html](http://localhost:8000/squt/)

#### Directly on a Debian/Ubuntu system or through Cygwin

If you prefer a step-by-step installation have a look at the [Installation guide](../../wiki/Installation Guide).


## Features

Basically, squt works with most SELECT queries. It doesn't like nested subqueries that much though.

Head over to the [Features](../../wiki/Features) page for more details.

## Demo

[Here is the demo](http://62.210.239.25/squt/) :-)


## Understanding and collaborating

Head over to the [How it works](../../wiki/How-it-works) page for a quick explanation of architecture of squt.

Pull requests are always appreciated.


[<img alt="Licence Creative Commons" style="border-width:0" src="http://i.creativecommons.org/l/by-sa/3.0/fr/88x31.png" />](http://creativecommons.org/licenses/by-sa/3.0/legalcode)
