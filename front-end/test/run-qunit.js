if (!(phantom.args.length === 1 || phantom.args.length === 2)) {
    console.log('Usage: run-qunit.js URL [debug]');
    phantom.exit(1);
}

var page = require('webpage').create();

if (phantom.args.length === 2 && phantom.args[1] == "debug") {
	page.onConsoleMessage = function(msg) {
		console.log(msg);
	};
}

page.open(phantom.args[0], function(status){
    if (status !== "success") {
        console.log("Unable to access network");
        phantom.exit(1);
    }
	console.log(page.evaluate(function(){
		return document.getElementById('report').innerText;
	}));
	phantom.exit(0);
});

