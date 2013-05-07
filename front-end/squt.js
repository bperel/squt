var force = d3.layout.force()
			.gravity(0.2)
			.charge(-150)
			.linkDistance(300)
			.size([W*2/3, H*2/3]);

var repulsion = d3.select('#repulsion').attr("value");
d3.select('#repulsion').on("change",function() {
	repulsion = this.value;
	force.start();
});

var query_is_too_long = false;

var editor = CodeMirror.fromTextArea(document.getElementById("query"), {
	lineWrapping: true,
	onKeyEvent: function(editor,event) {
		var new_query_is_too_long = editor.getValue().length > QUERY_MAX_LENGTH;
		if (query_is_too_long && !new_query_is_too_long) {
			d3.select("#log").text("");
			d3.select(".CodeMirror").attr("class",function() { return d3.select(this).attr("class").replace(/ error/g,""); });
		}
		if (!query_is_too_long && new_query_is_too_long) {
			d3.select("#log").text(d3.select("#error_query_too_long").text());	
			d3.select(".CodeMirror").attr("class",function() { return d3.select(this).attr("class")+" error"; });
		}
		query_is_too_long = new_query_is_too_long;
	}
});

var selected_query_sample;

d3.select('#query_sample')
  .on("change",function() {
	  selected_query_sample = d3.select(this[this.selectedIndex]).attr('name');
	  if (selected_query_sample != "dummy") {
		d3.text("querysamples/"+selected_query_sample,function(sql) {
			editor.setValue(sql);
		});
	  }
  });

d3.text("list_samples.php?test=false",function(text) {
	var queries=text.split(/,/g);
	if (queries.length > 0) {
		if (queries[0].indexOf("Error") !== -1) {
			alert(queries[0]);
		}
		else {
			for (var i=0;i<queries.length;i++) {
				d3.select('#query_sample')
				  	.append("option")
				  	.text(queries[i].replace(/^(.*)\.sql/g,'$1'))
				  	.attr("name",queries[i]);
			}
		}
	}
});

var is_debug=extractUrlParams()['debug'] !== undefined;
if (!is_debug) {
	d3.select("#debug_info").attr("class","invisible");
}
var no_graph=extractUrlParams()['no_graph'] !== undefined;

var tables= [],
	tableAliases={},
	fields= {},
		 
	links=[],
	functions=[],
	linksToFunctions=[],
	linksToOutput=[];

var n=[],l=[];

var svg = d3.select("body").append("svg:svg")
	.attr("id","graph")
	.attr("width", W)
	.attr("height", H)
	.call(d3.behavior.zoom()
		.on("zoom",function() {
			svg.select("svg>g").attr("transform", "translate(" +  d3.event.translate[0] + "," + d3.event.translate[1] + ") scale(" +  d3.event.scale + ")"); 	
		}));

svg.append("defs");
	
d3.select("defs").append("svg:g").selectAll("marker")
    .data(["arrow"])
  .enter().append("marker")
    .attr("id", String)
    .attr("viewBox", "0 0 10 10")
    .attr("refX", 10)
    .attr("refY", 5)
    .attr("markerUnits", "strokeWidth")
    .attr("markerWidth", 8)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
  .append("polyline")
    .attr("points", "0,0 10,5 0,10 1,5 0,0");

d3.select("defs").append("svg:g").selectAll("marker")
      .data(["solidlink1","solidlink2"])
    .enter().append("marker")
      .attr("id", String)
      .attr("class","solidlink")
      .attr("refX", function(d) {
    	  if (d == "solidlink1") {
    		  return -4;
    	  }
    	  else {
    		  return 14;
    	  }
      })
      .attr("refY", 2.5)
      .attr("markerWidth", 100)
      .attr("markerHeight", 100)
      .attr("orient", "auto")
      .append("rect")
        .attr("width",10)
        .attr("height",5);

var no_parser=false;

d3.text(URL,function(data) {
	if (data === undefined || data === null || data === "") {
		no_parser=true;
		editor.setOption('readOnly',true);
		d3.select('.CodeMirror').attr("style","background-color:rgb(220,220,220)");
		d3.select('#no-parser').attr("class","");
	}
})
  .header("Content-Type","application/x-www-form-urlencoded")
  .send("POST","query=SELECT b.a FROM b");

