var editor = CodeMirror.fromTextArea(document.getElementById("query"), {
	lineWrapping: true
});

var query_examples=d3.selectAll('.samplequery').each(function() {
	d3.select('#query_sample')
		.on("change",function(d,i) {
			var queryname = d3.select(this[this.selectedIndex]).attr('name');
			if (queryname != "dummy") {
				editor.setValue(d3.select('.samplequery[name="'+queryname+'"]').text());
			}
		})
		.append("option")
			.text(d3.select(this).attr("title"))
			.attr("name",d3.select(this).attr("name"));
});

var is_debug=extractUrlParams()['debug'] !== undefined;

var tables= [],
	tableAliases={},
	fields= {},
		 
	links=[],
	functions=[],
	linksToFunctions=[],
	linksToOutput=[];
 

var dragTable = d3.behavior.drag()
	.origin(Object)
	.on("drag", positionTable),

	dragFunction = d3.behavior.drag()
	.origin(Object)
	.on("drag", positionFunction),

	dragGround = d3.behavior.drag()
	.origin(Object)
	.on("drag", positionGround);

var svg = d3.select("body").append("svg:svg")
	.attr("id","graph")
	.attr("width", W)
	.attr("height", H);

svg.append("defs");
	
d3.select("defs").append("svg:g").selectAll("marker")
    .data(["output"])
  .enter().append("marker")
    .attr("id", String)
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 15)
    .attr("refY", -1.5)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
  .append("path")
    .attr("d", "M0,-5L10,0L0,5");

