/* Query config */

var URL="analyze.php";
var QUERY_MAX_LENGTH = 2000;


/* MySQL enums */

var SUBSELECT_TYPES={SINGLEROW_SUBS: "SINGLEROW",
                     IN_SUBS	   : "IN",
                     EXISTS_SUBS   : "EXISTS",
                     ANY_SUBS	   : "ANY",
                     ALL_SUBS	   : "ALL"};

/* Labels */

var  OUTPUT_LABEL        = "OUTPUT"
	,LIMITS_1_BOUNDARY   = "$2 first row$3 only"
	,LIMITS_2_BOUNDARIES = "rows $1 to $2 only"
	,DISTINCT            = "(distinct rows)";

var OPTIONS_LABELS       = { SELECT_DISTINCT      : "distinct rows",
							 SELECT_STRAIGHT_JOIN : "LTR table join"}


/* Measures */

var W = 960,
    H = 500;

var CHAR_WIDTH = 8,
	CHAR_HEIGHT= 12;

var CIRCLE_RADIUS 	   		 =  6
   ,SORT_SIDE	  	   		 = 30
   ,MIN_TABLE_HEIGHT   		 = 35
   ,TABLE_NAME_PADDING 		 = { left:        3,
								 top:        12,
								 output_top: 13
							   }
   ,LINE_SEPARATOR_TOP 		 = 20
   ,ALIAS_BOX_MARGIN   		 = { left:  0,
								 top:  20
							   }
   ,ALIAS_NAME_PADDING 		 = {
								 top:   12,
								 right: 10,
								 left:  10
							   }
   ,FIELD_PADDING	   		 = {
								 left: 5,
								 top: 35
							   }
   ,FIELD_LINEHEIGHT   		 = 20
   ,FUNCTION_BOX_RY			 = 20
   ,FUNCTION_ELLIPSE_PADDING = {
								 left: 10,
								 top:   0
							   }
   ,CONSTANT_PADDING 		 = {
								 leftright: 10,
								 topbottom: 10
							   }
   ,SUBQUERY_PADDING		 =  5
   ,SUBQUERY_TYPE_PADDING	 =- 3
   ,OPTION_PADDING	   		 = {
								 left:  5,
								 top:  12
							   };

/* Legend-specific measures */
var LEGEND_LINEHEIGHT        = 35,
	LEGEND_WIDTH             = 50,
	LEGEND_PADDING           = 25,
	LEGEND_CONTENT_PADDING   = 10;

/* Misc */

var OUTPUT_PREFIX="_OUTPUT_";
var MAIN_QUERY_ALIAS="main";
var MAIN_SUBQUERY_OUTPUT_ALIAS = OUTPUT_PREFIX+MAIN_QUERY_ALIAS;

function addDefs() {
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
}

function addLegend() {
	var legendLabels = ["field", "data flow", "condition", "data transformation", "constant"];
	var legendFullWidth = LEGEND_PADDING + LEGEND_WIDTH + CHAR_WIDTH * d3.max(legendLabels, function(label) { return label.length; });

	var legend = svg.append("svg:g")
		.attr("id","legend")
		.attr("width", 100)
		.attr("height", 200)
		.attr("transform", "translate("+(-legendFullWidth+LEGEND_PADDING)+" 0)")
		.on("mouseover", function() {
			d3.select("#legend").attr("transform", "translate("+(LEGEND_PADDING)+" 0)");
		})
		.on("mouseout", function() {
			d3.select("#legend").attr("transform", "translate("+(-legendFullWidth+LEGEND_PADDING)+" 0)");
		});

	legend.append("svg:rect")
		.classed("whiteBackground", true)
		.attr("x", -LEGEND_PADDING)
		.attr("width", legendFullWidth)
		.attr("height", LEGEND_LINEHEIGHT * legendLabels.length);

	legend.selectAll("circle")
		.data([{cx: LEGEND_WIDTH/2, cy: LEGEND_CONTENT_PADDING}])
		.enter().append("svg:circle")
		.attr("r", CIRCLE_RADIUS)
		.attr("cx", function(d) { return d.cx;})
		.attr("cy", function(d) { return d.cy;});

	legend.append("svg:path")
		.attr("marker-end", "url(#arrow)")
		.classed("output link", true)
		.attr("d", getPathFromCoords({x: LEGEND_CONTENT_PADDING,                y: LEGEND_CONTENT_PADDING + LEGEND_LINEHEIGHT},
									 {x: LEGEND_WIDTH - LEGEND_CONTENT_PADDING, y: LEGEND_CONTENT_PADDING + LEGEND_LINEHEIGHT}, true));

	var legendRow = 1;

	legend.selectAll("ellipse")
		.data(["function conditional", "function"])
		.enter().append("svg:ellipse")
		.attr("class", function(d) { return d;})
		.attr("cx", LEGEND_WIDTH /2)
		.attr("cy", function() { return LEGEND_CONTENT_PADDING + ++legendRow*LEGEND_LINEHEIGHT; })
		.attr("rx", (LEGEND_WIDTH - LEGEND_CONTENT_PADDING) / 2)
		.attr("ry", LEGEND_LINEHEIGHT/3);

	legend.append("svg:rect")
		.classed("constant", true)
		.attr("x", LEGEND_CONTENT_PADDING + LEGEND_WIDTH/6)
		.attr("y", LEGEND_CONTENT_PADDING + (legendRow+2/3)*LEGEND_LINEHEIGHT)
		.attr("width",  LEGEND_WIDTH/3)
		.attr("height", 2*LEGEND_LINEHEIGHT/3);

	legend.selectAll("text")
		.data(legendLabels)
		.enter().append("svg:text")
		.attr("x", LEGEND_WIDTH)
		.attr("y", function(d, i) { return LEGEND_CONTENT_PADDING + CIRCLE_RADIUS/2 + i*LEGEND_LINEHEIGHT; })
		.text(String);

	legend.append("svg:rect")
		.attr("x", (legendFullWidth-LEGEND_PADDING))
		.attr("width",  LEGEND_PADDING)
		.attr("height", LEGEND_LINEHEIGHT * legendLabels.length);

	legend.append("svg:text")
		.classed("title", true)
		.attr("transform", "translate("+(legendFullWidth-LEGEND_PADDING+5)
								   +" "+((LEGEND_LINEHEIGHT * legendLabels.length - 18*"Legend".length)/2)+") rotate(90)")
		.text("Legend");
}