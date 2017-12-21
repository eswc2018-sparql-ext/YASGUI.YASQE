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
require("codemirror/addon/hint/show-hint.css");
require("./scss/codemirrorMods.scss");
require("./scss/yasqe.scss");
require("./scss/buttons.scss");
import * as superagent from "superagent";
import { default as prefixFold, findFirstPrefixLine } from "./prefixFold";
import { getPrefixesFromQuery, addPrefixes, removePrefixes, Prefixes } from "./prefixUtils";
import { getPreviousNonWsToken, getNextNonWsToken, getCompleteToken } from "./tokenUtils";
import * as sparql11Mode from "../grammar/tokenizer";
import YStorage from "yasgui-utils/build/Storage";
import * as queryString from "query-string";
import tooltip from "./tooltip";
import { drawSvgStringAsElement } from "yasgui-utils/build";
import * as Sparql from "./sparql";
CodeMirror.defineMode("sparql11", sparql11Mode.default);
import * as imgs from "./imgs";
import * as Autocompleter from "./autocompleters";
// export var
import { merge, escape } from "lodash";
// @ts-ignore
// var Yasqe = CodeMirror

interface Yasqe extends CodeMirror.Editor {
  getDoc: () => Yasqe.Doc;
  getTokenTypeAt: (pos: CodeMirror.Position) => string;
  foldCode: any;
  on(eventName: "request", handler: (instance: Yasqe, req: superagent.SuperAgentRequest) => void): void;
  off(eventName: "request", handler: (instance: Yasqe, req: superagent.SuperAgentRequest) => void): void;
  on(
    eventName: "response",
    handler: (instance: Yasqe, req: superagent.SuperAgentRequest, duration: number) => void
  ): void;
  off(
    eventName: "response",
    handler: (instance: Yasqe, req: superagent.SuperAgentRequest, duration: number) => void
  ): void;
  showHint: (conf: Yasqe.HintConfig) => void;
  on(eventName: "error", handler: (instance: Yasqe, err: any) => void): void;
  off(eventName: "error", handler: (instance: Yasqe, err: any) => void): void;
  on(eventName: "queryResults", handler: (instance: Yasqe, results: any) => void, duration: number): void;
  off(eventName: "queryResults", handler: (instance: Yasqe, results: any, duration: number) => void): void;
  on(eventName: string, handler: (instance: any) => void): void;
  off(eventName: string, handler: (instance: any) => void): void;
}

