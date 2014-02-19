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

var OUTPUT_LABEL="OUTPUT";


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
   ,SUBQUERY_TYPE_PADDING	 =- 3;

/* Legend-specific measures */
var LEGEND_LINEHEIGHT        = 30,
	LEGEND_CONTENT_PADDING   = {
								 left: 10,
								 top:  10
							   };

/* Misc */

var OUTPUT_PREFIX="_OUTPUT_";
var MAIN_QUERY_ALIAS="main";

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