var query_is_too_long = false;

var editor = CodeMirror.fromTextArea(document.getElementById("query"), {
	lineWrapping: true,
	onKeyEvent: function(editor) {
		var new_query_is_too_long = editor.getValue().length > QUERY_MAX_LENGTH;
		if (query_is_too_long && !new_query_is_too_long) {
			d3.select("#log").text("");
			d3.select(".CodeMirror").attr("class",function() { return d3.select(this).attr("class").replace(/ error/g,""); });
		}
		if (!query_is_too_long && new_query_is_too_long) {
			d3.select("#log").text(d3.select("#error_query_too_long").text());
			d3.select(".CodeMirror").attr("class",function() { return d3.select(this).attr("class")+" error"; });
		}
		query_is_too_long = new_query_is_too_long;
	}
});

var selected_query_sample;

d3.select('#query_sample')
	.on("change",function() {
		selected_query_sample = d3.select(this[this.selectedIndex]).attr('name');
		if (selected_query_sample != "dummy") {
			d3.text("querysamples/"+selected_query_sample,function(sql) {
				editor.setValue(sql);
			});
		}
	});

d3.text("list_samples.php?test=false",function(text) {
	var queries=text.split(/,/g);
	if (queries.length > 0) {
		if (queries[0].indexOf("Error") !== -1) {
			alert(queries[0]);
		}
		else {
			for (var i=0;i<queries.length;i++) {
				d3.select('#query_sample')
					.append("option")
					.text(queries[i].replace(/^(.*)\.sql/g,'$1'))
					.attr("name",queries[i]);
			}
		}
	}
});

var params = extractUrlParams();

var is_debug=params.debug !== undefined;
var no_graph=params.no_graph !== undefined;
var query_param=params.query;

if (query_param !== undefined) {
	editor.setValue(decodeURIComponent(query_param));
	analyzeAndBuild();
}

var no_parser=false;
var query;

d3.json(URL, function(data) {
	if (data === undefined || data === null || data === "") {
		no_parser=true;
		editor.setOption('readOnly',true);
		d3.select('.CodeMirror').attr("style","background-color:rgb(220,220,220)");
		d3.select('#no-parser').attr("class","");
	}
	else {
		d3.select('#mysql_version .version').text(d3.values(data.Constants)[0].value);
	}
})
	.header("Content-Type","application/x-www-form-urlencoded")
	.send("POST","query=SELECT VERSION()");

d3.select("#OK").on("click", analyzeAndBuild);

function analyzeAndBuild() {
	query=editor.getValue().replace(/\n/g,' ');
	var parameters;
	if (no_parser) {
		parameters="sample="+selected_query_sample;
	}
	else {
		parameters="query="+encodeURIComponent(query);
	}
	if (no_graph) {
		d3.text(URL,function(data) {
			d3.select('#log').text(data);
		})
			.header("Content-Type","application/x-www-form-urlencoded")
			.send("POST",parameters+"&debug=1"
			);
		return;
	}
	d3.json(URL,processJsonData)
		.header("Content-Type","application/x-www-form-urlencoded")
		.send("POST",parameters);
}

d3.select('#create_link a').on('click', function() {
	toggleLinkDisplay(true);
});

d3.select('#create_link input').on('click', function() {
	d3.select('#create_link input').node().select();
});

function toggleLinkDisplay(toggle) {
	d3.select('#create_link a')
		.classed('invisible', toggle);

	var input = d3.select('#create_link input');
	input.classed('invisible', !toggle);

	if (toggle) {
		input.attr('value',document.URL.match(/^.*\.html/g)[0]+'?query='+encodeURIComponent(query));
	}
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