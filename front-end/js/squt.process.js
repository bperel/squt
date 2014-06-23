function processJsonData(jsondata) {

	if (jsondata == null) {
		d3.select('#log').text("Error ! Make sure your paths are properly configured");
		cleanupGraph();
		return;
	}
	if (jsondata.Error !== undefined) {
		d3.select('#log').text("ERROR - " + jsondata.Error);
		cleanupGraph();
		force.stop();
		return;
	}

	toggleLinkDisplay(false);

	if (jsondata.Warning) {
		var warningText=[];
		d3.forEach(jsondata.Warning, function(warnings, warnType) {
			d3.forEach(warnings, function(warning, relatedObject) {
				switch (warnType) {
					case "No alias": case "No alias field ignored":
					warningText.push("WARNING - No named alias for field " + relatedObject + (warning ? " located in "+warning+" clause " : "")
						+(warnType === "No alias field ignored" ? ": field will be ignored" : ""));

					break;
					case "Invalid":
						warningText.push("WARNING - Invalid statement '" + relatedObject + "' in "+warning+" clause : the statement will be ignored");
						break;
					case "Not supported":
						warningText.push("WARNING - Not supported : " + relatedObject
							+ (warning ? " ("+warning+")":""));
						break;
				}
			});
		});
		d3.select('#log').text(warningText.join("\n"));
	}
	else {
		d3.select('#log').text("");
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
		var sourceId = getLinkSourceId(link);
		var targetId = parseInt(getOutputId(link.outputTableAlias.replace(OUTPUT_PREFIX,'')));
		addOrStrengthenLink(sourceId, targetId);
	});

	d3.forEach(linksToFunctions, function(link) {
		var sourceId = getLinkSourceId(link);
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