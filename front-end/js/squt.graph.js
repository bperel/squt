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

addDefs();

function cleanupGraph() {
	svg.selectAll('image,svg>g.main').remove();
}

var tableGroups,
	functionGroups,
	constantGroups,
	subqueryRects,
	fieldNodes,
	
	paths,
	pathsToFunctions,
	pathsToOutput,

	chargeForces;

function buildGraph() {

	tables = d3.values(tables);
	tableAliases = d3.values(tableAliases);
	fields = d3.values(fields);
	fieldNodes = [];

	cleanupGraph();
	
	var g = svg.append("svg:g").classed("main", true);

	subqueryRects = g.selectAll("rect.subquery")
		.data(tables.filter(function(table) {
			return table.subqueryGroup !== MAIN_QUERY_ALIAS;
		}))
		.enter().insert("svg:rect", ":first-child")
		.classed("subquery", true);
	
	tableGroups = g.append("svg:g").selectAll("g")
		.data(tables)
	  .enter().append("svg:g")
		.attr("class", function(currentTable) { return "tableGroup"+(currentTable.output ? " output":""); })
		.call(node_drag)
		.each(function(currentTable) {
			var relatedAliases = tableAliases.filter(function(ta) { return ta.table == currentTable.name; });
			var relatedFields = fields.filter(function(currentField) { 
				return isFieldInTable(currentField, currentTable); 
			});

			var tableWidth=TABLE_NAME_PADDING.left
	  		   			 + CHAR_WIDTH*d3.max([currentTable.name.length,
	  		   			                      d3.max(relatedFields, function(field) { 
	  		   			                    	  return field.name.length; 
	  		   			                      })
	  		   			                     ]);
			var tableHeight=MIN_TABLE_HEIGHT + relatedFields.length * FIELD_LINEHEIGHT;

			var currentTableElement = d3.select(this);
			currentTableElement
			  .append("svg:rect")
				.classed({table: true, output: !!currentTable.output})
				.attr("height", tableHeight)
				.attr("width",  tableWidth );
			
			currentTableElement
			  .append("svg:text")
				.text(currentTable.output ? OUTPUT_LABEL : currentTable.name)
				.classed({tablename: true, output: !!currentTable.output})
				.attr("x", TABLE_NAME_PADDING.left)
				.attr("y", currentTable.output ? TABLE_NAME_PADDING.output_top : TABLE_NAME_PADDING.top);
			
			currentTableElement
			  .append("svg:line")
				.classed("tableSeparator", true)
				.attr("x1", 0)
				.attr("x2", tableWidth)
				.attr("y1", LINE_SEPARATOR_TOP)
				.attr("y2", LINE_SEPARATOR_TOP);
			
			currentTableElement
			  .selectAll("g.aliasGroup")
			    .data(relatedAliases)
			  .enter().append("svg:g")
				.classed("aliasGroup", true)
				.each(function(currentAlias) {
					d3.select(this)
					  .append("svg:text")
						.text(currentTable.output ? "" : currentAlias.name)
						.attr("x", getAliasPosX(relatedAliases, currentAlias.name, tableWidth)+ALIAS_NAME_PADDING.left)
						.attr("y", ALIAS_NAME_PADDING.top);

					d3.select(this)
					  .append("svg:rect")
						.classed({alias: true, output: !!currentTable.output})
						.attr("x", getAliasPosX(relatedAliases, currentAlias.name, tableWidth))
						.attr("y", ALIAS_BOX_MARGIN.top)
						.attr("width", getAliasWidth(!!currentTable.output, currentAlias))
						.attr("height",tableHeight-ALIAS_BOX_MARGIN.top);
				});
			
			var fieldIndex = 0;
			
			currentTableElement
			  .selectAll("g.fieldGroup")
			    .data(relatedFields)
			  .enter().append("svg:g")
				.classed("fieldGroup", true)
				.each(function(currentField,i) {
					var sort = currentField.sort;
					var isFiltered = currentField.filtered;
					var preexistingField = fieldNodes.filter(function(fieldNode) {
						return fieldNode.tableAlias === currentTable.name && fieldNode.name === currentField.name;
					});
					
					var circlePosition = {x: getAliasPosX(relatedAliases, currentField.tableAlias, tableWidth)+ALIAS_NAME_PADDING.left,
										  y: preexistingField.length
											  ? parseInt(preexistingField[0].attr("cy"))
											  : (FIELD_PADDING.top+FIELD_LINEHEIGHT*fieldIndex-CIRCLE_RADIUS/2)};

					fieldNodes.push(
						d3.select(this)
							.append("svg:circle")
							.attr("r",CIRCLE_RADIUS)
							.attr("cx", circlePosition.x)
							.attr("cy", circlePosition.y)
							.classed("filtered", isFiltered)
							.classed("sort_"+sort, !!sort)
					);
					
					if (sort) {
						d3.select(this)
						  .append("svg:image")
						    .attr("xlink:href", "images/sort_"+sort+".svg")
							.attr("width", SORT_SIDE)
							.attr("height",SORT_SIDE)
							.attr("x", circlePosition.x)
							.attr("y", circlePosition.y-SORT_SIDE/2)
						    .classed("order", true);
					}

					if (!preexistingField.length) {
						d3.select(this)
						  .append("svg:text")
						    .text(currentField.name)
							.attr("x", FIELD_PADDING.left)
							.attr("y", FIELD_PADDING.top + FIELD_LINEHEIGHT*fieldIndex);
						
						fieldIndex++;
					}
				});

			if (!!currentTable.output) {
				var infoboxSources = [
					{ type: "options", data: options },
					{ type: "limits" , data: limits  }
				];

				var currentYOffset = tableHeight;

				d3.forEach(infoboxSources, function(infoboxSource) {
					var dataForCurrentSubqueryGroup = infoboxSource.data.filter(function(currentData) {
						return currentData.subqueryGroup === currentTable.subqueryGroup;
					});

					if (dataForCurrentSubqueryGroup.length) {
						var currentData = dataForCurrentSubqueryGroup[0][infoboxSource.type];
						var textLines = [];

						switch(infoboxSource.type) {
							case 'limits':
								textLines.push(
									(currentData.Begin ? LIMITS_2_BOUNDARIES : LIMITS_1_BOUNDARY)
										.replace(/\$1/, currentData.Begin)
										.replace(/\$2/, currentData.End)
										.replace(/\$3/, (currentData.End - currentData.Begin > 1) ? 's' :'')
								);
							break;
							case 'options':
								d3.forEach(currentData, function(value, optionName) {
									textLines.push(OPTIONS_LABELS[optionName]);
								});
							break;
						}

						var infoboxHeight = (1+textLines.length)*CHAR_HEIGHT;

						currentTableElement
							.append("svg:rect")
								.attr("class", "infobox "+infoboxSource.type)
								.attr("height", infoboxHeight)
								.attr("width",  Math.max(textLines.length * CHAR_WIDTH, tableWidth + getAliasWidth(true)))
								.attr("x", 0)
								.attr("y", currentYOffset);

						currentTableElement
							.selectAll(".infoboxText."+infoboxSource.type)
								.data(textLines)
							.enter()
								.append("svg:text")
									.attr("class", "infoboxText "+infoboxSource.type)
									.text(function(line) { return line;})
									.attr("x", OPTION_PADDING.left)
									.attr("y", function(line, lineNumber) { return currentYOffset + OPTION_PADDING.top + lineNumber*CHAR_HEIGHT; });

						currentYOffset += infoboxHeight;
					}
				});
			}
		});
	
	paths = g.append("svg:g").selectAll("path.join")
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
				g
				  .append("svg:text")
				  	.append("textPath")
				  	  .attr("startOffset","50%")
				  	  .attr("xlink:href","#link"+i)
				  	  .append("tspan")
				  	  	.attr("dy",SUBQUERY_TYPE_PADDING)
				  	  	.text(SUBSELECT_TYPES[d.type]);
			}
		});

	pathsToOutput = g.append("svg:g").selectAll("path.output")
		.data(linksToOutput)
	  .enter().append("svg:path")
	    .attr("id", function(d,i) { return "outputpath"+i;})
		.attr("marker-end", "url(#arrow)")
		.classed({output: true, link: true});
		
	functionGroups  = g.append("svg:g").selectAll("g.functionGroup")
		.data(d3.values(functions))
	  .enter()
	  	.append("svg:g")
		.classed("functionGroup", true)
	  	.each(function() {
			d3.select(this).data()[0].center =
				d3.select(this)
		            .append("svg:ellipse")
			            .classed("function", true)
			            .classed("conditional", function(d) { return !!d.isCondition; })
			            .attr("rx",function(d) { return d.value.length*CHAR_WIDTH+FUNCTION_ELLIPSE_PADDING.left*2; })
			            .attr("ry",FUNCTION_BOX_RY+FUNCTION_ELLIPSE_PADDING.top*2);
	  		
	  		d3.select(this)
		  		.append("svg:text")
				.text(function(d) { return d.value; })
				.attr("x", function(d) { return -1*d.value.length*CHAR_WIDTH/2;});
	  			
	  	})
		.call(node_drag);

	pathsToFunctions = g.append("svg:g").selectAll("path.tofunction")
		.data(linksToFunctions)
	  .enter().append("svg:path")
	    .attr("id", function(d,i) { return "pathtofunction"+i;})
		.attr("marker-end", "url(#arrow)")
		.classed({link: true, tofunction: true});


	constantGroups  = g.append("svg:g").selectAll("g.constantGroup")
		.data(d3.values(constants))
		.enter()
		.append("svg:g")
		.classed("constantGroup", true)
		.each(function(currentConstant) {
			var rectDimensions = {
				width:  CONSTANT_PADDING.leftright*2 + CHAR_WIDTH * currentConstant.name.length,
				height: CONSTANT_PADDING.topbottom*2 + CHAR_HEIGHT
			};

			d3.select(this)
				.append("svg:rect")
					.classed("constant", true)
					.attr("x", -rectDimensions.width/2)
					.attr("y", -rectDimensions.height/2)
					.attr("width", rectDimensions.width)
					.attr("height",rectDimensions.height);

			d3.select(this)
				.append("svg:text")
				.text(currentConstant.name)
				.attr("x", -rectDimensions.width/2  + CONSTANT_PADDING.leftright)
				.attr("y", -rectDimensions.height/2 + CONSTANT_PADDING.topbottom + CHAR_HEIGHT);

		})
		.call(node_drag);

	if (is_debug) {
		chargeForces = g.append("svg:g").selectAll("g.chargeForce")
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
	  var target = fieldNodes.filter(function(fieldNode) {
		  var field = fieldNode.datum();
		  return field.tableAlias === link.outputTableAlias && field.name === link.outputName;
	  })[0];
	  
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
			sourceId = parseInt(fieldNameToTableId(link.fieldName));
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
			return tableGroups.filter(function(table) {
				return d.name == table.name;
			});
			break;
		case "function":
			return functionGroups.filter(function(func) {
				return func.functionAlias === d.functionAlias;
			}).datum().center;
		break;
		case "field":
			return fieldNodes.filter(function(fieldNode) {
				var field = fieldNode.datum();
				return field.fullName === d.fieldName;
			})[0];
		break;
		case "link":
			args.role = args.role || "source";
			if (args.role == "source") {
				switch (d.from) {
					case "field":
						return fieldNodes.filter(function(fieldNode) {
							var field = fieldNode.datum();
							return field.fullName === d.fieldName;
						})[0];
					break;
					case "function":
						return functionGroups.filter(function(func) {
							return func.functionAlias === d.sourceFunctionId;
						}).datum().center;
					break;
					case "constant":
						return constantGroups.filter(function(c) {
							return d.constantId == c.id;
						});
					break;
				}
			}
			else {
				return functionGroups.filter(function(func) {
					return func.functionAlias === d.functionAlias;
				}).datum().center;
			}
		break;
		case "constant":
			return constantGroups.filter(function(c) {
				return d.name === c.name;
			});
		break;
		case "subquery":
			return subqueryRects.filter(function(subquery) {
				return d.name == subquery.name;
			});
			break;
	}

	return null;
}

