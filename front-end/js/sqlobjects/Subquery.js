var Subquery = function(){};

Subquery.prototype = new Sqlobject();


var subqueryRects;

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
		: subqueryRects.filter(function(d2) { return d2.subqueryGroup == d.name; });
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

Subquery.findByDatum = function(d) {
	return subqueryRects.filter(function(subquery) {
		return d.name == subquery.name;
	});
};