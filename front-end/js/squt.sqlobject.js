function Sqlobject(){}

Sqlobject.process = function() {
	console.error("Sqlobject method "+arguments.callee+" called directly");
};

Sqlobject.build = function() {
	console.error("Sqlobject method "+arguments.callee+" called directly");
};

Sqlobject.getChargedElement = function() {
	console.error("Sqlobject method "+arguments.callee+" called directly");
};

Sqlobject.findByDatum = function() {
	console.error("Sqlobject method "+arguments.callee+" called directly");
};

Sqlobject.position = function() {
	console.error("Sqlobject method "+arguments.callee+" called directly");
};