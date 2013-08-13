/*! literalizer
    v0.2.0-b (c) Kyle Simpson
    MIT License: http://getify.mit-license.org
*/

(function UMD(name,context,definition) {
	if (typeof module != "undefined" && module.exports) module.exports = definition();
	else if (typeof define == "function" && define.amd) define(definition);
	else context[name] = definition();
})("LIT",this,function definition(name,context) {

	function combineGeneralSegments(segmentsSlice) {
		var start, end, i, j;

		for (i=0; i<segmentsSlice.length; i++) {
			if (segmentsSlice[i].type === SEGMENT_GENERAL) {
				start = end = i;
				for (j=start+1; j<segmentsSlice.length; j++) {
					end = j;
					if (segmentsSlice[j].type !== SEGMENT_GENERAL) {
						end = j-1;
						break;
					}
				}
				if (end > start) {
					for (j=start+1; j<=end; j++) {
						segmentsSlice[start].val += segmentsSlice[j].val;
					}
					segmentsSlice.splice(start+1,end-start);
				}
				else i = j;
			}
		}

		return segmentsSlice;
	}

	// test for non-empty, non-whitespace, non-comment token
	function isUsefulToken(tok) {
		if (
			!tok.val ||
			// new-line?
			(
				tok.type === TOKEN_SPECIAL &&
				tok.val.match(/^(?:\r?\n)+$/)
			) ||
			// whitespace?
			(
				tok.type === SEGMENT_GENERAL &&
				tok.val.match(/^\s*$/)
			) ||
			// comment?
			tok.type === SEGMENT_COMMENT
		) {
			return false;
		}
		else {
			return true;
		}
	}

	function lex(code) {

		function saveText(text) {
			// can we add to a previous general segment?
			if (segments.length > 0 &&
				segments[segments.length-1].type === SEGMENT_GENERAL
			) {
				segments[segments.length-1].val += text;
			}
			// otherwise, just create a new one
			else {
				segments.push({
					type: SEGMENT_GENERAL,
					val: text
				});
			}
		}

		// find previous useful token
		function findUsefulToken(tokIdx) {
			while (
				tokIdx >= 0 &&
				!isUsefulToken(tokens[tokIdx])
			) {
				tokIdx--;
			}

			// did we find one?
			if (tokIdx >= 0) {
				return tokIdx;
			}
			else {
				return false;
			}
		}

		// Algorithm here comes from pseudo-code description at:
		// https://github.com/mozilla/sweet.js/wiki/design
		function regexLookback() {

			// try to find a balanced ( ) pair
			function findParenPair(tokIdx) {
				var i, tok, paren_count = 0;

				for (i=tokIdx; i>=0; i--) {
					tok = tokens[i];

					// skip over non-useful tokens
					if (!isUsefulToken(tok)) {
						continue;
					}

					// special-token to consider?
					if (tok.type === TOKEN_SPECIAL) {
						if (tok.val === ")") {
							paren_count++;
						}
						else if (tok.val === "(") {
							paren_count--;

							if (paren_count === 0) {
								return i;
							}
							// parens unbalanced? abort!
							else if (paren_count < 0) {
								return false;
							}
						}
					}
					// parens not yet found?
					else if (paren_count === 0) {
						// abort!
						return false;
					}
				}

				// if we get here, we didn't find a balanced ( ) pair
				return false;
			}

			// try to find a balanced { } pair
			function findBracePair(tokIdx) {
				var i, tok, brace_count = 0;

				for (i=tokIdx; i>=0; i--) {
					tok = tokens[i];

					// skip over non-useful tokens
					if (!isUsefulToken(tok)) {
						continue;
					}

					// special-token to consider?
					if (tok.type === TOKEN_SPECIAL) {
						if (tok.val === "}") {
							brace_count++;
						}
						else if (tok.val === "{") {
							brace_count--;

							if (brace_count === 0) {
								return i;
							}
							// braces unbalanced? abort!
							else if (brace_count < 0) {
								return false;
							}
						}
					}
					// braces not yet found?
					else if (brace_count === 0) {
						// abort!
						return false;
					}
				}

				// if we get here, we didn't find a balanced { } pair
				return false;
			}


			var tok_idx, i, tmp, tok;

			// look for most recent useful token
			tok_idx = findUsefulToken(tokens.length-1);

			// nothing useful found?
			if (tok_idx === false) {
				// assume a valid regex literal
				return true;
			}

			tok = tokens[tok_idx];

			// preceding token is valid before a regex literal?
			if (tok.type === TOKEN_SPECIAL) {
				// is preceeding special-token a ')'?
				if (tok.val === ")") {
					tok_idx = findParenPair(tok_idx);

					// did we find a balanced ( ) pair?
					if (tok_idx !== false) {
						// let's now look for a preceding if/while/for/with keyword
						for (i=tok_idx-1; i>=0; i--) {
							tok = tokens[i];

							// skip over non-useful tokens
							if (!isUsefulToken(tok)) {
								continue;
							}

							// special-token to consider?
							if (tok.type === TOKEN_SPECIAL) {
								// preceding if/while/for/with keyword implies
								// a valid regex literal
								if (tok.val.match(/^(?:if|while|for|with)$/)) {
									return true;
								}
								// otherwise, NOT a valid regex literal
								else {
									return false;
								}
							}
							// otherwise, NOT a valid regex literal
							else {
								return false;
							}
						}
					}
					// otherwise, NOT a valid regex literal
					else {
						return false;
					}
				}
				// is preceeding special-token a '}'?
				else if (tok.val === "}") {
					tok_idx = findBracePair(tok_idx);

					// did we find a balanced { } pair?
					if (tok_idx !== false) {
						// is the { } pair a statement block?
						if (tokens[tok_idx].is_block) {
							// let's look at the previous (useful) token
							tok_idx = findUsefulToken(tok_idx-1);

							// nothing useful found preceding?
							if (tok_idx === false) {
								// NOTE: we found a { } statement block already
								return true;
							}

							tok = tokens[tok_idx];

							if (tok.type === TOKEN_SPECIAL) {
								// ES6 fat-arrow function?
								if (tok.val === "=>") {
									// arrow functions are always function expressions,
									// and regex literals can't immediately follow those
									return false;
								}
								// look for normal function signature?
								else {
									tok_idx = findParenPair(tok_idx);

									// balanced ( ) pair not found?
									if (tok_idx === false) {
										// NOTE: we found a { } statement block already,
										// so subsequent regex literal allowed
										return true;
									}

									// look backward to try and find a "function" keyword
									tok_idx = findUsefulToken(tok_idx-1);

									// nothing useful found preceding?
									if (tok_idx === false) {
										// NOTE: we found a { } statement block already,
										// so subsequent regex literal allowed
										return true;
									}

									// account for function name, if any
									if (tokens[tok_idx].type === SEGMENT_GENERAL) {
										// skipping the name, see if we can find
										// the "function" keyword?
										tok_idx = findUsefulToken(tok_idx-1);

										// nothing useful found preceding?
										if (tok_idx === false) {
											// NOTE: we found a { } statement block already,
											// so subsequent regex literal allowed
											return true;
										}
									}

									if (
										// preceding is not a `function` keyword?
										tokens[tok_idx].val !== "function" ||
										// preceding `function` is a declaration?
										tokens[tok_idx].is_decl
									) {
										// NOTE: we found a { } statement block already,
										// so subsequent regex literal allowed
										return true;
									}
									// otherwise, subsequent regex literal not allowed
									else {
										return false;
									}
								}
							}
							else {
								// NOTE: we found a { } statement block already,
								// so subsequent regex literal allowed
								return true;
							}
						}
						// otherwise, the { } pair is a value, so subsequent
						// regex literal not allowed
						else {
							return false;
						}
					}
					// otherwise, no balanced { } pair found
					else {
						// NOTE: unbalanced { } is an invalid case, but we're
						// erring on the side caution and assuming the }
						// was the end of a statement block, not a value
						return true;
					}
				}
				// is preceeding special-token a keyword or punctuator/operator?
				else if (tok.val.match(/^(?:\b(?:return|throw|delete|in|else|void|typeof|yield|case|debugger|break|continue)\b|\=\>|[+\-*\/=~!%&,\|;:\?<>\(\{\[])$/)) {
					return true;
				}
				// otherwise, NOT a valid regex literal
				else {
					return false;
				}
			}
			// otherwise, NOT a valid regex literal
			else {
				return false;
			}
		}

		function processGeneral() {
			var segmentsSlice, left_context, tok_idx;

			// capture preceeding unmatched string, if any
			if (unmatched) {
				saveText(unmatched);
				if (tokens[tokens.length-1] !== segments[segments.length-1]) {
					tokens.push({
						type: SEGMENT_GENERAL,
						val: unmatched
					});

					if (
						// more tokens than just the unmatched one?
						tokens.length > 1 &&
						// valid identifier (and optional surrounding whitespace)?
						unmatched.match(/^\s*[^0-9\s\(\)\[\]\{\}<>,.:;=~+\-\*\/!%&\|\?\"\'][^\s\(\)\[\]\{\}<>,.:;=~+\-\*\/!%&\|\?\"\']*\s*$/)
					) {
						// if block is allowed and an identifier is found,
						// it's a block-label candidate
						if (block_allowed) {
							previous_statement_block_label_candidate = true;
						}
						else {
							previous_statement_block_label_candidate = false;
						}
					}
					// valid identifier not found where necessary for block label
					else {
						previous_statement_block_label_candidate = false;
					}
				}
			}

			if (match) {
				left_context = code.slice(0,next_match_idx - match[0].length);

				// starting a comment segment?
				if (match[0] === "//" || match[0] === "/*") {
					segments.push({
						type: SEGMENT_COMMENT,
						val: match[0]
					});
					tokens.push(segments[segments.length-1]);

					if (match[0] === "//") {
						lexing_state = STATE_SINGLE_LINE_COMMENT;
					}
					else {
						lexing_state = STATE_MULTI_LINE_COMMENT;
					}
					previous_newline = false;
				}
				// starting a backtick-literal segment?
				else if (match[0] === "`") {
					segments.push({
						type: SEGMENT_BACKTICK_LITERAL,
						val: match[0]
					});
					tokens.push(segments[segments.length-1]);

					lexing_state = STATE_BACKTICK_LITERAL;
					previous_newline = false;
				}
				// starting a string-literal segment?
				else if (match[0] === "\"" || match[0] === "'") {
					segments.push({
						type: SEGMENT_STRING_LITERAL,
						val: match[0]
					});
					tokens.push(segments[segments.length-1]);

					lexing_state = STATE_STRING_LITERAL;
					STATE_PATTERNS[STATE_STRING_LITERAL] = new RegExp(match[0] + "|\r?\n","g");
					previous_newline = false;
				}
				// number literal candidate?
				else if (match[0].match(/^(?:(?:0[xX][0-9a-fA-F]+)|(?:0[oO][0-7]+)|(?:0[bB][01]+)|(?:\d+\.\d*(?:[eE][+-]?\d+)?)|(?:\.\d+(?:[eE][+-]?\d+)?)|(?:\d+(?:[eE][+-]?\d+)?))$/)) {
					// number appears separate from an identifier?
					if (!left_context.match(/[^\s\(\)\[\]\{\}<>,.:;=~+\-\*\/!%&\|\?\"\']$/)) {
						segments.push({
							type: SEGMENT_NUMBER_LITERAL,
							val: match[0]
						});
						tokens.push(segments[segments.length-1]);
					}
					// otherwise, skip over, not a valid number literal to consider
					else {
						saveText(match[0]);
						if (tokens[tokens.length-1].type === SEGMENT_GENERAL) {
							tokens[tokens.length-1].val += match[0];
						}
						else {
							tokens.push({
								type: SEGMENT_GENERAL,
								val: match[0]
							});
						}
					}

					previous_newline = false;
				}
				// special token?
				else if (match[0].match(/^(?:\b(?:return|throw|delete|in|else|void|typeof|yield|function|if|do|while|for|with|case|debugger|break|continue)\b|\=\>|[+\-*=~!%&,\|;:\?<>\(\)\{\}\[\]]|(?:\r?\n)+)$/)) {
					saveText(match[0]);
					tokens.push({
						type: TOKEN_SPECIAL,
						val: match[0]
					});

					if (match[0] === "function") {
						// NOTE: wherever a statement block can appear,
						// a function declaration can appear... right? :)
						tokens[tokens.length-1].is_decl = block_allowed;
						previous_newline = false;
						previous_opening_brace = false;
						previous_statement_block_label_candidate = false;
					}
					else {
						// new-line?
						if (match[0].match(/^(?:\r?\n)+$/)) {
							previous_newline = true;
						}
						else {
							if (match[0] === "{") {
								previous_opening_brace = true;
								tokens[tokens.length-1].is_block = block_allowed;
							}
							else {
								// : is possibly a qualifier for subsequent statement block
								if (match[0] === ":") {
									// is : part of a statement block label?
									if (previous_statement_block_label_candidate) {
										// subsequent statement block allowed
										block_allowed = true;
									}
									else {
										// subsequent statement block not allowed
										block_allowed = false;
									}
								}
								// disqualifier for subsequent statement block?
								else if (match[0].match(/^[\(\[+\-*\/%&\|=,]$/)) {
									block_allowed = false;
								}
								// otherwise, subsequent statement block allowed
								else {
									block_allowed = true;
								}

								previous_opening_brace = false;
							}

							previous_newline = false;
							previous_statement_block_label_candidate = false;
						}
					}
				}
				// starting a regex-literal segment (candidate)?
				else if (match[0] === "/") {
					if (regexLookback()) {
						segments.push({
							type: SEGMENT_REGEX_LITERAL,
							val: match[0]
						});
						tokens.push(segments[segments.length-1]);

						lexing_state = STATE_REGEX_LITERAL_CANDIDATE;
					}
					else {
						saveText(match[0]);
						tokens.push({
							type: TOKEN_SPECIAL,
							val: match[0]
						});
					}

					block_allowed = false;
					previous_newline = false;
				}
			}
		}

		function processSingleLineComment() {
			segments[segments.length-1].val += unmatched;
			if (match) {
				// don't capture the new-line in this comment segment, leave it for next match
				next_match_idx -= match[0].length;
				lexing_state = STATE_GENERAL;
			}
		}

		function processMultiLineComment() {
			segments[segments.length-1].val += unmatched;
			if (match) {
				segments[segments.length-1].val += match[0];
				lexing_state = STATE_GENERAL;
			}
		}

		function processStringLiteral() {
			var left_context;

			segments[segments.length-1].val += unmatched;

			if (match) {
				left_context = code.slice(0,next_match_idx - match[0].length);

				// is the match at the beginning or is it NOT escaped?
				if (!left_context || left_context.match(not_escaped_pattern)) {
					// an unescaped new-line in a file's string literal
					// is a syntax error
					if (match[0].match(/\r?\n/)) {
						public_api.warnings.push("Unterminated string literal: " + segments[segments.length-1].val);
						next_match_idx -= match[0].length;
						prev_match_idx = next_match_idx;
						lexing_state = STATE_GENERAL;
					}
					else {
						segments[segments.length-1].val += match[0];
						lexing_state = STATE_GENERAL;
					}
				}
				else {
					// include an escaped quote character?
					if (match[0] === "\"" || match[0] === "'") {
						segments[segments.length-1].val += match[0];
					}
					// omit escaped new-lines including their \ escape character
					else {
						segments[segments.length-1].val =
							segments[segments.length-1].val.slice(
								0,
								segments[segments.length-1].val.length-1
							)
						;
					}
				}
			}
		}

		function processBacktickLiteral() {
			var left_context;

			segments[segments.length-1].val += unmatched;

			if (match) {
				segments[segments.length-1].val += match[0];
				left_context = code.slice(0,next_match_idx - match[0].length);

				// is the match at the beginning or is it NOT escaped?
				if (!left_context || left_context.match(not_escaped_pattern)) {
					lexing_state = STATE_GENERAL;
				}
			}
		}

		function processRegexLiteral() {
			var left_context;

			segments[segments.length-1].val += unmatched;

			if (match) {
				left_context = code.slice(0,next_match_idx - match[0].length);

				// any new-line in a file's regex literal is a syntax error
				if (match[0].match(/\r?\n/)) {
					public_api.warnings.push("Unterminated regular expression literal: " + segments[segments.length-1].val);
					next_match_idx -= match[0].length;
					prev_match_idx = next_match_idx;
					lexing_state = STATE_GENERAL;
				}
				// unescaped [ ?
				else if (match[0] === "[" && left_context.match(not_escaped_pattern)) {
					segments[segments.length-1].val += match[0];
					regex_character_class = true;
				}
				// unescaped ] ?
				else if (match[0] === "]" && left_context.match(not_escaped_pattern)) {
					segments[segments.length-1].val += match[0];
					regex_character_class = false;
				}
				// otherwise, must be a /
				else {
					segments[segments.length-1].val += match[0];

					// is the / NOT in a character-class, and is 
					// at the beginning or is it NOT escaped?
					if (!regex_character_class &&
						(
							!left_context ||
							left_context.match(not_escaped_pattern)
						)
					) {
						lexing_state = STATE_GENERAL;
						block_allowed = false;
					}
				}
			}
		}


		var segments = [],
			tokens = [],

			match,
			prev_match_idx = 0,
			next_match_idx = 0,
			unmatched = "",
			regex,
			segment,

			block_allowed = true,
			previous_newline = false,
			previous_opening_brace = false,
			previous_statement_block_label_candidate = false,
			regex_character_class = false,

			lexing_state = 0,
			lexing_index = 0,

			STATE_PROCESSORS = [
				processGeneral,
				processSingleLineComment,
				processMultiLineComment,
				processStringLiteral,
				processBacktickLiteral,
				processRegexLiteral
			]
		;

		if (!code || code.length === 0) return segments;

		while (next_match_idx < code.length) {
			unmatched = "";

			regex = STATE_PATTERNS[lexing_state];

			regex.lastIndex = next_match_idx;
			match = regex.exec(code);

			if (match) {
				prev_match_idx = next_match_idx;
				next_match_idx = regex.lastIndex;

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

			STATE_PROCESSORS[lexing_state]();
		}

		// did we end in an abnormal state?
		if (lexing_state === STATE_MULTI_LINE_COMMENT) {
			segments[segments.length-1].type = SEGMENT_GENERAL;
			public_api.warnings.push("Unterminated multi-line comment at end of file");
		}
		else if (lexing_state === STATE_STRING_LITERAL) {
			segments[segments.length-1].type = SEGMENT_GENERAL;
			public_api.warnings.push("Unterminated string literal at end of file");
		}
		else if (lexing_state === STATE_BACKTICK_LITERAL) {
			segments[segments.length-1].type = SEGMENT_GENERAL;
			public_api.warnings.push("Unterminated template string at end of file");
		}
		else if (lexing_state === STATE_REGEX_LITERAL_CANDIDATE) {
			segments[segments.length-1].type = SEGMENT_GENERAL;
			public_api.warnings.push("Unterminated regular expression literal at end of file");
		}

		tokens.length = 0;
		return combineGeneralSegments(segments);
	}

	function reset() {
		public_api.warnings.length = 0;
	}


	var SEGMENT_GENERAL = 0,
		SEGMENT_COMMENT = 1,
		SEGMENT_STRING_LITERAL = 2,
		SEGMENT_BACKTICK_LITERAL = 3,
		SEGMENT_REGEX_LITERAL = 4,
		SEGMENT_NUMBER_LITERAL = 5,

		TOKEN_SPECIAL = 50,

		STATE_GENERAL = 0,
		STATE_SINGLE_LINE_COMMENT = 1,
		STATE_MULTI_LINE_COMMENT = 2,
		STATE_STRING_LITERAL = 3,
		STATE_BACKTICK_LITERAL = 4,
		STATE_REGEX_LITERAL_CANDIDATE = 5,

		not_escaped_pattern = /(?:[^\\]|(?:^|[^\\])(?:\\\\)+)$/,

		STATE_PATTERNS = [
			// general
			/\b(?:return|throw|delete|in|else|void|typeof|yield|function|if|while|for|with|case|debugger|break|continue)\b|\/\/|\/\*|\=\>|[`"'+\-*\/=~!%&,\|;:\?<>\(\)\{\}\[\]]|(?:0[xX][0-9a-fA-F]+)|(?:0[oO][0-7]+)|(?:0[bB][01]+)|(?:\d+\.\d*(?:[eE][+-]?\d+)?)|(?:\.\d+(?:[eE][+-]?\d+)?)|(?:\d+(?:[eE][+-]?\d+)?)/g,
			/\r?\n/g,						// end of single-line comment
			/\*\//g,						// end of multi-line comment
			null,							// (placeholder) end of string literal
			/[`]/g,							// end of backtick literal
			/\/[imgyn]*|\r?\n|[\[\]]/g		// end of regex
		],

		public_api
	;


	public_api = {
		lex: lex,
		reset: reset,

		// a list of warnings (if any) from the lexing
		warnings: [],

		// public constants for interpreting segment type
		SEGMENT: {
			GENERAL: SEGMENT_GENERAL,
			COMMENT: SEGMENT_COMMENT,
			STRING_LITERAL: SEGMENT_STRING_LITERAL,
			BACKTICK_LITERAL: SEGMENT_BACKTICK_LITERAL,
			REGEX_LITERAL: SEGMENT_REGEX_LITERAL,
			NUMBER_LITERAL: SEGMENT_NUMBER_LITERAL
		}
	};

	return public_api;
});
