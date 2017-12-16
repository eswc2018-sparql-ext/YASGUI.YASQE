/**
 * The default options of YASQE (check the CodeMirror documentation for even
 * more options, such as disabling line numbers, or changing keyboard shortcut
 * keys). Either change the default options by setting YASQE.defaults, or by
 * passing your own options as second argument to the YASQE constructor
 */
// var $ = require("jquery"), YASQE = require("./main.js");
import * as Yasqe from './'
export default <Yasqe.Config>{
    mode: "sparql11",
    /**
  	 * Query string
  	 */
    value:
`PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
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
      // rangeFinder: new YASQE.fold.combine(YASQE.fold.brace, YASQE.fold.prefix)
    },
    collapsePrefixesOnLoad: false,
    gutters: ["gutterErrorBar", "CodeMirror-linenumbers", "CodeMirror-foldgutter"],
    matchBrackets: true,
    fixedGutter: true,
    syntaxErrorCheck: true,
    onQuotaExceeded: function(e) {
      //fail silently
      console.warn("Could not store in localstorage. Skipping..", e);
    },
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
    cursorHeight: 0.9,

    // createShareLink: YASQE.createShareLink,

    createShortLink: null,

    // consumeShareLink: YASQE.consumeShareLink,
    // persistent: function(yasqe) {
    //   return "yasqe_" + $(yasqe.getWrapperElement()).closest("[id]").attr("id") + "_queryVal";
    // },

    sparql: {
      queryName: function(yasqe:Yasqe) {
        return yasqe.getQueryMode();
      },
      showQueryButton: false,

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
      },
    }
  }
// }
