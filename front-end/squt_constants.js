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

var CIRCLE_RADIUS 	   		 = 6
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
								 leftright:   10,
								 topbottom:   10
							   }
   ,SUBQUERY_PADDING		 = 5
   ,SUBQUERY_TYPE_PADDING	 =-3 ;

/* Misc */

var OUTPUT_PREFIX="_OUTPUT_";
var MAIN_QUERY_ALIAS="main";