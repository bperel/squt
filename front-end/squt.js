var tables= [];
var tableAliases={};
var fields= {};
		 
var links= [];
var linksToOutput=[];

var w = 960,
    h = 500;

var editor = CodeMirror.fromTextArea(document.getElementById("query"), {
	lineWrapping: true
});
 

var drag = d3.behavior.drag()
	.origin(Object)
	.on("drag", position);

var svg = d3.select("body").append("svg:svg")
	.attr("id","graph")
	.attr("width", w)
	.attr("height", h);
	
svg.append("defs").selectAll("marker")
    .data(["internal", "output"])
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

d3.select("#OK").on("click",function(d,i) {
	
	d3.json(
	  "analyze.php?query="+editor.getValue().replace(/\n/g,' '),
	  function (jsondata) {
		console.log(jsondata);
		if (jsondata.Error) {
			d3.select('#log').text(jsondata.Error);
			svg.selectAll('image,g').remove();
			return;
		}
		tables= [];
		tableAliases={};
		fields= {};
		links= [];
		linksToOutput=[];
		
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
							fields[tableAlias+"."+field]={tableAlias:tableAlias, name:field, fullname:tableAlias+"."+field, filtered: false, sort: false};
						}
						switch(type) {
							case 'o': // output
								linksToOutput.push(tableAlias+"."+field);
							break;
							case '?': // condition
								if (data.indexOf(".") != -1) { // jointure
									links.push({source: tableAlias+"."+field, target: data});
								}
								else { 
									fields[tableAlias+"."+field]['filtered']=true;
								}
							break;
							case '^': // tri
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

var ground, table, tableText, tableSeparator, tableAlias, field, fieldOrder, fieldText, path, pathToOutput;

function buildGraph() {	

	//cleanup
	svg.selectAll('image,g').remove();
	
	ground = svg.append("svg:image")
	  .attr("xlink:href", "images/ground.svg")
	  .attr("width", 40)
	  .attr("height", 40)
	  .attr("x",w-45)
	  .attr("y",h-45)
	  .call(drag);
	  
	tableBoxes = svg.append("svg:g").selectAll("rect.table")
		.data(d3.values(tables))
	  .enter().append("svg:rect")
		.attr("class","table")
		.attr("name", function(d) { return d.name;})
		.attr("width", function(d) { return 120;/*12+d.name.length*7;*/})
		.attr("rx", 4)
		.attr("ry", 4)
		.call(drag);
		
	tableText = svg.append("svg:g").selectAll("g")
		.data(d3.values(tables))
	  .enter().append("svg:text")
		.text(function(d) { return d.name; });
		
	tableSeparator = svg.append("svg:g").selectAll("line")
		.data(d3.values(tables))
	  .enter().append("svg:line")
		.attr("stroke", "black")
		.call(drag);
		
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
		.attr("r",6)
		.attr("class",function(d) { return (d.filtered === true ? "filtered" : "")+" "+(d.sort === true ? "sort" : "");});
		
	fieldOrder = svg.append("svg:g").selectAll("image.order")
		.data(d3.values(fields).filter(function(f) { return f.sort;}))
	  .enter().append("svg:image")
	    .attr("xlink:href", function(f) { return "images/sort_"+f.sort+".svg";})
	    .attr("class", "order")
		.attr("width",30)
		.attr("height",30);
	  
	fieldText = svg.append("svg:g").selectAll("g")
		.data(d3.values(fields))
	  .enter().append("svg:text")
		.attr("name",function(d) { return d.tableAlias+"."+d.name; })
		.text(function(d) { return d.name; });
		

	path = svg.append("svg:g").selectAll("path.internal")
		.data(links)
	  .enter().append("svg:path")
		.attr("class", function(d) { return "internal link " + d.type; });;

	pathToOutput = svg.append("svg:g").selectAll("path.output")
		.data(linksToOutput)
	  .enter().append("svg:path")
		.attr("class", function(d) { return "output link "; })
		.attr("marker-end", "url(#output)");
		
	tableBoxes.call(function(d) {positionAll(d);});
}


function positionFieldPathsToOutput(d,i,x,y) {
  pathToOutput.filter(function(fieldName) {
    var currentTableAlias = fieldName.substring(0,fieldName.indexOf("."));
	return tableAlias.filter(function(ta) { return tableAliases[currentTableAlias] && tableAliases[currentTableAlias].table == d.name;})[0].length > 0;
  }).attr("d", getPathToOutput);
}

function getPathToOutput(fieldName) {
	var source=field.filter(function(f) { 
		return f.fullname == fieldName; 
	});
	  
	var dx = ground.attr("x") - source.attr("cx"),
		dy = ground.attr("y") - source.attr("cy"),
		dr = Math.sqrt(dx * dx + dy * dy);
	return "M" + source.attr("cx") + "," + source.attr("cy") + "A" + dr + "," + dr + " 0 0,1 " + (parseInt(ground.attr("x"))+parseInt(ground.attr("width"))/2) + "," + ground.attr("y");
}

function positionAll(elements) {
	elements.each(function(d,i) {
	  position.call(this,d,i, "",12+i*200, 0);
	});
}

function position(d, i, a, x, y) {
	if (x == undefined && isNaN(d3.event.x) && !isNaN(d3.event.dx)) {
		x = parseInt(d3.select(this).attr("x")) + d3.event.dx;
		y = parseInt(d3.select(this).attr("y")) + d3.event.dy;
	}
	x = x == undefined ? d3.event.x : x;
	y = y == undefined ? d3.event.y : y;
	
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
		return 35+field.filter(function(f) { 
			return tableAlias.filter(function(ta) { 
				f.tableAlias == ta.name && ta.table == d.name}); 
		})[0].length * 20;
	});
	
	var tableWidth=parseInt(d3.select(this).attr("width"));
	var tableHeight=parseInt(d3.select(this).attr("height"));
	  
	tableText.filter(function(tt) { return tt.name == d.name; })
	  .attr("x", x+3)
	  .attr("y", y+12);
	  
	tableSeparator.filter(function(ts) { return ts.name == d.name; })
	  .attr("x1", x)
	  .attr("x2", x+parseInt(d3.select('rect[name="'+d.name+'"]').attr('width')))
	  .attr("y1", y+20)
	  .attr("y2", y+20);
	  
	relatedAliases
	  .attr("x", function(ta,j) { return x+tableWidth+j*ta.name.length*20+10;})
	  .attr("y", y+12);
	  
	tableAliasBoxes.filter(function(ta) { return ta.table == d.name; })
	  .attr("x", function(ta,j) { return x+tableWidth+j*ta.name.length*20;})
	  .attr("y", y+20)
	  .attr("width",function(ta,j) { return ta.name.length*20;})
	  .attr("height",tableHeight-20);
	  
	  
	fieldText.filter(function(f) { return isFieldInTable(f,d);})
	  .attr("x", x+5)
	  .attr("y", function(f, i) { return (y || 0) +35+20*i});
		
	
	field.filter(function(f) { return isFieldInTable(f,d);})
	  .attr("cx", function(f) { return relatedAliases.filter(function(a) { return a.name == f.tableAlias; }).attr("x");})
	  .attr("cy", function(f, i) { return (y || 0) +30+20*i});
		
	
	fieldOrder.filter(function(f) { return isFieldInTable(f,d);})
	  .attr("x", function(f) { return parseInt(field.filter(function(a) { return f.fullname == a.fullname; }).attr("cx"));})
	  .attr("y", function(f) { return parseInt(field.filter(function(a) { return f.fullname == a.fullname; }).attr("cy"))-15;});
		
	
	positionFieldPathsToOutput.call(this, d,i);
	
	path.attr("d", function(d) {
	  var source=field.filter(function(f) { return d.source == f.fullname; });
	  var target=field.filter(function(f) { return d.target == f.fullname; });
	
	  var x = [source.attr("cx") || 0, target.attr("cx") || 0];
	  var y = [source.attr("cy") || 0, target.attr("cy") || 0];
 	
	  var dx = x[1] - x[0],
		  dy = y[1] - y[0],
		  dr = Math.sqrt(dx * dx + dy * dy);
	  return "M" + x[0] + "," + y[0] + "A" + dr + "," + dr + " 0 0,1 " + x[1] + "," + y[1];
	});
}

function isFieldInTable(field,table) {
	return tableAliases[field.tableAlias] && tableAliases[field.tableAlias].table == table.name;
}