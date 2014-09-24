function processJsonData(jsondata) {

	clearLog();

	if (jsondata == null) {
		log("Make sure your paths are properly configured", "Error");
		cleanupGraph();
		return;
	}
	if (jsondata.Error !== undefined) {
		log(jsondata.Error, "Error");
		cleanupGraph();
		force.stop();
		return;
	}

	toggleLinkDisplay(false);

	if (jsondata.Warning) {
		var warningText=[];
		d3.forEach(jsondata.Warning, function(warnings, warnType) {
			d3.forEach(warnings, function(details, relatedObject) {
				switch (warnType) {
					case "No alias": case "No alias field ignored":
						var objectType = details[0],
							clause     = details[1],
							objectName = AGGREGATION_LABELS[relatedObject] || relatedObject;
						warningText.push("Warning-No named alias for "+objectType+" "+ objectName + (clause ? " located in "+clause+" clause " : "")
										+(warnType === "No alias field ignored" ? ": field will be ignored" : ""));

					break;
					case "Not supported":
						warningText.push("Warning-Not supported : " + relatedObject + (details ? " ("+details+")":""));
						break;
				}
			});
		});
		log(warningText.join("\n"));
	}

	subqueries=		 [];
	tables= 	 	 [];
	tableAliases=	 [];
	fields= 	 	 [];
	functions=		 [];
	constants=		 [];
	limits=          [];
	options=         [];
	links= 			 [];
	linksToFunctions=[];
	linksToOutput=	 [];

	Subquery.process(jsondata);

	var fieldId = 0;
	d3.forEach(d3.keys(fields), function(key) {
		fields[key].id=fieldId++;
	});

	tableAliases = d3.values(tableAliases);

	n = 	  d3.values(tables)
		.concat(d3.values(functions))
		.concat(d3.values(constants))
		.concat(d3.values(subqueries));
	l = [];

	d3.forEach(links, function(link) {
		var sourceTableId = parseInt(Field.getTableIdFromName(link.source));
		var targetTableId;
		if (d3.keys(SUBSELECT_TYPES).indexOf(link.type) !== -1) {
			targetTableId = parseInt(Table.getIdFromName(link.target));
		}
		else {
			targetTableId = parseInt(Field.getTableIdFromName(link.target));
		}
		addOrStrengthenLink(sourceTableId, targetTableId);
	});


	d3.forEach(linksToOutput, function(link) {
		var sourceId = Flow.getSourceId(link);
		var targetId = parseInt(getOutputId(link.outputTableAlias.replace(OUTPUT_PREFIX,'')));
		addOrStrengthenLink(sourceId, targetId);
	});

	d3.forEach(linksToFunctions, function(link) {
		var sourceId = Flow.getSourceId(link);
		var targetId = parseInt(Function.getId(link, "target"));
		addOrStrengthenLink(sourceId, targetId);
	});

	l = d3.values(l);

	buildGraph();
}

function addOrStrengthenLink(sourceId, targetId) {
	var linkId = [sourceId, targetId].join('/');
	var linkStrength;
	if (l[linkId]) {
		linkStrength = l[linkId].value + 1;
	}
	else {
		linkStrength = 1;
	}
	l[linkId] = {source: sourceId, target: targetId, value: linkStrength};
}

d3.forEach = function (obj, callback) {
	if (typeof obj === 'object') {
		Array.prototype.forEach.call(Object.keys(obj), function (prop) {
			callback(obj[prop], prop);
		});
	}
};