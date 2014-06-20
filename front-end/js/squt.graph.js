var force = d3.layout.force()
			.gravity(0.5)
			.charge(function(d) {
				return getNodeCharge(d);
			})
			.size([W*2/3, H*2/3]);
			
function dragstart() {
	d3.event.sourceEvent.stopPropagation();
	force.stop();
}

function dragmove(d) {
	d.x = d3.event.x;
	d.y = d3.event.y;
	positionAll();
}

function dragend(d) {
	d.fixed = true;
	positionAll();
}

var node_drag = d3.behavior.drag()
	.origin(function(d) { return d; })
	.on("dragstart", dragstart)
	.on("drag", dragmove)
	.on("dragend", dragend);

var subqueries,
	tables,
	tableAliases,
	fields,
	functions,
	constants,

	limits,
	options,
		 
	links,
	linksToFunctions,
	linksToOutput;

var n=[],l=[];

var svg = d3.select("body").append("svg:svg")
	.attr("id","graph")
	.attr("width", W)
	.attr("height", H)
	.call(d3.behavior.zoom()
		.on("zoom",function(a,b) {
			svg.select("svg>g.main").attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
		})
	);
var mainGroup;

addDefs();

function cleanupGraph() {
	svg.selectAll('image,svg>g.main').remove();
}

var paths,
	pathsToFunctions,
	pathsToOutput,

	chargeForces;

function buildGraph() {

	tables = d3.values(tables);
	tableAliases = d3.values(tableAliases);
	fields = d3.values(fields);

	cleanupGraph();
	
	mainGroup = svg.append("svg:g").classed("main", true);

	Subquery.build(tables);
	
	Table.build(tables);
	
	paths = mainGroup.append("svg:g").selectAll("path.join")
		.data(links)
	  .enter().append("svg:path")
		.classed("link", true)
		.attr("id", function(d,i) { return "link"+i; })
		.attr("marker-start", function(d) { 
			if (d.type == "innerjoin" || d.type == "leftjoin" || d.type == "rightjoin") {
				return "url(#solidlink1)";
			}
			else {
				return "";
			}
		})
		.attr("marker-end", function(d) { 
			if (d.type == "innerjoin") {
				return "url(#solidlink2)";
			}
			else if (d3.keys(SUBSELECT_TYPES).indexOf(d.type) !== -1) {
				return "url(#subquery)";
			}
			else {
				return "";
			}
		})
		.each(function(d,i) {
			if (d3.keys(SUBSELECT_TYPES).indexOf(d.type) !== -1) {
				mainGroup
				  .append("svg:text")
				  	.append("textPath")
				  	  .attr("startOffset","50%")
				  	  .attr("xlink:href","#link"+i)
				  	  .append("tspan")
				  	  	.attr("dy",SUBQUERY_TYPE_PADDING)
				  	  	.text(SUBSELECT_TYPES[d.type]);
			}
		});

	pathsToOutput = mainGroup.append("svg:g").selectAll("path.output")
		.data(linksToOutput)
	  .enter().append("svg:path")
	    .attr("id", function(d,i) { return "outputpath"+i;})
		.attr("marker-end", "url(#arrow)")
		.classed({output: true, link: true});
		
	Function.build(functions);

	pathsToFunctions = mainGroup.append("svg:g").selectAll("path.tofunction")
		.data(linksToFunctions)
	  .enter().append("svg:path")
	    .attr("id", function(d,i) { return "pathtofunction"+i;})
		.attr("marker-end", "url(#arrow)")
		.classed({link: true, tofunction: true});

	Constant.build(constants);

	if (is_debug) {
		chargeForces = mainGroup.append("svg:g").selectAll("g.chargeForce")
			.data(n)
			.enter()
			.append("svg:circle")
				.classed("chargeForce", true);
	}

	if (! d3.select("g#legend").node()) {
		addLegend();
	}

	force
		.nodes(n)
		.links(l)
		.on("tick", positionAll)
		.start();
}

function getAliasWidth(isOutputTable, currentAlias) {
	var aliasNameLength = isOutputTable
		? 0
		: currentAlias.name.length*CHAR_WIDTH + ALIAS_NAME_PADDING.right;

	return ALIAS_NAME_PADDING.left
	     + Math.max(
			aliasNameLength,
			CIRCLE_RADIUS/2 + SORT_SIDE
		);
}

function getAliasPosX(relatedAliases, currentAlias, tableWidth) {
	var pos = tableWidth;
	for (var i=0; i<relatedAliases.length; i++) {
		if (relatedAliases[i].name === currentAlias) {
			return pos;
		}
		pos+=ALIAS_NAME_PADDING.left
  			+relatedAliases[i].name.length*CHAR_WIDTH
			+ALIAS_NAME_PADDING.right;
	}
	return pos;
}

