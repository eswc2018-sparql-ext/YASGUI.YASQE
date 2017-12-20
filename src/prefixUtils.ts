import * as Yasqe from './'
export type Prefixes = {[prefixLabel:string]:string};
export function addPrefixes(yasqe:Yasqe, prefixes:string |Prefixes) {
  var existingPrefixes = yasqe.getPrefixesFromQuery();
  //for backwards compatability, we stil support prefixes value as string (e.g. 'rdf: <http://fbfgfgf>'
  if (typeof prefixes == "string") {
    addPrefixAsString(yasqe, prefixes);
  } else {
    for (var pref in prefixes) {
      if (!(pref in existingPrefixes)) addPrefixAsString(yasqe, pref + ": <" + prefixes[pref] + ">");
    }
  }
  yasqe.collapsePrefixes(false);
};

export function addPrefixAsString(yasqe:Yasqe, prefixString:string) {
  var lastPrefix = null;
  var lastPrefixLine = 0;
  var numLines = yasqe.getDoc().lineCount();
  for (var i = 0; i < numLines; i++) {
    var firstTokenOnLine = yasqe.getNextNonWsToken(i);
    if (firstTokenOnLine != null && (firstTokenOnLine.string == "PREFIX" || firstTokenOnLine.string == "BASE")) {
      lastPrefix = firstTokenOnLine;
      lastPrefixLine = i;
    }
  }

  if (lastPrefix == null) {
    yasqe.getDoc().replaceRange("PREFIX " + prefixString + "\n", {
      line: 0,
      ch: 0
    });
  } else {
    var previousIndent = getIndentFromLine(yasqe, lastPrefixLine);
    yasqe.getDoc().replaceRange(previousIndent + "PREFIX " + prefixString + "\n", {
      line: lastPrefixLine + 1,
      ch: 0
    });
  }
  yasqe.collapsePrefixes(false);
};
export function removePrefixes(yasqe:Yasqe, prefixes:Prefixes) {
  var escapeRegex = function(string:string) {
    //taken from http://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript/3561711#3561711
    return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
  };
  for (var pref in prefixes) {
    yasqe.setValue(
      yasqe
        .getValue()
        .replace(new RegExp("PREFIX\\s*" + pref + ":\\s*" + escapeRegex("<" + prefixes[pref] + ">") + "\\s*", "ig"), "")
    );
  }
  yasqe.collapsePrefixes(false);
};

/**
 * Get defined prefixes from query as array, in format {"prefix:" "uri"}
 *
 * @param cm
 * @returns {Array}
 */
export function getPrefixesFromQuery(yasqe:Yasqe) {
  //Use precise here. We want to be sure we use the most up to date state. If we're
  //not, we might get outdated prefixes from the current query (creating loops such
  //as https://github.com/OpenTriply/YASGUI/issues/84)
  return yasqe.getTokenAt({ line: yasqe.getDoc().lastLine(), ch: yasqe.getDoc().getLine(yasqe.getDoc().lastLine()).length }, true).state.prefixes;
};

export function getIndentFromLine(yasqe:Yasqe, line:number, charNumber:number = 1):string {
  var token = yasqe.getTokenAt({
    line: line,
    ch: charNumber
  });
  if (token == null || token == undefined || token.type != "ws") {
    return "";
  } else {
    return token.string + getIndentFromLine(yasqe, line, token.end + 1);
  }
};
