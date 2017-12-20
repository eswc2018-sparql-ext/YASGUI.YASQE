/**
 * The default options of YASQE (check the CodeMirror documentation for even
 * more options, such as disabling line numbers, or changing keyboard shortcut
 * keys). Either change the default options by setting YASQE.defaults, or by
 * passing your own options as second argument to the YASQE constructor
 */
import * as _Yasqe from "./";
import * as CodeMirror from "codemirror";
import * as queryString from "query-string";
//need to pass Yasqe object as argument, as the imported version might not have inherited all (e.g. `fold`) props of Codemirror yet
export default function get(Yasqe: typeof _Yasqe): _Yasqe.Config {
  return {
    mode: "sparql11",
    value: `PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT * WHERE {
  ?sub ?pred ?obj .
} LIMIT 10`,
    highlightSelectionMatches: {
      showToken: /\w/
    },
    tabMode: "indent",
    lineNumbers: true,
    lineWrapping: true,
    foldGutter: {
      rangeFinder: new (<any>CodeMirror).fold.combine((<any>CodeMirror).fold.brace, (<any>CodeMirror).fold.prefix)
    },
    collapsePrefixesOnLoad: false,
    gutters: ["gutterErrorBar", "CodeMirror-linenumbers", "CodeMirror-foldgutter"],
    matchBrackets: true,
    fixedGutter: true,
    syntaxErrorCheck: true,
    autocompleters: [],
    extraKeys: {
      "Ctrl-Space": function(yasqe: _Yasqe) {
        yasqe.autocomplete();
      },
      //   "Ctrl-Space": YASQE.autoComplete,
      //
      //   "Cmd-Space": YASQE.autoComplete,
      // "Ctrl-d": function(yasqe: _Yasqe) {
      //
      //   return yasqe.getDoc().removeLine(yasqe.getDoc().getCursor().line);
      // },
      "Shift-Ctrl-K": function(yasqe: _Yasqe) {
        return yasqe.getDoc().removeLine(yasqe.getDoc().getCursor().line);
      },
      //   "Cmd-D": YASQE.deleteLine,
      //   "Cmd-K": YASQE.deleteLine,
      //   "Ctrl-/": YASQE.commentLines,
      //   "Cmd-/": YASQE.commentLines,
      //   "Ctrl-Alt-Down": YASQE.copyLineDown,
      //   "Ctrl-Alt-Up": YASQE.copyLineUp,
      //   "Cmd-Alt-Down": YASQE.copyLineDown,
      //   "Cmd-Alt-Up": YASQE.copyLineUp,

        "Shift-Ctrl-F": function(yasqe:_Yasqe) {
          yasqe.autoformat();
        },
      //   "Ctrl-]": YASQE.indentMore,
      //   "Cmd-]": YASQE.indentMore,
      //   "Ctrl-[": YASQE.indentLess,
      //   "Cmd-[": YASQE.indentLess,
        "Ctrl-S": function(yasqe:_Yasqe) {
        yasqe.saveQuery()
      },
      "Ctrl-Enter": function(yasqe: _Yasqe) {
        return yasqe.query();
      },
      F11: function(yasqe: _Yasqe) {
        yasqe.setFullscreen(true);
      },
      Esc: function(yasqe: _Yasqe) {
        yasqe.setFullscreen(false);
      }
    },
    // cursorHeight: 0.9,

    createShareLink: function(yasqe: _Yasqe) {
      return (
        document.location.protocol +
        "//" +
        document.location.host +
        document.location.pathname +
        document.location.search +
        "#" +
        queryString.stringify(yasqe.configToQueryParams())
      );
    },

    createShortLink: null,

    consumeShareLink: function(yasqe: _Yasqe) {
      yasqe.queryParamsToConfig(yasqe.getUrlParams());
    },
    persistenceId: function(yasqe: _Yasqe) {
      //Traverse parents untl we've got an id
      // Get matching parent elements
      var id = "";
      var elem = <Node>yasqe.rootEl;
      if ((<any>elem).id) id = (<any>elem).id;
      for (; elem && elem !== <any>document; elem = elem.parentNode) {
        if (elem) {
          if ((<any>elem).id) id = (<any>elem).id;
          break;
        }
      }
      return "yasqe_" + id + "_query";
    },
    persistencyExpire: 60 * 60 * 24 * 30,

    sparql: {
      queryName: function(yasqe: _Yasqe): string {
        return yasqe.getQueryMode();
      },
      showQueryButton: true,

      endpoint: "http://dbpedia.org/sparql",
      requestMethod: "POST",
      acceptHeaderGraph: "text/turtle,*/*;q=0.9",
      acceptHeaderSelect: "application/sparql-results+json,*/*;q=0.9",
      acceptHeaderUpdate: "text/plain,*/*;q=0.9",
      namedGraphs: [],
      defaultGraphs: [],
      args: [],
      headers: {},
      withCredentials: false,
      getQueryForAjax: null
    }
  };
}
// }
