## squt (it's like SQL, but cUTe)

squt is a Perl and PHP/JS Web application aiming at graphically representing MySQL queries in a graph form.

![squt example](https://raw.github.com/wiki/ducksmanager/squt/images/squt_example.png)

squt uses :
* Philip Stoev's [MyParse](http://search.cpan.org/~philips/DBIx-MyParse/) to parse MySQL queries
* Mike Bostock's [d3](https://github.com/mbostock/d3.git) to handle the graph representation.
* Marijn Haverbeke's [CodeMirror](https://github.com/marijnh/CodeMirror) for the in-browser code editor
* Kevin Lindsey's [js-intersections](https://github.com/thelonious/js-intersections.git) for geometrical intersection calculations.
* jQuery's [qunit](https://github.com/jquery/qunit.git) and [qunit-reporter-junit](https://github.com/jquery/qunit-reporter-junit.git) along with PrettyCode's [Object.identical.js](https://github.com/prettycode/Object.identical.js.git) for testing purposes

All of them are integrated into squt as submodules : no need to install them manually.


Want to know more and install it ? Have a look at the [Installation guide](../../wiki/Installation Guide) !

Want some intel about how that system works ? Head over to the [How it works](../../wiki/How-it-works) and [Features](../../wiki/Features) pages.

... Or play with the online [demo](http://62.210.239.25//squt/master/front-end/squt.html) :-)

[<img alt="Licence Creative Commons" style="border-width:0" src="http://i.creativecommons.org/l/by-sa/3.0/fr/88x31.png" />](http://creativecommons.org/licenses/by-sa/3.0/legalcode)