d3.select("#OK").on("click",function() {
	analyzeAndBuild(editor.getValue().replace(/\n/g,' '));
});

function analyzeAndBuild(query) {
	var parameters;
	if (no_parser) {
		parameters="sample="+selected_query_sample;
	}
	else {
		parameters="query="+encodeURIComponent(query);
	}
	if (no_graph) {
		d3.text(URL,function(data) {
			d3.select('#log').text(data);
		  })
		  .header("Content-Type","application/x-www-form-urlencoded")
		  .send("POST",parameters+"&debug=1"
		);
		return;
	}
	d3.json(URL,build)
	  .header("Content-Type","application/x-www-form-urlencoded")
	  .send("POST",parameters);
}

function build(jsondata) {
	console.log(jsondata);
	if (jsondata == null) {
		d3.select('#log').text("Error ! Make sure your paths are properly configured");
		svg.selectAll('image,g').remove();
		return;
	}
	if (jsondata.Error !== undefined) {
		d3.select('#log').text("ERROR - " + jsondata.Error);
		svg.selectAll('image,g').remove();
		return;
	}
	if (jsondata.Warning) {
		var warningText=[];
		for (var warnType in jsondata.Warning) {
			for (var i in jsondata.Warning[warnType]) {
				var field_location=jsondata.Warning[warnType][i];
				switch (warnType) {
					case "No alias": case "No alias field ignored":
						warningText.push("WARNING - No named alias for field " + i + " located in "+field_location+" clause "
										 +(warnType === "No alias field ignored" ? ": field will be ignored" : ""));
					
					break;
					case "Invalid":
						warningText.push("WARNING - Invalid statement '" + i + "' in "+field_location+" clause : the statement will be ignored");
					break;
					case "Not supported":
						warningText.push("WARNING - Not supported : " + i);
					break;
				}
			}
		}
		d3.select('#log').text(warningText.join("\n"));
	}
	else {
		d3.select('#log').text("");
	}
	
	tables= 	 	 [],
	tableAliases=	 [],
	fields= 	 	 [],
	links= 			 [],
	functions=		 [],
	constants=		 [],
	linksToFunctions=[],
	linksToOutput=	 [];

	tables["/OUTPUT/"]=({type: "table",
		  				name:"/OUTPUT/"});
	tableAliases["/OUTPUT/"]={table: "/OUTPUT/",name: "/OUTPUT/"};
	
	for (var tableName in jsondata.Tables) {
		tables[tableName]=({type: "table",
			  				name:tableName});
		var tableInfo = jsondata.Tables[tableName];
		for (var tableAlias in tableInfo) {
			tableAliases[tableAlias]={table: tableName,name: tableAlias};
			var actions=tableInfo[tableAlias];
			for (var type in actions) {
				var actionFields=actions[type];
				for (var field in actionFields) {
					var data=actionFields[field];
					if (fields[tableAlias+"."+field] == undefined) {
						fields[tableAlias+"."+field]={type: "field", tableAlias:tableAlias, name:field, fullName:tableAlias+"."+field, filtered: false, sort: false};
					}
					switch(type) {
						case 'OUTPUT':
							for (var functionAlias in data) {
								var outputAlias = data[functionAlias];
								if (functionAlias == -1) { // Directly to output
									linksToOutput.push({type: "link", from: "field", fieldName: tableAlias+"."+field, outputName: outputAlias});
									fields[outputAlias]={type: "field", tableAlias:"/OUTPUT/", name:outputAlias, fullName:outputAlias, filtered: false, sort: false};
								}
								else { // To a function
									linksToFunctions.push({type: "field", type: "link", from: "field", fieldName: tableAlias+"."+field, functionAlias: functionAlias});
								}
							}
							
						break;
						case 'CONDITION':
							for (var conditionType in data) {
								var conditionData = data[conditionType];
								switch(conditionType) {
									case 'FUNCTION':
										for (var destinationFunctionAlias in conditionData) {									
											linksToFunctions.push({type: "link", from: "field", fieldName: tableAlias+"."+field, functionAlias: destinationFunctionAlias});
										}
									break;
									case 'JOIN': case 'VALUE': case 'EXISTS':
										for (var otherField in conditionData) {
											if (otherField.indexOf(".") != -1) { // condition is related to another field => it's a join
												if (fields[otherField] == undefined) { // In case the joined table isn't referenced elsewhere
													var tableAliasAndField=otherField.split('.');
													fields[otherField]={type: "field", tableAlias:tableAliasAndField[0], name:tableAliasAndField[1], fullName:otherField, filtered: false, sort: false};
												}
												var joinType=null;
												switch(data[otherField]) {
													case 'JOIN_TYPE_LEFT': joinType='leftjoin'; break;
													case 'JOIN_TYPE_RIGHT': joinType='rightjoin'; break;
													case 'JOIN_TYPE_STRAIGHT': joinType='innerjoin'; break;
													case 'JOIN_TYPE_NATURAL': joinType='innerjoin'; alert('Natural joins are not supported'); break;
												}
												links.push({source: tableAlias+"."+field, target: otherField, type: joinType});
											}
											else { // It's a value
												fields[tableAlias+"."+field]['filtered']=true;
											}
										}
									break;
								}
							}
						break;
						case 'SORT':
							fields[tableAlias+"."+field]['sort']=data;
						break;
					}
				}
			}
		}
	}
	
	for (var functionAlias in jsondata.Functions) {
		var functionDestination=jsondata.Functions[functionAlias]["to"];
		functions[functionAlias]={type: "function",
								  functionAlias: functionAlias, 
							      name: jsondata.Functions[functionAlias]["name"],
							      isCondition: functionDestination === "NOWHERE"
								 };
		if (functionDestination === "OUTPUT") {
			linksToOutput.push({type: "link", from: "function", sourceFunctionId: functionAlias, outputName: functions[functionAlias]["functionAlias"]});
			fields[functionAlias]={type: "field", tableAlias:"/OUTPUT/", name:functionAlias, fullName:functionAlias, filtered: false, sort: false};
		}
		else if (functionDestination !== "NOWHERE") {
			linksToFunctions.push({type: "link", from: "function", sourceFunctionId: functionAlias, functionAlias: functionDestination});
		}
		if (jsondata.Functions[functionAlias]["Constants"] !== undefined) {
			var functionConstants = jsondata.Functions[functionAlias]["Constants"];
			for (var constant in functionConstants) {
				var constantId=constants.length;
				constants.push({id: constantId, name: constant, functionAlias: functionAlias, type: "constant" });
				linksToFunctions.push({type: "link", from: "constant", constantId: constantId, functionAlias: functionAlias});
			}
		}
	}

	var i=0;
	for(var key in fields) {
	  fields[key].id=i++;
	};

	n = 	  d3.values(tables)
	  .concat(d3.values(functions));
	l = [];
	
	for (var i in links) {
		var sourceTableId = parseInt(fieldToTableId(links[i].source));
		var targetTableId = parseInt(fieldToTableId(links[i].target));
		if (l[sourceTableId+","+targetTableId]) {
			l[sourceTableId+","+targetTableId] = {source: sourceTableId, target: targetTableId, value: l[sourceTableId+","+targetTableId].value+1};
		}
		else {
			l[sourceTableId+","+targetTableId] = {source: sourceTableId, target: targetTableId, value: 1};
		}
	}
	for (var i in linksToOutput) {
		var sourceId;
		if (linksToOutput[i].from == "field") {
			sourceId = parseInt(fieldToTableId(linksToOutput[i].fieldName));
		}
		else if (linksToOutput[i].from == "function") {
			sourceId = parseInt(getFunctionId(linksToOutput[i].sourceFunctionId));
		}
		else continue;
		l[sourceId+",0"] = {source: sourceId, target: 0, value: 1};
	}

	for (var i in linksToFunctions) {
		var sourceId;
		if (linksToFunctions[i].constantId !== undefined) { // Not supported yet
			continue;
		}
		else if (linksToFunctions[i].sourceFunctionId) {
			sourceId = parseInt(getFunctionId(linksToFunctions[i].sourceFunctionId));
		}
		else {
			sourceId = parseInt(fieldToTableId(linksToFunctions[i].fieldName));
		}
		var targetId = parseInt(getFunctionId(linksToFunctions[i].functionAlias));
		if (l[sourceId+","+targetId]) {
			l[sourceId+","+targetId] = {source: sourceId, target: targetId, value: l[sourceId+","+targetId].value+1};
		}
		else {
			l[sourceId+","+targetId] = {source: sourceId, target: targetId, value: 1};
		}
	}
	l = d3.values(l);
	console.log(n);
	console.log(l);
	
	buildGraph();
}

