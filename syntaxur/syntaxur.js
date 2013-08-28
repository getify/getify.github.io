/*! syntaxur
    v0.0.1-a (c) Kyle Simpson
    MIT License: http://getify.mit-license.org
*/

(function UMD(name,context,definition) {
	if (typeof module != "undefined" && module.exports) module.exports = definition();
	else if (typeof define == "function" && define.amd) define(definition);
	else context[name] = definition();
})("Syntaxur",this,function definition(name,context) {

	function entityifyHTMLTagStart(code) {
		return code.replace(/</g,"&lt;");
	}

	// test for non-empty, non-whitespace, non-comment token
	function isUsefulSegment(seg) {
		if (
			!seg.val ||
			// only whitespace?
			(
				seg.type === LIT.SEGMENT.GENERAL &&
				/^\s+$/.test(seg.val)
			) ||
			// comment?
			seg.type === LIT.SEGMENT.COMMENT
		) {
			console.log("not useful: " + JSON.stringify(seg));
			return false;
		}
		else {
			console.log("useful: " + JSON.stringify(seg));
			return true;
		}
	}

	function identifyOtherSegments(segments) {

		// find previous useful segment
		function findUsefulSegment(segIdx) {
			while (
				segIdx >= 0 &&
				!isUsefulSegment(segments[segIdx])
			) {
				segIdx--;
			}

			// did we find one?
			if (segIdx >= 0) {
				return segIdx;
			}
			else {
				return false;
			}
		}

		function precedingDotOperator(leftContext) {
			var dot_operator = /\.\s*$/, prev_seg_idx;

			// is there left-context text to examine,
			// and does it have a preceding . in it?
			if (leftContext) {
				if (dot_operator.test(leftContext)) {
					return true;
				}
			}
			// otherwise, any previous segments to consult?
			else if (segment_idx > 0) {
				prev_seg_idx = findUsefulSegment(segment_idx-1);

				// preceding . appears in a previous segment
				// (that isn't a a number literal)?
				if (
					prev_seg_idx !== false &&
					dot_operator.test(segments[prev_seg_idx].val) &&
					segments[prev_seg_idx].type !== LIT.SEGMENT.NUMBER_LITERAL
				) {
					return true;
				}
			}

			return false;
		}

		function split(code) {

			function saveText(text) {
				if (segs.length > 0 &&
					segs[segs.length-1].type === LIT.SEGMENT.GENERAL
				) {
					segs[segs.length-1].val += text;
				}
				// otherwise, just create a new one
				else {
					segs.push({
						type: LIT.SEGMENT.GENERAL,
						val: text
					});
				}
			}


			var segs = [], unmatched, left_context,
				next_match_idx = 0, prev_match_idx = 0
			;

			while (next_match_idx < code.length) {
				unmatched = "";

				pattern.lastIndex = next_match_idx;
				match = pattern.exec(code);

				if (match) {
					prev_match_idx = next_match_idx;
					next_match_idx = pattern.lastIndex;

					// collect the previous string code not matched before this segment
					if (prev_match_idx < next_match_idx - match[0].length) {
						unmatched = code.slice(prev_match_idx,next_match_idx - match[0].length);
					}
				}
				else {
					prev_match_idx = next_match_idx;
					next_match_idx = code.length;
					unmatched = code.slice(prev_match_idx);
					if (!unmatched) break;
				}

				if (unmatched) {
					saveText(unmatched);
				}

				if (match) {
					left_context = code.slice(0,next_match_idx - match[0].length);

					console.log("match:" + match[0]);
					console.log("left_context:" + left_context);
					console.log("precedingDotOperator:" + precedingDotOperator(left_context));

					// simple literal?
					if (
						/true|false|null|Infinity|NaN|undefined/.test(match[0]) &&
						!precedingDotOperator(left_context)
					) {
						console.log("simple literal:" + match[0]);
						segs.push({
							type: SEGMENT_SIMPLE_LITERAL,
							val: match[0]
						});
					}
					// keyword?
					else if (
						/function|return|var|let|const|for|while|do|if|else|try|catch|finally|throw|break|continue|switch|case|default|delete|debugger|in|instanceof|new|this|typeof|void|with|class|export|import|extends|super|yield/.test(match[0]) &&
						!precedingDotOperator(left_context)
					) {
						segs.push({
							type: SEGMENT_KEYWORD,
							val: match[0]
						});
					}
					else if (match[0].match(/[`~!%&*()\-+=[\]{};:<>,.\/?\\|]/)) {
						segs.push({
							type: SEGMENT_OPERATOR,
							val: match[0]
						});
					}
					else {
						saveText(match[0]);
					}
				}
			}

			return segs;
		}

		var segment_idx, seg, segs,
			pattern = /\b(?:true|false|null|Infinity|NaN|undefined|function|return|var|let|const|for|while|do|if|else|try|catch|finally|throw|break|continue|switch|case|default|delete|debugger|in|instanceof|new|this|typeof|void|with|class|export|import|extends|super|yield)\b|[`~!%&*()\-+=[\]{};:<>,.\/?\\|]/g
		;

		for (segment_idx=0; segment_idx<segments.length; segment_idx++) {
			if (segments[segment_idx].type === LIT.SEGMENT.GENERAL) {
				seg = segments[segment_idx];

				segs = split(seg.val);
				if (segs.length > 0) {
					segments.splice.apply(segments,[segment_idx,1].concat(segs));
					segment_idx += segs.length - 1;
				}
			}
		}
	}

	function highlight(code) {
		var segments, i, ret = "";

		// identify the complex literals first!
		segments = LIT.lex(code);

		// lex out the other segments types we want to highlight
		identifyOtherSegments(segments);

		// process all the segments and annotate them with styles
		for (i=0; i<segments.length; i++) {
			if (segments[i].type === LIT.SEGMENT.GENERAL) {
				ret += entityifyHTMLTagStart(segments[i].val);
			}
			else if (segments[i].type === SEGMENT_SIMPLE_LITERAL) {
				ret += "<span style=\"" + (public_api.options.simple || default_opts.simple) + "\">";
				ret += segments[i].val;
				ret += "</span>";
			}
			else if (segments[i].type === SEGMENT_KEYWORD) {
				ret += "<span style=\"" + (public_api.options.keyword || default_opts.keyword) + "\">";
				ret += segments[i].val;
				ret += "</span>";
			}
			else if (segments[i].type === SEGMENT_OPERATOR) {
				ret += "<span style=\"" + (public_api.options.operator || default_opts.operator) + "\">";
				ret += entityifyHTMLTagStart(segments[i].val);
				ret += "</span>";
			}
			else if (segments[i].type === LIT.SEGMENT.COMMENT) {
				ret += "<span style=\"" + (public_api.options.comment || default_opts.comment) + "\">";
				ret += entityifyHTMLTagStart(segments[i].val);
				ret += "</span>";
			}
			else if (segments[i].type === LIT.SEGMENT.STRING_LITERAL) {
				ret += "<span style=\"" + (public_api.options.string || default_opts.string) + "\">";
				ret += entityifyHTMLTagStart(segments[i].val);
				ret += "</span>";
			}
			else if (segments[i].type === LIT.SEGMENT.BACKTICK_LITERAL) {
				ret += "<span style=\"" + (public_api.options.backtick || default_opts.backtick) + "\">";
				ret += entityifyHTMLTagStart(segments[i].val);
				ret += "</span>";
			}
			else if (segments[i].type === LIT.SEGMENT.REGEX_LITERAL) {
				ret += "<span style=\"" + (public_api.options.regex || default_opts.regex) + "\">";
				ret += entityifyHTMLTagStart(segments[i].val);
				ret += "</span>";
			}
			else if (segments[i].type === LIT.SEGMENT.NUMBER_LITERAL) {
				ret += "<span style=\"" + (public_api.options.number || default_opts.number) + "\">";
				ret += segments[i].val;
				ret += "</span>";
			}
		}

		return ret;
	}


	var
		SEGMENT_SIMPLE_LITERAL = 100,
		SEGMENT_KEYWORD = 101,
		SEGMENT_OPERATOR = 102,

		default_opts = {
			comment: "color:#999;font-style:italic;",
			string: "color:#909;background-color:#eee;",
			backtick: "color:#039;background-color:#39f;",
			regex: "color:#090;font-weight:bold;",
			number: "color:#900;font-weight:bold;",
			simple: "color:#009;font-style:italic;",
			keyword: "color:#960;font-weight:bold;",
			operator: "color:#0aa;font-weight:bold;"
		},

		public_api = {
			options: JSON.parse(JSON.stringify(default_opts)),
			highlight: highlight
		}
	;

	return public_api;
});
