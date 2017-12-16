console.log('bla7')
import * as CodeMirror from 'codemirror';
require("codemirror/addon/fold/foldcode.js");
require("codemirror/addon/fold/foldgutter.js");
require("codemirror/addon/fold/xml-fold.js");
require("codemirror/addon/fold/brace-fold.js");
require("codemirror/addon/hint/show-hint.js");
require("codemirror/addon/search/searchcursor.js");
require("codemirror/addon/edit/matchbrackets.js");
require("codemirror/addon/runmode/runmode.js");
require("codemirror/addon/display/fullscreen.js");

require("codemirror/lib/codemirror.css")
import defaults from './defaults'
import {merge} from 'lodash'
namespace Yasqe {
  export interface Config extends CodeMirror.EditorConfiguration {
    mode?: "sparql11",
    collapsePrefixesOnLoad?: boolean,
    syntaxErrorCheck?: boolean,
    onQuotaExceeded?: (e:Error) => any
    /**
    * Show a button with which users can create a link to this query. Set this value to null to disable this functionality.
    * By default, this feature is enabled, and the only the query value is appended to the link.
    * ps. This function should return an object which is parseable by jQuery.param (http://api.jquery.com/jQuery.param/)
    */
    createShareLink?: (todo:number) => number
    createShortLink?: (todo:number) => number
    consumeShareLink?: (todo:number) => number
    /**
    * Change persistency settings for the YASQE query value. Setting the values
    * to null, will disable persistancy: nothing is stored between browser
    * sessions Setting the values to a string (or a function which returns a
    * string), will store the query in localstorage using the specified string.
    * By default, the ID is dynamically generated using the closest dom ID, to avoid collissions when using multiple YASQE items on one
    * page
    */
    sparql?: {
      queryName?: (yasqe:Yasqe) => string
      showQueryButton?: boolean,
      endpoint?:string
      requestMethod?: 'POST' | 'GET'
      acceptHeaderGraph?: string,
      acceptHeaderSelect?: string,
      acceptHeaderUpdate?: string,
      namedGraphs?: string[],
      defaultGraphs?: string[],
      args?: string[],
      headers?: {[key:string]:string}
      getQueryForAjax?: (todo:number) => number
      callbacks?: {
        beforeSend?: (todo:number) => number
        complete?: (todo:number) => number
        error?: (todo:number) => number
        success?: (todo:number) => number
      }
    }
    //Addon specific addon ts defs, or missing props from codemirror conf
    highlightSelectionMatches?: {showToken?: RegExp, annotateScrollbar?: boolean}
    tabMode?: string
    foldGutter?: {
      rangerFinder?: (todo:number) => number
    }
    matchBrackets?: boolean
  }

  //add missing static functions, added by e.g. addons
  // declare function runMode(text:string, mode:any, out:any):void
}
interface Yasqe extends CodeMirror.Editor {
  //add missing interface (e.g. from addons)
  //
}
class Yasqe  {
  private rootEl:HTMLDivElement
  public config:Yasqe.Config
  constructor(parent: HTMLElement, conf: Yasqe.Config = {}) {
    // super();
    if (!parent) throw new Error('No parent passed as argument. Dont know where to draw YASQE');
    this.rootEl = document.createElement('div');
    this.rootEl.className = 'yasqe';
    parent.appendChild(this.rootEl)
    this.config = merge({}, Yasqe.defaults, conf);

    //inherit codemirror props
    (<any>Object).assign(this, CodeMirror.prototype, CodeMirror(this.rootEl));

  }
  getQueryType() {
    return 'TODO'
  }
  getQueryMode():'update' | 'query' {
    switch (this.getQueryType()) {
      case "INSERT":
      case "DELETE":
      case "LOAD":
      case "CLEAR":
      case "CREATE":
      case "DROP":
      case "COPY":
      case "MOVE":
      case "ADD":
        return 'update';
      default:
        return 'query'
    }
  }

