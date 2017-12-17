import * as CodeMirror from "codemirror";
require("codemirror/addon/fold/foldcode.js");
require("codemirror/addon/fold/foldgutter.js");
require("codemirror/addon/fold/xml-fold.js");
require("codemirror/addon/fold/brace-fold.js");
require("codemirror/addon/hint/show-hint.js");
require("codemirror/addon/search/searchcursor.js");
require("codemirror/addon/edit/matchbrackets.js");
require("codemirror/addon/runmode/runmode.js");
require("codemirror/addon/display/fullscreen.js");

require("codemirror/lib/codemirror.css");
require("codemirror/addon/fold/foldgutter.css");
require("codemirror/addon/display/fullscreen.css");
require("./scss/codemirrorMods.scss");
require("./scss/buttons.scss");

import { default as prefixFold, findFirstPrefixLine } from "./prefixFold";
import { getPrefixesFromQuery } from "./prefixUtils";
import { getPreviousNonWsToken, getNextNonWsToken, getCompleteToken } from "./tokenUtils";
import * as sparql11Mode from "../grammar/tokenizer";
import YStorage from "yasgui-utils/build/Storage";
import { drawSvgStringAsElement } from "yasgui-utils/build";
CodeMirror.defineMode("sparql11", sparql11Mode.default);
import * as imgs from "./imgs";
// export var
import { merge } from "lodash";
// @ts-ignore
// var Yasqe = CodeMirror
interface Yasqe extends CodeMirror.Editor {
  getDoc: () => Yasqe.Doc;
  getTokenTypeAt: (pos: CodeMirror.Position) => string;
  foldCode: any;
}
// var Yasqe = CodeMirror
class Yasqe {
  private static storageNamespace = "triply";
  public queryValid = true;
  private isQuerying = false;
  private queryStatus: "valid" | "error" ;
  private queryBtn: HTMLDivElement;
  public rootEl: HTMLDivElement;
  private storage: YStorage;
  public config: Yasqe.Config;
  constructor(parent: HTMLElement, conf: Yasqe.Config = {}) {
    // super();
    if (!parent) throw new Error("No parent passed as argument. Dont know where to draw YASQE");
    this.rootEl = document.createElement("div");
    this.rootEl.className = "yasqe";
    parent.appendChild(this.rootEl);
    this.config = merge({}, Yasqe.defaults, conf);
    //inherit codemirror props
    (<any>Object).assign(this, CodeMirror.prototype, CodeMirror(this.rootEl, this.config));
    this.storage = new YStorage(Yasqe.storageNamespace);
    this.drawButtons();
  }
  getQueryType() {
    return "TODO";
  }
  getQueryMode(): "update" | "query" {
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
        return "update";
      default:
        return "query";
    }
  }

  // yasqe.autocompleters = require("./autocompleters/autocompleterBase.js")(root, yasqe);
  // if (yasqe.options.autocompleters) {
  //   yasqe.options.autocompleters.forEach(function(name) {
  //     if (root.Autocompleters[name]) yasqe.autocompleters.init(name, root.Autocompleters[name]);
  //   });
  // }
  emit(event: string, data?: any) {
    CodeMirror.signal(this, event, data);
  }
  // yasqe.lastQueryDuration = null;
  getCompleteToken(token: Yasqe.Token, cur: Yasqe.Position) {
    return getCompleteToken(this, token, cur);
  }
  getPreviousNonWsToken(line: number, token: Yasqe.Token) {
    return getPreviousNonWsToken(this, line, token);
  }
  getNextNonWsToken(lineNumber: number, charNumber?: number) {
    return getNextNonWsToken(this, lineNumber, charNumber);
  }
  collapsePrefixes(collapse = true) {
    this.foldCode(findFirstPrefixLine(this), (<any>CodeMirror).fold.prefix, collapse ? "fold" : "unfold");
  }
  // yasqe.query = function(callbackOrConfig) {
  //   root.executeQuery(yasqe, callbackOrConfig);
  // };

  // yasqe.getUrlArguments = function(config) {
  //   return root.getUrlArguments(yasqe, config);
  // };

  getPrefixesFromQuery() {
    return getPrefixesFromQuery(this);
  }

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

  setCheckSyntaxErrors(isEnabled: boolean) {
    this.config.syntaxErrorCheck = isEnabled;
    // checkSyntax(this);
  }

  enableCompleter(name: string) {
    // addCompleterToSettings(yasqe.options, name);
    // if (root.Autocompleters[name]) yasqe.autocompleters.init(name, root.Autocompleters[name]);
  }
  disableCompleter(name: string) {
    // removeCompleterFromSettings(yasqe.options, name);
  }
  private getStorageId() {
    if (typeof this.config.persistenceId === "string") return this.config.persistenceId;
    return this.config.persistenceId(this);
  }
  drawButtons() {
    const buttons = document.createElement("div");
    buttons.className = "yasqe_buttons";
    this.getWrapperElement().appendChild(buttons);

    /**
     * draw share link button
     */
    if (this.config.createShareLink) {
      var svgShare = drawSvgStringAsElement(imgs.share);
      svgShare.className = "yasqe_share";
      svgShare.title = "Share your query";
      buttons.appendChild(svgShare);
      svgShare.onclick = (event: MouseEvent) => {
        event.stopPropagation();
        var popup = document.createElement("div");
        popup.className = "yasqe_sharePopup";
        popup.onclick = function(event) {
          event.stopPropagation();
        };
        buttons.appendChild(popup);
        document.body.addEventListener(
          "click",
          () => {
            if (popup) {
              // popup.remove();
              // popup = undefined;
            }
          },
          true
        );
        var input = document.createElement("input");
        input.type = "text";
        input.value =
          document.location.protocol +
          "//" +
          document.location.host +
          document.location.pathname +
          document.location.search +
          "#";
        console.log("TODO: create actual share link");
        // $.param(yasqe.options.createShareLink(yasqe))

        input.onfocus = function() {
          input.select();
        };
        // Work around Chrome's little problem
        input.onmouseup = function() {
          // $this.unbind("mouseup");
          return false;
        };
        popup.innerHTML = "";

        var inputWrapper = document.createElement("div");
        inputWrapper.className = "inputWrapper";

        inputWrapper.appendChild(input);

        popup.appendChild(inputWrapper);

        if (this.config.createShortLink) {
          popup.className = popup.className += " enableShort";
          const shortBtn = document.createElement("button");
          shortBtn.innerHTML = "Shorten";
          shortBtn.className = "yasqe_btn yasqe_btn-sm shorten";
          shortBtn.onclick = () => {
            shortBtn.disabled = true;
            this.config.createShortLink(this, input.value).then(
              value => {
                input.value = value;
                input.focus();
              },
              err => {
                input.remove();
                const errSpan = document.createElement("span");
                errSpan.className = "shortlinkErr";
                errSpan.textContent = err.message;
              }
            );
          };
        }

        const curlBtn = document.createElement("button");
        curlBtn.className = "yasqe_btn yasqe_btn-sm curl";
        curlBtn.onclick = () => {
          curlBtn.disabled = true;

          // input.value = this.getAsCurl();
          input.value = "TODO getAsCurl";
          input.focus();
          popup.appendChild(curlBtn);
        };

        const svgPos = svgShare.getBoundingClientRect();
        popup.style.top = svgShare.offsetTop + svgPos.height + "px";
        popup.style.left = svgShare.offsetLeft + svgShare.clientWidth - popup.clientWidth + "px";
        input.focus();
      };
    }

    /**
     * draw fullscreen button
     */
    const toggleFullscreen = document.createElement("div");
    toggleFullscreen.className = "fullscreenToggleBtns";

    const toggleFullscreenBtn = drawSvgStringAsElement(imgs.fullscreen);
    toggleFullscreenBtn.className = "yasqe_fullscreenBtn";
    toggleFullscreenBtn.title = "Set editor full screen";
    toggleFullscreenBtn.onclick = () => {
      this.setOption("fullScreen", true);
      this.emit("fullscreen-enter");
    };
    toggleFullscreen.appendChild(toggleFullscreenBtn);

    const toggleSmallScreenBtn = drawSvgStringAsElement(imgs.smallscreen);
    toggleSmallScreenBtn.className = "yasqe_smallscreenBtn";
    toggleSmallScreenBtn.title = "Set editor normal size";
    toggleSmallScreenBtn.onclick = () => {
      this.setOption("fullScreen", false);
      this.emit("fullscreen-leave");
    };
    toggleFullscreen.appendChild(toggleSmallScreenBtn);
    buttons.appendChild(toggleFullscreen);

    /**
     * Draw query btn
     */
    if (this.config.sparql.showQueryButton) {
      this.queryBtn = document.createElement("div");
      this.queryBtn.className = "yasqe_queryButton";

      /**
       * Add busy/valid/error btns
       */
       const queryEl = drawSvgStringAsElement(imgs.query);
       queryEl.className = queryEl.className + ' queryIcon';
       this.queryBtn.appendChild(queryEl);

       //todo: add warning icon
       const warningIcon = drawSvgStringAsElement(imgs.warning);
       warningIcon.className = warningIcon.className + ' warningIcon';
       this.queryBtn.appendChild(warningIcon);

       // const loaderEl = drawSvgStringAsElement(imgs.query);
       // loaderEl.className = loaderEl.className + ' loadingIcon';
       // this.queryBtn.appendChild(loaderEl);


      this.queryBtn.onclick = () => {
        console.warn("TODO: check whether query is busy, and abort request");
        const isBusy = false;
        console.warn("TODO: implement query func");
        if (isBusy) {
          //abort
          this.updateQueryButton();
        }
        // this.query();
      };
      buttons.appendChild(this.queryBtn);
      this.updateQueryButton();
    }
  }
  updateQueryButton(status?: "valid" | "error") {
    if (!this.queryBtn) return;

    /**
     * Set query status (valid vs invalid)
     */
    if (!status) {
      status = this.queryValid ? "valid" : "error";
    }
    if (status != this.queryStatus) {
      //reset query status classnames
      this.queryBtn.className = this.queryBtn.className
        .split(" ")
        .filter(function(c) {
          //remove classname from previous status
          return c.indexOf("query_") !== 0;
        })
        .join(" ");
      this.queryBtn.className = this.queryBtn.className + ' query_' + status
      this.queryStatus = status;
    }

    /**
     * Set/remove spinner if needed
     */
   if (this.isQuerying && this.queryBtn.className.indexOf('busy') < 0) {
     this.queryBtn.className = this.queryBtn.className += ' busy'
   } else {
     this.queryBtn.className = this.queryBtn.className.replace('busy', '');
   }

  }
  store() {
    // var storageId = utils.getPersistencyId(yasqe, yasqe.options.persistent);
    // if (storageId) {
    //   yutils.storage.set(storageId, yasqe.getValue(), "month", yasqe.options.onQuotaExceeded);
    // }
    this.storage.set(this.getStorageId(), this.getValue(), this.config.persistencyExpire, e => {
      console.warn("Localstorage quota exceeded. Clearing all queries");
      Yasqe.clearStorage();
    });
  }
  static clearStorage() {
    const storage = new YStorage(Yasqe.storageNamespace);
    storage.removeNamespace();
  }
}

