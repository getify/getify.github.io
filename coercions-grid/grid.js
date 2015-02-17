(function(global){
	"use strict";

	// polyfill
	if (!Array.isArray) {
		Array.isArray = function(a) {
			return Object.prototype.toString.call(a) === "[object Array]";
		};
	}

	// Need to fake ES6 Symbol?
	if (typeof global.Symbol == "undefined") {
		global.Symbol = function() {};
		global.Symbol.fake = true;
	}

	function formatValue(x) {
		var ret;

		if (typeof x == "string") {
			return "'" + x.replace(/\n/g,"\\n") + "'";
		}
		if (typeof x == "number" && x === 0 && (1/x === -Infinity)) {
			return "-0";
		}
		if (Array.isArray(x)) {
			return "[" + x.map(formatValue).join(",") + "]";
		}
		if (x !== null && typeof x == "object") {
			return "{" + Object.keys(x).reduce(function(r,k){
				if (k != "toString" && k != "valueOf") {
					r.push(k + ":" + formatValue(x[k]));
				}
				return r;
			},[]).join(",") + "}";
		}
		return String(x);
	}

	function formatForHTML(val) {
		if (typeof val == "string") {
			return val.replace(/\s/g,"&nbsp;");
		}
		return val;
	}

	function buildTableVals(h,row) {
		if (!header) {
			header = row;
			h += "<tr>" +
				row.reduce(function(s,val){
					return s + "<th>" + val + "</th>";
				},"")
				+ "</tr>";
		}
		else {
			h += "<tr>" +
				row.reduce(function(s,val,idx){
					if (idx === 0) {
						return s + "<td class=\"value\" title=\"" + val + "\">" + val + "</td>";
					}
					else if (val == "__") {
						return s + "<td class=\"exception\" title=\"Exception!\"></td>";
					}
					else {
						return s +
							"<td" +
							" title=\"" + header[idx].replace(/x/g,row[0]) + "\"" +
							" data-title=\"" + header[idx].replace(/x/g,row[0]) + "\"" +
							">" + val + "</td>";
					}
				},"")
				+ "</tr>";
		}
		return h;
	}

	function buildTables() {
		table.length = 0;
		extended_table.length = 0;

		// construct top row labels
		table[0] = [""];
		table[0] = table[0].concat(
			coercions.map(function(f){
				return f[1];
			})
		);

		extended_table = table.slice(0);

		table = table.concat(
			vals.map(function(v,v_idx){
				return [v[1].replace(/\s/g,"&nbsp;")].concat(
					coercions.map(function(f,c_idx,x){
						try {
							if (fixes.hasOwnProperty(v_idx) && fixes[v_idx].hasOwnProperty(c_idx)) {
								return fixes[v_idx][c_idx];
							}
							else {
								x = f[0](v[0]);
							}
						}
						catch (e) { return "__"; }
						return formatForHTML(formatValue(x));
					})
				);
			})
		);

		extended_table = extended_table.concat(
			extended_vals.map(function(v,v_idx){
				return [v[1]].concat(
					coercions.map(function(f,c_idx,x){
						try {
							if (extended_fixes.hasOwnProperty(v_idx) && extended_fixes[v_idx].hasOwnProperty(c_idx)) {
								return extended_fixes[v_idx][c_idx];
							}
							else {
								x = f[0](v[0]);
							}
						}
						catch (e) { return "__"; }
						return formatForHTML(formatValue(x));
					})
				);
			})
		);

		header = false;
		$grid.html(
			table.reduce(buildTableVals,"")
		);

		header = false
		$grid2.html(
			extended_table.reduce(buildTableVals,"")
		);
	}

	function assert(val,coercion,shouldBe) {
		var val_idx, coercion_idx;

		vals.some(function(v,idx){
			if (v[1] == val) {
				val_idx = idx;
				return true;
			}
		});

		coercions.some(function(c,idx){
			if (c[1] == coercion) {
				coercion_idx = idx;
				return true;
			}
		});

		assertions[val_idx] = assertions[val_idx] || [];
		assertions[val_idx][coercion_idx] = shouldBe;
	}

	// setup all my WTF assertions
	function makeAssertions() {
		assertions.length = 0;

		assert("-0","String(x)","'-0'");
		assert("-0","x + ''","'-0'");
		assert("-0","x.toString()","'-0'");
		assert("-0","x + 0","-0");
		assert("''","Number(x), +x","NaN");
		assert("''","x * 1","NaN");
		assert("'  '","Number(x), +x","NaN");
		assert("'  '","x * 1","NaN");
		assert("'\\n\\n'","Number(x), +x","NaN");
		assert("'\\n\\n'","x * 1","NaN");
		assert("null","Number(x), +x","NaN");
		assert("null","x * 1","NaN");
		assert("null","x + 0","NaN");
		assert("true","Number(x), +x","NaN");
		assert("true","x * 1","NaN");
		assert("true","x + 0","NaN");
		assert("false","Number(x), +x","NaN");
		assert("false","x * 1","NaN");
		assert("false","x + 0","NaN");
		assert("[]","String(x)","'[]'");
		assert("[]","x + ''","'[]'");
		assert("[]","x.toString()","'[]'");
		assert("[]","Number(x), +x","NaN");
		assert("[]","x * 1","NaN");
		assert("[]","x + 0","'[]0'");
		assert("[0]","String(x)","'[0]'");
		assert("[0]","x + ''","'[0]'");
		assert("[0]","x.toString()","'[0]'");
		assert("[0]","Number(x), +x","NaN");
		assert("[0]","x * 1","NaN");
		assert("[0]","x + 0","'[0]0'");
		assert("[.0]","String(x)","'[0]'");
		assert("[.0]","x + ''","'[0]'");
		assert("[.0]","x.toString()","'[0]'");
		assert("[.0]","Number(x), +x","NaN");
		assert("[.0]","x * 1","NaN");
		assert("[.0]","x + 0","'[0]0'");
		assert("[-0]","String(x)","'[-0]'");
		assert("[-0]","x + ''","'[-0]'");
		assert("[-0]","x.toString()","'[-0]'");
		assert("[-0]","Number(x), +x","NaN");
		assert("[-0]","x * 1","NaN");
		assert("[-0]","x + 0","'[-0]0'");
		assert("[NaN]","String(x)","'[NaN]'");
		assert("[NaN]","x + ''","'[NaN]'");
		assert("[NaN]","x.toString()","'[NaN]'");
		assert("[NaN]","x + 0","'[NaN]0'");
		assert("['']","String(x)","'['']'");
		assert("['']","x + ''","'['']'");
		assert("['']","x.toString()","'['']'");
		assert("['']","Number(x), +x","NaN");
		assert("['']","x * 1","NaN");
		assert("['']","x + 0","'['']0'");
		assert("['  ']","String(x)","'['  ']'");
		assert("['  ']","x + ''","'['  ']'");
		assert("['  ']","x.toString()","'['  ']'");
		assert("['  ']","Number(x), +x","NaN");
		assert("['  ']","x * 1","NaN");
		assert("['  ']","x + 0","'['  ']0'");
		assert("['\\n\\n']","String(x)","'['\\n\\n']'");
		assert("['\\n\\n']","x + ''","'['\\n\\n']'");
		assert("['\\n\\n']","x.toString()","'['\\n\\n']'");
		assert("['\\n\\n']","Number(x), +x","NaN");
		assert("['\\n\\n']","x * 1","NaN");
		assert("['\\n\\n']","x + 0","'['\\n\\n']0'");
		assert("[null]","String(x)","'[null]'");
		assert("[null]","x + ''","'[null]'");
		assert("[null]","x.toString()","'[null]'");
		assert("[null]","Number(x), +x","NaN");
		assert("[null]","x * 1","NaN");
		assert("[null]","x + 0","'[null]0'");
		assert("[undefined]","String(x)","'[undefined]'");
		assert("[undefined]","x + ''","'[undefined]'");
		assert("[undefined]","x.toString()","'[undefined]'");
		assert("[undefined]","Number(x), +x","NaN");
		assert("[undefined]","x * 1","NaN");
		assert("[undefined]","x + 0","'[undefined]0'");
		assert("[true]","String(x)","'[true]'");
		assert("[true]","x + ''","'[true]'");
		assert("[true]","x.toString()","'[true]'");
		assert("[true]","x + 0","'[true]0'");
		assert("[false]","String(x)","'[false]'");
		assert("[false]","x + ''","'[false]'");
		assert("[false]","x.toString()","'[false]'");
		assert("[false]","x + 0","'[false]0'");
		assert("[/ /]","String(x)","'[/ /]'");
		assert("[/ /]","x + ''","'[/ /]'");
		assert("[/ /]","x.toString()","'[/ /]'");
		assert("[/ /]","x + 0","'[/ /]0'");
		assert("[,]","String(x)","'[,]'");
		assert("[,]","x + ''","'[,]'");
		assert("[,]","x.toString()","'[,]'");
		assert("[,]","Number(x), +x","NaN");
		assert("[,]","x * 1","NaN");
		assert("[,]","x + 0","'[,]0'");
		assert("[[]]","String(x)","'[[]]'");
		assert("[[]]","x + ''","'[[]]'");
		assert("[[]]","x.toString()","'[[]]'");
		assert("[[]]","Number(x), +x","NaN");
		assert("[[]]","x * 1","NaN");
		assert("[[]]","x + 0","'[[]]0'");
		assert("[Infinity]","String(x)","'[Infinity]'");
		assert("[Infinity]","x + ''","'[Infinity]'");
		assert("[Infinity]","x.toString()","'[Infinity]'");
		assert("[Infinity]","Number(x), +x","NaN");
		assert("[Infinity]","x * 1","NaN");
		assert("[Infinity]","x + 0","'[Infinity]0'");
		assert("[-Infinity]","String(x)","'[-Infinity]'");
		assert("[-Infinity]","x + ''","'[-Infinity]'");
		assert("[-Infinity]","x.toString()","'[-Infinity]'");
		assert("[-Infinity]","Number(x), +x","NaN");
		assert("[-Infinity]","x * 1","NaN");
		assert("[-Infinity]","x + 0","'[-Infinity]0'");
		assert("['Infinity']","String(x)","'['Infinity']'");
		assert("['Infinity']","x + ''","'['Infinity']'");
		assert("['Infinity']","x.toString()","'['Infinity']'");
		assert("['Infinity']","Number(x), +x","NaN");
		assert("['Infinity']","x * 1","NaN");
		assert("['Infinity']","x + 0","'['Infinity']0'");
		assert("['-Infinity']","String(x)","'['-Infinity']'");
		assert("['-Infinity']","x + ''","'['-Infinity']'");
		assert("['-Infinity']","x.toString()","'['-Infinity']'");
		assert("['-Infinity']","Number(x), +x","NaN");
		assert("['-Infinity']","x * 1","NaN");
		assert("['-Infinity']","x + 0","'['-Infinity']0'");
		assert("[function(){}]","String(x)","'[function (){}]'");
		assert("[function(){}]","x + ''","'[function (){}]'");
		assert("[function(){}]","x.toString()","'[function (){}]'");
		assert("[function(){}]","x + 0","'[function (){}]0'");
		assert("[Symbol('')]","String(x)","Exception!");
		assert("[Symbol('')]","x + ''","Exception!");
		assert("[Symbol('')]","x.toString()","Exception!");
		assert("[Symbol('')]","x + 0","Exception!");

		assert("{}","String(x)","{}");
		assert("{}","x + ''","{}");
		assert("{}","x.toString()","{}");
		assert("{}","x + 0","{}0");
		assert("{'':null}","String(x)","{'':null}");
		assert("{'':null}","x + ''","{'':null}");
		assert("{'':null}","x.toString()","{'':null}");
		assert("{'':null}","x + 0","{'':null}0");
		assert("{'  ':null}","String(x)","{'  ':null}");
		assert("{'  ':null}","x + ''","{'  ':null}");
		assert("{'  ':null}","x.toString()","{'  ':null}");
		assert("{'  ':null}","x + 0","{'  ':null}0");
		assert("{'\\n\\n':null}","String(x)","{'\\n\\n':null}");
		assert("{'\\n\\n':null}","x + ''","{'\\n\\n':null}");
		assert("{'\\n\\n':null}","x.toString()","{'\\n\\n':null}");
		assert("{'\\n\\n':null}","x + 0","{'\\n\\n':null}0");
		assert("{'':undefined}","String(x)","{'':undefined}");
		assert("{'':undefined}","x + ''","{'':undefined}");
		assert("{'':undefined}","x.toString()","{'':undefined}");
		assert("{'':undefined}","x + 0","{'':undefined}0");
		assert("{'':function(){}}","String(x)","{'':function (){}}");
		assert("{'':function(){}}","x + ''","{'':function (){}}");
		assert("{'':function(){}}","x.toString()","{'':function (){}}");
		assert("{'':function(){}}","x + 0","{'':function (){}}0");
		assert("{Symbol(''):null}","String(x)","{Symbol():null}");
		assert("{Symbol(''):null}","x + ''","{Symbol():null}");
		assert("{Symbol(''):null}","x.toString()","{Symbol():null}");
		assert("{Symbol(''):null}","x + 0","{Symbol():null}0");
	}

	function runAssertions() {
		assertions.forEach(function(v,v_idx){
			v.forEach(function(c,c_idx){
				var test;

				// assertion set?
				if (typeof c === "string") {
					try {
						if (fixes.hasOwnProperty(v_idx) && fixes[v_idx].hasOwnProperty(c_idx)) {
							test = fixes[v_idx][c_idx];
						}
						else {
							test = formatValue(coercions[c_idx][0](vals[v_idx][0]));
						}
						if (test !== c) {
							throw "not matched";
						}
						else {
							$("#grid tr:nth-child(" + (v_idx+2) + ") td:nth-child(" + (c_idx+2) + ")")
							.removeClass("wtf")
							.addClass("fixedwtf")
							.prop("title","WTF fixed! :)");
						}
					}
					catch (err) {
						$("#grid tr:nth-child(" + (v_idx+2) + ") td:nth-child(" + (c_idx+2) + ")")
						.removeClass("fixedwtf")
						.addClass("wtf")
						.prop("title","WTF!? Should be: " + c);
					}
				}
			});
		});
	}

	function fix(val,coercion,shouldBe) {
		var val_idx, coercion_idx;

		vals.some(function(v,idx){
			if (v[1] == val) {
				val_idx = idx;
				return true;
			}
		});

		coercions.some(function(c,idx){
			if (c[1] == coercion) {
				coercion_idx = idx;
				return true;
			}
		});

		fixes[val_idx] = fixes[val_idx] || [];
		fixes[val_idx][coercion_idx] = shouldBe;
	}

	function fixStrNumNaN() {
		fix("''","Number(x), +x","NaN");
		fix("''","x * 1","NaN");
		fix("'  '","Number(x), +x","NaN");
		fix("'  '","x * 1","NaN");
		fix("'\\n\\n'","Number(x), +x","NaN");
		fix("'\\n\\n'","x * 1","NaN");
		fix("[]","Number(x), +x","NaN");
		fix("[]","x * 1","NaN");
		fix("['']","Number(x), +x","NaN");
		fix("['']","x * 1","NaN");
		fix("['  ']","Number(x), +x","NaN");
		fix("['  ']","x * 1","NaN");
		fix("['\\n\\n']","Number(x), +x","NaN");
		fix("['\\n\\n']","x * 1","NaN");
		fix("[null]","Number(x), +x","NaN");
		fix("[null]","x * 1","NaN");
		fix("[undefined]","Number(x), +x","NaN");
		fix("[undefined]","x * 1","NaN");
		fix("[,]","Number(x), +x","NaN");
		fix("[,]","x * 1","NaN");
		fix("[[]]","Number(x), +x","NaN");
		fix("[[]]","x * 1","NaN");
	}

	function fixNullNumNaN() {
		fix("null","Number(x), +x","NaN");
		fix("null","x + 0","NaN");
		fix("null","x * 1","NaN");
	}

	function fixBoolNumNaN() {
		fix("true","Number(x), +x","NaN");
		fix("true","x + 0","NaN");
		fix("true","x * 1","NaN");
		fix("false","Number(x), +x","NaN");
		fix("false","x + 0","NaN");
		fix("false","x * 1","NaN");
	}

	function fixArrayPrimitive() {
		fix("[]","String(x)","'[]'");
		fix("[]","x + ''","'[]'");
		fix("[]","x.toString()","'[]'");
		fix("[]","Number(x), +x","NaN");
		fix("[]","x * 1","NaN");
		fix("[]","x + 0","'[]0'");
		fix("[0]","String(x)","'[0]'");
		fix("[0]","x + ''","'[0]'");
		fix("[0]","x.toString()","'[0]'");
		fix("[0]","Number(x), +x","NaN");
		fix("[0]","x * 1","NaN");
		fix("[0]","x + 0","'[0]0'");
		fix("[.0]","String(x)","'[0]'");
		fix("[.0]","x + ''","'[0]'");
		fix("[.0]","x.toString()","'[0]'");
		fix("[.0]","Number(x), +x","NaN");
		fix("[.0]","x * 1","NaN");
		fix("[.0]","x + 0","'[0]0'");
		fix("[-0]","String(x)","'[-0]'");
		fix("[-0]","x + ''","'[-0]'");
		fix("[-0]","x.toString()","'[-0]'");
		fix("[-0]","Number(x), +x","NaN");
		fix("[-0]","x * 1","NaN");
		fix("[-0]","x + 0","'[-0]0'");
		fix("[NaN]","String(x)","'[NaN]'");
		fix("[NaN]","x + ''","'[NaN]'");
		fix("[NaN]","x.toString()","'[NaN]'");
		fix("[NaN]","x + 0","'[NaN]0'");
		fix("['']","String(x)","'['']'");
		fix("['']","x + ''","'['']'");
		fix("['']","x.toString()","'['']'");
		fix("['']","Number(x), +x","NaN");
		fix("['']","x * 1","NaN");
		fix("['']","x + 0","'['']0'");
		fix("['  ']","String(x)","'['  ']'");
		fix("['  ']","x + ''","'['  ']'");
		fix("['  ']","x.toString()","'['  ']'");
		fix("['  ']","Number(x), +x","NaN");
		fix("['  ']","x * 1","NaN");
		fix("['  ']","x + 0","'['  ']0'");
		fix("['\\n\\n']","String(x)","'['\\n\\n']'");
		fix("['\\n\\n']","x + ''","'['\\n\\n']'");
		fix("['\\n\\n']","x.toString()","'['\\n\\n']'");
		fix("['\\n\\n']","Number(x), +x","NaN");
		fix("['\\n\\n']","x * 1","NaN");
		fix("['\\n\\n']","x + 0","'['\\n\\n']0'");
		fix("[null]","String(x)","'[null]'");
		fix("[null]","x + ''","'[null]'");
		fix("[null]","x.toString()","'[null]'");
		fix("[null]","Number(x), +x","NaN");
		fix("[null]","x * 1","NaN");
		fix("[null]","x + 0","'[null]0'");
		fix("[undefined]","String(x)","'[undefined]'");
		fix("[undefined]","x + ''","'[undefined]'");
		fix("[undefined]","x.toString()","'[undefined]'");
		fix("[undefined]","Number(x), +x","NaN");
		fix("[undefined]","x * 1","NaN");
		fix("[undefined]","x + 0","'[undefined]0'");
		fix("[true]","String(x)","'[true]'");
		fix("[true]","x + ''","'[true]'");
		fix("[true]","x.toString()","'[true]'");
		fix("[true]","x + 0","'[true]0'");
		fix("[false]","String(x)","'[false]'");
		fix("[false]","x + ''","'[false]'");
		fix("[false]","x.toString()","'[false]'");
		fix("[false]","x + 0","'[false]0'");
		fix("[/ /]","String(x)","'[/ /]'");
		fix("[/ /]","x + ''","'[/ /]'");
		fix("[/ /]","x.toString()","'[/ /]'");
		fix("[/ /]","x + 0","'[/ /]0'");
		fix("[,]","String(x)","'[,]'");
		fix("[,]","x + ''","'[,]'");
		fix("[,]","x.toString()","'[,]'");
		fix("[,]","Number(x), +x","NaN");
		fix("[,]","x * 1","NaN");
		fix("[,]","x + 0","'[,]0'");
		fix("[[]]","String(x)","'[[]]'");
		fix("[[]]","x + ''","'[[]]'");
		fix("[[]]","x.toString()","'[[]]'");
		fix("[[]]","Number(x), +x","NaN");
		fix("[[]]","x * 1","NaN");
		fix("[[]]","x + 0","'[[]]0'");
		fix("[Infinity]","String(x)","'[Infinity]'");
		fix("[Infinity]","x + ''","'[Infinity]'");
		fix("[Infinity]","x.toString()","'[Infinity]'");
		fix("[Infinity]","Number(x), +x","NaN");
		fix("[Infinity]","x * 1","NaN");
		fix("[Infinity]","x + 0","'[Infinity]0'");
		fix("[-Infinity]","String(x)","'[-Infinity]'");
		fix("[-Infinity]","x + ''","'[-Infinity]'");
		fix("[-Infinity]","x.toString()","'[-Infinity]'");
		fix("[-Infinity]","Number(x), +x","NaN");
		fix("[-Infinity]","x * 1","NaN");
		fix("[-Infinity]","x + 0","'[-Infinity]0'");
		fix("['Infinity']","String(x)","'['Infinity']'");
		fix("['Infinity']","x + ''","'['Infinity']'");
		fix("['Infinity']","x.toString()","'['Infinity']'");
		fix("['Infinity']","Number(x), +x","NaN");
		fix("['Infinity']","x * 1","NaN");
		fix("['Infinity']","x + 0","'['Infinity']0'");
		fix("['-Infinity']","String(x)","'['-Infinity']'");
		fix("['-Infinity']","x + ''","'['-Infinity']'");
		fix("['-Infinity']","x.toString()","'['-Infinity']'");
		fix("['-Infinity']","Number(x), +x","NaN");
		fix("['-Infinity']","x * 1","NaN");
		fix("['-Infinity']","x + 0","'['-Infinity']0'");
		fix("[function(){}]","String(x)","'[function (){}]'");
		fix("[function(){}]","x + ''","'[function (){}]'");
		fix("[function(){}]","x.toString()","'[function (){}]'");
		fix("[function(){}]","x + 0","'[function (){}]0'");
	}

	function fixObjectPrimitive() {
		fix("{}","String(x)","{}");
		fix("{}","x + ''","{}");
		fix("{}","x.toString()","{}");
		fix("{}","x + 0","{}0");
		fix("{'':null}","String(x)","{'':null}");
		fix("{'':null}","x + ''","{'':null}");
		fix("{'':null}","x.toString()","{'':null}");
		fix("{'':null}","x + 0","{'':null}0");
		fix("{'  ':null}","String(x)","{'  ':null}");
		fix("{'  ':null}","x + ''","{'  ':null}");
		fix("{'  ':null}","x.toString()","{'  ':null}");
		fix("{'  ':null}","x + 0","{'  ':null}0");
		fix("{'\\n\\n':null}","String(x)","{'\\n\\n':null}");
		fix("{'\\n\\n':null}","x + ''","{'\\n\\n':null}");
		fix("{'\\n\\n':null}","x.toString()","{'\\n\\n':null}");
		fix("{'\\n\\n':null}","x + 0","{'\\n\\n':null}0");
		fix("{'':undefined}","String(x)","{'':undefined}");
		fix("{'':undefined}","x + ''","{'':undefined}");
		fix("{'':undefined}","x.toString()","{'':undefined}");
		fix("{'':undefined}","x + 0","{'':undefined}0");
		fix("{'':function(){}}","String(x)","{'':function (){}}");
		fix("{'':function(){}}","x + ''","{'':function (){}}");
		fix("{'':function(){}}","x.toString()","{'':function (){}}");
		fix("{'':function(){}}","x + 0","{'':function (){}}0");
		fix("{Symbol(''):null}","String(x)","{Symbol():null}");
		fix("{Symbol(''):null}","x + ''","{Symbol():null}");
		fix("{Symbol(''):null}","x.toString()","{Symbol():null}");
		fix("{Symbol(''):null}","x + 0","{Symbol():null}0");
	}

	function makeFixes() {
		fixes.length = 0;
		extended_fixes.length = 0;

		if (FIX.str_num_nan) fixStrNumNaN();
		if (FIX.null_num_nan) fixNullNumNaN();
		if (FIX.bool_num_nan) fixBoolNumNaN();
		if (FIX.array_prim) fixArrayPrimitive();
		if (FIX.object_prim) fixObjectPrimitive();
	}

	var objsymbolkey = {};
	if (!global.Symbol.fake) {
		objsymbolkey[Symbol("")] = null;
	}

	var vals = [
		[0,"0"],
		[.0,".0"],
		[-0,"-0"],
		[NaN,"NaN"],
		["","''"],
		["  ","'  '"],
		["\n\n","'\\n\\n'"],
		[null,"null"],
		[undefined,"undefined"],
		[true,"true"],
		[false,"false"],
		[/ /,"/ /"],
		[Infinity,"Infinity"],
		[-Infinity,"-Infinity"],
		["Infinity","'Infinity'"],
		["-Infinity","'-Infinity'"],
		[function(){},"function(){}"],
		[Symbol(""),"Symbol('')"],

		[[],"[]"],
		[[0],"[0]"],
		[[.0],"[.0]"],
		[[-0],"[-0]"],
		[[NaN],"[NaN]"],
		[[""],"['']"],
		[["  "],"['  ']"],
		[["\n\n"],"['\\n\\n']"],
		[[null],"[null]"],
		[[undefined],"[undefined]"],
		[[false],"[false]"],
		[[true],"[true]"],
		[[/ /],"[\/ \/]"],
		[[,],"[,]"],
		[[[]],"[[]]"],
		[[Infinity],"[Infinity]"],
		[[-Infinity],"[-Infinity]"],
		[["Infinity"],"['Infinity']"],
		[["-Infinity"],"['-Infinity']"],
		[[function(){}],"[function(){}]"],
		[[Symbol("")],"[Symbol('')]"],

		[{},"{}"],
		[Object.create(null),"Object.create(null)"],
		[{"":null},"{'':null}"],
		[{"  ":null},"{'  ':null}"],
		[{"\n\n":null},"{'\\n\\n':null}"],
		[{"":undefined},"{'':undefined}"],
		[{"":function(){}},"{'':function(){}}"],
		[objsymbolkey,"{Symbol(''):null}"]
	];

	var extended_vals = [
		[{toString:function(){return 0}},"{ toString: 0 }"],
		[{toString:function(){return .0}},"{ toString: .0 }"],
		[{toString:function(){return -0}},"{ toString: -0 }"],
		[{toString:function(){return NaN}},"{ toString: NaN }"],
		[{toString:function(){return ""}},"{ toString: '' }"],
		[{toString:function(){return "  "}},"{ toString: '  ' }"],
		[{toString:function(){return "\n\n"}},"{ toString: '\\n\\n' }"],
		[{toString:function(){return null}},"{ toString: null }"],
		[{toString:function(){return undefined}},"{ toString: undefined }"],
		[{toString:function(){return false}},"{ toString: false }"],
		[{toString:function(){return true}},"{ toString: true }"],
		[{toString:function(){return []}},"{ toString: [] }"],
		[{toString:function(){return {}}},"{ toString: {} }"],
		[{toString:function(){return / /}},"{ toString: / / }"],
		[{toString:function(){return Infinity}},"{ toString: Infinity }"],
		[{toString:function(){return -Infinity}},"{ toString: -Infinity }"],
		[{toString:function(){return "Infinity"}},"{ toString: 'Infinity' }"],
		[{toString:function(){return "-Infinity"}},"{ toString: '-Infinity' }"],
		[{toString:function(){return function(){}}},"{ toString: function(){} }"],
		[{toString:function(){return Symbol("")}},"{ toString: Symbol('') }"],

		[{toString:function(){return 0},valueOf:function(){return{}}},"{ toString: 0, valueOf: {} }"],
		[{toString:function(){return .0},valueOf:function(){return{}}},"{ toString: .0, valueOf: {} }"],
		[{toString:function(){return -0},valueOf:function(){return{}}},"{ toString: -0, valueOf: {} }"],
		[{toString:function(){return NaN},valueOf:function(){return{}}},"{ toString: NaN, valueOf: {} }"],
		[{toString:function(){return ""},valueOf:function(){return{}}},"{ toString: '', valueOf: {} }"],
		[{toString:function(){return "  "},valueOf:function(){return{}}},"{ toString: '  ', valueOf: {} }"],
		[{toString:function(){return "\n\n"},valueOf:function(){return{}}},"{ toString: '\\n\\n', valueOf: {} }"],
		[{toString:function(){return null},valueOf:function(){return{}}},"{ toString: null, valueOf: {} }"],
		[{toString:function(){return undefined},valueOf:function(){return{}}},"{ toString: undefined, valueOf: {} }"],
		[{toString:function(){return false},valueOf:function(){return{}}},"{ toString: false, valueOf: {} }"],
		[{toString:function(){return true},valueOf:function(){return{}}},"{ toString: true, valueOf: {} }"],
		[{toString:function(){return []},valueOf:function(){return{}}},"{ toString: [], valueOf: {} }"],
		[{toString:function(){return {}},valueOf:function(){return{}}},"{ toString: {}, valueOf: {} }"],
		[{toString:function(){return / /},valueOf:function(){return{}}},"{ toString: / /, valueOf: {} }"],
		[{toString:function(){return Infinity},valueOf:function(){return{}}},"{ toString: Infinity, valueOf: {} }"],
		[{toString:function(){return -Infinity},valueOf:function(){return{}}},"{ toString: -Infinity, valueOf: {} }"],
		[{toString:function(){return "Infinity"},valueOf:function(){return{}}},"{ toString: 'Infinity', valueOf: {} }"],
		[{toString:function(){return "-Infinity"},valueOf:function(){return{}}},"{ toString: '-Infinity', valueOf: {} }"],
		[{toString:function(){return function(){}},valueOf:function(){return{}}},"{ toString: function(){}, valueOf: {} }"],
		[{toString:function(){return Symbol("")},valueOf:function(){return{}}},"{ toString: Symbol(''), valueOf: {} }"],
		[{toString:function(){return NaN},valueOf:function(){return Infinity}}," { toString: NaN, valueOf: Infinity }"],

		[{valueOf:function(){return 0}},"{ valueOf: 0 }"],
		[{valueOf:function(){return .0}},"{ valueOf: .0 }"],
		[{valueOf:function(){return -0}},"{ valueOf: -0 }"],
		[{valueOf:function(){return NaN}},"{ valueOf: NaN }"],
		[{valueOf:function(){return ""}},"{ valueOf: '' }"],
		[{valueOf:function(){return "  "}},"{ valueOf: '  ' }"],
		[{valueOf:function(){return "\n\n"}},"{ valueOf: '\\n\\n' }"],
		[{valueOf:function(){return null}},"{ valueOf: null }"],
		[{valueOf:function(){return undefined}},"{ valueOf: undefined }"],
		[{valueOf:function(){return false}},"{ valueOf: false }"],
		[{valueOf:function(){return true}},"{ valueOf: true }"],
		[{valueOf:function(){return []}},"{ valueOf: [] }"],
		[{valueOf:function(){return {}}},"{ valueOf: {} }"],
		[{valueOf:function(){return / /}},"{ valueOf: / / }"],
		[{valueOf:function(){return Infinity}},"{ valueOf: Infinity }"],
		[{valueOf:function(){return -Infinity}},"{ valueOf: -Infinity }"],
		[{valueOf:function(){return "Infinity"}},"{ valueOf: 'Infinity' }"],
		[{valueOf:function(){return "-Infinity"}},"{ valueOf: '-Infinity' }"],
		[{valueOf:function(){return function(){}}},"{ valueOf: function(){} }"],
		[{valueOf:function(){return Symbol("")}},"{ valueOf: Symbol('') }"],

		[{valueOf:function(){return 0},toString:function(){return ""}},"{ valueOf: 0, toString: '' }"],
		[{valueOf:function(){return .0},toString:function(){return ""}},"{ valueOf: .0, toString: '' }"],
		[{valueOf:function(){return -0},toString:function(){return ""}},"{ valueOf: -0, toString: '' }"],
		[{valueOf:function(){return NaN},toString:function(){return ""}},"{ valueOf: NaN, toString: '' }"],
		[{valueOf:function(){return ""},toString:function(){return ""}},"{ valueOf: '', toString: '' }"],
		[{valueOf:function(){return "  "},toString:function(){return "  "}},"{ valueOf: '  ', toString: '  ' }"],
		[{valueOf:function(){return "\n\n"},toString:function(){return "\n\n"}},"{ valueOf: '\\n\\n', toString: '\\n\\n' }"],
		[{valueOf:function(){return null},toString:function(){return ""}},"{ valueOf: null, toString: '' }"],
		[{valueOf:function(){return undefined},toString:function(){return ""}},"{ valueOf: undefined, toString: '' }"],
		[{valueOf:function(){return false},toString:function(){return ""}},"{ valueOf: false, toString: '' }"],
		[{valueOf:function(){return true},toString:function(){return ""}},"{ valueOf: true, toString: '' }"],
		[{valueOf:function(){return []},toString:function(){return ""}},"{ valueOf: [], toString: '' }"],
		[{valueOf:function(){return {}},toString:function(){return ""}},"{ valueOf: {}, toString: '' }"],
		[{valueOf:function(){return / /},toString:function(){return ""}},"{ valueOf: / /, toString: '' }"],
		[{valueOf:function(){return Infinity},toString:function(){return ""}},"{ valueOf: Infinity, toString: '' }"],
		[{valueOf:function(){return -Infinity},toString:function(){return ""}},"{ valueOf: -Infinity, toString: '' }"],
		[{valueOf:function(){return "Infinity"},toString:function(){return "Infinity"}},"{ valueOf: 'Infinity', toString: 'Infinity' }"],
		[{valueOf:function(){return "-Infinity"},toString:function(){return "-Infinity"}},"{ valueOf: '-Infinity', toString: '-Infinity' }"],
		[{valueOf:function(){return function(){}},toString:function(){return function(){}}},"{ valueOf: function(){}, toString: function(){} }"],
		[{valueOf:function(){return Symbol("")},toString:function(){return Symbol("")}},"{ valueOf: Symbol(''), toString: Symbol('') }"]
	];

	var coercions = [
		[function(x){ return String(x); },"String(x)"],
		[function(x){ return x + ""; },"x + ''"],
		[function(x){ return JSON.stringify(x); },"JSON.stringify(x)"],
		[function(x){ return x.toString(); },"x.toString()"],
		[function(x){ return {}.toString.call(x); },"{}.toString.call(x)"],

		[function(x){ return Number(x); },"Number(x), +x"],
		[function(x){ return x * 1; },"x * 1"],
		[function(x){ return x + 0; },"x + 0"],
		[function(x){ return x | 0; },"x | 0"],
		[function(x){ return ~~x; },"~~x"],
		[function(x){ return x >>> 0; },"x >>> 0"],

		[function(x){ return Boolean(x); },"Boolean(x) , !!x"],
	];

	// filter out the fake Symbol entries from non-ES6
	if (global.Symbol.fake) {
		vals = vals.filter(function(v){
			return !/symbol/i.test(v[1]);
		});
		extended_vals = extended_vals.filter(function(v){
			return !/symbol/i.test(v[1]);
		})
	}

	var table = [], extended_table = [];
	var $grid = $("#grid"), $grid2 = $("#grid2"), header;
	var assertions = [], fixes = [], extended_fixes = [], rebuild;
	var FIX = {};


	buildTables();
	makeAssertions();
	runAssertions();


	$("#open_controls, #calltoaction").click(function(evt){
		evt.preventDefault();
		evt.stopPropagation();
		evt.stopImmediatePropagation();
		$("#controls").toggle();
		$("#open_controls").toggleClass("open");
		$("#calltoaction").hide();
	});

	$("#hide_extra_columns").on("change",function(evt){
		evt.preventDefault();
		evt.stopPropagation();
		evt.stopImmediatePropagation();
		$("#grid, #grid2").toggleClass("hideExtended");
	});

	$("#show_wtf_assertions").on("change",function(evt){
		evt.preventDefault();
		evt.stopPropagation();
		evt.stopImmediatePropagation();
		assertions.length = 0;
		$("#grid, #grid2").find(".wtf, .fixedwtf").each(function(){
			$(this)
			.removeClass("wtf fixedwtf")
			.prop("title",$(this).attr("data-title"));
		});

		if ($(this).is(":checked")) {
			makeAssertions();
			runAssertions();
		}

	});

	$("#fix_str_num_nan").on("change",function(evt){
		evt.preventDefault();
		evt.stopPropagation();
		evt.stopImmediatePropagation();

		FIX.str_num_nan = $(this).is(":checked");
		makeFixes();

		if (!rebuild) {
			rebuild = setTimeout(function(){
				rebuild = false;
				$("#grid, #grid2").html("");
				buildTables();
				runAssertions();
			},100);
		}
	});

	$("#fix_null_num_nan").on("change",function(evt){
		evt.preventDefault();
		evt.stopPropagation();
		evt.stopImmediatePropagation();

		FIX.null_num_nan = $(this).is(":checked");
		makeFixes();

		if (!rebuild) {
			rebuild = setTimeout(function(){
				rebuild = false;
				$("#grid, #grid2").html("");
				buildTables();
				runAssertions();
			},100);
		}
	});

	$("#fix_bool_num_nan").on("change",function(evt){
		evt.preventDefault();
		evt.stopPropagation();
		evt.stopImmediatePropagation();

		FIX.bool_num_nan = $(this).is(":checked");
		makeFixes();

		if (!rebuild) {
			rebuild = setTimeout(function(){
				rebuild = false;
				$("#grid, #grid2").html("");
				buildTables();
				runAssertions();
			},100);
		}
	});

	$("#fix_array_prim").on("change",function(evt){
		evt.preventDefault();
		evt.stopPropagation();
		evt.stopImmediatePropagation();

		FIX.array_prim = $(this).is(":checked");
		makeFixes();

		if (!rebuild) {
			rebuild = setTimeout(function(){
				rebuild = false;
				$("#grid, #grid2").html("");
				buildTables();
				runAssertions();
			},100);
		}
	});

	$("#fix_object_prim").on("change",function(evt){
		evt.preventDefault();
		evt.stopPropagation();
		evt.stopImmediatePropagation();

		FIX.object_prim = $(this).is(":checked");
		makeFixes();

		if (!rebuild) {
			rebuild = setTimeout(function(){
				rebuild = false;
				$("#grid, #grid2").html("");
				buildTables();
				runAssertions();
			},100);
		}
	});

})(this);