function getNodeCharge(d) {
	var charge = 0;
	var element = null;
	switch(d.type) {
		case "table":
			element = tableGroups.filter(function(d2) { return d2.name === d.name;});
		break;
		
		case "function":
			element = functionGroups.filter(function(d2) { return d2.functionAlias == d.functionAlias; });
		break;

		case "constant":
			element = constantGroups.filter(function(d2) { return d2.name == d.name; });
		break;
		
		case "subquery":
			if (d.name !== MAIN_QUERY_ALIAS) {
				element = subqueryRects.filter(function(d2) { return d2.subqueryGroup == d.name; });
			}
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
	var subqueryBoundaries=[];
	tableGroups.each(function(d,i) {
		var tableBoundaries = positionTable.call(this,d,i);
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
	
	functionGroups.each(function(d,i) {
		positionFunction.call(this,d,i);
	});

	constantGroups.each(function(d,i) {
		positionConstant.call(this,d,i);
	});
	
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

function positionTable(d) {
	var x = d.x || 0;
	var y = d.y || 0;
	
	d3.select(this)
	  .attr("transform", "translate("+x+" "+y+")");
		
	// Paths between fields
	paths.attr("d", function(d) {
	  var source = fieldNodes.filter(function(fieldNode) {
			return fieldNode.datum().fullName === d.source;
	  })[0];
	  var target = fieldNodes.filter(function(fieldNode) {
			return fieldNode.datum().fullName === d.target;
	  })[0];
	  
	  return getPath(this, source, target);
	});
	
	return {x1: x, y1: y, x2: x+this.getBBox().width, y2: y+this.getBBox().height};
}

function positionFunction(d) {
	var x=d.x || 0;
	var y=d.y || 0;

	d3.select(this)
	  .attr("transform", "translate("+x+" "+y+")");

	positionPathsToFunctions("function",d3.select(this).data()[0]);
}

function positionConstant(d) {
	var x=d.x || 0;
	var y=d.y || 0;

	d3.select(this)
		.attr("transform", "translate("+x+" "+y+")");
}

function isFieldInTable(field,table) {
	return tableAliases.filter(function(tableAlias) { 
		return tableAlias.name === field.tableAlias && tableAlias.table == table.name; 
	}).length > 0;
}

function fieldNameToTableId(fieldname) {
	return fieldNameToTable(fieldname, "index");
}
	
function fieldNameToTable(fieldname, indexOrObject) {
	for (var i in n) {
		if (n[i].type === "table") {
			var fieldAlias = tableAliases.filter(function(tableAlias) {
				var currentField = 
					d3.values(fields).filter(function(f) { 
						return fieldname === f.fullName;
					});
				return currentField.length > 0 && tableAlias.name === currentField[0].tableAlias;
			});
			if (fieldAlias.length > 0 && fieldAlias[0].table === n[i].name) {
				return indexOrObject === "index" ? i : n[i];
			}
		}
	}
	return null;
}

function getTableId(tablename) {
	for (var i in n) {
		if (n[i].type === "table" && n[i].name === tablename) {
			return i;
		}
	}
	return null;
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