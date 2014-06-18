var Field = function(){};

Field.prototype = new Sqlobject();

Field.process = function (role, data, fieldName, tableAlias, subqueryGroup, outputTableAlias) {
	var tableAliasField = [tableAlias, fieldName].join('.');
	if (!fields.filter(function (field) {
		return field.fullName === tableAliasField;
	}).length) {
		fields.push({type: "field", tableAlias: tableAlias, name: fieldName, fullName: tableAliasField, filtered: false, sort: false, subqueryGroup: subqueryGroup});
	}
	switch (role) {
		case 'OUTPUT':
			d3.forEach(data, function (outputAlias, functionAlias) {
				if (functionAlias == -1) { // Directly to output
					var fullName = [outputTableAlias, outputAlias].join('.');
					linksToOutput.push({type: "link", from: "field", fieldName: tableAliasField, outputName: outputAlias, outputTableAlias: outputTableAlias});
					fields.push({type: "field", tableAlias: outputTableAlias, name: outputAlias, fullName: fullName, filtered: false, sort: false, subqueryGroup: subqueryGroup});
				}
				else { // To a function
					linksToFunctions.push({type: "link", from: "field", fieldName: tableAliasField, functionAlias: functionAlias});
				}
			});

			break;
		case 'CONDITION':
			d3.forEach(data, function (conditionData, conditionType) {
				switch (conditionType) {
					case 'FUNCTION':
						d3.forEach(d3.keys(conditionData), function (destinationFunctionAlias) {
							linksToFunctions.push({type: "link", from: "field", fieldName: tableAliasField, functionAlias: destinationFunctionAlias});
						});
						break;
					case 'JOIN':
					case 'VALUE':
					case 'EXISTS':
						d3.forEach(conditionData, function (join, otherField) {
							if (otherField.indexOf(".") != -1) { // condition is related to another field => it's a join
								if (!fields.filter(function (field) {
									return field.fullName === otherField;
								}).length) { // In case the joined table isn't referenced elsewhere
									var tableAliasAndField = otherField.split('.');
									fields.push({type: "field", tableAlias: tableAliasAndField[0], name: tableAliasAndField[1], fullName: otherField, filtered: false, sort: false, subqueryGroup: subqueryGroup});
								}
								var joinType;
								switch (join) {
									case 'JOIN_TYPE_LEFT':
										joinType = 'leftjoin';
										break;
									case 'JOIN_TYPE_RIGHT':
										joinType = 'rightjoin';
										break;
									case 'JOIN_TYPE_STRAIGHT':
										joinType = 'innerjoin';
										break;
									case 'JOIN_TYPE_NATURAL':
										joinType = 'innerjoin';
										alert('Natural joins are not supported');
										break;
								}
								links.push({source: tableAliasField, target: otherField, type: joinType});
							}
//							else { // It's a value
//								fields[tableAliasField].filtered=true;
//							}
						});
						break;
					default:
						if (d3.keys(SUBSELECT_TYPES).indexOf(conditionType) !== -1) {
							links.push({source: tableAliasField, target: OUTPUT_PREFIX + conditionData, type: conditionType});
						}
						break;
				}
			});
			break;
		case 'SORT':
			d3.forEach(fields, function (field) {
				if (field.fullName === tableAliasField) {
					field.sort = data;
				}
			});
			break;
	}
};

Field.build = function (data, fieldIndex, currentTableElement, currentTable, relatedAliases, tableWidth) {
	currentTableElement
		.selectAll("g.fieldGroup")
		.data(data)
		.enter().append("svg:g")
		.classed("fieldGroup", true)
		.each(function (currentField) {
			var sort = currentField.sort;
			var isFiltered = currentField.filtered;
			var preexistingField = fieldNodes.filter(function (fieldNode) {
				return fieldNode.tableAlias === currentTable.name && fieldNode.name === currentField.name;
			});

			var circlePosition = {x: getAliasPosX(relatedAliases, currentField.tableAlias, tableWidth) + ALIAS_NAME_PADDING.left,
				y: preexistingField.length
					? parseInt(preexistingField[0].attr("cy"))
					: (FIELD_PADDING.top + FIELD_LINEHEIGHT * fieldIndex - CIRCLE_RADIUS / 2)};

			fieldNodes.push(
				d3.select(this)
					.append("svg:circle")
					.attr("r", CIRCLE_RADIUS)
					.attr("cx", circlePosition.x)
					.attr("cy", circlePosition.y)
					.classed("filtered", isFiltered)
					.classed("sort_" + sort, !!sort)
			);

			if (sort) {
				d3.select(this)
					.append("svg:image")
					.attr("xlink:href", "images/sort_" + sort + ".svg")
					.attr("width", SORT_SIDE)
					.attr("height", SORT_SIDE)
					.attr("x", circlePosition.x)
					.attr("y", circlePosition.y - SORT_SIDE / 2)
					.classed("order", true);
			}

			if (!preexistingField.length) {
				d3.select(this)
					.append("svg:text")
					.text(currentField.name)
					.attr("x", FIELD_PADDING.left)
					.attr("y", FIELD_PADDING.top + FIELD_LINEHEIGHT * fieldIndex);

				fieldIndex++;
			}
		});
};

Field.isInTable = function(field,table) {
	return tableAliases.filter(function(tableAlias) {
		return tableAlias.name === field.tableAlias && tableAlias.table == table.name;
	}).length > 0;
};

Field.getTableIdFromName = function(fieldname) {
	for (var i in n) {
		if (n[i].type === "table") {
			var fieldAlias = tableAliases.filter(function(tableAlias) {
				var currentField =
					d3.values(fields).filter(function(f) {
						return fieldname === f.fullName;
					});
				return currentField.length > 0 && tableAlias.name === currentField[0].tableAlias;
			});
			if (fieldAlias.length && fieldAlias[0].table === n[i].name) {
				return i;
			}
		}
	}
	return null;
};