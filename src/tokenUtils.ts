import * as Yasqe from './';

/**
 * When typing a query, this query is sometimes syntactically invalid, causing
 * the current tokens to be incorrect This causes problem for autocompletion.
 * http://bla might result in two tokens: http:// and bla. We'll want to combine
 * these
 */

export function getCompleteToken(yasqe:Yasqe.Instance, token:Yasqe.Token, cur: Yasqe.Position):Yasqe.Token {
  if (!cur) {
    cur = yasqe.getDoc().getCursor();
  }
  if (!token) {
    token = yasqe.getTokenAt(cur);
  }
  var prevToken = yasqe.getTokenAt({
    line: cur.line,
    ch: token.start
  });
  // not start of line, and not whitespace
  if (prevToken.type != null && prevToken.type != "ws" && token.type != null && token.type != "ws") {
    token.start = prevToken.start;
    token.string = prevToken.string + token.string;
    return getCompleteToken(yasqe, token, {
      line: cur.line,
      ch: prevToken.start
    }); // recursively, might have multiple tokens which it should include
  } else if (token.type != null && token.type == "ws") {
    //always keep 1 char of whitespace between tokens. Otherwise, autocompletions might end up next to the previous node, without whitespace between them
    token.start = token.start + 1;
    token.string = token.string.substring(1);
    return token;
  } else {
    return token;
  }
};
export function getPreviousNonWsToken(yasqe: Yasqe.Instance, line:number, token:Yasqe.Token):Yasqe.Token {
  var previousToken = yasqe.getTokenAt({
    line: line,
    ch: token.start
  });
  if (previousToken != null && previousToken.type == "ws") {
    previousToken = getPreviousNonWsToken(yasqe, line, previousToken);
  }
  return previousToken;
};
export function getNextNonWsToken(yasqe:Yasqe.Instance, lineNumber:number, charNumber:number):Yasqe.Token {
  if (charNumber == undefined) charNumber = 1;
  var token = yasqe.getTokenAt({
    line: lineNumber,
    ch: charNumber
  });
  if (token == null || token == undefined || token.end < charNumber) {
    return null;
  }
  if (token.type == "ws") {
    return getNextNonWsToken(yasqe, lineNumber, token.end + 1);
  }
  return token;
};