  // yasqe.autocompleters = require("./autocompleters/autocompleterBase.js")(root, yasqe);
  // if (yasqe.options.autocompleters) {
  //   yasqe.options.autocompleters.forEach(function(name) {
  //     if (root.Autocompleters[name]) yasqe.autocompleters.init(name, root.Autocompleters[name]);
  //   });
  // }
  emit(event:string, data?:any) {
    CodeMirror.signal(this, event, data)
  }
  // yasqe.lastQueryDuration = null;
  // getCompleteToken = function(token, cur) {
  //   return require("./tokenUtils.js").getCompleteToken(yasqe, token, cur);
  // };
  // yasqe.getPreviousNonWsToken = function(line, token) {
  //   return require("./tokenUtils.js").getPreviousNonWsToken(yasqe, line, token);
  // };
  // yasqe.getNextNonWsToken = function(lineNumber, charNumber) {
  //   return require("./tokenUtils.js").getNextNonWsToken(yasqe, lineNumber, charNumber);
  // };
  // yasqe.collapsePrefixes = function(collapse) {
  //   if (collapse === undefined) collapse = true;
  //   yasqe.foldCode(
  //     require("./prefixFold.js").findFirstPrefixLine(yasqe),
  //     root.fold.prefix,
  //     collapse ? "fold" : "unfold"
  //   );
  // };
  // yasqe.query = function(callbackOrConfig) {
  //   root.executeQuery(yasqe, callbackOrConfig);
  // };

  // yasqe.getUrlArguments = function(config) {
  //   return root.getUrlArguments(yasqe, config);
  // };

  // yasqe.getPrefixesFromQuery = function() {
  //   return require("./prefixUtils.js").getPrefixesFromQuery(yasqe);
  // };

  // yasqe.addPrefixes = function(prefixes) {
  //   return require("./prefixUtils.js").addPrefixes(yasqe, prefixes);
  // };
  // yasqe.removePrefixes = function(prefixes) {
  //   return require("./prefixUtils.js").removePrefixes(yasqe, prefixes);
  // };
  // yasqe.getVariablesFromQuery = function() {
  //   //Use precise here. We want to be sure we use the most up to date state. If we're
  //   //not, we might get outdated info from the current query (creating loops such
  //   //as https://github.com/OpenTriply/YASGUI/issues/84)
  //   //on caveat: this function won't work when query is invalid (i.e. when typing)
  //   return $.map(yasqe.getTokenAt({ line: yasqe.lastLine(), ch: yasqe.getLine(yasqe.lastLine()).length }, true).state.variables, function(val,key) {return key});
  // }
  //values in the form of {?var: 'value'}, or [{?var: 'value'}]
  // yasqe.getQueryWithValues = function(values) {
  //   if (!values) return yasqe.getValue();
  //   var injectString;
  //   if (typeof values === 'string') {
  //     injectString = values;
  //   } else {
  //     //start building inject string
  //     if (!Array.isArray(values)) values = [values];
  //     var variables = values.reduce(function(vars, valueObj) {
  //       for (var v in valueObj) {
  //         vars[v] = v;
  //       }
  //       return vars;
  //     }, {})
  //     var varArray = [];
  //     for (var v in variables) {
  //       varArray.push(v);
  //     }
  //
  //     if (!varArray.length) return yasqe.getValue() ;
  //     //ok, we've got enough info to start building the string now
  //     injectString = "VALUES (" + varArray.join(' ') + ") {\n";
  //     values.forEach(function(valueObj) {
  //       injectString += "( ";
  //       varArray.forEach(function(variable) {
  //         injectString += valueObj[variable] || "UNDEF"
  //       })
  //       injectString += " )\n"
  //     })
  //     injectString += "}\n"
  //   }
  //   if (!injectString) return yasqe.getValue();
  //
  //   var newQuery = ""
  //   var injected = false;
  //   var gotSelect = false;
  //   root.runMode(yasqe.getValue(), "sparql11", function(stringVal, className, row, col, state) {
  //     if (className === "keyword" && stringVal.toLowerCase() === 'select') gotSelect = true;
  //     newQuery += stringVal;
  //     if (gotSelect && !injected && className === "punc" && stringVal === "{") {
  //       injected = true;
  //       //start injecting
  //       newQuery += "\n" + injectString;
  //     }
  //   });
  //   return newQuery
  // }

  // getValueWithoutComments() {
  //   var cleanedQuery = "";
  //   CodeMirror.runMode(this.getValue(), "sparql11", function(stringVal, className) {
  //     if (className != "comment") {
  //       cleanedQuery += stringVal;
  //     }
  //   });
  //   return cleanedQuery;
  // };

  setCheckSyntaxErrors(isEnabled:boolean) {
    this.config.syntaxErrorCheck = isEnabled;
    // checkSyntax(this);
  };

  enableCompleter(name:string) {
    // addCompleterToSettings(yasqe.options, name);
    // if (root.Autocompleters[name]) yasqe.autocompleters.init(name, root.Autocompleters[name]);
  };
  disableCompleter(name:string) {
    // removeCompleterFromSettings(yasqe.options, name);
  };


  static fromTextArea() {
    //todo
  }
  static defaults:Yasqe.Config = defaults
}
export = Yasqe
