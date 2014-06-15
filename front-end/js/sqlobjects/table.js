var Table = function(){};

Table.prototype = new Sqlobject();

Table.process = function(tableInfo, tableName, subqueryGroup, subqueryType, outputTableAlias) {
	tables[tableName]=({type: "table",
		name:tableName,
		subqueryGroup: subqueryGroup});

	d3.forEach(tableInfo, function(actions, tableAlias) {
		tableAliases[tableAlias]={table: tableName,name: tableAlias};

		d3.forEach(actions, function(actionFields, type) {

			d3.forEach(actionFields, function(data, field) {
				var tableAliasField = [tableAlias, field].join('.');
				if (!fields.filter(function(field) {
					return field.fullName === tableAliasField;
				}).length) {
					fields.push({type: "field", tableAlias:tableAlias, name:field, fullName:tableAliasField, filtered: false, sort: false, subqueryGroup: subqueryGroup});
				}
				switch(type) {
					case 'OUTPUT':
						d3.forEach(data, function(outputAlias, functionAlias) {
							if (functionAlias == -1) { // Directly to output
								var fullName = [outputTableAlias, outputAlias].join('.');
								linksToOutput.push({type: "link", from: "field", fieldName: tableAliasField, outputName: outputAlias, outputTableAlias: outputTableAlias});
								fields.push({type: "field", tableAlias:outputTableAlias, name:outputAlias, fullName: fullName, filtered: false, sort: false, subqueryGroup: subqueryGroup});
							}
							else { // To a function
								linksToFunctions.push({type: "link", from: "field", fieldName: tableAliasField, functionAlias: functionAlias});
							}
						});

						break;
					case 'CONDITION':
						d3.forEach(data, function(conditionData, conditionType) {
							switch(conditionType) {
								case 'FUNCTION':
									d3.forEach(d3.keys(conditionData), function(destinationFunctionAlias) {
										linksToFunctions.push({type: "link", from: "field", fieldName: tableAliasField, functionAlias: destinationFunctionAlias});
									});
									break;
								case 'JOIN': case 'VALUE': case 'EXISTS':
								d3.forEach(conditionData, function(join, otherField) {
									if (otherField.indexOf(".") != -1) { // condition is related to another field => it's a join
										if (!fields.filter(function(field) {
											return field.fullName === otherField;
										}).length) { // In case the joined table isn't referenced elsewhere
											var tableAliasAndField=otherField.split('.');
											fields.push({type: "field", tableAlias:tableAliasAndField[0], name:tableAliasAndField[1], fullName:otherField, filtered: false, sort: false, subqueryGroup: subqueryGroup});
										}
										var joinType;
										switch(join) {
											case 'JOIN_TYPE_LEFT': joinType='leftjoin'; break;
											case 'JOIN_TYPE_RIGHT': joinType='rightjoin'; break;
											case 'JOIN_TYPE_STRAIGHT': joinType='innerjoin'; break;
											case 'JOIN_TYPE_NATURAL': joinType='innerjoin'; alert('Natural joins are not supported'); break;
										}
										links.push({source: tableAliasField, target: otherField, type: joinType});
									}
//											else { // It's a value
//												fields[tableAliasField].filtered=true;
//											}
								});
								break;
								default:
									if (d3.keys(SUBSELECT_TYPES).indexOf(conditionType) !== -1) {
										links.push({source: tableAliasField, target: OUTPUT_PREFIX+conditionData, type: conditionType});
									}
									break;
							}
						});
						break;
					case 'SORT':
						d3.forEach(fields, function(field) {
							if (field.fullName === tableAliasField) {
								field.sort = data;
							}
						});
						break;
				}
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
	return mainGroup.append("svg:g").selectAll("g")
		.data(data)
		.enter().append("svg:g")
		.attr("class", function(currentTable) { return "tableGroup"+(currentTable.output ? " output":""); })
		.call(node_drag)
		.each(function(currentTable) {
			var relatedAliases = tableAliases.filter(function(ta) { return ta.table == currentTable.name; });
			var relatedFields = fields.filter(function(currentField) {
				return isFieldInTable(currentField, currentTable);
			});

			var tableWidth=TABLE_NAME_PADDING.left
				+ CHAR_WIDTH*d3.max([currentTable.name.length,
				d3.max(relatedFields, function(field) {
					return field.name.length;
				})
			]);
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

			currentTableElement
				.selectAll("g.fieldGroup")
				.data(relatedFields)
				.enter().append("svg:g")
				.classed("fieldGroup", true)
				.each(function(currentField) {
					var sort = currentField.sort;
					var isFiltered = currentField.filtered;
					var preexistingField = fieldNodes.filter(function(fieldNode) {
						return fieldNode.tableAlias === currentTable.name && fieldNode.name === currentField.name;
					});

					var circlePosition = {x: getAliasPosX(relatedAliases, currentField.tableAlias, tableWidth)+ALIAS_NAME_PADDING.left,
						y: preexistingField.length
							? parseInt(preexistingField[0].attr("cy"))
							: (FIELD_PADDING.top+FIELD_LINEHEIGHT*fieldIndex-CIRCLE_RADIUS/2)};

					fieldNodes.push(
						d3.select(this)
							.append("svg:circle")
							.attr("r",CIRCLE_RADIUS)
							.attr("cx", circlePosition.x)
							.attr("cy", circlePosition.y)
							.classed("filtered", isFiltered)
							.classed("sort_"+sort, !!sort)
					);

					if (sort) {
						d3.select(this)
							.append("svg:image")
							.attr("xlink:href", "images/sort_"+sort+".svg")
							.attr("width", SORT_SIDE)
							.attr("height",SORT_SIDE)
							.attr("x", circlePosition.x)
							.attr("y", circlePosition.y-SORT_SIDE/2)
							.classed("order", true);
					}

					if (!preexistingField.length) {
						d3.select(this)
							.append("svg:text")
							.text(currentField.name)
							.attr("x", FIELD_PADDING.left)
							.attr("y", FIELD_PADDING.top + FIELD_LINEHEIGHT*fieldIndex);

						fieldIndex++;
					}
				});

			if (!!currentTable.output) {
				var infoboxSources = [
					{ type: "options", data: options },
					{ type: "limits" , data: limits  }
				];

				var currentYOffset = tableHeight;

				d3.forEach(infoboxSources, function(infoboxSource) {
					var dataForCurrentSubqueryGroup = infoboxSource.data.filter(function(currentData) {
						return currentData.subqueryGroup === currentTable.subqueryGroup;
					});

					if (dataForCurrentSubqueryGroup.length) {
						var currentData = dataForCurrentSubqueryGroup[0][infoboxSource.type];
						var textLines = [];

						switch(infoboxSource.type) {
							case 'limits':
								textLines.push(
									(currentData.Begin ? LIMITS_2_BOUNDARIES : LIMITS_1_BOUNDARY)
										.replace(/\$1/, currentData.Begin)
										.replace(/\$2/, currentData.End)
										.replace(/\$3/, (currentData.End - currentData.Begin > 1) ? 's' :'')
								);
								break;
							case 'options':
								d3.forEach(currentData, function(value, optionName) {
									textLines.push(OPTIONS_LABELS[optionName]);
								});
								break;
						}

						var infoboxHeight = (1+textLines.length)*CHAR_HEIGHT;

						currentTableElement
							.append("svg:rect")
							.attr("class", "infobox "+infoboxSource.type)
							.attr("height", infoboxHeight)
							.attr("y", currentYOffset);

						var infoboxTextContainer = currentTableElement
							.selectAll(".infoboxText."+infoboxSource.type)
							.data(textLines)
							.enter();
						infoboxTextContainer
							.append("svg:rect")
							.attr("height", CHAR_HEIGHT)
							.attr("width",  function(line) { return (line.text || line).length * CHAR_WIDTH; })
							.attr("y", function(line, i) { return currentYOffset + i*CHAR_HEIGHT; })
							.attr("class", "infoboxText "+infoboxSource.type)
							.on("click", function(line) {
								if (line.doc) {
									window.open(DOC_ROOT_URL+line.doc);
								}
							});

						infoboxTextContainer
							.append("svg:text")
							.text(function(line) { return line.text || line;})
							.attr("x", OPTION_PADDING.left)
							.attr("y", function(line, lineNumber) { return currentYOffset + OPTION_PADDING.top + lineNumber*CHAR_HEIGHT; });

						currentYOffset += infoboxHeight;
					}
				});

				d3.selectAll(".infobox").attr("width",
					d3.max([tableWidth + getAliasWidth(true),
						d3.max(d3.selectAll(".infoboxText").data(), function(infobox) {
							return (infobox.text || infobox).length * CHAR_WIDTH;
						})
					])
				);
			}
		}
	);
};

Table.findByDatum = function(d) {
	return tableGroups.filter(function(table) {
		return d.name == table.name;
	});
};

Table.position = function(d) {
	var x = d.x || 0;
	var y = d.y || 0;

	d3.select(this)
		.attr("transform", "translate("+x+" "+y+")");

	// Paths between fields
	paths.attr("d", function(d) {
		var source = fieldNodes.filter(function(fieldNode) {
			return fieldNode.datum().fullName === d.source;
		})[0];
		var target = fieldNodes.filter(function(fieldNode) {
			return fieldNode.datum().fullName === d.target;
		})[0];

		return getPath(this, source, target);
	});

	return {x1: x, y1: y, x2: x+this.getBBox().width, y2: y+this.getBBox().height};
};
