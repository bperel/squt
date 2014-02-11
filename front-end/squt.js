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

d3.select('#create_link a').on('click', function() {
	toggleLinkDisplay(true);
});

d3.select('#create_link input').on('click', function() {
	d3.select('#create_link input').node()
		.select();
});

var query_is_too_long = false;

var editor = CodeMirror.fromTextArea(document.getElementById("query"), {
	lineWrapping: true,
	onKeyEvent: function(editor) {
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

var params = extractUrlParams();

var is_debug=params.debug !== undefined;
var no_graph=params.no_graph !== undefined;
var query_param=params.query;

if (query_param !== undefined) {
	editor.setValue(decodeURIComponent(query_param));
	query=editor.getValue().replace(/\n/g,' ');
	analyzeAndBuild();
}

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

var svg = d3.select("body").append("svg:svg")
	.attr("id","graph")
	.attr("width", W)
	.attr("height", H)
	.call(d3.behavior.zoom()
		.on("zoom",function(a,b) {
			svg.select("svg>g").attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
		})
	);

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
	.data(["subquery"])
  .enter().append("marker")
	.attr("id", String)
	.attr("viewBox", "0 0 16 22")
	.attr("refX", 16)
	.attr("refY", 11)
	.attr("markerUnits", "strokeWidth")
	.attr("markerWidth", 16)
	.attr("markerHeight", 12)
	.attr("orient", "auto")
  .append("polyline")
	.attr("points", "0,8 16,0 16,2 2,10 20,10 20,12 2,12 16,20 16,22 0,14 0,8");

d3.select("defs").append("svg:g").selectAll("marker")
      .data(["solidlink1","solidlink2"])
    .enter().append("marker")
      .attr("id", String)
      .attr("refX", function(d) {
    	  return d === "solidlink1" ? -4 : 14;
      })
      .attr("refY", 2.5)
      .attr("markerWidth", 100)
      .attr("markerHeight", 100)
      .attr("orient", "auto")
      .classed("solidlink", true)
      .append("rect")
        .attr("width",10)
        .attr("height",5);

var no_parser=false;
var query;

d3.json(URL,function(data) {
	if (data === undefined || data === null || data === "") {
		no_parser=true;
		editor.setOption('readOnly',true);
		d3.select('.CodeMirror').attr("style","background-color:rgb(220,220,220)");
		d3.select('#no-parser').attr("class","");
	}
	else {
		d3.select('#mysql_version .version').text(d3.values(data.Constants)[0].value);
	}
})
  .header("Content-Type","application/x-www-form-urlencoded")
  .send("POST","query=SELECT VERSION()");

d3.select("#OK").on("click",function() {
	query=editor.getValue().replace(/\n/g,' ');
	analyzeAndBuild();
});

function analyzeAndBuild() {
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
		svg.selectAll('image,svg>g').remove();
		return;
	}
	if (jsondata.Error !== undefined) {
		d3.select('#log').text("ERROR - " + jsondata.Error);
		svg.selectAll('image,svg>g').remove();
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
	links= 			 [];
	functions=		 [];
	constants=		 [];
	linksToFunctions=[];
	linksToOutput=	 [];

	d3.forEach(jsondata.Subqueries, function(subquery) {
		processJson(subquery);
	});
	processJson(jsondata);

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
		var sourceTableId = parseInt(fieldNameToTableId(link.source));
		var targetTableId;
		if (d3.keys(SUBSELECT_TYPES).indexOf(link.type) !== -1) {
			targetTableId = parseInt(getTableId(link.target));
		}
		else {
			targetTableId = parseInt(fieldNameToTableId(link.target));
		}
		addOrStrengthenLink(sourceTableId, targetTableId);
	});


	d3.forEach(linksToOutput, function(link) {
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
		if (sourceId) {
			var targetId = parseInt(getOutputId(link.outputTableAlias.replace(OUTPUT_PREFIX,'')));
			l[sourceId+","+targetId] = {source: sourceId, target: targetId, value: 1};
		}
	});

	d3.forEach(linksToFunctions, function(link) {
		var sourceId;
		if (link.constantId === undefined) {
			if (link.sourceFunctionId) {
				sourceId = parseInt(getFunctionId(link.sourceFunctionId));
			}
			else {
				sourceId = parseInt(fieldNameToTableId(link.fieldName));
			}
			var targetId = parseInt(getFunctionId(link.functionAlias));
			addOrStrengthenLink(sourceId, targetId);
		}
	});

	l = d3.values(l);
	console.log(n);
	console.log(l);
	
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

function processJson(jsondata, subqueryIndex) {
	var subqueryGroup=jsondata.SubqueryAlias || MAIN_QUERY_ALIAS;
	var subqueryType=jsondata.SubqueryType;
	
	var outputTableAlias=OUTPUT_PREFIX+subqueryGroup;
	tables[outputTableAlias]=({type: "table",
							   output: true,
		  				  	   name: outputTableAlias,
				  			   subqueryGroup: subqueryGroup});
	tableAliases[outputTableAlias]={table: outputTableAlias,
							   		name:  outputTableAlias};
	
	subqueries[subqueryGroup]={type: "subquery",
							   name: subqueryGroup};
	d3.forEach(jsondata.Tables, function(tableInfo, tableName) {
		tables[tableName]=({type: "table",
			  				name:tableName,
			  				subqueryGroup: subqueryGroup});

		d3.forEach(tableInfo, function(actions, tableAlias) {
			tableAliases[tableAlias]={table: tableName,name: tableAlias};

			d3.forEach(actions, function(actionFields, type) {

				d3.forEach(actionFields, function(data, field) {
					var tableAliasField = [tableAlias, field].join('.');
					if (fields[tableAliasField] == undefined) {
						fields[tableAliasField]={type: "field", tableAlias:tableAlias, name:field, fullName:tableAliasField, filtered: false, sort: false, subqueryGroup: subqueryGroup};
					}
					switch(type) {
						case 'OUTPUT':
							d3.forEach(data, function(outputAlias, functionAlias) {
								if (functionAlias == -1) { // Directly to output
									var fullName = [outputTableAlias, outputAlias].join('.');
									linksToOutput.push({type: "link", from: "field", fieldName: tableAliasField, outputName: outputAlias, outputTableAlias: outputTableAlias});
									fields[fullName]={type: "field", tableAlias:outputTableAlias, name:outputAlias, fullName: fullName, filtered: false, sort: false, subqueryGroup: subqueryGroup};
									
									// We are in a subquery, the output must be transmitted to the superquery if included in the main query's SELECT
									if (subqueryGroup !== MAIN_QUERY_ALIAS) {
										var mainSubqueryOutputAlias = OUTPUT_PREFIX+MAIN_QUERY_ALIAS;
										var fullNameInMainSubquery;
										var outputName;
										var fieldId;
										if (subqueryType === "SINGLEROW_SUBS") {
											outputName = subqueryGroup;
											fullNameInMainSubquery = [mainSubqueryOutputAlias, outputName].join('.');
											fieldId = subqueryGroup;
										}
										else if (subqueryType === null) { // Derived table
											outputName = outputAlias;
											fullNameInMainSubquery = [mainSubqueryOutputAlias, outputName].join('.');
											fieldId = fullNameInMainSubquery;
										}

										if (!!outputName) {
											fields[fieldId]={type: "field", tableAlias: mainSubqueryOutputAlias, name: outputName, fullName: fullNameInMainSubquery, filtered: false, sort: false, subqueryGroup: MAIN_QUERY_ALIAS};
											linksToOutput.push({type: "link", from: "field", fieldName: fullName, outputName: outputName, outputTableAlias: mainSubqueryOutputAlias});
										}
									}
								}
								else { // To a function
									linksToFunctions.push({type: "link", from: "field", fieldName: tableAliasField, functionAlias: functionAlias});
								}
							});
							
						break;
						case 'CONDITION':
							d3.forEach(data, function(conditionData, conditionType) {
								switch(conditionType) {
									case 'FUNCTION':
										d3.forEach(d3.keys(conditionData), function(destinationFunctionAlias) {
											linksToFunctions.push({type: "link", from: "field", fieldName: tableAliasField, functionAlias: destinationFunctionAlias});
										});
									break;
									case 'JOIN': case 'VALUE': case 'EXISTS':
										d3.forEach(conditionData, function(join, otherField) {
											if (otherField.indexOf(".") != -1) { // condition is related to another field => it's a join
												if (fields[otherField] == undefined) { // In case the joined table isn't referenced elsewhere
													var tableAliasAndField=otherField.split('.');
													fields[otherField]={type: "field", tableAlias:tableAliasAndField[0], name:tableAliasAndField[1], fullName:otherField, filtered: false, sort: false, subqueryGroup: subqueryGroup};
												}
												var joinType;
												switch(join) {
													case 'JOIN_TYPE_LEFT': joinType='leftjoin'; break;
													case 'JOIN_TYPE_RIGHT': joinType='rightjoin'; break;
													case 'JOIN_TYPE_STRAIGHT': joinType='innerjoin'; break;
													case 'JOIN_TYPE_NATURAL': joinType='innerjoin'; alert('Natural joins are not supported'); break;
												}
												links.push({source: tableAliasField, target: otherField, type: joinType});
											}
											else { // It's a value
												fields[tableAliasField].filtered=true;
											}
										});
									break;
									default:
										if (d3.keys(SUBSELECT_TYPES).indexOf(conditionType) !== -1) {
											links.push({source: tableAliasField, target: OUTPUT_PREFIX+conditionData, type: conditionType});
										}
									break;
								}
							});
						break;
						case 'SORT':
							fields[tableAliasField].sort=data;
						break;
					}
				});
			});
		});
	});
	
	d3.forEach(jsondata.Functions, function(functionAliasInfo, functionAlias) {
		var functionDestination=functionAliasInfo.to;
		functions[functionAlias]={type: "function",
								  functionAlias: functionAlias, 
							      name: functionAliasInfo.name,
							      isCondition: functionDestination === "NOWHERE"
								 };
		if (functionDestination === "OUTPUT") {
			linksToOutput.push({type: "link", from: "function", sourceFunctionId: functionAlias, outputName: functions[functionAlias].functionAlias, outputTableAlias: outputTableAlias});
			fields[functionAlias]={type: "field", tableAlias:outputTableAlias, name: functionAlias, fullName: functionAlias, filtered: false, sort: false, subqueryGroup: subqueryGroup};
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
	});
	if (jsondata.Constants) {
		d3.forEach(jsondata.Constants, function(constant, constantAlias) {
			var constantId=constants.length;
			var constantValue = constant.value;
			constants.push({id: constantId, name: constantValue, value: constantValue, type: "constant" });
			linksToOutput.push({type: "link", from: "constant", outputTableAlias: outputTableAlias, outputName: constantAlias, constantId: constantId});
			fields[constantAlias]={type: "field", tableAlias:outputTableAlias, name:constantAlias, fullName:constantAlias, filtered: false, sort: false, subqueryGroup: subqueryGroup};
		});
	}
}

var tableGroups,
	functionGroups,
	constantGroups,
	
	paths,
	pathsToFunctions,
	pathsToOutput,

	chargeForces;

function buildGraph() {	
	
	tables = d3.values(tables);
	tableAliases = d3.values(tableAliases);
	fields = d3.values(fields);

	//cleanup
	svg.selectAll('image,svg>g').remove();
	
	var g = svg.append("svg:g");
	
	tableGroups = g.append("svg:g").selectAll("g")
		.data(tables)
	  .enter().append("svg:g")
		.attr("name",  function(currentTable) { return currentTable.name; })
		.attr("class", function(currentTable) { return "tableGroup"+(currentTable.output ? " output":""); })
		.call(node_drag)
		.each(function(currentTable) {
			var relatedAliases = tableAliases.filter(function(ta) { return ta.table == currentTable.name; });
			var relatedFields = fields.filter(function(currentField) { 
				return isFieldInTable(currentField, currentTable); 
			});
			var relatedUniqueFields = relatedFields.filter(function(currentField, i) { 
				for (var j=0; j<i; j++) {
					  if (relatedFields[j].name === currentField.name) {
						  return false;
					  }
				}
				return true;
			});

			var tableWidth=TABLE_NAME_PADDING.left
	  		   			 + CHAR_WIDTH*d3.max([currentTable.name.length,
	  		   			                      d3.max(relatedFields, function(field) { 
	  		   			                    	  return field.name.length; 
	  		   			                      })
	  		   			                     ]);
			var tableHeight=MIN_TABLE_HEIGHT
						  + relatedUniqueFields.length * FIELD_LINEHEIGHT;
			
			if (currentTable.subqueryGroup !== MAIN_QUERY_ALIAS 
			 && d3.select(".subquery[name=\""+escapeQuote(currentTable.subqueryGroup)+"\"]").node() === null) {
				g.insert("svg:rect", ":first-child")
				  .classed("subquery", true)
				  .attr("name",currentTable.subqueryGroup);
			}
			
			d3.select(this)
			  .append("svg:rect")
				.classed({table: true, output: !!currentTable.output})
				.attr("height", tableHeight)
				.attr("width",  tableWidth );
			
			d3.select(this)
			  .append("svg:text")
				.text(currentTable.output ? OUTPUT_LABEL : currentTable.name)
				.classed({tablename: true, output: !!currentTable.output})
				.attr("x", TABLE_NAME_PADDING.left)
				.attr("y", currentTable.output ? TABLE_NAME_PADDING.output_top : TABLE_NAME_PADDING.top);
			
			d3.select(this)
			  .append("svg:line")
				.attr("stroke", "black")
				.attr("x1", 0)
				.attr("x2", tableWidth)
				.attr("y1", LINE_SEPARATOR_TOP)
				.attr("y2", LINE_SEPARATOR_TOP);
			
			d3.select(this)
			  .selectAll("g.aliasGroup")
			    .data(relatedAliases)
			  .enter().append("svg:g")
				.attr("name", function(currentAlias) { return currentAlias.name; })
				.classed("aliasGroup", true)
				.each(function(currentAlias) {
					d3.select(this)
					  .append("svg:text")
						.text(currentTable.output ? "" : currentAlias.name)
						.attr("x", getAliasPosX(relatedAliases, currentAlias.name, tableWidth)+ALIAS_NAME_PADDING.left)
						.attr("y", ALIAS_NAME_PADDING.top);

					d3.select(this)
					  .append("svg:rect")
						.classed({alias: true, output: !!currentAlias.output})
						.attr("x", getAliasPosX(relatedAliases, currentAlias.name, tableWidth))
						.attr("y", ALIAS_BOX_MARGIN.top)
						.attr("width", ALIAS_NAME_PADDING.left 
							  		 + Math.max(currentAlias.name.length*CHAR_WIDTH + ALIAS_NAME_PADDING.right,
							  					CIRCLE_RADIUS/2 + SORT_SIDE))
						.attr("height",tableHeight-ALIAS_BOX_MARGIN.top);
				});
			
			var fieldIndex = 0;
			
			d3.select(this)
			  .selectAll("g.fieldGroup")
			    .data(relatedFields)
			  .enter().append("svg:g")
				.attr("name", function(currentField) { return currentField.tableAlias+"."+currentField.name; })
				.classed("fieldGroup", true)
				.each(function(currentField,i) {
					var sort = currentField.sort;
					var isFiltered = currentField.filtered;
					var preexistingField = d3.select("g.tableGroup[name=\""+ escapeQuote(currentTable.name)+"\"]"
												   +" g.fieldGroup[name$=\""+escapeQuote(currentField.name)+"\"] circle");
					
					var circlePosition = {x: getAliasPosX(relatedAliases, currentField.tableAlias, tableWidth)+ALIAS_NAME_PADDING.left,
										  y: preexistingField.empty() ? (FIELD_PADDING.top+FIELD_LINEHEIGHT*fieldIndex-CIRCLE_RADIUS/2) : parseInt(preexistingField.attr("cy")) };
					
					d3.select(this)
					  .append("svg:circle")
						.attr("r",CIRCLE_RADIUS)
						.attr("cx", circlePosition.x)
						.attr("cy", circlePosition.y)
						.classed("filtered", isFiltered)
						.classed("sort_"+sort, !!sort);
					
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

					if (preexistingField.empty()) {
						d3.select(this)
						  .append("svg:text")
						    .text(currentField.name)
							.attr("x", FIELD_PADDING.left)
							.attr("y", FIELD_PADDING.top + FIELD_LINEHEIGHT*fieldIndex);
						
						fieldIndex++;
					}
				});
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
	  		d3.select(this)
	  			.append("svg:ellipse")
		  			.classed("function", true)
		  			.classed("conditional", function(d) { return !!d.isCondition; })
		  			.attr("name", function(d) { return d.functionAlias;})
		  			.attr("rx",function(d) { return d.name.length*CHAR_WIDTH+FUNCTION_ELLIPSE_PADDING.left*2; })
		  			.attr("ry",FUNCTION_BOX_RY+FUNCTION_ELLIPSE_PADDING.top*2);
	  		
	  		d3.select(this)
		  		.append("svg:text")
				.text(function(d) { return d.name; })
				.attr("x", function(d) { return -1*d.name.length*CHAR_WIDTH/2;});
	  			
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
					.attr("name", currentConstant.name)
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

	force
		.nodes(n)
		.links(l)
		.on("tick", positionAll)
		.start();
}

function toggleLinkDisplay(toggle) {
	d3.select('#create_link a')
		.classed('invisible', toggle);

	var input = d3.select('#create_link input');
	input.classed('invisible', !toggle);

	if (toggle) {
		input.attr('value',document.URL.match(/^.*\.html/g)[0]+'?query='+encodeURIComponent(query));
	}
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
	  var target = d3.select('.tableGroup.output [name="'+escapeQuote(link.outputTableAlias+'.'+link.outputName)+'"] circle');
	  
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
	var isArc = !(source.data()[0].type === "constant" && target.data()[0].type === "function");
	
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
		coords = element.attr("transform").replace(/translate\(([-0-9.]+ [-0-9.]+)\)/g,'$1');
		coords = {x: parseFloat(coords.split(/ /g)[0]),
				  y: parseFloat(coords.split(/ /g)[1])};
	}
	
	if (!coords.x || !coords.y) {
		coords = {x:0, y:0};
	}
	if (element.node().parentNode.tagName !== "svg") {
		var parentCoords = getAbsoluteCoords(d3.select(element.node().parentNode));
		coords.x+=parentCoords.x;
		coords.y+=parentCoords.y;
	}
	return coords;
}

function getNode(pathInfo, args) {
	args = args || {};
	switch (pathInfo.type) {
		case "field":
			return d3.select('[name="'+escapeQuote(pathInfo.fieldName)+'"] circle');
		break;
		case "link":
			args.role = args.role || "source";
			if (args.role == "source") {
				switch (pathInfo.from) {
					case "field":
						return d3.select('[name="'+escapeQuote(pathInfo.fieldName)+'"] circle');
					break;
					case "function":
						return d3.select('[name="'+escapeQuote(pathInfo.sourceFunctionId)+'"]');
					break;
					case "constant":
						return constantGroups.filter(function(c) {
							return pathInfo.constantId == c.id; 
						});
					break;
				}
			}
			else {
				return d3.select('[name="'+escapeQuote(pathInfo.functionAlias)+'"]');
			}
		break;
		case "constant":
			return constantGroups.filter(function(c) {
				return pathInfo.constantId == c.id; 
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
				element = d3.select('.subquery[name="'+escapeQuote(d.name)+'"]');
			}
		break;
	}
	
	if (element) {
		var boundingRect = element.node().getBoundingClientRect();
		charge = d3.max([boundingRect.width, boundingRect.height]);

		if (is_debug) {
			chargeForces
				.filter(function(d2) {
					return d.name === d2.name;
				})
				.attr("r", charge);
		}
	}
	
	if (isNaN(charge)) {
		console.log("Charge for node "+JSON.stringify(d)+" is NaN");
	}
	return -1*charge*charge;
}

function getGroupCenter(d, axis) {
	var element = d3.select('[name="'+ d.name+'"]');
	if (element.node()) {
		var bbox = element.node().getBBox();
		var pos = getAbsoluteCoords(element);
		return axis === 'x' ? pos.x + bbox.width  /2
							: pos.y + bbox.height /2;
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
		
		d3.select(".subquery[name=\""+escapeQuote(subqueryGroup)+"\"]")
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
	  var source=d3.select('[name="'+escapeQuote(d.source)+'"] circle');
	  var target=d3.select('[name="'+escapeQuote(d.target)+'"] circle');
	  
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
		if (outputAlias == n[i].name) {
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

function extractUrlParams(){	
	var t = location.search.substring(1).split('&');
	var f = [];
	for (var i=0; i<t.length; i++){
		var x = t[ i ].split('=');
		f[x[0]]=(x[1] == undefined ? null : x[1]);
	}
	return f;
}

function domElementToMyObject(element) {	
	var localName = element.localName;
	switch ( localName ) {
	    case "ellipse":
	    	var absolutePosition = getAbsoluteCoords(d3.select(element));
	    	var absolutizedElement = d3.select(clone(element));
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

function clone(selector) {
    var node = d3.select(selector).node();
    return node.cloneNode(true);
  }

function escapeQuote(str) {
	return str.replace(/"/,'\\"');
}

d3.forEach = function (obj, callback) {
	if (typeof obj === 'object') {
		Array.prototype.forEach.call(Object.keys(obj), function (prop) {
			callback(obj[prop], prop);
		});
	}
};
