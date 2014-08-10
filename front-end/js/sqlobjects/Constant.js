var Constant = function(){};

Constant.prototype = new Sqlobject();


var constantGroups;

Constant.build = function(data) {
	constantGroups  = mainGroup.append("svg:g").selectAll("g.constantGroup")
		.data(d3.values(data))
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
				.attr("x", -rectDimensions.width /2 + CONSTANT_PADDING.leftright)
				.attr("y", -rectDimensions.height/2 + CONSTANT_PADDING.topbottom + CHAR_HEIGHT);

		})
		.call(node_drag);
};

Constant.process = function(data, outputTableAlias, subqueryGroup) {
	if (data) {
		d3.forEach(data, function(constant) {
			var constantId=constants.length;
			var constantAlias = constant.alias;
			var constantValue = constant.value;
			var fullName = [outputTableAlias, constantValue].join('.');

			constants.push({id: constantId, name: constantValue, value: constantValue, type: "constant" });
			linksToOutput.push({type: "link", from: "constant", outputTableAlias: outputTableAlias, outputName: constantAlias, constantId: constantId});
			fields.push({type: "field", tableAlias:outputTableAlias, name:constantAlias, fullName:fullName, filtered: false, sort: false, subqueryGroup: subqueryGroup});
		});
	}
};

Constant.processFunctionConstant = function(constant, functionAlias) {
	var constantId = constants.length;
	constants.push({id: constantId, name: constant, functionAlias: functionAlias, type: "constant"});
	linksToFunctions.push({
		type: "link",
		from: "constant",
		constantId: constantId,
		functionAlias: functionAlias
	});
};

Constant.position = function() {
	constantGroups.each(function(d) {
		var x=d.x || 0;
		var y=d.y || 0;

		d3.select(this)
			.attr("transform", "translate("+x+" "+y+")");
	});
};

Constant.findByDatum = function(d, useAlias) {
	return constantGroups.filter(function(c) {
		if (useAlias) {
			return d.name === c.name;
		}
		else {
			return d.constantId === c.id;
		}
	});
};

Constant.getId = function(d) {
	for (var i in n) {
		if (d.constantId == n[i].id)
			return i;
	}
	return null;
};