var force = d3.layout.force()
			.gravity(0.5)
			.charge(getNodeCharge)
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
		 
	links,
	linksToFunctions,
	linksToOutput;

var n=[],l=[];

var svg = d3.select("#main").append("svg:svg")
	.attr("id","graph")
	.attr("width", W)
	.attr("height", H)
	.call(d3.behavior.zoom()
		.on("zoom",function() {
			svg.select("svg>g.main").attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
		})
	);
var mainGroup;
var chargeForces;


addDefs();

function cleanupGraph() {
	svg.selectAll('image,svg>g.main').remove();
}

function buildGraph() {

	tables = d3.values(tables);
	tableAliases = d3.values(tableAliases);
	fields = d3.values(fields);

	cleanupGraph();
	
	mainGroup = svg.append("svg:g").classed("main", true);

	Subquery.build(tables);
	Table.build(tables);

	Flow.build(links);
		
	Function.build(functions);
	Flow.buildPathToFunctions(linksToFunctions);

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

function getElement(d, args) {
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
	var element = getElement(d);
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
	Flow.position();

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