var table, 
	tableText, 
	tableSeparator, 
	tableAlias, 
	field, 
	fieldOrder, 
	fieldText,
	funcText,
	
	path, 
	pathToFunction,
	pathToOutput, 
	outputTexts;

function buildGraph() {	

	//cleanup
	svg.selectAll('image,svg>g').remove();
	var g = svg.append("svg:g");
	  
	tableBoxes = g.append("svg:g").selectAll("rect.table")
		.data(d3.values(tables))
	  .enter().append("svg:rect")
		.attr("class", function(d) { return "table"+(d.name==="/OUTPUT/" ? " output":"");})
		.attr("name", function(d) { return d.name;})
		.call(force.drag);
		
	tableText = g.append("svg:g").selectAll("g")
		.data(d3.values(tables))
	  .enter().append("svg:text")
		.text(function(d) { return d.name; })
		.attr("class", function(d) { return d.name==="/OUTPUT/" ? "tablename output":"";});
		
	tableSeparator = g.append("svg:g").selectAll("line")
		.data(d3.values(tables))
	  .enter().append("svg:line")
		.attr("stroke", "black");
		
	tableAlias = g.append("svg:g").selectAll("g")
		.data(d3.values(tableAliases))
	  .enter().append("svg:text")
		.text(function(d) { return d.name; });
		
	tableAliasBoxes = g.append("svg:g").selectAll("g")
		.data(d3.values(tableAliases))
	  .enter().append("svg:rect")
		.attr("class", function(d) { return "alias"+(d.name==="/OUTPUT/" ? " output":"");});
		
	field = g.append("svg:g").selectAll("circle")
		.data(d3.values(fields))
	  .enter().append("svg:circle")
		.attr("r",CIRCLE_RADIUS)
		.attr("class",function(d) { return (d.filtered === true ? "filtered" : "")+" "
										  +(d.sort 	   === true ? "sort" 	 : "");
								  });
		
	fieldOrder = g.append("svg:g").selectAll("image.order")
		.data(d3.values(fields).filter(function(f) { return f.sort;}))
	  .enter().append("svg:image")
	    .attr("xlink:href", function(f) { return "images/sort_"+f.sort+".svg";})
	    .attr("class", "order")
		.attr("width",SORT_SIDE)
		.attr("height",SORT_SIDE);
	  
	fieldText = g.append("svg:g").selectAll("g")
		.data(d3.values(fields))
	  .enter().append("svg:text")
		.attr("name",function(d) { return d.tableAlias+"."+d.name; })
		.text(function(d) { return d.name; });
		
	func = g.append("svg:g").selectAll("ellipse.function")
		.data(d3.values(functions))
	  .enter().append("svg:ellipse")
		.attr("class", function(d) { return "function "+(d.isCondition ? "conditional":""); })
		.attr("name", function(d) { return d.name;})
		.attr("ry",FUNCTION_BOX_RY+FUNCTION_ELLIPSE_PADDING.top*2)
		.call(force.drag);
		
	funcText = g.append("svg:g").selectAll("g")
		.data(d3.values(functions))
	  .enter().append("svg:text")
		.text(function(d) { return d.name; });

	constantText = g.append("svg:g").selectAll("g")
		.data(d3.values(constants))
	  .enter().append("svg:text")
		.text(function(d) { return d.name; });
	
	
	path = g.append("svg:g").selectAll("path.join")
		.data(links)
	  .enter().append("svg:path")
		.attr("class", "link")
		.attr("marker-start", function(d) { 
			if (d.type == "innerjoin" || d.type == "leftjoin" || d.type == "rightjoin") {
				return "url(#solidlink1)";
			}
		})
		.attr("marker-end", function(d) { 
			if (d.type == "innerjoin") {
				return "url(#solidlink2)";
			}
		});

	pathToFunction = g.append("svg:g").selectAll("path.tofunction")
		.data(linksToFunctions)
	  .enter().append("svg:path")
	    .attr("id", function(d,i) { return "pathtofunction"+i;})
		.attr("class", "link tofunction")
		.attr("marker-end", "url(#arrow)");

	pathToOutput = g.append("svg:g").selectAll("path.output")
		.data(linksToOutput)
	  .enter().append("svg:path")
	    .attr("id", function(d,i) { return "outputpath"+i;})
		.attr("class", "output link ")
		.attr("marker-end", "url(#arrow)");

	outputTexts = g.append("svg:g").selectAll("g")
		.data(linksToOutput)
	  .enter().append("svg:text")
	    .attr("class","outputname")
		.append("textPath")
		  .attr("xlink:href",function(d,i) { return "#outputpath"+i;})
		    .attr({"startOffset":20})
		    .append("tspan")
		      .attr("dy",-5)
		      .text(function(d) { return d.outputName; });
	
	force
		.nodes(n)
		.links(l)
		.on("tick", tick)
		.start();
}