CodeMirror.registerHelper("fold", "prefix", prefixFold);
import getDefaults from "./defaults";
namespace Yasqe {
  export interface Doc extends CodeMirror.Doc {}
  export interface Token extends CodeMirror.Token {
    state: sparql11Mode.State;
  }
  //copy the fold we registered registered
  // export var fold:any = (<any>CodeMirror).fold
  export var defaults: Yasqe.Config = getDefaults(Yasqe);
  export type TokenizerState = sparql11Mode.State;
  export type Position = CodeMirror.Position;
  export interface Config extends CodeMirror.EditorConfiguration {
    mode?: string;
    collapsePrefixesOnLoad?: boolean;
    syntaxErrorCheck?: boolean;
    /**
     * Show a button with which users can create a link to this query. Set this value to null to disable this functionality.
     * By default, this feature is enabled, and the only the query value is appended to the link.
     * ps. This function should return an object which is parseable by jQuery.param (http://api.jquery.com/jQuery.param/)
     */
    createShareLink?: (yasqe: Yasqe) => string;
    createShortLink?: (yasqe: Yasqe, longLink: string) => Promise<string>;
    consumeShareLink?: (todo: number) => number;
    /**
     * Change persistency settings for the YASQE query value. Setting the values
     * to null, will disable persistancy: nothing is stored between browser
     * sessions Setting the values to a string (or a function which returns a
     * string), will store the query in localstorage using the specified string.
     * By default, the ID is dynamically generated using the closest dom ID, to avoid collissions when using multiple YASQE items on one
     * page
     */
    persistenceId?: ((yasqe: Yasqe) => string) | string;
    persistencyExpire?: number; //seconds
    sparql?: {
      queryName?: (yasqe: Yasqe) => string;
      showQueryButton?: boolean;
      endpoint?: string;
      requestMethod?: "POST" | "GET";
      acceptHeaderGraph?: string;
      acceptHeaderSelect?: string;
      acceptHeaderUpdate?: string;
      namedGraphs?: string[];
      defaultGraphs?: string[];
      args?: string[];
      headers?: { [key: string]: string };
      getQueryForAjax?: (todo: number) => number;
      callbacks?: {
        beforeSend?: (todo: number) => number;
        complete?: (todo: number) => number;
        error?: (todo: number) => number;
        success?: (todo: number) => number;
      };
    };
    //Addon specific addon ts defs, or missing props from codemirror conf
    highlightSelectionMatches?: { showToken?: RegExp; annotateScrollbar?: boolean };
    tabMode?: string;
    foldGutter?: {
      rangeFinder?: any;
    };
    matchBrackets?: boolean;
  }

  //add missing static functions, added by e.g. addons
  // declare function runMode(text:string, mode:any, out:any):void
}

export = Yasqe;
