import * as Yasqe from './';
import * as CodeMirror from 'codemirror'
import * as TokenUtils from './tokenUtils'
var lookFor = "PREFIX ";

export function findFirstPrefixLine(yasqe:Yasqe) {
  var lastLine = yasqe.getDoc().lastLine();
  for (var i = 0; i <= lastLine; ++i) {
    if (findFirstPrefix(yasqe, i) >= 0) {
      return i;
    }
  }
}

export function findFirstPrefix(yasqe:Yasqe, line:number, ch = 0, lineText?:string) {
  if (!lineText) lineText = yasqe.getDoc().getLine(line);
  lineText = lineText.toUpperCase();
  for (var at = ch, pass = 0; ; ) {
    var found = lineText.indexOf(lookFor, at);
    if (found == -1) {
      //no prefix on this line
      if (pass == 1) break;
      pass = 1;
      at = lineText.length;
      continue;
    }
    if (pass == 1 && found < ch) break;

    var tokenType = yasqe.getTokenTypeAt(CodeMirror.Pos(line, found + 1));
    if (!/^(comment|string)/.test(tokenType)) return found + 1;
    at = found - 1;
    //Could not find a prefix, no use looping any further. Probably invalid query
    if (at === pass) break;
  }
}
export default function(yasqe:Yasqe, start:Yasqe.Position) {
  var line = start.line, lineText = yasqe.getDoc().getLine(line);

  // var startCh, tokenType;

  function hasPreviousPrefix() {
    var hasPreviousPrefix = false;
    for (var i = line - 1; i >= 0; i--) {
      if (yasqe.getDoc().getLine(i).toUpperCase().indexOf(lookFor) >= 0) {
        hasPreviousPrefix = true;
        break;
      }
    }
    return hasPreviousPrefix;
  }


  var getLastPrefixPos = function(line:number, ch:number) {
    var prefixKeywordToken = yasqe.getTokenAt(CodeMirror.Pos(line, ch + 1));
    if (!prefixKeywordToken || prefixKeywordToken.type != "keyword") return -1;
    var prefixShortname = TokenUtils.getNextNonWsToken(yasqe, line, prefixKeywordToken.end + 1);
    if (!prefixShortname || prefixShortname.type != "string-2") return -1; //missing prefix keyword shortname
    var prefixUri = TokenUtils.getNextNonWsToken(yasqe, line, prefixShortname.end + 1);
    if (!prefixUri || prefixUri.type != "variable-3") return -1; //missing prefix uri
    return prefixUri.end;
  };

  //only use opening prefix declaration
  if (hasPreviousPrefix()) return;
  var prefixStart = findFirstPrefix(yasqe, line, start.ch, lineText);

  if (prefixStart == null) return;
  var stopAt = "{"; //if this char is there, we won't have a chance of finding more prefixes
  var stopAtNextLine = false;
  var lastLine = yasqe.getDoc().lastLine(), endCh;
  var prefixEndChar = getLastPrefixPos(line, prefixStart);
  var prefixEndLine = line;

  // outer:
  for (var i = line; i <= lastLine; ++i) {
    if (stopAtNextLine) break;
    var text = yasqe.getDoc().getLine(i), pos = i == line ? prefixStart + 1 : 0;

    for (;;) {
      if (!stopAtNextLine && text.indexOf(stopAt) >= 0) stopAtNextLine = true;

      var nextPrefixDeclaration = text.toUpperCase().indexOf(lookFor, pos);

      if (nextPrefixDeclaration >= 0) {
        if ((endCh = getLastPrefixPos(i, nextPrefixDeclaration)) > 0) {
          prefixEndChar = endCh;
          prefixEndLine = i;
          pos = prefixEndChar;
        }
        pos++;
      } else {
        break;
      }
    }
  }
  return {
    from: CodeMirror.Pos(line, prefixStart + lookFor.length),
    to: CodeMirror.Pos(prefixEndLine, prefixEndChar)
  };
};
