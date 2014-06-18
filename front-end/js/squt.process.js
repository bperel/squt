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

function processQuery(jsondata) {
	var subqueryGroup=jsondata.SubqueryAlias || MAIN_QUERY_ALIAS;
	var subqueryType=jsondata.SubqueryType;

	var outputTableAlias=OUTPUT_PREFIX+subqueryGroup;

	tableAliases[outputTableAlias]={table: outputTableAlias,
		name:  outputTableAlias};

	subqueries[subqueryGroup]={type: "subquery",
		name: subqueryGroup};

	Table.addOutputTable(subqueryGroup, outputTableAlias);
	d3.forEach(jsondata.Tables, function(tableInfo, tableName) {
		Table.process(tableInfo, tableName, subqueryGroup, subqueryType, outputTableAlias)
	});

	var functionCpt=0;
	d3.forEach(jsondata.Functions, function(functionAliasInfo, functionAlias) {
		var functionDestination=functionAliasInfo.to;
		functions[functionAlias]={type: "function",
			functionAlias: functionAlias,
			name: subqueryGroup+".function_"+functionCpt,
			value: functionAliasInfo.name,
			isCondition: functionDestination === "NOWHERE"
		};
		if (functionDestination === "OUTPUT") {
			linksToOutput.push({type: "link", from: "function", sourceFunctionId: functionAlias, outputName: functions[functionAlias].functionAlias, outputTableAlias: outputTableAlias});
			fields.push({type: "field", tableAlias:outputTableAlias, name: functionAlias, fullName: functionAlias, filtered: false, sort: false, subqueryGroup: subqueryGroup});
		}
		else if (functionDestination !== "NOWHERE") {
			linksToFunctions.push({type: "link", from: "function", sourceFunctionId: functionAlias, functionAlias: functionDestination});
		}
		var functionConstants = functionAliasInfo.Constants;
		if (functionConstants !== undefined) {
			d3.forEach(d3.keys(functionConstants), function(constant) {
				var constantId=constants.length;
				constants.push({id: constantId, name: constant, functionAlias: functionAlias, type: "constant" });
				linksToFunctions.push({type: "link", from: "constant", constantId: constantId, functionAlias: functionAlias});
			});
		}
		functionCpt++;
	});
	if (jsondata.Constants) {
		d3.forEach(jsondata.Constants, function(constant) {
			var constantId=constants.length;
			var constantAlias = constant.alias;
			var constantValue = constant.value;
			var fullName = [outputTableAlias, constantValue].join('.');
			constants.push({id: constantId, name: constantValue, value: constantValue, type: "constant" });
			linksToOutput.push({type: "link", from: "constant", outputTableAlias: outputTableAlias, outputName: constantAlias, constantId: constantId});
			fields.push({type: "field", tableAlias:outputTableAlias, name:constantAlias, fullName:fullName, filtered: false, sort: false, subqueryGroup: subqueryGroup});
		});
	}

	// If we are in a subquery, the outputs must be transmitted to the superquery if included in the main query's SELECT
	if (subqueryGroup !== MAIN_QUERY_ALIAS) {
		d3.forEach(fields, function(field) {
			if (field.tableAlias === OUTPUT_PREFIX + subqueryGroup) {
				var fullName = [field.tableAlias, field.name].join('.');
				var fullNameInMainSubquery;
				var outputName;
				var fieldId;
				if (subqueryType === "SINGLEROW_SUBS") {
					outputName = subqueryGroup;
					fullNameInMainSubquery = [MAIN_SUBQUERY_OUTPUT_ALIAS, outputName].join('.');
					fieldId = subqueryGroup;
				}
				else if (subqueryType === null) { // Derived table
					outputName = field.name;
					fullNameInMainSubquery = [MAIN_SUBQUERY_OUTPUT_ALIAS, outputName].join('.');
					fieldId = fullNameInMainSubquery;
				}

				if (!!outputName) {
					fields.push({type: "field", tableAlias: MAIN_SUBQUERY_OUTPUT_ALIAS, name: outputName, fullName: fullNameInMainSubquery, filtered: false, sort: false, subqueryGroup: MAIN_QUERY_ALIAS});
					linksToOutput.push({type: "link", from: "field", fieldName: fullName, outputName: outputName, outputTableAlias: MAIN_SUBQUERY_OUTPUT_ALIAS});
				}
			}
		});
	}

	if (!!jsondata.Limits) {
		limits.push({subqueryGroup: subqueryGroup, limits: jsondata.Limits});
	}
	if (!!jsondata.Options) {
		options.push({subqueryGroup: subqueryGroup, options: jsondata.Options});
	}
}

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

	d3.forEach(jsondata.Subqueries, function(subquery) {
		processQuery(subquery);
	});
	processQuery(jsondata);

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
		var targetId = parseInt(getFunctionId(link.functionAlias));
		addOrStrengthenLink(sourceId, targetId);
	});

	l = d3.values(l);

	buildGraph();
}

d3.forEach = function (obj, callback) {
	if (typeof obj === 'object') {
		Array.prototype.forEach.call(Object.keys(obj), function (prop) {
			callback(obj[prop], prop);
		});
	}
};