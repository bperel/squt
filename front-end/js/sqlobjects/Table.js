var Table = function(){};

Table.prototype = new Sqlobject();


var tableGroups;

Table.process = function(tableInfo, tableName, subqueryGroup, subqueryType, outputTableAlias) {
	tables[tableName]=({
		type: "table",
		name:tableName,
		subqueryGroup: subqueryGroup
	});

	d3.forEach(tableInfo, function(actions, tableAlias) {
		tableAliases[tableAlias]={table: tableName,name: tableAlias};

		d3.forEach(actions, function(actionFields, role) {

			d3.forEach(actionFields, function(data, fieldName) {
				Field.process(role, data, fieldName, tableAlias, subqueryGroup, outputTableAlias);
			});
		});
	});
};

Table.addOutputTable = function (subqueryGroup, outputTableAlias) {
	tables[outputTableAlias] = ({
		type: "table",
		output: true,
		name: outputTableAlias,
		subqueryGroup: subqueryGroup
	});
};

Table.build = function(data) {

	fieldNodes = [];

	tableGroups = mainGroup.append("svg:g").selectAll("g")
		.data(data)
		.enter().append("svg:g")
		.attr("class", function(currentTable) { return "tableGroup"+(currentTable.output ? " output":""); })
		.call(node_drag)
		.each(function(currentTable) {
			var relatedAliases = tableAliases.filter(function(ta) { return ta.table == currentTable.name; });
			var relatedFields = fields.filter(function(currentField) {
				return Field.isInTable(currentField, currentTable);
			});

			var tableWidth=
				TABLE_NAME_PADDING.left
			  + CHAR_WIDTH*d3.max([currentTable.name.length,
				d3.max(relatedFields, function(field) {
					return field.name.length;
				})])
			  + TABLE_NAME_PADDING.right;
			var tableHeight=MIN_TABLE_HEIGHT + relatedFields.length * FIELD_LINEHEIGHT;

			var currentTableElement = d3.select(this);
			currentTableElement
				.append("svg:rect")
				.classed({table: true, output: !!currentTable.output})
				.attr("height", tableHeight)
				.attr("width",  tableWidth );

			currentTableElement
				.append("svg:text")
				.text(currentTable.output ? OUTPUT_LABEL : currentTable.name)
				.classed({tablename: true, output: !!currentTable.output})
				.attr("x", TABLE_NAME_PADDING.left)
				.attr("y", currentTable.output ? TABLE_NAME_PADDING.output_top : TABLE_NAME_PADDING.top);

			currentTableElement
				.append("svg:line")
				.classed("tableSeparator", true)
				.attr("x1", 0)
				.attr("x2", tableWidth)
				.attr("y1", LINE_SEPARATOR_TOP)
				.attr("y2", LINE_SEPARATOR_TOP);

			currentTableElement
				.selectAll("g.aliasGroup")
				.data(relatedAliases)
				.enter().append("svg:g")
				.classed("aliasGroup", true)
				.each(function(currentAlias) {
					d3.select(this)
						.append("svg:text")
						.text(currentTable.output ? "" : currentAlias.name)
						.attr("x", getAliasPosX(relatedAliases, currentAlias.name, tableWidth)+ALIAS_NAME_PADDING.left)
						.attr("y", ALIAS_NAME_PADDING.top);

					d3.select(this)
						.append("svg:rect")
						.classed({alias: true, output: !!currentTable.output})
						.attr("x", getAliasPosX(relatedAliases, currentAlias.name, tableWidth))
						.attr("y", ALIAS_BOX_MARGIN.top)
						.attr("width", getAliasWidth(!!currentTable.output, currentAlias))
						.attr("height",tableHeight-ALIAS_BOX_MARGIN.top);
				});

			var fieldIndex = 0;

			Field.build(relatedFields, fieldIndex, currentTableElement, currentTable, relatedAliases, tableWidth);

			if (!!currentTable.output) {
				OptionLimit.build(currentTable.subqueryGroup, currentTableElement, tableWidth, tableHeight);
			}
		}
	);
};

Table.findByDatum = function(d) {
	return tableGroups.filter(function(table) {
		return d.name == table.name;
	});
};

Table.getIdFromName = function(tablename) {
	for (var i in n) {
		if (n[i].type === "table" && n[i].name === tablename) {
			return i;
		}
	}
	return null;
};

Table.position = function(d) {
	var x = d.x || 0;
	var y = d.y || 0;

	d3.select(this)
		.attr("transform", "translate("+x+" "+y+")");

	return {x1: x, y1: y, x2: x+this.getBBox().width, y2: y+this.getBBox().height};
};