function filterPathOrigin(node, origin, d) {
	switch(origin) {
		case "all":
			return true;
		break;
		case "field":
			return node.fieldName == d.fieldName;
		break;
		case "constant":
			return node.constantId == d.constantId;
		break;
		case "function":
			return node.functionAlias    == d.functionAlias
				|| node.sourceFunctionId == d.functionAlias;
		break;
		default:
			return false;
	}
}

function positionPathsToOutput(origin,d) {
  pathsToOutput.filter(function(link) {
	return filterPathOrigin(link,origin,d);
  }).attr("d", function(link) { 
	  var source = getNode(link);
	  var target = Field.getOutputField(link.outputTableAlias, link.outputName);
	  
	  return getPath(this, source, target);
  });
}

function positionPathsToFunctions(origin,d) {
	pathsToFunctions.filter(function(link) {
	  return filterPathOrigin(link,origin,d);
	}).attr("d", function(d) {
		var source = getNode(d, {role: "source"});
		var target = getNode(d, {role: "target"});
		
	    return getPath(this, source, target);
	});
}

function getPath(pathElement, source, target) {
	var sourceCoords = getAbsoluteCoords(source);
	var targetCoords = getAbsoluteCoords(target);
	var isArc = true;//!(source.data()[0].type === "constant" && target.data()[0].type === "function");
	
	var pathCoords=getPathFromCoords(sourceCoords, targetCoords, isArc);
	d3.select(pathElement).attr("d",pathCoords);
	var pathObject = domElementToMyObject(pathElement);
	
	sourceCoords = getCorrectedPathPoint(pathObject, source, sourceCoords, target, targetCoords);
	targetCoords = getCorrectedPathPoint(pathObject, target, targetCoords, source, sourceCoords);
	
	return getPathFromCoords(sourceCoords, targetCoords, isArc);
}

function getCorrectedPathPoint(pathObject, element, elementCoords, otherElement, otherElementCoords) {
	var elementData = element.data()[0];
	switch (elementData.type) {
		case "function":
		case "constant":
			var elementObject = domElementToMyObject(element[0][0]);
			return getIntersection(pathObject, elementObject, otherElementCoords) || elementCoords;
		break;
		case "field":
//			if (elementData.tableAlias.indexOf(OUTPUT_PREFIX) !== -1) {
//				var subqueryName=elementData.tableAlias.substring(OUTPUT_PREFIX.length);
//				if (subqueryName !== MAIN_QUERY_ALIAS && element.data()[0].subqueryGroup !== otherElement.data()[0].subqueryGroup) {
//					var elementObject = domElementToMyObject(d3.select('.subquery[name="'+subqueryName+'"]')[0][0]);
//					return getIntersection(pathObject, elementObject, otherElementCoords) || elementCoords;
//				}
//			}
	}
	return elementCoords;
}

function getIntersection(object1, object2, otherElementCoords) {
	if (!!object1 && !!object2) {
		var intersection = Intersection.intersectShapes(object1, object2);
		if (intersection.points.length > 0) {
			var minDistance = undefined;
			var closest = null;
			for (var i=0; i<intersection.points.length; i++) {
				var distance = getDistance(otherElementCoords.x, otherElementCoords.y, intersection.points[i].x, intersection.points[i].y);
				if (!minDistance || distance < minDistance) {
					minDistance = distance;
					closest = intersection.points[i];
				}
			}
			return {x: closest.x, y: closest.y};
		}
	}
	return null;
}

function getPathFromCoords(p1, p2, isArc) {
	if (isArc) {
		var dr = getDistance(p1.x, p1.y, p2.x, p2.y);
		return "M" + p1.x + "," + p1.y + "A" + dr + "," + dr + " 0 0,1 " + p2.x + "," + p2.y;
	}
	else { // Line
    	return "M" + p1.x + "," + p1.y + "L" + p2.x + "," + p2.y;
	}
}

function getDistance(x1, y1, x2, y2) {
	var dx = x2 - x1,
  	    dy = y2 - y1;
  	return Math.sqrt(dx * dx + dy * dy);
}

function getAbsoluteCoords(element) {
	var coords = {};
	if (element.attr("x") !== null) {
		coords = {x: parseFloat(element.attr("x")), 
				  y: parseFloat(element.attr("y"))};
	}
	else if (element.attr("cx") !== null) {
		coords = {x: parseFloat(element.attr("cx")), 
				  y: parseFloat(element.attr("cy"))};
	}
	else if (element.attr("transform") !== null) {
		coords = d3.transform(element.attr("transform")).translate;
		coords = {x: coords[0],
				  y: coords[1]};
	}
	
	if (!coords.x || !coords.y) {
		coords = {x:0, y:0};
	}

	var parentNode = element.node().parentNode;
	if (parentNode.tagName !== "svg" && !d3.select(parentNode).classed("main")) {
		var parentCoords = getAbsoluteCoords(d3.select(element.node().parentNode));
		coords.x+=parentCoords.x;
		coords.y+=parentCoords.y;
	}
	return coords;
}

