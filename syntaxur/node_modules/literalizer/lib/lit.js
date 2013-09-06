/*! literalizer
    v0.3.0-a (c) Kyle Simpson
    MIT License: http://getify.mit-license.org
*/

(function UMD(name,context,definition) {
	if (typeof module != "undefined" && module.exports) module.exports = definition();
	else if (typeof define == "function" && define.amd) define(definition);
	else context[name] = definition(name,context);
})("LIT",this,function definition(name,context) {
	"use strict";

	function clone(obj) {
		return JSON.parse(JSON.stringify(obj));
	}

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
				/^(?:\r?\n)+$/.test(tok.val)
			) ||
			// whitespace?
			(
				tok.type === SEGMENT_GENERAL &&
				/^\s*$/.test(tok.val)
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

		// Algorithm here comes (partly) from pseudo-code description at:
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
								if (/^(?:if|while|for|with)$/.test(tok.val)) {
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
										!/function(?:\s*\*)?/.test(tokens[tok_idx].val) ||
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
				// is preceeding special-token a keyword or punctuator/operator that implies rval?
				else if (/^(?:new|return|throw|delete|in|else|void|typeof|yield|case|debugger|break|continue|(?:=>|[+\-*\/=~!%&,\|;:\?<>\(\{\[]))$/.test(tok.val)) {
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

			function checkAbandonPropertyFunctionCandidate(matched) {
				var tmp;

				if (
					// empty value token?
					!matched ||
					// whitespace only?
					/^\s+$/.test(matched) ||
					// not currently processing a property-function candidate anyway?
					block_allowed[block_allowed.length-1].type !== BLOCK_ALLOWED_PROPERTY_FUNCTION
				) {
					// don't abandon anything :)
					return;
				}

				if (
					// unbalanced ( ) pairs?
					block_allowed[block_allowed.length-1].paren_count < 0 ||
					// unbalanced { } pairs?
					block_allowed[block_allowed.length-1].brace_count < 0 ||
					(
						// expecting the opening { for the outer { } balanced pair?
						block_allowed[block_allowed.length-1].brace_count === 0 &&
						// but didn't find what was expected?
						matched !== "{"
					)
				) {
					// abandon as not actually a valid property-function
					tmp = block_allowed.pop();

					// update paren and brace counts after state pop, if need-be
					if (tmp.paren_count > 0) {
						if (block_allowed[block_allowed.length-1].paren_count === null) {
							block_allowed[block_allowed.length-1].paren_count = tmp.paren_count;
						}
						else if (typeof block_allowed[block_allowed.length-1].paren_count === "number") {
							block_allowed[block_allowed.length-1].paren_count += tmp.paren_count;
						}
					}
					if (tmp.brace_count > 0) {
						if (block_allowed[block_allowed.length-1].brace_count === null) {
							block_allowed[block_allowed.length-1].brace_count = tmp.brace_count;
						}
						else if (typeof block_allowed[block_allowed.length-1].brace_count === "number") {
							block_allowed[block_allowed.length-1].brace_count += tmp.brace_count;
						}
					}
				}
			}


			var segmentsSlice, left_context, tok_idx,
				prev_tok_idx,
				preceding_dot_operator = false
			;

			// capture preceeding unmatched string, if any
			if (unmatched) {
				saveText(unmatched);

				tokens.push({
					type: SEGMENT_GENERAL,
					val: unmatched
				});

				// valid identifier (and optional surrounding whitespace)?
				if (/^\s*[^0-9\s\(\)\[\]\{\}<>,.:;=~+\-\*\/!%&\|\?\"\'][^\s\(\)\[\]\{\}<>,.:;=~+\-\*\/!%&\|\?\"\']*\s*$/.test(unmatched)) {
					// if block is allowed and an identifier is found,
					// it's a block-label candidate
					statement_block_label_candidate = block_allowed[block_allowed.length-1].allowed;
					// if a block is not allowed but an identifier is found,
					// it's a property-function candidate, as long as it's not
					// the name identifier of an existing function definition
					property_function_candidate = (
						!block_allowed[block_allowed.length-1].allowed &&
						!(
							block_allowed[block_allowed.length-1].type === BLOCK_ALLOWED_FUNCTION &&
							block_allowed[block_allowed.length-1].paren_count === null
						) &&
						!(
							block_allowed[block_allowed.length-1].type === BLOCK_ALLOWED_ARROW_FUNCTION &&
							block_allowed[block_allowed.length-1].brace_count === null
						)
					);
				}
				// valid identifier not found where necessary for block label
				else {
					statement_block_label_candidate = false;
				}
			}

			// record whether there's a preceding . operator (not part of a number literal)
			prev_tok_idx = findUsefulToken(tokens.length-1);
			if (prev_tok_idx !== false &&
				tokens[prev_tok_idx].type !== SEGMENT_NUMBER_LITERAL
			) {
				preceding_dot_operator = /\.\s*$/.test(tokens[prev_tok_idx].val);
			}

			// do we need to implicitly end an arrow-function or for-loop block-state
			// processing because no outer { } balanced pair is going to be found?
			if (
				(
					(
						// currently processing an arrow-function?
						block_allowed[block_allowed.length-1].type === BLOCK_ALLOWED_ARROW_FUNCTION &&
						// expecting the opening { for the outer { } balanced pair?
						block_allowed[block_allowed.length-1].brace_count === null
					) ||
					(
						// currently processing a for-loop?
						block_allowed[block_allowed.length-1].type === BLOCK_ALLOWED_FOR &&
						// expecting the opening { for the outer { } balanced pair?
						block_allowed[block_allowed.length-1].paren_count === 0
					)
				) &&
				(
					// non-whitespace/newline followed?
					/[^\s]/.test(unmatched) ||
					// non-comment, non { character followed?
					!/\/\/|\/\*|[\{]/.test(match[0])
				)
			) {
				block_allowed.pop();
			}

			if (match) {
				left_context = code.slice(0,next_match_idx - match[0].length);

				// starting a comment segment?
				if (match[0] === "//" || match[0] === "/*") {
					segments.push({
						type: SEGMENT_COMMENT,
						val: match[0]
					});
					tokens.push(clone(segments[segments.length-1]));

					if (match[0] === "//") {
						lexing_state = STATE_SINGLE_LINE_COMMENT;
					}
					else {
						lexing_state = STATE_MULTI_LINE_COMMENT;
					}
				}
				// starting a backtick-literal segment?
				else if (match[0] === "`") {
					segments.push({
						type: SEGMENT_BACKTICK_LITERAL,
						val: match[0]
					});
					tokens.push(clone(segments[segments.length-1]));

					lexing_state = STATE_BACKTICK_LITERAL;

					checkAbandonPropertyFunctionCandidate(match[0]);
				}
				// starting a string-literal segment?
				else if (match[0] === "\"" || match[0] === "'") {
					segments.push({
						type: SEGMENT_STRING_LITERAL,
						val: match[0]
					});
					tokens.push(clone(segments[segments.length-1]));

					lexing_state = STATE_STRING_LITERAL;
					STATE_PATTERNS[STATE_STRING_LITERAL] = new RegExp(match[0] + "|\r?\n","g");

					checkAbandonPropertyFunctionCandidate(match[0]);
				}
				// number literal candidate?
				else if (/^(?:(?:0[xX][0-9a-fA-F]+)|(?:0[oO][0-7]+)|(?:0[bB][01]+)|(?:\d+\.\d*(?:[eE][+-]?\d+)?)|(?:\.\d+(?:[eE][+-]?\d+)?)|(?:\d+(?:[eE][+-]?\d+)?))$/.test(match[0])) {
					// number appears separate from an identifier?
					if (!/[^\s\(\)\[\]\{\}<>,.:;=~+\-\*\/!%&\|\?\"\']$/.test(left_context)) {
						segments.push({
							type: SEGMENT_NUMBER_LITERAL,
							val: match[0]
						});
						tokens.push(clone(segments[segments.length-1]));

						statement_block_label_candidate = false;
						property_function_candidate = false;

						checkAbandonPropertyFunctionCandidate(match[0]);
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

						switch_clause_candidate = false;
					}

					block_asi_allowed = true;
				}
				// what looks like a special keyword but is just a property identifier (because of preceding . operator)?
				else if (preceding_dot_operator &&
					/\w/.test(match[0])
				) {
					saveText(match[0]);
					tokens.push({
						type: SEGMENT_GENERAL,
						val: match[0]
					});

					block_asi_allowed = true;
					statement_block_label_candidate = false;
					switch_clause_candidate = false;
					property_function_candidate = false;

					checkAbandonPropertyFunctionCandidate(match[0]);
				}
				// special token?
				else if (/^(?:\b(?:new|return|throw|delete|in|of|else|void|typeof|yield|if|do|while|for|with|case|default|debugger|break|continue)\b|\bfunction(?:\s*\*)?|=>|[+\-*=~!%&,\|;:\?<>\(\)\{\}\[\]]|(?:\r?\n)+)$/.test(match[0])) {
					saveText(match[0]);
					tokens.push({
						type: TOKEN_SPECIAL,
						val: match[0]
					});

					// normal function?
					if (/function(?:\s*\*)?/.test(match[0])) {
						block_asi_allowed = false;
						statement_block_label_candidate = false;
						switch_clause_candidate = false;
						property_function_candidate = false;

						checkAbandonPropertyFunctionCandidate(match[0]);

						// NOTE: wherever a statement block can appear,
						// a function declaration can appear, and only there.
						tokens[tokens.length-1].is_decl = block_allowed[block_allowed.length-1].allowed;

						block_allowed.push({
							type: BLOCK_ALLOWED_FUNCTION,
							allowed: false,
							paren_count: null,
							brace_count: null
						});
					}
					// arrow function?
					else if (match[0] === "=>") {
						block_asi_allowed = false;
						statement_block_label_candidate = false;
						switch_clause_candidate = false;
						property_function_candidate = false;

						checkAbandonPropertyFunctionCandidate(match[0]);

						block_allowed.push({
							type: BLOCK_ALLOWED_ARROW_FUNCTION,
							allowed: false,
							brace_count: null
						});
					}
					// starting a for-loop?
					else if (match[0] === "for") {
						block_asi_allowed = false;
						statement_block_label_candidate = false;
						switch_clause_candidate = false;
						property_function_candidate = false;

						checkAbandonPropertyFunctionCandidate(match[0]);

						block_allowed.push({
							type: BLOCK_ALLOWED_FOR,
							allowed: false,
							paren_count: null
						});
					}
					// `new` operator?
					else if (match[0] === "new") {
						block_asi_allowed = false;
						statement_block_label_candidate = false;
						switch_clause_candidate = false;
						property_function_candidate = false;

						checkAbandonPropertyFunctionCandidate(match[0]);

						block_allowed[block_allowed.length-1].allowed = false;
					}
					// switch clauses?
					else if (/case|default/.test(match[0])) {
						block_asi_allowed = false;
						statement_block_label_candidate = false;
						switch_clause_candidate = true;
						property_function_candidate = false;

						checkAbandonPropertyFunctionCandidate(match[0]);
					}
					// new-line?
					else if (/^(?:\r?\n)+$/.test(match[0])) {
						// check block ASI at this new-line
						if (block_asi_allowed) {
							block_allowed[block_allowed.length-1].allowed = true;
							block_asi_allowed = false;
						}
					}
					// opening ( parenthesis?
					else if (match[0] === "(") {
						block_asi_allowed = false;
						statement_block_label_candidate = false;
						switch_clause_candidate = false;

						checkAbandonPropertyFunctionCandidate(match[0]);

						// are we continuing a property-function candidate with an outer ( ) pair?
						if (property_function_candidate) {
							property_function_candidate = false;
							block_allowed.push({
								type: BLOCK_ALLOWED_PROPERTY_FUNCTION,
								allowed: false,
								paren_count: 1,
								brace_count: null
							});
						}
						else if (
							// processing a for-loop currently?
							block_allowed[block_allowed.length-1].type === BLOCK_ALLOWED_FOR ||
							(
								(
									// processing a normal function?
									block_allowed[block_allowed.length-1].type === BLOCK_ALLOWED_FUNCTION ||
									// processing a property-function candidate currently?
									block_allowed[block_allowed.length-1].type === BLOCK_ALLOWED_PROPERTY_FUNCTION
								) &&
								// still haven't found its outer ( ) balanced pair?
								block_allowed[block_allowed.length-1].brace_count === null
							)
						) {
							// expecting the opening ( of the outer ( ) balanced pair?
							if (block_allowed[block_allowed.length-1].paren_count === null) {
								block_allowed[block_allowed.length-1].paren_count = 1;
							}
							// otherwise, keep count to find outer ( ) balanced pair
							else {
								block_allowed[block_allowed.length-1].paren_count++;
							}
						}
						// otherwise, just a non-special ( operator
						else {
							block_allowed[block_allowed.length-1].allowed = false;
						}
					}
					// closing ) parenthesis?
					else if (match[0] === ")") {
						block_asi_allowed = false;
						statement_block_label_candidate = false;
						switch_clause_candidate = false;
						property_function_candidate = false;

						checkAbandonPropertyFunctionCandidate(match[0]);

						if (
							(
								// processing a for-loop currently?
								block_allowed[block_allowed.length-1].type === BLOCK_ALLOWED_FOR ||
								(
									(
										// processing a property-function candidate currently?
										block_allowed[block_allowed.length-1].type === BLOCK_ALLOWED_PROPERTY_FUNCTION ||
										// processing a normal function?
										block_allowed[block_allowed.length-1].type === BLOCK_ALLOWED_FUNCTION
									) &&
									// still haven't found its outer ( ) balanced pair?
									block_allowed[block_allowed.length-1].brace_count === null
								)
							) &&
							// already found the opening ( of the outer ( ) balanced pair?
							block_allowed[block_allowed.length-1].paren_count !== null
						) {
							block_allowed[block_allowed.length-1].paren_count--;

							// found the closing ) for the outer ( ) balanced pair?
							if (block_allowed[block_allowed.length-1].paren_count === 0) {
								block_allowed[block_allowed.length-1].allowed = true;
								// now look for the outer { } balanced pair
								block_allowed[block_allowed.length-1].brace_count = 0;
							}
							else {
								checkAbandonPropertyFunctionCandidate(match[0]);
							}
						}
						// otherwise, just a non-special ) operator
						else {
							block_asi_allowed = true;
						}
					}
					// opening { brace?
					else if (match[0] === "{") {
						block_asi_allowed = false;
						statement_block_label_candidate = false;
						switch_clause_candidate = false;
						property_function_candidate = false;

						checkAbandonPropertyFunctionCandidate(match[0]);

						if (
							// general block-allowed processing state?
							block_allowed[block_allowed.length-1].type === BLOCK_ALLOWED_GENERAL ||
							(
								(
									// processing normal function?
									block_allowed[block_allowed.length-1].type === BLOCK_ALLOWED_FUNCTION ||
									// processing arrow-function?
									block_allowed[block_allowed.length-1].type === BLOCK_ALLOWED_ARROW_FUNCTION ||
									// processing property-function?
									block_allowed[block_allowed.length-1].type === BLOCK_ALLOWED_PROPERTY_FUNCTION
								) &&
								// function body-block has started already?
								block_allowed[block_allowed.length-1].brace_count !== null
							)
						) {
							// if a block is allowed here, the { starts a block
							tokens[tokens.length-1].is_block = block_allowed[block_allowed.length-1].allowed;
							if ("brace_count" in block_allowed[block_allowed.length-1]) {
								block_allowed[block_allowed.length-1].brace_count++;
							}
						}
						else if (
							// processing an arrow-function?
							block_allowed[block_allowed.length-1].type === BLOCK_ALLOWED_ARROW_FUNCTION ||
							(
								(
									// processing a normal function?
									block_allowed[block_allowed.length-1].type === BLOCK_ALLOWED_FUNCTION ||
									// processing a property-function candidate?
									block_allowed[block_allowed.length-1].type === BLOCK_ALLOWED_PROPERTY_FUNCTION
								) &&
								// already found the outer ( ) balanced pair?
								block_allowed[block_allowed.length-1].paren_count === 0
							)
						) {
							tokens[tokens.length-1].is_block = true;

							// expecting the opening { of the outer { } balanced pair?
							if (block_allowed[block_allowed.length-1].brace_count === null) {
								block_allowed[block_allowed.length-1].brace_count = 1;
							}
							// otherwise, keep count to find outer { } balanced pair
							else {
								block_allowed[block_allowed.length-1].brace_count++;
							}

							block_allowed[block_allowed.length-1].allowed = true;
						}
						else if (
							// processing a for-loop currently?
							block_allowed[block_allowed.length-1].type === BLOCK_ALLOWED_FOR &&
							// already found the outer ( ) balanced pair?
							block_allowed[block_allowed.length-1].paren_count === 0
						) {
							tokens[tokens.length-1].is_block = true;

							block_allowed.pop();
							block_allowed[block_allowed.length-1].allowed = true;
						}
					}
					// closing } brace?
					else if (match[0] === "}") {
						block_asi_allowed = false;
						statement_block_label_candidate = false;
						switch_clause_candidate = false;
						property_function_candidate = false;

						checkAbandonPropertyFunctionCandidate(match[0]);

						if (
							// not general block-allowed processing state?
							block_allowed[block_allowed.length-1].type !== BLOCK_ALLOWED_GENERAL &&
							// still looking for the closing } for the outer { } balanced pair?
							block_allowed[block_allowed.length-1].brace_count > 0
						) {
							block_allowed[block_allowed.length-1].brace_count--;

							// found the closing } for the outer { } balanced pair?
							if (block_allowed[block_allowed.length-1].brace_count === 0) {
								block_allowed.pop();
							}
							else {
								checkAbandonPropertyFunctionCandidate(match[0]);
							}
						}

						block_allowed[block_allowed.length-1].allowed = true;
					}
					// : is possibly a qualifier for subsequent statement block?
					else if (match[0] === ":") {
						checkAbandonPropertyFunctionCandidate(match[0]);

						// is : part of a statement block label or a switch clause?
						if (statement_block_label_candidate ||
							switch_clause_candidate
						) {
							// subsequent statement block allowed
							block_allowed[block_allowed.length-1].allowed = true;
						}
						else {
							// subsequent statement block not allowed
							block_allowed[block_allowed.length-1].allowed = false;
						}

						block_asi_allowed = false;
						statement_block_label_candidate = false;
						switch_clause_candidate = false;
						property_function_candidate = false;
					}
					// ; allows a subsequent { } block, except when inside a for-loop's clauses
					else if (match[0] === ";") {
						block_asi_allowed = false;
						statement_block_label_candidate = false;
						switch_clause_candidate = false;
						property_function_candidate = false;

						checkAbandonPropertyFunctionCandidate(match[0]);

						// processing a for-loop's clauses?
						if (block_allowed[block_allowed.length-1].type === BLOCK_ALLOWED_FOR) {
							// ; in a for-loop's clauses separates expression-statements only,
							// so statement blocks not allowed
							block_allowed[block_allowed.length-1].allowed = false;
						}
						else {
							block_allowed[block_allowed.length-1].allowed = true;
						}
					}
					// disqualifier for subsequent statement block?
					else if (/^(?:[\[+\-*\/%&\|=,])$/.test(match[0])) {
						block_asi_allowed = false;
						statement_block_label_candidate = false;
						switch_clause_candidate = false;

						checkAbandonPropertyFunctionCandidate(match[0]);

						block_allowed[block_allowed.length-1].allowed = false;
					}
					// otherwise, subsequent statement block allowed
					else {
						block_asi_allowed = true;
						statement_block_label_candidate = false;
						switch_clause_candidate = false;

						checkAbandonPropertyFunctionCandidate(match[0]);

						block_allowed[block_allowed.length-1].allowed = false;
					}
				}
				// starting a regex-literal segment (candidate)?
				else if (match[0] === "/") {
					if (regexLookback()) {
						segments.push({
							type: SEGMENT_REGEX_LITERAL,
							val: match[0]
						});
						tokens.push(clone(segments[segments.length-1]));

						lexing_state = STATE_REGEX_LITERAL_CANDIDATE;
					}
					else {
						saveText(match[0]);
						tokens.push({
							type: TOKEN_SPECIAL,
							val: match[0]
						});
					}

					block_asi_allowed = false;
					statement_block_label_candidate = false;
					switch_clause_candidate = false;
					property_function_candidate = false;

					checkAbandonPropertyFunctionCandidate(match[0]);

					block_allowed[block_allowed.length-1].allowed = false;
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

				// did this multi-line comment span multiple lines?
				if (/\r?\n/.test(segments[segments.length-1].val)) {
					// check block ASI at this new-line
					if (block_asi_allowed) {
						block_allowed[block_allowed.length-1].allowed = true;
						block_asi_allowed = false;
					}
				}
			}
		}

		function processStringLiteral() {
			var left_context;

			segments[segments.length-1].val += unmatched;

			if (match) {
				left_context = code.slice(0,next_match_idx - match[0].length);

				// is the match at the beginning or is it NOT escaped?
				if (!left_context || not_escaped_pattern.test(left_context)) {
					// an unescaped new-line in a file's string literal
					// is a syntax error
					if (/\r?\n/.test(match[0])) {
						public_api.warnings.push("Unterminated string literal: " + segments[segments.length-1].val);
						next_match_idx -= match[0].length;
						prev_match_idx = next_match_idx;

						block_allowed[block_allowed.length-1].allowed = true;
						block_asi_allowed = false;
					}
					else {
						segments[segments.length-1].val += match[0];
						block_asi_allowed = true;
					}

					lexing_state = STATE_GENERAL;
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
				if (!left_context || not_escaped_pattern.test(left_context)) {
					lexing_state = STATE_GENERAL;

					block_asi_allowed = true;
				}
			}
		}

		function processRegexLiteral() {
			var left_context;

			segments[segments.length-1].val += unmatched;

			if (match) {
				left_context = code.slice(0,next_match_idx - match[0].length);

				// any new-line in a file's regex literal is a syntax error
				if (/\r?\n/.test(match[0])) {
					public_api.warnings.push("Unterminated regular expression literal: " + segments[segments.length-1].val);
					next_match_idx -= match[0].length;
					prev_match_idx = next_match_idx;
					lexing_state = STATE_GENERAL;

					block_allowed[block_allowed.length-1].allowed = true;
					block_asi_allowed = false;
				}
				// unescaped [ ?
				else if (match[0] === "[" && not_escaped_pattern.test(left_context)) {
					segments[segments.length-1].val += match[0];
					regex_character_class = true;
				}
				// unescaped ] ?
				else if (match[0] === "]" && not_escaped_pattern.test(left_context)) {
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
							not_escaped_pattern.test(left_context)
						)
					) {
						lexing_state = STATE_GENERAL;
						block_asi_allowed = true;
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

			block_allowed = [
				{
					type: BLOCK_ALLOWED_GENERAL,
					allowed: true
				}
			],
			block_asi_allowed = false,
			statement_block_label_candidate = false,
			switch_clause_candidate = false,
			property_function_candidate = false,
			regex_character_class = false,
			normal_function_started = false,
			arrow_function_started = false,

			lexing_state = 0,

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

		BLOCK_ALLOWED_GENERAL = 0,
		BLOCK_ALLOWED_FUNCTION = 1,
		BLOCK_ALLOWED_ARROW_FUNCTION = 2,
		BLOCK_ALLOWED_PROPERTY_FUNCTION = 3,
		BLOCK_ALLOWED_FOR = 4,

		not_escaped_pattern = /(?:[^\\]|(?:^|[^\\])(?:\\\\)+)$/,

		STATE_PATTERNS = [
			// general
			/\b(?:new|return|throw|delete|in|of|else|void|typeof|yield|if|while|for|with|case|default|debugger|break|continue)\b|\bfunction(?:\s*\*)?|\/\/|\/\*|=>|(?:\r?\n)|[`"'+\-*\/=~!%&,\|;:\?<>\(\)\{\}\[\]]|(?:0[xX][0-9a-fA-F]+)|(?:0[oO][0-7]+)|(?:0[bB][01]+)|(?:\d+\.\d*(?:[eE][+-]?\d+)?)|(?:\.\d+(?:[eE][+-]?\d+)?)|(?:\d+(?:[eE][+-]?\d+)?)/g,
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