function filterFunction(fieldOrFunction, origin, d) {
  if (origin == "all")
	return true;
  if (origin == "field") {
	return fieldOrFunction.fieldName == d.fullName;
  }
  if (origin == "function") {
	 return fieldOrFunction.functionAlias == d.functionAlias 
	 	 || fieldOrFunction.sourceFunctionId == d.functionAlias;
  }
}

function positionPathsToOutput(origin,d) {
  pathToOutput.filter(function(link) {
	return filterFunction(link,origin,d);
  }).attr("d", function(link) { 
	  var source = getNode(link);
	  
	  var target = field.filter(function(f) { 
		  return f.tableAlias === "/OUTPUT/" && f.fullName === link.outputName; 
	  });
	  
	  return getPath(this, source, target);
  });
  
  outputTexts.filter(function(link) {
	return filterFunction(link,origin,d);
  }).attr("dy",OUTPUT_NAME_TOP_PADDING); // Refreshing an attribute on the textPath allows it to be correctly positionned on its corresponding path
  
  d3.selectAll("text.outputname").filter(function(link) {
	return filterFunction(link,origin,d);
  });
}

function positionPathsToFunctions(origin,d) {
	pathToFunction.filter(function(link) {
	  return filterFunction(link,origin,d);
	}).attr("d", function(d) {
		var source = getNode(d, {role: "source"});
		var target = getNode(d, {role: "target"});
		
	    return getPath(this, source, target);
	});
}

