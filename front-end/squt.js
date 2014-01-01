var force = d3.layout.force()
			.gravity(0.5)
			.charge(function(d) {
				return getNodeCharge(d);
			})
			.size([W*2/3, H*2/3]);

var nodeDragging = false;
			
function dragstart(d, i) {
	force.stop();
}

function dragmove(d, i) {	
	d.px += d3.event.dx;
	d.py += d3.event.dy;
	d.x += d3.event.dx;
	d.y += d3.event.dy;	
	tick();
}

function dragend(d, i) {
	d.fixed = true;
	tick();
}

var node_drag = d3.behavior.drag()
	.on("dragstart", dragstart)
	.on("drag", dragmove)
	.on("dragend", dragend);

var repulsion = d3.select('#repulsion').attr("value");

d3.select('#repulsion').on("change",function() {
	repulsion = this.value;
	force.start();
});

d3.select('#create_link a').on('click', function() {
	d3.select('#create_link a')
		.attr('class', 'invisible');
	d3.select('#create_link input')
		.attr('class', '')
		.attr('value',document.URL.match(/^.*\.html/g)[0]+'?query='+encodeURIComponent(query));
});

d3.select('#create_link input').on('click', function() {
	d3.select('#create_link input').node()
		.select();
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
var query_param=extractUrlParams()['query'];
if (query_param !== undefined) {
	editor.setValue(decodeURIComponent(query_param));
}

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
		.on("zoom",function(a,b) {
			if (!nodeDragging) {
				svg.select("svg>g").attr("transform", "translate(" +  d3.event.translate[0] + "," + d3.event.translate[1] + ") scale(" +  d3.event.scale + ")"); 	
			}
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
var query;

d3.json(URL,function(data) {
	if (data === undefined || data === null || data === "") {
		no_parser=true;
		editor.setOption('readOnly',true);
		d3.select('.CodeMirror').attr("style","background-color:rgb(220,220,220)");
		d3.select('#no-parser').attr("class","");
	}
	else {
		d3.select('#mysql_version .version').text(d3.values(data.Functions[-1].Constants)[0]);
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
		svg.selectAll('image,g').remove();
		return;
	}
	if (jsondata.Error !== undefined) {
		d3.select('#log').text("ERROR - " + jsondata.Error);
		svg.selectAll('image,g').remove();
		return;
	}
	
	d3.select('#create_link a')
		.attr('class', '');
	d3.select('#create_link input')
		.attr('class', 'invisible');
	
	if (jsondata.Warning) {
		var warningText=[];
		for (var warnType in jsondata.Warning) {
			for (var i in jsondata.Warning[warnType]) {
				switch (warnType) {
					case "No alias": case "No alias field ignored":
						var field_location=jsondata.Warning[warnType][i];
						warningText.push("WARNING - No named alias for field " + i + (field_location ? " located in "+field_location+" clause " : "")
										 +(warnType === "No alias field ignored" ? ": field will be ignored" : ""));
					
					break;
					case "Invalid":
						var field_location=jsondata.Warning[warnType][i];
						warningText.push("WARNING - Invalid statement '" + i + "' in "+field_location+" clause : the statement will be ignored");
					break;
					case "Not supported":
						var info=jsondata.Warning[warnType][i];
						warningText.push("WARNING - Not supported : " + i
										+ (info ? " ("+info+")":""));
					break;
				}
			}
		}
		d3.select('#log').text(warningText.join("\n"));
	}
	else {
		d3.select('#log').text("");
	}
	
	subqueries=		 [],
	tables= 	 	 [],
	tableAliases=	 [],
	fields= 	 	 [],
	links= 			 [],
	functions=		 [],
	constants=		 [],
	linksToFunctions=[],
	linksToOutput=	 [];

	processJson(jsondata);
	if (jsondata.Subqueries) {
		for (var i in jsondata.Subqueries) {
			processJson(jsondata.Subqueries[i], i);
		}
	}
	
	var i=0;
	for(var key in fields) {
	  fields[key].id=i++;
	};
	
	tableAliases = d3.values(tableAliases);

	n = 	  d3.values(tables)
	  .concat(d3.values(functions))
	  .concat(d3.values(subqueries));
	l = [];
	
	for (var i in links) {
		var sourceTableId = parseInt(fieldNameToTableId(links[i].source));
		var targetTableId;
		if (d3.keys(SUBSELECT_TYPES).indexOf(links[i].type) !== -1) {
			targetTableId = parseInt(tableNameToId(links[i].target));
		}
		else {
			targetTableId = parseInt(fieldNameToTableId(links[i].target));
		}
		if (l[sourceTableId+","+targetTableId]) {
			l[sourceTableId+","+targetTableId] = {source: sourceTableId, target: targetTableId, type: links[i].type, value: l[sourceTableId+","+targetTableId].value+1};
		}
		else {
			l[sourceTableId+","+targetTableId] = {source: sourceTableId, target: targetTableId, type: links[i].type, value: 1};
		}
	}
	for (var i in linksToOutput) {
		var sourceId;
		if (linksToOutput[i].from == "field") {
			sourceId = parseInt(fieldNameToTableId(linksToOutput[i].fieldName));
		}
		else if (linksToOutput[i].from == "function") {
			sourceId = parseInt(getFunctionId(linksToOutput[i].sourceFunctionId));
		}
		else continue;
		var targetId = parseInt(getOutputId(linksToOutput[i].outputTableAlias.replace(OUTPUT_PREFIX,'')));
		l[sourceId+","+targetId] = {source: sourceId, target: targetId, value: 1};
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
			sourceId = parseInt(fieldNameToTableId(linksToFunctions[i].fieldName));
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

function processJson(jsondata, subqueryIndex) {
	var subqueryGroup=subqueryIndex || MAIN_QUERY_ALIAS;
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
	for (var tableName in jsondata.Tables) {
		tables[tableName]=({type: "table",
			  				name:tableName,
			  				subqueryGroup: subqueryGroup});
		var tableInfo = jsondata.Tables[tableName];
		for (var tableAlias in tableInfo) {
			tableAliases[tableAlias]={table: tableName,name: tableAlias};
			var actions=tableInfo[tableAlias];
			for (var type in actions) {
				var actionFields=actions[type];
				for (var field in actionFields) {
					var data=actionFields[field];
					if (fields[tableAlias+"."+field] == undefined) {
						fields[tableAlias+"."+field]={type: "field", tableAlias:tableAlias, name:field, fullName:tableAlias+"."+field, filtered: false, sort: false, subqueryGroup: subqueryGroup};
					}
					switch(type) {
						case 'OUTPUT':
							for (var functionAlias in data) {
								var outputAlias = data[functionAlias];
								if (functionAlias == -1) { // Directly to output
									var fullName = outputTableAlias+"."+outputAlias;
									linksToOutput.push({type: "link", from: "field", fieldName: tableAlias+"."+field, outputName: outputAlias, outputTableAlias: outputTableAlias});
									fields[fullName]={type: "field", tableAlias:outputTableAlias, name:outputAlias, fullName: fullName, filtered: false, sort: false, subqueryGroup: subqueryGroup};
									
									// We are in a subquery, the output must be transmitted to the superquery if included in the main query's SELECT
									if (subqueryGroup !== MAIN_QUERY_ALIAS) {
										var mainSubqueryOutputAlias = OUTPUT_PREFIX+MAIN_QUERY_ALIAS;
										if (subqueryType === "SINGLEROW_SUBS") {
											var fullNameInMainSubquery = mainSubqueryOutputAlias+"."+subqueryGroup;
											linksToOutput.push({type: "link", from: "field", fieldName: fullName, outputName: subqueryGroup, outputTableAlias: mainSubqueryOutputAlias});
											fields[subqueryGroup]={type: "field", tableAlias: mainSubqueryOutputAlias, name: subqueryGroup, fullName: fullNameInMainSubquery, filtered: false, sort: false, subqueryGroup: MAIN_QUERY_ALIAS};
										}
										else if (subqueryType === null) { // Derived table
											var fullNameInMainSubquery = mainSubqueryOutputAlias+"."+outputAlias;
											linksToOutput.push({type: "link", from: "field", fieldName: fullName, outputName: outputAlias, outputTableAlias: mainSubqueryOutputAlias});
											fields[fullNameInMainSubquery]={type: "field", tableAlias: mainSubqueryOutputAlias, name: outputAlias, fullName: fullNameInMainSubquery, filtered: false, sort: false, subqueryGroup: MAIN_QUERY_ALIAS};
										}
									}
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
													fields[otherField]={type: "field", tableAlias:tableAliasAndField[0], name:tableAliasAndField[1], fullName:otherField, filtered: false, sort: false, subqueryGroup: subqueryGroup};
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
									default:
										if (d3.keys(SUBSELECT_TYPES).indexOf(conditionType) !== -1) {
											links.push({source: tableAlias+"."+field, target: OUTPUT_PREFIX+conditionData, type: conditionType});
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
			linksToOutput.push({type: "link", from: "function", sourceFunctionId: functionAlias, outputName: functions[functionAlias]["functionAlias"], outputTableAlias: outputTableAlias});
			fields[functionAlias]={type: "field", tableAlias:outputTableAlias, name:functionAlias, fullName:functionAlias, filtered: false, sort: false, subqueryGroup: subqueryGroup};
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
}

var table, 
	groups,
	tableText, 
	tableSeparator, 
	tableAlias, 
	field, 
	fieldOrder, 
	fieldText,
	funcText,
	
	path, 
	pathToFunction,
	pathToOutput;

function buildGraph() {	
	
	tables = d3.values(tables);
	tableAliases = d3.values(tableAliases);
	fields = d3.values(fields);

	//cleanup
	svg.selectAll('image,svg>g').remove();
	
	var g = svg.append("svg:g");
	
	groups = g.append("svg:g").selectAll("g")
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
			 && d3.select(".subquery[name=\""+currentTable.subqueryGroup+"\"]").node() === null) {
				g.append("svg:rect")
				  .attr("class","subquery")
				  .attr("name",currentTable.subqueryGroup);
			}
			
			d3.select(this)
			  .append("svg:rect")
				.attr("class", "table"+(currentTable.output ? " output":""))
				
				.attr("height", tableHeight)
				.attr("width",  tableWidth );
			
			d3.select(this)
			  .append("svg:text")
				.text(currentTable.output ? OUTPUT_LABEL : currentTable.name)
				.attr("class", "tablename"+(currentTable.output ? " output":""))
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
				.attr("class", "aliasGroup")
				.each(function(currentAlias,i) {

					d3.select(this)
					  .append("svg:text")
						.text(currentTable.output ? "" : currentAlias.name)
						.attr("x", getAliasPosX(relatedAliases, currentAlias.name, tableWidth)+ALIAS_NAME_PADDING.left)
						.attr("y", ALIAS_NAME_PADDING.top);

					d3.select(this)
					  .append("svg:rect")
						.attr("class", "alias"+(currentAlias.output ? " output":""))
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
				.attr("class", "fieldGroup")
				.each(function(currentField,i) {
					var sort = 	 currentField.sort;
					var isFiltered = currentField.filtered;
					var preexistingField = d3.select("g.tableGroup[name=\""+currentTable.name+"\"] g.fieldGroup[name$=\""+currentField.name+"\"] circle");
					
					var circlePosition = {x: getAliasPosX(relatedAliases, currentField.tableAlias, tableWidth)+ALIAS_NAME_PADDING.left,
										  y: preexistingField.empty() ? (FIELD_PADDING.top+FIELD_LINEHEIGHT*fieldIndex-CIRCLE_RADIUS/2) : parseInt(preexistingField.attr("cy")) };
					
					d3.select(this)
					  .append("svg:circle")
						.attr("r",CIRCLE_RADIUS)
						.attr("class", (isFiltered ? "filtered" : "")+" "
									  +(sort   	   ? "sort" 	: ""))
						.attr("cx", circlePosition.x)
						.attr("cy", circlePosition.y);
					
					if (sort) {
						d3.select(this)
						  .append("svg:image")
						    .attr("xlink:href", "images/sort_"+sort+".svg")
						    .attr("class", "order")
							.attr("width", SORT_SIDE)
							.attr("height",SORT_SIDE)
							.attr("x", circlePosition.x)
							.attr("y", circlePosition.y-SORT_SIDE/2);
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
		})
		.on('mousedown', preventGlobalDrag)
		.on('mouseup', allowGlobalDrag);
	
	path = g.append("svg:g").selectAll("path.join")
		.data(links)
	  .enter().append("svg:path")
		.attr("class", "link")
		.attr("id", function(d,i) { return "link"+i; })
		.attr("marker-start", function(d) { 
			if (d.type == "innerjoin" || d.type == "leftjoin" || d.type == "rightjoin") {
				return "url(#solidlink1)";
			}
		})
		.attr("marker-end", function(d) { 
			if (d.type == "innerjoin") {
				return "url(#solidlink2)";
			}
			else if (d3.keys(SUBSELECT_TYPES).indexOf(d.type) !== -1) {
				return "url(#subquery)";
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

	pathToOutput = g.append("svg:g").selectAll("path.output")
		.data(linksToOutput)
	  .enter().append("svg:path")
	    .attr("id", function(d,i) { return "outputpath"+i;})
		.attr("class", "output link ")
		.attr("marker-end", "url(#arrow)");
		
	func = g.append("svg:g").selectAll("ellipse.function")
		.data(d3.values(functions))
	  .enter().append("svg:ellipse")
		.attr("class", function(d) { return "function "+(d.isCondition ? "conditional":""); })
		.attr("name", function(d) { return d.functionAlias;})
		.attr("ry",FUNCTION_BOX_RY+FUNCTION_ELLIPSE_PADDING.top*2)
		.call(node_drag)
		.on('mousedown', preventGlobalDrag)
		.on('mouseup', allowGlobalDrag);

	pathToFunction = g.append("svg:g").selectAll("path.tofunction")
		.data(linksToFunctions)
	  .enter().append("svg:path")
	    .attr("id", function(d,i) { return "pathtofunction"+i;})
		.attr("class", "link tofunction")
		.attr("marker-end", "url(#arrow)");
		
	funcText = g.append("svg:g").selectAll("g")
		.data(d3.values(functions))
	  .enter().append("svg:text")
		.text(function(d) { return d.name; });

	constantText = g.append("svg:g").selectAll("g")
		.data(d3.values(constants))
	  .enter().append("svg:text")
		.text(function(d) { return d.name; });
	
	//positionAll();
	
	force
		.nodes(n)
		.links(l)
		.on("tick", tick)
		.start();
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

function filterFieldOrFunction(fieldOrFunction, origin, d) {
  if (origin == "all")
	return true;
  if (origin == "field") {
	return fieldOrFunction.fieldName == d.fieldName;
  }
  if (origin == "function") {
	 return fieldOrFunction.functionAlias == d.functionAlias 
	 	 || fieldOrFunction.sourceFunctionId == d.functionAlias;
  }
}

function positionPathsToOutput(origin,d) {
  pathToOutput.filter(function(link) {
	return filterFieldOrFunction(link,origin,d);
  }).attr("d", function(link) { 
	  var source = getNode(link);
	  var target = d3.select('.tableGroup.output [name="'+link.outputTableAlias+'.'+link.outputName+'"] circle');
	  
	  return getPath(this, source, target);
  });
}

function positionPathsToFunctions(origin,d) {
	pathToFunction.filter(function(link) {
	  return filterFieldOrFunction(link,origin,d);
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
	
	var pathCoords=getPathFromCoords(sourceCoords.x, sourceCoords.y, targetCoords.x, targetCoords.y, isArc);
	d3.select(pathElement).attr("d",pathCoords);
	var pathObject = domElementToMyObject(pathElement);
	
	sourceCoords = getCorrectedPathPoint(pathObject, source, sourceCoords, target, targetCoords);
	targetCoords = getCorrectedPathPoint(pathObject, target, targetCoords, source, sourceCoords);
	
	return getPathFromCoords(sourceCoords.x, sourceCoords.y, targetCoords.x, targetCoords.y, isArc);
}

function getCorrectedPathPoint(pathObject, element, elementCoords, otherElement, otherElementCoords) {
	var elementData = element.data()[0];
	switch (elementData.type) {
		case "function":
			var elementObject = domElementToMyObject(element[0][0]);
			return getIntersection(pathObject, elementObject, otherElementCoords) || elementCoords;
		break;
		case "constant":
			return {x: elementCoords.x+elementData.name.length/2*CHAR_WIDTH, 
				 	y: elementCoords.y};
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
			return d3.select('[name="'+pathInfo.fieldName+'"] circle');
		break;
		case "link":
			args.role = args.role || "source";
			if (args.role == "source") {
				switch (pathInfo.from) {
					case "field":
						return d3.select('[name="'+pathInfo.fieldName+'"] circle');
					break;
					case "function":
						return d3.select('[name="'+pathInfo.sourceFunctionId+'"]');
					break;
					case "constant":
						return constantText.filter(function(c) { 
							return pathInfo.constantId == c.id; 
						});
					break;
				}
			}
			else {
				return d3.select('[name="'+pathInfo.functionAlias+'"]');
			}
		break;
		case "constant":
			return constantText.filter(function(c) { 
				return pathInfo.constantId == c.id; 
			});
		break;
	}
}

function getNodeCharge(d) {
	var charge = 0;
	switch(d.type) {
		case "table":
			charge = d3.max([
				groups.filter(function(d2) { return d2.name === d.name;}).node().getBoundingClientRect().width,
				groups.filter(function(d2) { return d2.name === d.name;}).node().getBoundingClientRect().height]);
		break;
		
		case "function":
			charge = 2*d3.max([parseInt(func.filter(function(func) { return func.functionAlias == d.functionAlias; }).attr("rx")),
			                   parseInt(func.filter(function(func) { return func.functionAlias == d.functionAlias; }).attr("ry"))]);
		break;
		case "subquery":
			if (d.name !== MAIN_QUERY_ALIAS) {
				charge = d3.max([
	 				d3.select('.subquery[name="'+d.name+'"]').node().getBoundingClientRect().width,
	 				d3.select('.subquery[name="'+d.name+'"]').node().getBoundingClientRect().height]);
			}
	}
	return -1*charge*charge;
}

function positionAll() {
	var subqueryBoundaries=[];
	groups.each(function(d,i) {
		var tableBoundaries = positionTable.call(this,d,i);
		if (d.subqueryGroup !== undefined) {
			if (!subqueryBoundaries[d.subqueryGroup]) {
				subqueryBoundaries[d.subqueryGroup]=[];
			}
			subqueryBoundaries[d.subqueryGroup].push(tableBoundaries);
		}
	});
	for (var subqueryGroup in subqueryBoundaries) {
		var boundaries = subqueryBoundaries[subqueryGroup];
		var topBoundary = 	 d3.min(boundaries, function(coord) { return coord.y1; }) - SUBQUERY_PADDING;
		var rightBoundary =  d3.max(boundaries, function(coord) { return coord.x2; }) + SUBQUERY_PADDING;
		var bottomBoundary = d3.max(boundaries, function(coord) { return coord.y2; }) + SUBQUERY_PADDING;
		var leftBoundary = 	 d3.min(boundaries, function(coord) { return coord.x1; }) - SUBQUERY_PADDING;
		
		d3.select(".subquery[name=\""+subqueryGroup+"\"]")
			.attr("x",leftBoundary)
			.attr("y",topBoundary)
			.attr("width",rightBoundary-leftBoundary)
			.attr("height",bottomBoundary-topBoundary);
	}
	
	func.each(function(d,i) {
		positionFunction.call(this,d,i);
	});
	
	pathToOutput.each(function(d,i) {
		positionPathsToOutput(d.from,d);
	});
}

function positionTable(d, i) {
	var x = d.x || 0;
	var y = d.y || 0;
	
	d3.select(this)
	  .attr("transform", "translate("+x+" "+y+")");
		
	// Paths between fields
	path.attr("d", function(d) {
	  var source=d3.select('[name="'+d.source+'"] circle');
	  var target=d3.select('[name="'+d.target+'"] circle');
	  
	  return getPath(this, source, target, true);
	});
	
	return {x1: x, y1: y, x2: x+this.getBBox().width, y2: y+this.getBBox().height};
}

function positionFunction(d, i) {
	var x=d.x || 0;
	var y=d.y || 0;
	
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
	  });
	
}

function isFieldInTable(field,table) {
	return tableAliases.filter(function(tableAlias) { 
		return tableAlias.name === field.tableAlias && tableAlias.table == table.name; 
	}).length > 0;
}

function fieldNameToTableId(fieldname) {
	return fieldNameToTable(fieldname, "index");
}

function fieldNameToTableObject(fieldname) {
	return fieldNameToTable(fieldname, "object");
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
}

function preventGlobalDrag() {
	nodeDragging = true;
}

function allowGlobalDrag() {
	nodeDragging = false;
}

function tableNameToId(tablename) {
	for (var i in n) {
		if (n[i].type === "table" && n[i].name === tablename) {
			return i;
		}
	}
	return;
}

function getOutputId(outputAlias) {
	for (var i in n) {
		if (outputAlias == n[i].name)
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

function tick() {
	positionAll();
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