d3.select("defs").append("svg:g").selectAll("marker")
      .data(["solidlink1","solidlink2"])
    .enter().append("marker")
      .attr("id", String)
      .attr("class","solidlink")
      .attr("refX", function(d,i) {
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

d3.select("#OK").on("click",function(d,i) {
	var url="analyze.php?query="+editor.getValue().replace(/\n/g,' ');
	if (is_debug) {
		d3.text(
			url+"&debug=1",
			function(data) {
				d3.select('#log').text(data);
			}
		);
		return;
	}
	d3.json(
	  url,	  
	  function (jsondata) {
		console.log(jsondata);
		if (jsondata == null) {
			d3.select('#log').text("Error ! Make sure your paths are properly configured");
			svg.selectAll('image,g').remove();
			return;
		}
		if (jsondata.Error) {
			d3.select('#log').text("ERROR - " + jsondata.Error);
			svg.selectAll('image,g').remove();
			return;
		}
		if (jsondata.Warning) {
			var warningText=[];
			for (var warnType in jsondata.Warning) {
				switch (warnType) {
					case 'No alias':
						for (var i in jsondata.Warning[warnType]) {
							var field_location=jsondata.Warning[warnType][i];
							warningText.push("WARNING - No named alias for field " + i + " located in "+field_location+" clause : field will be ignored");
						}
					break;
				}
			}
			d3.select('#log').text(warningText.join("\n"));
		}
		else {
			d3.select('#log').text("");
		}
		tables= 	 	 [],
		tableAliases=	 {},
		fields= 	 	 {},
		links= 			 [],
		functions=		 [],
		linksToFunctions=[],
		linksToOutput=	 [];
		
		for (var tableName in jsondata.Tables) {
			tables[tableName]=({'name':tableName});
			var tableInfo = jsondata.Tables[tableName];
			for (var tableAlias in tableInfo) {
				tableAliases[tableAlias]={'table':tableName,'name':tableAlias};
				var actions=tableInfo[tableAlias];
				for (var type in actions) {
					var actionFields=actions[type];
					for (var field in actionFields) {
						var data=actionFields[field];
						if (fields[tableAlias+"."+field] == undefined) {
							fields[tableAlias+"."+field]={tableAlias:tableAlias, name:field, fullName:tableAlias+"."+field, filtered: false, sort: false};
						}
						switch(type) {
							case 'OUTPUT':
								for (var functionId in data) {
									var outputAlias = data[functionId];
									if (functionId == -1) { // Directly to output
										linksToOutput.push({type: "field", fieldName: tableAlias+"."+field, outputName: outputAlias});
									}
									else { // Through a function
										if (functions[functionId] == undefined) {
											functions[functionId]={functionId: functionId, 
																   name: jsondata.Functions[functionId]["name"],
																   alias: jsondata.Functions[functionId]["alias"]};
											linksToOutput.push({type: "function", functionId: functionId, outputName: functions[functionId]["alias"]});
										}
										linksToFunctions.push({fieldName: tableAlias+"."+field, functionId: functionId});
									}
								}
								
							break;
							case 'CONDITION':
								for (var otherField in data) {
									if (otherField.indexOf(".") != -1) { // condition is related to another field => it's a join
										if (fields[otherField] == undefined) { // In case the joined table isn't referenced elsewhere
											var tableAliasAndField=otherField.split('.');
											fields[otherField]={tableAlias:tableAliasAndField[0], name:tableAliasAndField[1], fullName:otherField, filtered: false, sort: false};
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
									else { 
										fields[tableAlias+"."+field]['filtered']=true;
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

		var i=0;
		for(var key in fields) {
		  fields[key].id=i++;
		};
		
		buildGraph();

	  });

});

var ground, 
	table, 
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
	
	ground = svg.append("svg:image")
	  .attr("xlink:href", "images/ground.svg")
	  .attr("width", 40)
	  .attr("height", 40)
	  .call(dragGround);
	  
	tableBoxes = svg.append("svg:g").selectAll("rect.table")
		.data(d3.values(tables))
	  .enter().append("svg:rect")
		.attr("class","table")
		.attr("name", function(d) { return d.name;})
		.attr("width", function(d) { return 120;/*12+d.name.length*7;*/})
		.call(dragTable);
		
	tableText = svg.append("svg:g").selectAll("g")
		.data(d3.values(tables))
	  .enter().append("svg:text")
		.text(function(d) { return d.name; });
		
	tableSeparator = svg.append("svg:g").selectAll("line")
		.data(d3.values(tables))
	  .enter().append("svg:line")
		.attr("stroke", "black");
		
	tableAlias = svg.append("svg:g").selectAll("g")
		.data(d3.values(tableAliases))
	  .enter().append("svg:text")
		.text(function(d) { return d.name; });
		
	tableAliasBoxes = svg.append("svg:g").selectAll("g")
		.data(d3.values(tableAliases))
	  .enter().append("svg:rect")
		.attr("class","alias")
		
	field = svg.append("svg:g").selectAll("circle")
		.data(d3.values(fields))
	  .enter().append("svg:circle")
		.attr("r",CIRCLE_RADIUS)
		.attr("class",function(d) { return (d.filtered === true ? "filtered" : "")+" "
										  +(d.sort 	   === true ? "sort" 	 : "");
								  });
		
	fieldOrder = svg.append("svg:g").selectAll("image.order")
		.data(d3.values(fields).filter(function(f) { return f.sort;}))
	  .enter().append("svg:image")
	    .attr("xlink:href", function(f) { return "images/sort_"+f.sort+".svg";})
	    .attr("class", "order")
		.attr("width",SORT_SIDE)
		.attr("height",SORT_SIDE);
	  
	fieldText = svg.append("svg:g").selectAll("g")
		.data(d3.values(fields))
	  .enter().append("svg:text")
		.attr("name",function(d) { return d.tableAlias+"."+d.name; })
		.text(function(d) { return d.name; });
		
	func = svg.append("svg:g").selectAll("ellipse.function")
		.data(d3.values(functions))
	  .enter().append("svg:ellipse")
		.attr("class","function")
		.attr("name", function(d) { return d.name;})
		.attr("ry",FUNCTION_BOX_RY+FUNCTION_ELLIPSE_PADDING.top*2)
		.call(dragFunction);
		
	funcText = svg.append("svg:g").selectAll("g")
		.data(d3.values(functions))
	  .enter().append("svg:text")
		.text(function(d) { return d.name; });
	
	
	path = svg.append("svg:g").selectAll("path.join")
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

	pathToFunction = svg.append("svg:g").selectAll("path.tofunction")
		.data(linksToFunctions)
	  .enter().append("svg:path")
	    .attr("id", function(d,i) { return "pathtofunction"+i;})
		.attr("class", function(d) { return "link tofunction"; });

	pathToOutput = svg.append("svg:g").selectAll("path.output")
		.data(linksToOutput)
	  .enter().append("svg:path")
	    .attr("id", function(d,i) { return "outputpath"+i;})
		.attr("class", function(d) { return "output link "; })
		.attr("marker-end", "url(#output)");

	outputTexts = svg.append("svg:g").selectAll("g")
		.data(linksToOutput)
	  .enter().append("svg:text")
	    .attr("class","outputname")
		.append("textPath")
		  .attr("xlink:href",function(d,i) { return "#outputpath"+i;})
		    .attr({"startOffset":20})
		    .append("tspan")
		      .attr("dy",-5)
		      .text(function(d) { return d.outputName; });
	
	// Initial positions
	positionGround.call(ground,null,null,null,false);
	tableBoxes.each(function(d,i) {
		positionTable.call(this,d,i);
	});
	func.each(function(d,i) {
		positionFunction.call(this,d,i);
	});
}

function filterFunction(fieldOrFunction, origin, d) {
  if (origin == "all")
	return true;
  if (origin == "field") {
	return fieldOrFunction.fieldName == d.fullName;
  }
  if (origin == "function") {
	 return fieldOrFunction.functionId == d.functionId;
  }
}

function positionPathsToOutput(origin,d) {
  pathToOutput.filter(function(link) {
	return filterFunction(link,origin,d);
  }).attr("d", function(d) { return getPathToOutput(d);});
  
  outputTexts.filter(function(link) {
	return filterFunction(link,origin,d);
  }).attr("dy",OUTPUT_NAME_TOP_PADDING); // Refreshing an attribute on the textPath allows it to be correctly positionned on its corresponding path
}

function positionPathsToFunctions(origin,d) {
	pathToFunction.filter(function(link) {
	  return filterFunction(link,origin,d);
	}).attr("d", function(d) {
		var source=field.filter(function(f) { return d.fieldName == f.fullName; });
	    var target=func.filter(function(f) { return d.functionId == f.functionId; });
	
	    var x = [source.attr("cx") || 0, target.attr("cx") || 0];
	    var y = [source.attr("cy") || 0, target.attr("cy") - FUNCTION_BOX_RY || 0];
 	
	    var dx = x[1] - x[0],
		    dy = y[1] - y[0],
		    dr = Math.sqrt(dx * dx + dy * dy);
	    return "M" + x[0] + "," + y[0] + "A" + dr + "," + dr + " 0 0,1 " + x[1] + "," + y[1];
	});
}

function getPathToOutput(info) {
	if (info.type == "field") {
		var source=field.filter(function(f) { 
			return f.fullName == info.fieldName; 
		});
		var source_y=source.attr("cy");
	}
	else {
		var source=func.filter(function(f) { return info.functionId == f.functionId; });
		var source_y=parseFloat(source.attr("cy")) + FUNCTION_BOX_RY;
	}
	  
	var dx = ground.attr("x") - source.attr("cx"),
		dy = ground.attr("y") - source_y,
		dr = Math.sqrt(dx * dx + dy * dy);
	return "M" + source.attr("cx") + "," + source_y + "A" + dr + "," + dr + " 0 0,1 " + (parseInt(ground.attr("x"))+parseInt(ground.attr("width"))/2) + "," + ground.attr("y");
}

function positionTable(d, i) {
	var drawFunctionLinks = d3.event != null;

	var x = d3.event == null ? 12+i*200 : (parseInt(d3.select(this).attr("x"))+d3.event.dx);
	var y = d3.event == null ? 0 : (parseInt(d3.select(this).attr("y"))+d3.event.dy);
	
	if (this instanceof SVGImageElement) {
		ground.attr("x", x)
			  .attr("y", y);
		pathToOutput.attr("d", getPathToOutput);
		return;
	}
	
	var relatedAliases = tableAlias.filter(function(ta) { return ta.table == d.name});
	
	d3.select(this)
	  .attr("x", this.x = x)
	  .attr("y", this.y = y)
	  .attr("height", function(t) { 
		return MIN_TABLE_HEIGHT+field.filter(function(f) { 
			return tableAlias.filter(function(ta) { 
				f.tableAlias == ta.name && ta.table == d.name}); 
		})[0].length * FIELD_LINEHEIGHT;
	});
	
	var tableWidth=parseInt(d3.select(this).attr("width"));
	var tableHeight=parseInt(d3.select(this).attr("height"));
	  
	tableText.filter(function(tt) { return tt.name == d.name; })
	  .attr("x", x+TABLE_NAME_PADDING.left)
	  .attr("y", y+TABLE_NAME_PADDING.top);
	  
	tableSeparator.filter(function(ts) { return ts.name == d.name; })
	  .attr("x1", x)
	  .attr("x2", function(ts) { return x+parseInt(d3.select('rect[name="'+ts.name+'"]').attr('width'));})
	  .attr("y1", y+LINE_SEPARATOR_TOP)
	  .attr("y2", y+LINE_SEPARATOR_TOP);
	  
	relatedAliases
	  .attr("x", function(ta,j) { return x+tableWidth
		  								+(j==0 ? 0 : (j-1)*ta.name.length*CHAR_WIDTH)
		  								+ALIAS_NAME_PADDING.left;})
	  .attr("y", y+ALIAS_NAME_PADDING.top);
	  
	tableAliasBoxes.filter(function(ta) { return ta.table == d.name; })
	  .attr("x", function(ta,j) { return x+tableWidth
										+(j==0 ? 0 : (j-1)*ta.name.length*CHAR_WIDTH)
		  								+ALIAS_BOX_MARGIN.left;})
	  .attr("y", y+ALIAS_BOX_MARGIN.top)
	  .attr("width",function(ta,j) { return ALIAS_NAME_PADDING.left 
		  								  + Math.max(ta.name.length*CHAR_WIDTH + ALIAS_NAME_PADDING.right,
		  										  	 CIRCLE_RADIUS/2 + SORT_SIDE);
	  							   })
	  .attr("height",tableHeight-ALIAS_BOX_MARGIN.top);
	  
	  
	fieldText.filter(function(f) { return isFieldInTable(f,d);})
	  .attr("x", x+FIELD_PADDING.left)
	  .attr("y", function(f, i) { return y + FIELD_PADDING.top + FIELD_LINEHEIGHT*i});
		
	
	field.filter(function(f) { return isFieldInTable(f,d);})
	  .attr("cx", function(f) { return relatedAliases.filter(function(a) { return a.name == f.tableAlias; }).attr("x");})
	  .attr("cy", function(f, i) { return y +FIELD_PADDING.top
		  									+FIELD_LINEHEIGHT*i
		  									-CIRCLE_RADIUS/2})
	  .each(function(f) {
		if (drawFunctionLinks) 
		  positionPathsToFunctions("field", f);
		positionPathsToOutput("field", f);
	  });
		
	
	fieldOrder.filter(function(f) { return isFieldInTable(f,d);})
	  .attr("x", function(f) { return parseInt(field.filter(function(a) { return f.fullName == a.fullName; }).attr("cx"));})
	  .attr("y", function(f) { return parseInt(field.filter(function(a) { return f.fullName == a.fullName; }).attr("cy"))-15;});

	
	path.attr("d", function(d) {
	  var source=field.filter(function(f) { return d.source == f.fullName; });
	  var target=field.filter(function(f) { return d.target == f.fullName; });
	
	  var x = [source.attr("cx") || 0, target.attr("cx") || 0];
	  var y = [source.attr("cy") || 0, target.attr("cy") || 0];
 	
	  var dx = x[1] - x[0],
		  dy = y[1] - y[0],
		  dr = Math.sqrt(dx * dx + dy * dy);
	  return "M" + x[0] + "," + y[0] + "A" + dr + "," + dr + " 0 0,1 " + x[1] + "," + y[1];
	});
}

function positionFunction(d, i) {
	var x=d3.event == null ? (i+1)*100 : (parseInt(d3.select(this).attr("cx"))+d3.event.dx);
	var y=d3.event == null ? 100 : (parseInt(d3.select(this).attr("cy"))+d3.event.dy);
	
	funcText.filter(function(func) { return func.functionId == d.functionId; })
	  .attr("x", function(func) { return x - func.name.length*CHAR_WIDTH/2;})
	  .attr("y", y);
	
	func.filter(function(func) { return func.functionId == d.functionId; })
	  .attr("cx", x)
	  .attr("cy", y)
	  .attr("rx",function(func,j) { return func.name.length*CHAR_WIDTH+FUNCTION_ELLIPSE_PADDING.left*2; })
	  .each(function(func) {
		positionPathsToFunctions("function",func);
		positionPathsToOutput("function",func);
	  });
	
}

function positionGround(d, i) {
	var drawLinks = d3.event != null;
	
	var x=d3.event == null ? W-45 : (parseInt(d3.select(this).attr("x"))+d3.event.dx);
	var y=d3.event == null ? H-45 : (parseInt(d3.select(this).attr("y"))+d3.event.dy);
	
	ground
	  .attr("x", x)
	  .attr("y", y);

	if (drawLinks) {
		positionPathsToOutput("all");
	}
}

function isFieldInTable(field,table) {
	return tableAliases[field.tableAlias] && tableAliases[field.tableAlias].table == table.name;
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