class Yasqe {
  private static storageNamespace = "triply";
  public autocompleters: { [name: string]: Autocompleter.Completer } = {};
  private prevQueryValid = false;
  public queryValid = true;
  public lastQueryDuration: number;
  public queryType: Yasqe.TokenizerState["queryType"];
  private req: superagent.SuperAgentRequest;
  private queryStatus: "valid" | "error";
  private queryBtn: HTMLDivElement;
  public rootEl: HTMLDivElement;
  public storage: YStorage;
  public config: Yasqe.Config;
  constructor(parent: HTMLElement, conf: Yasqe.Config = {}) {
    // super();
    if (!parent) throw new Error("No parent passed as argument. Dont know where to draw YASQE");
    this.rootEl = document.createElement("div");
    this.rootEl.className = "yasqe";
    parent.appendChild(this.rootEl);
    this.config = merge({}, Yasqe.defaults, conf);
    //inherit codemirror props
    (<any>Object).assign(CodeMirror.prototype, this);
    (<any>Object).assign(this, CodeMirror.prototype, CodeMirror(this.rootEl, this.config));

    //Do some post processing
    this.storage = new YStorage(Yasqe.storageNamespace);
    this.drawButtons();
    var storageId = this.getStorageId();
    if (storageId) {
      var valueFromStorage = this.storage.get<string>(storageId);
      if (valueFromStorage) this.setValue(valueFromStorage);
    }
    this.config.autocompleters.forEach(c => this.enableCompleter(c).then(() => {}, console.warn));

    if (this.config.consumeShareLink) {
      this.config.consumeShareLink(this);
      //and: add a hash listener!
      window.addEventListener("hashchange", () => {
        this.config.consumeShareLink(this);
      });
    }
    this.checkSyntax();
    /**
     * Register listeners
     */
    this.on("change", eventInfo => {
      this.checkSyntax();
      this.updateQueryButton();
      // root.positionButtons(yasqe);
    });
    this.on("blur", () => {
      this.saveQuery();
    });
    this.on("changes", () => {
      //e.g. on paste
      this.checkSyntax();
      this.updateQueryButton();
      // root.positionButtons(yasqe);
    });
    this.on("cursorActivity", () => {
      this.autocomplete(true);
    });

    this.on("request", (yasqe, req) => {
      this.req = req;
      this.updateQueryButton();
    });
    this.on("response", (yasqe, response, duration) => {
      this.lastQueryDuration = duration;
      this.req = null;
      this.updateQueryButton();
    });
  }
  getQueryType() {
    return this.queryType;
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
  private notificationEls: { [key: string]: HTMLDivElement } = {};
  showNotification(key: string, message: string) {
    if (!this.notificationEls[key]) {
      this.notificationEls[key] = document.createElement("div");
      this.notificationEls[key].className = "notification " + " notif_" + key;
      this.getWrapperElement().appendChild(this.notificationEls[key]);
    }
    const el = this.notificationEls[key];
    el.style.display = "block";
    el.innerText = message;
  }
  hideNotification(key: string) {
    if (this.notificationEls[key]) {
      this.notificationEls[key].style.display = "none";
    }
  }
  static Autocompleters: { [name: string]: Autocompleter.CompleterConfig } = {};
  static registerAutocompleter(value: Autocompleter.CompleterConfig, enable = true) {
    const name = value.name;
    Yasqe.Autocompleters[name] = value;
    if (enable && Yasqe.defaults.autocompleters.indexOf(name) < 0) Yasqe.defaults.autocompleters.push(name);
  }

  static forkAutocompleter(fromCompleter: string, newCompleter: Autocompleter.CompleterConfig, enable = true) {
    if (!Yasqe.Autocompleters[fromCompleter]) throw new Error('Autocompleter ' + fromCompleter + ' does not exist')
    if (Yasqe.Autocompleters[newCompleter.name]) throw new Error('Completer ' + newCompleter.name + ' already exists');

    const name = newCompleter.name;
    Yasqe.Autocompleters[name] = {...Yasqe.Autocompleters[fromCompleter], ...newCompleter};
    if (enable && Yasqe.defaults.autocompleters.indexOf(name) < 0) Yasqe.defaults.autocompleters.push(name);
  }

  enableCompleter(name: string): Promise<void> {
    if (!Yasqe.Autocompleters[name])
      return Promise.reject(new Error("Autocompleter " + name + " is not a registered autocompleter"));
    if (this.config.autocompleters.indexOf(name) < 0) this.config.autocompleters.push(name);
    this.autocompleters[name] = new Autocompleter.Completer(this, Yasqe.Autocompleters[name]);
    return this.autocompleters[name].initialize();
  }
  disableCompleter(name: string) {
    this.config.autocompleters = this.config.autocompleters.filter(a => a !== name);
    this.autocompleters[name] = undefined;
  }
  autocomplete(fromAutoShow = false) {
    if (this.getDoc().somethingSelected()) return;

    for (let i in this.config.autocompleters) {
      const completerName = this.config.autocompleters[i];
      if (!this.autocompleters[completerName] || !this.autocompleters[completerName].autocomplete(fromAutoShow))
        continue;
    }
  }
  emit(event: string, ...data: any[]) {
    CodeMirror.signal(this, event, this, ...data);
  }
  getCompleteToken(token?: Yasqe.Token, cur?: Yasqe.Position) {
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
  query(config?: Sparql.YasqeAjaxConfig) {
    return Sparql.executeQuery(this, config);
  }

  getPrefixesFromQuery() {
    return getPrefixesFromQuery(this);
  }
  addPrefixes(prefixes: string | Prefixes) {
    return addPrefixes(this, prefixes);
  }
  removePrefixes(prefixes: Prefixes) {
    return removePrefixes(this, prefixes);
  }
  getVariablesFromQuery() {
    //Use precise here. We want to be sure we use the most up to date state. If we're
    //not, we might get outdated info from the current query (creating loops such
    //as https://github.com/OpenTriply/YASGUI/issues/84)
    //on caveat: this function won't work when query is invalid (i.e. when typing)
    const token: Yasqe.Token = this.getTokenAt(
      { line: this.getDoc().lastLine(), ch: this.getDoc().getLine(this.getDoc().lastLine()).length },
      true
    );
    const vars: string[] = [];
    for (var v in token.state.variables) {
      vars.push(v);
    }
    return vars.sort();
  }
  //values in the form of {?var: 'value'}, or [{?var: 'value'}]
  getQueryWithValues(values: string | { [varName: string]: string } | Array<{ [varName: string]: string }>) {
    if (!values) return this.getValue();
    var injectString: string;
    if (typeof values === "string") {
      injectString = values;
    } else {
      //start building inject string
      if (!(values instanceof Array)) values = [values];
      var variables = values.reduce(function(vars, valueObj) {
        for (var v in valueObj) {
          vars[v] = v;
        }
        return vars;
      }, {});
      var varArray: string[] = [];
      for (var v in variables) {
        varArray.push(v);
      }

      if (!varArray.length) return this.getValue();
      //ok, we've got enough info to start building the string now
      injectString = "VALUES (" + varArray.join(" ") + ") {\n";
      values.forEach(function(valueObj) {
        injectString += "( ";
        varArray.forEach(function(variable) {
          injectString += valueObj[variable] || "UNDEF";
        });
        injectString += " )\n";
      });
      injectString += "}\n";
    }
    if (!injectString) return this.getValue();

    var newQuery = "";
    var injected = false;
    var gotSelect = false;
    (<any>Yasqe).runMode(this.getValue(), "sparql11", function(
      stringVal: string,
      className: string,
      row: number,
      col: number,
      state: Yasqe.TokenizerState
    ) {
      if (className === "keyword" && stringVal.toLowerCase() === "select") gotSelect = true;
      newQuery += stringVal;
      if (gotSelect && !injected && className === "punc" && stringVal === "{") {
        injected = true;
        //start injecting
        newQuery += "\n" + injectString;
      }
    });
    return newQuery;
  }

  getValueWithoutComments() {
    var cleanedQuery = "";
    (<any>Yasqe).runMode(this.getValue(), "sparql11", function(stringVal: string, className: string) {
      if (className != "comment") {
        cleanedQuery += stringVal;
      }
    });
    return cleanedQuery;
  }

  setCheckSyntaxErrors(isEnabled: boolean) {
    this.config.syntaxErrorCheck = isEnabled;
    this.checkSyntax();
  }
  checkSyntax() {
    this.queryValid = true;

    this.clearGutter("gutterErrorBar");

    var state: Yasqe.TokenizerState = null;
    for (var l = 0; l < this.getDoc().lineCount(); ++l) {
      var precise = false;
      if (!this.prevQueryValid) {
        // we don't want cached information in this case, otherwise the
        // previous error sign might still show up,
        // even though the syntax error might be gone already
        precise = true;
      }

      var token: Yasqe.Token = this.getTokenAt(
        {
          line: l,
          ch: this.getDoc().getLine(l).length
        },
        precise
      );
      var state = token.state;
      this.queryType = state.queryType;
      if (state.OK == false) {
        if (!this.config.syntaxErrorCheck) {
          //the library we use already marks everything as being an error. Overwrite this class attribute.
          const els = this.getWrapperElement().querySelectorAll(".sp-error");
          for (let i = 0; i < els.length; i++) {
            var el: any = els[i];
            if (el.style) el.style.color = "black";
          }
          //we don't want the gutter error, so return
          return;
        }
        const warningEl = drawSvgStringAsElement(imgs.warning);
        if (state.errorMsg) {
          tooltip(this, warningEl, escape(token.state.errorMsg));
        } else if (state.possibleCurrent && state.possibleCurrent.length > 0) {
          var expectedEncoded: string[] = [];
          state.possibleCurrent.forEach(function(expected) {
            expectedEncoded.push("<strong style='text-decoration:underline'>" + escape(expected) + "</strong>");
          });
          tooltip(this, warningEl, "This line is invalid. Expected: " + expectedEncoded.join(", "));
        }
        // warningEl.style.marginTop = "2px";
        // warningEl.style.marginLeft = "2px";
        warningEl.className = "parseErrorIcon";
        this.setGutterMarker(l, "gutterErrorBar", warningEl);

        this.queryValid = false;
        break;
      }
    }
  }

  public getStorageId(getter?: Yasqe.Config["persistenceId"]) {
    const persistenceId = getter || this.config.persistenceId;
    if (!persistenceId) return undefined;
    if (typeof persistenceId === "string") return persistenceId;
    return persistenceId(this);
  }

  private autoformatSelection(start: number, end: number): string {
    var text = this.getValue();
    text = text.substring(start, end);
    var breakAfterArray = [
      ["keyword", "ws", "prefixed", "ws", "uri"], // i.e. prefix declaration
      ["keyword", "ws", "uri"] // i.e. base
    ];
    var breakAfterCharacters = ["{", ".", ";"];
    var breakBeforeCharacters = ["}"];

    var getBreakType = function(stringVal: string, type: string) {
      for (var i = 0; i < breakAfterArray.length; i++) {
        if (stackTrace.valueOf().toString() == breakAfterArray[i].valueOf().toString()) {
          return 1;
        }
      }
      for (var i = 0; i < breakAfterCharacters.length; i++) {
        if (stringVal == breakAfterCharacters[i]) {
          return 1;
        }
      }
      for (var i = 0; i < breakBeforeCharacters.length; i++) {
        // don't want to issue 'breakbefore' AND 'breakafter', so check
        // current line
        if (currentLine.trim() !== "" && stringVal == breakBeforeCharacters[i]) {
          return -1;
        }
      }
      return 0;
    };
    var formattedQuery = "";
    var currentLine = "";
    var stackTrace: string[] = [];
    (<any>Yasqe).runMode(text, "sparql11", function(stringVal: string, type: string) {
      stackTrace.push(type);
      var breakType = getBreakType(stringVal, type);
      if (breakType != 0) {
        if (breakType == 1) {
          formattedQuery += stringVal + "\n";
          currentLine = "";
        } else {
          // (-1)
          formattedQuery += "\n" + stringVal;
          currentLine = stringVal;
        }
        stackTrace = [];
      } else {
        currentLine += stringVal;
        formattedQuery += stringVal;
      }
      if (stackTrace.length == 1 && stackTrace[0] == "sp-ws") stackTrace = [];
    });
    return formattedQuery.replace(/\n\s*\n/g, "\n").trim();
  }
  public autoformat() {
    if (!this.getDoc().somethingSelected()) this.execCommand("selectAll");
    const from = this.getDoc().getCursor("start");

    var to: Yasqe.Position = {
      line: this.getDoc().getCursor("end").line,
      ch: this.getDoc().getSelection().length
    };
    var absStart = this.getDoc().indexFromPos(from);
    var absEnd = this.getDoc().indexFromPos(to);
    // Insert additional line breaks where necessary according to the
    // mode's syntax

    const res = this.autoformatSelection(absStart, absEnd);

    // Replace and auto-indent the range
    this.operation(() => {
      this.getDoc().replaceRange(res, from, to);
      var startLine = this.getDoc().posFromIndex(absStart).line;
      var endLine = this.getDoc().posFromIndex(absStart + res.length).line;
      for (var i = startLine; i <= endLine; i++) {
        this.indentLine(i, "smart");
      }
    });
  }
  public getUrlParams() {
    //first try hash
    var urlParams: { [key: string]: string } = null;
    if (window.location.hash.length > 1) {
      //firefox does some decoding if we're using window.location.hash (e.g. the + sign in contentType settings)
      //Don't want this. So simply get the hash string ourselves
      urlParams = queryString.parse(location.href.split("#")[1]);
    }
    if ((!urlParams || !("query" in urlParams)) && window.location.search.length > 1) {
      //ok, then just try regular url params
      urlParams = queryString.parse(window.location.search.substring(1));
    }
    return urlParams;
  }
  configToQueryParams() {
    //extend existing link, so first fetch current arguments
    var urlParams: { [key: string]: string } = {};
    if (window.location.hash.length > 1) urlParams = queryString.parse(window.location.hash);
    urlParams["query"] = this.getValue();
    return urlParams;
  }
  queryParamsToConfig(params: { [key: string]: string }) {
    if (params && params.query) {
      this.setValue(params.query);
    }
  }

  getAsCurlString(config?: Sparql.YasqeAjaxConfig) {
    return Sparql.getAsCurlString(this, config);
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
        buttons.appendChild(popup);
        document.body.addEventListener(
          "click",
          event => {
            if (popup && event.target !== popup && !popup.contains(<any>event.target)) {
              popup.remove();
              popup = undefined;
            }
          },
          true
        );
        var input = document.createElement("input");
        input.type = "text";
        input.value = this.config.createShareLink(this);

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
          popup.appendChild(shortBtn);
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
        curlBtn.innerText = "CURL";
        curlBtn.className = "yasqe_btn yasqe_btn-sm curl";
        popup.appendChild(curlBtn);
        curlBtn.onclick = () => {
          curlBtn.disabled = true;

          input.value = this.getAsCurlString();
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
    toggleFullscreenBtn.onclick = () => this.setFullscreen(true);
    toggleFullscreen.appendChild(toggleFullscreenBtn);

    const toggleSmallScreenBtn = drawSvgStringAsElement(imgs.smallscreen);
    toggleSmallScreenBtn.className = "yasqe_smallscreenBtn";
    toggleSmallScreenBtn.title = "Set editor normal size";
    toggleSmallScreenBtn.onclick = () => this.setFullscreen(false);
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
      queryEl.className = queryEl.className + " queryIcon";
      this.queryBtn.appendChild(queryEl);

      const warningIcon = drawSvgStringAsElement(imgs.warning);
      warningIcon.className = warningIcon.className + " warningIcon";
      this.queryBtn.appendChild(warningIcon);

      this.queryBtn.onclick = () => {
        if (this.req) {
          this.req.abort();
          this.updateQueryButton();
        } else {
          this.query();
        }
      };
      buttons.appendChild(this.queryBtn);
      this.updateQueryButton();
    }
  }
  setFullscreen(fullscreen = true) {
    if (fullscreen) {
      this.setOption("fullScreen", true);
      this.emit("fullscreen-enter");
    } else {
      this.setOption("fullScreen", false);
      this.emit("fullscreen-leave");
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
      this.queryBtn.className = this.queryBtn.className + " query_" + status;
      this.queryStatus = status;
    }

    /**
     * Set/remove spinner if needed
     */
    if (this.req && this.queryBtn.className.indexOf("busy") < 0) {
      this.queryBtn.className = this.queryBtn.className += " busy";
    } else {
      this.queryBtn.className = this.queryBtn.className.replace("busy", "");
    }
  }
  handleLocalStorageQuotaFull(e: any) {
    console.warn("Localstorage quota exceeded. Clearing all queries");
    Yasqe.clearStorage();
  }
  static runMode = (<any>CodeMirror).runMode
  saveQuery() {
    this.storage.set(
      this.getStorageId(),
      this.getValue(),
      this.config.persistencyExpire,
      this.handleLocalStorageQuotaFull
    );
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

  export interface HintList {
    list: Hint[];
    from: Yasqe.Position;
    to: Yasqe.Position;
  }
  export interface Hint {
    text: string;
    displayText?: string;
    className?: string;
    render?: (el: HTMLElement, self: Hint, data: any) => void;
    from?: Yasqe.Position;
    to?: Yasqe.Position;
  }
  export type HintFn = { async?: boolean } & (() => Promise<HintList> | HintList);
  export interface HintConfig {
    completeOnSingleClick?: boolean;
    container?: HTMLElement;
    closeCharacters?: RegExp;
    completeSingle?: boolean;
    // A hinting function, as specified above. It is possible to set the async property on a hinting function to true, in which case it will be called with arguments (cm, callback, ?options), and the completion interface will only be popped up when the hinting function calls the callback, passing it the object holding the completions. The hinting function can also return a promise, and the completion interface will only be popped when the promise resolves. By default, hinting only works when there is no selection. You can give a hinting function a supportsSelection property with a truthy value to indicate that it supports selections.
    hint: HintFn;

    // Whether the pop-up should be horizontally aligned with the start of the word (true, default), or with the cursor (false).
    alignWithWord?: boolean;
    // When enabled (which is the default), the pop-up will close when the editor is unfocused.
    closeOnUnfocus?: boolean;
    // Allows you to provide a custom key map of keys to be active when the pop-up is active. The handlers will be called with an extra argument, a handle to the completion menu, which has moveFocus(n), setFocus(n), pick(), and close() methods (see the source for details), that can be used to change the focused element, pick the current element or close the menu. Additionally menuSize() can give you access to the size of the current dropdown menu, length give you the number of available completions, and data give you full access to the completion returned by the hinting function.
    customKeys?: any;

    // Like customKeys above, but the bindings will be added to the set of default bindings, instead of replacing them.
    extraKeys?: any;
  }
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
    consumeShareLink?: (yasqe: Yasqe) => void;
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
      endpoint?: string | ((yasqe: Yasqe) => string);
      requestMethod?: "POST" | "GET";
      acceptHeaderGraph?: string | ((yasqe: Yasqe) => string);
      acceptHeaderSelect?: string | ((yasqe: Yasqe) => string);
      acceptHeaderUpdate?: string | ((yasqe: Yasqe) => string);
      namedGraphs?: string[];
      defaultGraphs?: string[];
      args?: string[];
      headers?: { [key: string]: string };
      getQueryForAjax?: (yasqe: Yasqe) => string;
      withCredentials?: boolean;
    };
    //Addon specific addon ts defs, or missing props from codemirror conf
    highlightSelectionMatches?: { showToken?: RegExp; annotateScrollbar?: boolean };
    tabMode?: string;
    foldGutter?: {
      rangeFinder?: any;
    };
    matchBrackets?: boolean;
    autocompleters?: string[];
  }

  //add missing static functions, added by e.g. addons
  // declare function runMode(text:string, mode:any, out:any):void
}
//Need to assign our prototype to codemirror's, as some of the callbacks (e.g. the keymap opts)
//give us a cm doc, instead of a yasqe + cm doc
Autocompleter.completers.forEach(c => {
  Yasqe.registerAutocompleter(c);
});
(<any>Object).assign(CodeMirror.prototype, Yasqe.prototype);
export = Yasqe;