function getLinkSourceId(link) {
	var sourceId;
	switch(link.from) {
		case "field":
			sourceId = parseInt(Field.getTableIdFromName(link.fieldName));
			break;
		case "function":
			sourceId = parseInt(getFunctionId(link.sourceFunctionId));
			break;
		case "constant":
			sourceId = parseInt(getConstantId(link.constantId));
			break;
		default:
			break;
	}
	return sourceId;
}

function getNode(d, args) {
	args = args || {};
	switch (d.type) {
		case "table":
			return Table.findByDatum(d);
			break;
		case "function":
			return Function.findByDatum(d, false).datum().center;
		break;
		case "field":
			return Field.getByFullName(d.fieldName);
		break;
		case "link":
			args.role = args.role || "source";
			if (args.role == "source") {
				switch (d.from) {
					case "field":
						return Field.getByFullName(d.fieldName);
					break;
					case "function":
						return Function.findByDatum(d, true).datum().center;
					break;
					case "constant":
						return Constant.findByDatum(d, false);
					break;
				}
			}
			else {
				return Function.findByDatum(d, false).datum().center;
			}
		break;
		case "constant":
			return Constant.findByDatum(d, true);
		break;
		case "subquery":
			return Subquery.findByDatum(d, true);
			break;
	}

	return null;
}

function getNodeCharge(d) {
	var charge = 0;
	var element = null;
	switch(d.type) {
		case "table":
			element = Table.findByDatum(d);
		break;
		
		case "function":
			element = Function.findByDatum(d, false);
		break;

		case "constant":
			element = Constant.findByDatum(d, true);
		break;
		
		case "subquery":
			element = Subquery.getChargedElement(d);
		break;
	}
	
	if (element) {
		var boundingRect = element.node().getBoundingClientRect();
		var nodeSide = d3.max([boundingRect.width, boundingRect.height]);
		charge = 1.5*Math.PI*(nodeSide/2)*(nodeSide/2);

		if (is_debug) {
			chargeForces
				.filter(function(d2) {
					return d.name === d2.name;
				})
				.attr("r", nodeSide/2);
		}
	}
	
	if (isNaN(charge)) {
		console.log("Charge of node "+JSON.stringify(d)+" is NaN");
	}
	return -1*charge;
}

function getGroupCenter(d, axis) {
	if (d.type === "subquery" && d.name === MAIN_QUERY_ALIAS) {
		return null;
	}
	var element = getNode(d);
	if (element.node()) {
		var bbox = element.node().getBBox();
		var pos = getAbsoluteCoords(element);
		return axis === 'x' ? pos.x + bbox.x + bbox.width  /2
							: pos.y + bbox.y + bbox.height /2;
	}
	return null;
}

function positionAll() {

	Subquery.position(tableGroups);

	Function.position();

	Constant.position();
	
	pathsToOutput.each(function(d) {
		positionPathsToOutput(d.from,d);
	});

	if (is_debug) {
		chargeForces
			.attr("cx", function(d) {
				return getGroupCenter(d, 'x');
			})
			.attr("cy", function(d) {
				return getGroupCenter(d, 'y');
			});
	}
}

function getOutputId(outputAlias) {
	for (var i in n) {
		if (outputAlias == n[i].name
		 && !l.filter(function(link) {
				return link.target.index === i;
			}).length) {
			return i;
		}
	}
	return null;
}

function getFunctionId(funcName) {
	for (var i in n) {
		if (funcName == n[i].functionAlias)
			return i;
	}
	return null;
}

function getConstantId(constantId) {
	for (var i in n) {
		if (constantId == n[i].id)
			return i;
	}
	return null;
}

function domElementToMyObject(element) {	
	var localName = element.localName;
	switch ( localName ) {
	    case "ellipse":
	    	var absolutePosition = getAbsoluteCoords(d3.select(element));
	    	var absolutizedElement = d3.select(d3.select(element).node().cloneNode(true));
	    	absolutizedElement
	    		.attr("cx",absolutePosition.x)
	    		.attr("cy",absolutePosition.y);
	    	return new Ellipse(absolutizedElement.node());   
	    break;
	    case "path":
	    	return new Path(element);
	    break;
		default:
			return null;
		break;
	}
}