var Subquery = function(){};

Subquery.prototype = new Sqlobject();


var subqueryRects;

Subquery.process = function processQuery(data) {
	if (data.Subqueries) {
		d3.forEach(data.Subqueries, function(subquery) {
			Subquery.process(subquery);
		});
	}

	var subqueryGroup=data.SubqueryAlias || MAIN_QUERY_ALIAS;
	var subqueryType=data.SubqueryType;

	var outputTableAlias=OUTPUT_PREFIX+subqueryGroup;

	tableAliases[outputTableAlias]={
		table: outputTableAlias,
		name:  outputTableAlias
	};

	subqueries[subqueryGroup]={
		type: "subquery",
		name: subqueryGroup
	};

	Table.addOutputTable(subqueryGroup, outputTableAlias);
	d3.forEach(data.Tables, function(tableInfo, tableName) {
		Table.process(tableInfo, tableName, subqueryGroup, subqueryType, outputTableAlias)
	});

	var functionCpt=0;
	d3.forEach(data.Functions, function(functionAliasInfo, functionAlias) {
		Function.process(functionAliasInfo, functionAlias, subqueryGroup, functionCpt, outputTableAlias);
		functionCpt++;
	});

	Constant.process(data.Constants, outputTableAlias, subqueryGroup);

	// If we are in a subquery, the outputs must be transmitted to the superquery if included in the main query's SELECT
	if (subqueryGroup !== MAIN_QUERY_ALIAS) {
		d3.forEach(fields, function(field) {
			if (field.tableAlias === OUTPUT_PREFIX + subqueryGroup) {
				var outputName;
				if (subqueryType === "SINGLEROW_SUBS") {
					outputName = subqueryGroup;
				}
				else if (subqueryType === null) { // Derived table
					outputName = field.name;
				}

				if (!!outputName) {
					var fullName = [field.tableAlias, field.name].join('.');
					var fullNameInMainSubquery = [MAIN_SUBQUERY_OUTPUT_ALIAS, outputName].join('.');
					fields.push({type: "field", tableAlias: MAIN_SUBQUERY_OUTPUT_ALIAS, name: outputName, fullName: fullNameInMainSubquery, filtered: false, sort: false, subqueryGroup: MAIN_QUERY_ALIAS});
					linksToOutput.push({type: "link", from: "field", fieldName: fullName, outputName: outputName, outputTableAlias: MAIN_SUBQUERY_OUTPUT_ALIAS});
				}
			}
		});
	}

	if (!!data.Limits) {
		limits.push({subqueryGroup: subqueryGroup, limits: data.Limits});
	}
	if (!!data.Options) {
		options.push({subqueryGroup: subqueryGroup, options: data.Options});
	}
};

Subquery.build = function (data) {
	subqueryRects = mainGroup.selectAll("rect.subquery")
		.data(data.filter(function (table) {
			return table.subqueryGroup !== MAIN_QUERY_ALIAS;
		}))
		.enter().insert("svg:rect", ":first-child")
		.classed("subquery", true);
};

Subquery.getChargedElement = function(d) {
	return d.name === MAIN_QUERY_ALIAS
		? null
		: Subquery.findByDatum(d, false);
};

Subquery.position = function(data) {
	var subqueryBoundaries=[];
	data.each(function(d,i) {
		var tableBoundaries = Table.position.call(this,d,i);
		if (d.subqueryGroup !== undefined) {
			if (!subqueryBoundaries[d.subqueryGroup]) {
				subqueryBoundaries[d.subqueryGroup]=[];
			}
			subqueryBoundaries[d.subqueryGroup].push(tableBoundaries);
		}
	});
	d3.forEach(subqueryBoundaries, function(boundaries, subqueryGroup) {
		var topBoundary = 	 d3.min(boundaries, function(coord) { return coord.y1; }) - SUBQUERY_PADDING;
		var rightBoundary =  d3.max(boundaries, function(coord) { return coord.x2; }) + SUBQUERY_PADDING;
		var bottomBoundary = d3.max(boundaries, function(coord) { return coord.y2; }) + SUBQUERY_PADDING;
		var leftBoundary = 	 d3.min(boundaries, function(coord) { return coord.x1; }) - SUBQUERY_PADDING;

		subqueryRects.filter(function(subquery) { return subquery.subqueryGroup === subqueryGroup; })
			.attr("x",leftBoundary)
			.attr("y",topBoundary)
			.attr("width",rightBoundary-leftBoundary)
			.attr("height",bottomBoundary-topBoundary);
	});
};

Subquery.findByDatum = function(d, useAlias) {
	return subqueryRects.filter(function(subquery) {
		return d.name === (useAlias ? subquery.name : subquery.subqueryGroup);
	});
};