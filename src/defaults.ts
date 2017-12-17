/**
 * The default options of YASQE (check the CodeMirror documentation for even
 * more options, such as disabling line numbers, or changing keyboard shortcut
 * keys). Either change the default options by setting YASQE.defaults, or by
 * passing your own options as second argument to the YASQE constructor
 */
import * as _Yasqe from "./";
import * as CodeMirror from 'codemirror'
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
    /**
     * Extra shortcut keys. Check the CodeMirror manual on how to add your own
     *
     * @property extraKeys
     * @type object
     */
    // extraKeys: {
    //   //					"Ctrl-Space" : function(yasqe) {
    //   //						YASQE.autoComplete(yasqe);
    //   //					},
    //   "Ctrl-Space": YASQE.autoComplete,
    //
    //   "Cmd-Space": YASQE.autoComplete,
    //   "Ctrl-D": YASQE.deleteLine,
    //   "Ctrl-K": YASQE.deleteLine,
    //   "Shift-Ctrl-K": YASQE.deleteLine,
    //   "Cmd-D": YASQE.deleteLine,
    //   "Cmd-K": YASQE.deleteLine,
    //   "Ctrl-/": YASQE.commentLines,
    //   "Cmd-/": YASQE.commentLines,
    //   "Ctrl-Alt-Down": YASQE.copyLineDown,
    //   "Ctrl-Alt-Up": YASQE.copyLineUp,
    //   "Cmd-Alt-Down": YASQE.copyLineDown,
    //   "Cmd-Alt-Up": YASQE.copyLineUp,
    //   "Shift-Ctrl-F": YASQE.doAutoFormat,
    //   "Shift-Cmd-F": YASQE.doAutoFormat,
    //   "Ctrl-]": YASQE.indentMore,
    //   "Cmd-]": YASQE.indentMore,
    //   "Ctrl-[": YASQE.indentLess,
    //   "Cmd-[": YASQE.indentLess,
    //   "Ctrl-S": YASQE.storeQuery,
    //   "Cmd-S": YASQE.storeQuery,
    //   "Ctrl-Enter": YASQE.executeQuery,
    //   "Cmd-Enter": YASQE.executeQuery,
    //   F11: function(yasqe) {
    //     yasqe.setOption("fullScreen", !yasqe.getOption("fullScreen"));
    //   },
    //   Esc: function(yasqe) {
    //     if (yasqe.getOption("fullScreen")) yasqe.setOption("fullScreen", false);
    //   }
    // },
    // cursorHeight: 0.9,

    createShareLink: function(yasqe:_Yasqe) {
      // //extend existing link, so first fetch current arguments
      // var urlParams = {};
      // if (window.location.hash.length > 1) urlParams = $.deparam(window.location.hash.substring(1));
      // urlParams["query"] = yasqe.getValue();
      // return urlParams;
      return 'TODO: implement createhsarelink func in defaults'
    },

    createShortLink: null,

    // consumeShareLink: YASQE.consumeShareLink,
    persistenceId: function(yasqe:_Yasqe) {
      //Traverse parents untl we've got an id
        // Get matching parent elements
      var id = ''
      var elem = <Node>yasqe.rootEl
      if ((<any>elem).id) id = (<any>elem).id;
        for ( ; elem && elem !== <any>document; elem = elem.parentNode ) {
          if ( parent ) {
             if ((<any>parent).id) id = (<any>parent).id;
             break;
          }
      }
      return "yasqe_" + id + "_query";
    },
    persistencyExpire: 60 * 60 * 24 * 30,

    sparql: {
      queryName: function(yasqe: _Yasqe) {
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

      getQueryForAjax: null,
      /**
       * Set of ajax callbacks
       */
      callbacks: {
        beforeSend: null,
        complete: null,
        error: null,
        success: null
      }
    }
  };
}
// }
