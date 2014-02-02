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

var CIRCLE_RADIUS 	   		 = 6,
	SORT_SIDE	  	   		 = 30,
	MIN_TABLE_HEIGHT   		 = 35,
	TABLE_NAME_PADDING 		 = [],
	LINE_SEPARATOR_TOP 		 = 20,
	ALIAS_BOX_MARGIN   		 = [],
	ALIAS_NAME_PADDING 		 = [],
	FIELD_PADDING	   		 = [],
	FIELD_LINEHEIGHT   		 = 20,
	OUTPUT_NAME_TOP_PADDING  =-5,
	FUNCTION_BOX_RY			 = 20,
	FUNCTION_ELLIPSE_PADDING = [],
	CONSTANT_PADDING 		 = [],
	SUBQUERY_PADDING		 = 5,
	SUBQUERY_TYPE_PADDING	 =-3;

TABLE_NAME_PADDING.left 	 = 3;
TABLE_NAME_PADDING.top  	 = 12;
TABLE_NAME_PADDING.output_top= 13;

ALIAS_BOX_MARGIN.left 		 = 0;
ALIAS_BOX_MARGIN.top  		 = 20;

ALIAS_NAME_PADDING.top  	 = 12;
ALIAS_NAME_PADDING.right	 = 10;
ALIAS_NAME_PADDING.left 	 = 10;

FIELD_PADDING.left 			 = 5;
FIELD_PADDING.top 			 = 35;

FUNCTION_ELLIPSE_PADDING.left= 10;
FUNCTION_ELLIPSE_PADDING.top = 0;

CONSTANT_PADDING.left		 = 10;
CONSTANT_PADDING.bottom		 = 10;

/* Misc */

var OUTPUT_PREFIX="_OUTPUT_";
var MAIN_QUERY_ALIAS="main";