function getPath(pathElement, source, target) {
	var sourceCoords = getNodeCoords(source);
	var targetCoords = getNodeCoords(target);
	var isArc = !(source.data()[0].type === "constant" && target.data()[0].type === "function");
	
	var pathCoords=getPathFromCoords(sourceCoords.x, sourceCoords.y, targetCoords.x, targetCoords.y, isArc);
	d3.select(pathElement).attr("d",pathCoords);
	var pathObject = domElementToMyObject(pathElement);
	
	sourceCoords = getCorrectedPathPoint(pathObject, source, sourceCoords, targetCoords);
	targetCoords = getCorrectedPathPoint(pathObject, target, targetCoords, sourceCoords);
	
	return getPathFromCoords(sourceCoords.x, sourceCoords.y, targetCoords.x, targetCoords.y, isArc);
}

function getCorrectedPathPoint(pathObject, element, elementCoords, otherElementCoords) {
	var elementData = element.data()[0];
	switch (elementData.type) {
		case "function":
			var elementObject = domElementToMyObject(element[0][0]);
			if (!!pathObject && !!elementObject) {
				var intersection = Intersection.intersectShapes(pathObject, elementObject);
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
		break;
		case "constant":
			return {x: elementCoords.x+elementData.name.length/2*CHAR_WIDTH, 
				 	y: elementCoords.y};
	}
	return elementCoords;
}

function getPathFromCoords(x1, y1, x2, y2, isArc) {
	if (isArc) {
		var dr = getDistance(x1, y1, x2, y2);
		return "M" + x1 + "," + y1 + "A" + dr + "," + dr + " 0 0,1 " + x2 + "," + y2;
	}
	else { // Line
    	return "M" + x1 + "," + y1 + "L" + x2 + "," + y2;
	}
}

function getDistance(x1, y1, x2, y2) {
	var dx = x2 - x1,
  	dy = y2 - y1;
  	return Math.sqrt(dx * dx + dy * dy);
}

function getNodeCoords(element) {
	var coords;
	if (element.attr("x") !== null) {
		coords = {x: parseFloat(element.attr("x")), 
				  y: parseFloat(element.attr("y"))};
	}
	else {
		coords = {x: parseFloat(element.attr("cx")), 
				  y: parseFloat(element.attr("cy"))};
	}
	
	if (!coords.x || !coords.y) {
		return {x:0, y:0};
	}
	return coords;
}

function getNode(pathInfo, args) {
	args = args || {};
	switch (pathInfo.type) {
		case "field":
			return field.filter(function(f) { 
				return f.fullName == pathInfo.fullName; 
			});
		break;
		case "link":
			args.role = args.role || "source";
			if (args.role == "source") {
				switch (pathInfo.from) {
					case "field":
						return field.filter(function(f) { 
							return pathInfo.fieldName == f.fullName; 
						});
					break;
					case "function":
						return func.filter(function(f) { 
							return pathInfo.sourceFunctionId == f.functionAlias; 
						});
					break;
					case "constant":
						return constantText.filter(function(c) { 
							return pathInfo.constantId == c.id; 
						});
					break;
				}
			}
			else {
				return func.filter(function(f) { 
					return pathInfo.functionAlias == f.functionAlias; 
				});
			}
		break;
		case "constant":
			return constantText.filter(function(c) { 
				return pathInfo.constantId == c.id; 
			});
		break;
	}
}

function positionTable(d, i) {
	var x = d.x;
	var y = d.y;
	
	var relatedAliases = tableAlias.filter(function(ta) { return ta.table == d.name; });
	var relatedAliasesBoxes = tableAliasBoxes.filter(function(ta) { return ta.table == d.name; });
	
	var tableFields = field.filter(function(f) { return isFieldInTable(f, d); });
	
	d3.select(this)
	  .attr("x", this.x = x)
	  .attr("y", this.y = y)
	  .attr("height", MIN_TABLE_HEIGHT+tableFields.data().length * FIELD_LINEHEIGHT)
	  .attr("width", TABLE_NAME_PADDING.left
			  		+CHAR_WIDTH*d3.max([d.name.length,
			  		                    d3.max(tableFields.data(), function(f) { 
			  		                    	return f.name.length; 
			  		                    })
			  		                   ]));
	
	var tableWidth=parseInt(d3.select(this).attr("width"));
	var tableHeight=parseInt(d3.select(this).attr("height"));
	  
	tableText.filter(function(tt) { return tt.name == d.name; })
	  .attr("x", x+TABLE_NAME_PADDING.left)
	  .attr("y", y+TABLE_NAME_PADDING.top);
	  
	tableSeparator.filter(function(ts) { return ts.name == d.name; })
	  .attr("x1", x)
	  .attr("x2", x+tableWidth)
	  .attr("y1", y+LINE_SEPARATOR_TOP)
	  .attr("y2", y+LINE_SEPARATOR_TOP);
	  
	relatedAliases
	  .attr("x", function(ta,j) { 
		  if (j == 0) {
			  return x+tableWidth+ALIAS_NAME_PADDING.left;
		  }
		  else {
			  var previousAlias = relatedAliases.filter(function(ta2,j2) { 
									return j2 === j-1; 
								  });
			  return parseInt(previousAlias.attr("x"))
		  			+ALIAS_NAME_PADDING.right
			  		+previousAlias.data()[0].name.length*CHAR_WIDTH
			  		+ALIAS_NAME_PADDING.left;
		  }
	  })
	  .attr("y", y+ALIAS_NAME_PADDING.top);
	  
	relatedAliasesBoxes
	  .attr("x", function(ta,j) { 
		return parseInt(relatedAliases.filter(function(ta2,j2) {
										        return j === j2; 
										      })
											.attr("x"))
			   -ALIAS_NAME_PADDING.left;
	  })
	  .attr("y", y+ALIAS_BOX_MARGIN.top)
	  .attr("width",function(ta,j) { return ALIAS_NAME_PADDING.left 
		  								  + Math.max(ta.name.length*CHAR_WIDTH + ALIAS_NAME_PADDING.right,
		  										  	 CIRCLE_RADIUS/2 + SORT_SIDE);
	  							   })
	  .attr("height",tableHeight-ALIAS_BOX_MARGIN.top);
	  
	  
	fieldText.filter(function(f) { return isFieldInTable(f,d);})
	  .attr("x", x+FIELD_PADDING.left)
	  .attr("y", function(f, i) { return y + FIELD_PADDING.top + FIELD_LINEHEIGHT*i; });
		
	
	tableFields
	  .attr("cx", function(f) { return relatedAliases.filter(function(a) { return a.name == f.tableAlias; }).attr("x");})
	  .attr("cy", function(f, i) { return y +FIELD_PADDING.top
		  									+FIELD_LINEHEIGHT*i
		  									-CIRCLE_RADIUS/2; })
	  .each(function(f) {
		positionPathsToFunctions("field", f);
		positionPathsToOutput("field", f);
	  });
		
	
	fieldOrder.filter(function(f) { return isFieldInTable(f,d);})
	  .attr("x", function(f) { return parseInt(field.filter(function(a) { return f.fullName == a.fullName; }).attr("cx"));})
	  .attr("y", function(f) { return parseInt(field.filter(function(a) { return f.fullName == a.fullName; }).attr("cy"))-SORT_SIDE/2;});

	// Paths between fields
	path.attr("d", function(d) {
	  var source=field.filter(function(f) { return d.source == f.fullName; });
	  var target=field.filter(function(f) { return d.target == f.fullName; });
	  
	  return getPath(this, source, target, true);
	});
}

function positionFunction(d, i) {
	var x=d.x;
	var y=d.y;
	
	funcText.filter(function(func) { return func.functionAlias == d.functionAlias; })
	  .attr("x", function(func) { return x - func.name.length*CHAR_WIDTH/2;})
	  .attr("y", y);

	constantText.filter(function(t) { return t.functionAlias == d.functionAlias; })
	  .attr("x", function(c,j) { 
		  var offset=0;
		  constantText.filter(function(t) { return t.functionAlias == d.functionAlias; })
		  	.each(function(c2,j2) {
		  		if (j2<j) {
		  			offset+=c2.name.length*CHAR_WIDTH;
		  		}
		  	});	
		  return x+offset; 
	  })
	  .attr("y", y-CONSTANT_PADDING.bottom);
	
	func.filter(function(func) { return func.functionAlias == d.functionAlias; })
	  .attr("cx", x)
	  .attr("cy", y)
	  .attr("rx",function(func,j) { return func.name.length*CHAR_WIDTH+FUNCTION_ELLIPSE_PADDING.left*2; })
	  .each(function(func) {
		positionPathsToFunctions("function",func);
		positionPathsToOutput("function",func);
	  });
	
}

function isFieldInTable(field,table) {
	return tableAliases[field.tableAlias] && tableAliases[field.tableAlias].table == table.name;
}

function fieldToTableId(fieldname) {
	for (var i in n) {
		if (isFieldInTable(fields[fieldname],n[i]))
			return i;
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

function extractUrlParams(){	
	var t = location.search.substring(1).split('&');
	var f = [];
	for (var i=0; i<t.length; i++){
		var x = t[ i ].split('=');
		f[x[0]]=(x[1] == undefined ? null : x[1]);
	}
	return f;
}

var collisions;

function tick() {
	collisions="";
	var q = d3.geom.quadtree(n),
      	i = 0,
      	nl = n.length;

	while (++i < nl) {
		q.visit(collide(n[i]));
	}

	tableBoxes.each(function(d,i) {
		positionTable.call(this,d,i);
	});
	func.each(function(d,i) {
		positionFunction.call(this,d,i);
	});
	console.log("tick");
	logCollision();
}

function collide(node) {
	var p1 = getElementBoundaries(node);
	if (p1 === null || p1 === undefined)
		return function() { return true; };
		
	return function(quad, x1, y1, x2, y2) {
		if (quad.point && (quad.point !== node)) {
			var p2 = getElementBoundaries(quad.point);
			if (p2 === null || p2 === undefined)
				return true;
			
			var x = node.x - quad.point.x, 
				y = node.y - quad.point.y, 
				distance = Math.sqrt(x * x + y * y), 
				r = (p1.width+p1.height)/4 
				  + (p2.width+p2.height)/4;

			//if (l < r) {
			if (p1.left <= p2.right
	         && p2.left <= p1.right
	         && p1.top  <= p2.bottom
	         && p2.top  <= p1.bottom) {
				collisions+=(node.type+"/"+quad.point.type)+" ";
				distance = repulsion * (Math.abs(distance - r)) / distance;
				x *= distance;
				y *= distance;
				node.x = p1.left - x;
				node.y = p1.top  - y;
				quad.point.x = p2.left + x;
				quad.point.y = p2.top  + y;
			}
		}
		return x1 > p1.x2
			|| x2 < p1.x1 
			|| y1 > p1.y2 
			|| y2 < p1.y1;
	};
}

function getElementBoundaries(point) {
	switch(point.type) {
		case "table":
			return getBoundaries(getElementsByTypeAndName("table",			  point.name)[0]
				  		 .concat(getElementsByTypeAndName("aliasByTableName", point.name))
			);
		break;
		case "function":
			return getBoundaries(getElementsByTypeAndName("function",		  point.functionAlias)[0]);
		break;
	}
}

function getElementsByTypeAndName(type,name) {
	var elements = [];
	switch(type) {
		case "field":
			elements = field.filter(function(d) { return d.fullName == name; });
		break;
		case "table":
			elements = tableBoxes.filter(function(d) { return d.name == name; });
		break;
		case "aliasByTableName":
			elements = tableAliasBoxes.filter(function(d) { return d.table == name; });
		break;
		case "function":
			elements = func.filter(function(d) { return d.functionAlias == name; });
	}
	return elements;
}
	
function getBoundaries(elements) {
	elements = [].concat.apply([], elements);
	var left, right, top, bottom;
	d3.selectAll(elements).each(function(d) {
		var boundaries=[];
		switch(d.type) {
			case "table":
				var pos = d.x === undefined 
					? [parseInt(d3.select(this).attr("x")), parseInt(d3.select(this).attr("y"))]
					: [d.x, d.y];
				boundaries = {left:   pos[0],
							  right:  pos[0]+parseInt(d3.select(this).attr("width")),
							  top:    pos[1],
							  bottom: pos[1]+parseInt(d3.select(this).attr("height"))};
			break;
			case "function":
				var c = [parseInt(d3.select(this).attr("cx")), parseInt(d3.select(this).attr("cy"))];
				var r = [parseInt(d3.select(this).attr("rx")), parseInt(d3.select(this).attr("ry"))];
				boundaries = {left:   c[0]-r[0],
							  right:  c[0]+r[0],
							  top:    c[1]-r[1],
							  bottom: c[1]+r[1]};
			break;
		}
		
		if (left === undefined || left > boundaries.left)
			left = boundaries.left;
		if (top  === undefined || top  > boundaries.top)
			top  = boundaries.top;
		if (right === undefined || right < boundaries.right)
			right = boundaries.right;
		if (bottom  === undefined || bottom  < boundaries.bottom)
			bottom  = boundaries.bottom;
	});
	
	return {
		left:  	left, 
		right: 	right, 
		top: 	top, 
		bottom: bottom,
		width: 	right-left,
		height:	bottom-top};
}

function logCollision() {
	d3.select('#collision').text(collisions);
}

function domElementToMyObject(element) {
	var localName = element.localName;
	switch ( localName ) {
	    case "circle":  return new Circle(element);    break;
	    case "ellipse": return new Ellipse(element);   break;
	    case "line":    return new Line(element);      break;
	    case "path":    return new Path(element);      break;
	    case "polygon": return new Polygon(element);   break;
	    case "rect":    return new Rectangle(element); break;
	}
}