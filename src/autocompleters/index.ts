import * as Yasqe from "../";
import Trie from "../trie";
import { EventEmitter } from "events";
import * as superagent from 'superagent'
export class CompleterConfig {
  onInitialize?: (yasqe:Yasqe.Instance) => void;//allows for e.g. registering event listeners in yasqe, like the prefix autocompleter does
  isValidCompletionPosition: (yasqe: Yasqe.Instance) => boolean;
  get: (yasqe: Yasqe.Instance, token?: Yasqe.Token) => Promise<string[]> | string[];
  preProcessToken?: (yasqe: Yasqe.Instance, token: Yasqe.Token) => AutocompletionToken;
  postProcessSuggestion?: (yasqe: Yasqe.Instance, token: AutocompletionToken, suggestedString: string) => string;
  async: boolean;
  bulk: boolean;
  autoShow?: boolean;
  persistenceId?: Yasqe.Config["persistenceId"];
  name: string;
}

export interface AutocompletionToken extends Yasqe.Token {
  autocompletionString?: string;
  tokenPrefix?:string,
  tokenPrefixUri?:string
  from?:Partial<Yasqe.Position>
}
export class Completer extends EventEmitter {
  protected yasqe: Yasqe.Instance;
  private trie: Trie;
  private config: CompleterConfig;
  constructor(yasqe: Yasqe.Instance, config: CompleterConfig) {
    super();
    this.yasqe = yasqe;
    this.config = config;
  }

  // private selectHint(data:EditorChange, completion:any) {
  //   if (completion.text != this.yasqe.getTokenAt(this.yasqe.getDoc().getCursor()).string) {
  //     this.yasqe.getDoc().replaceRange(completion.text, data.from, data.to);
  //   }
  // };
  private getStorageId() {
    return this.yasqe.getStorageId(this.config.persistenceId);
  }

  /**
   * Store bulk completion in local storage, and populates the trie
   */
  private storeBulkCompletions(completions: string[]) {
    if (!completions || !(completions instanceof Array)) return;
    // store array as trie
    this.trie = new Trie();
    completions.forEach(c => this.trie.insert(c));

    // store in localstorage as well
    var storageId = this.getStorageId();
    if (storageId)
      this.yasqe.storage.set(storageId, completions, 60 * 60 * 24 * 30, this.yasqe.handleLocalStorageQuotaFull);
  }

  /**
   * Get completion list from `get` function
   */
  public getCompletions(token?: AutocompletionToken): Promise<string[]> {
    if (!this.config.get) return Promise.resolve([]);

    //No token, so probably getting as bulk
    if (!token) {
      if (this.config.get instanceof Array) return Promise.resolve(this.config.get);
      //wrapping call in a promise.resolve, so this when a `get` is both async or sync
      return Promise.resolve(this.config.get(this.yasqe)).then(suggestions => {
      if (suggestions instanceof Array) return suggestions;
      return [];
    });
    }

    //ok, there is a token
    const stringToAutocomplete = token.autocompletionString || token.string;
    if (this.trie) return Promise.resolve(this.trie.autoComplete(stringToAutocomplete));
    if (this.config.get instanceof Array)
      return Promise.resolve(
        this.config.get.filter(possibleMatch => possibleMatch.indexOf(stringToAutocomplete) === 0)
      );
    //assuming it's a function
    return Promise.resolve(this.config.get(this.yasqe, token)).then(r => {
    if (r instanceof Array) return r;
    return []
  });
  }

  /**
   * Populates completions. Pre-fetches those if bulk is set to true
   */
  public initialize(): Promise<void> {
    if (this.config.onInitialize) this.config.onInitialize(this.yasqe)
    if (this.config.bulk) {
      if (this.config.get instanceof Array) {
        // we don't care whether the completions are already stored in
        // localstorage. just use this one
        this.storeBulkCompletions(this.config.get);
        return Promise.resolve();
      } else {
        // if completions are defined in localstorage, use those! (calling the
        // function may come with overhead (e.g. async calls))
        var completionsFromStorage: string[];
        var storageId = this.getStorageId();
        if (storageId) completionsFromStorage = this.yasqe.storage.get<string[]>(storageId);
        if (completionsFromStorage && completionsFromStorage.length > 0) {
          this.storeBulkCompletions(completionsFromStorage);
          return Promise.resolve();
        } else {
          return this.getCompletions().then(this.storeBulkCompletions);
        }
      }
    }
    return Promise.resolve();
  }

  private isValidPosition(): boolean {
    if (!this.config.isValidCompletionPosition) return false; //no way to check whether we are in a valid position
    if (!this.config.isValidCompletionPosition(this.yasqe)) {
      this.emit("invalidPosition", this);
      this.yasqe.hideNotification(this.config.name)
      return false;
    }
    if (!this.config.autoShow) {
      this.yasqe.showNotification(this.config.name, 'Press CTRL - <spacebar> to autocomplete')
    }
    this.emit("validPosition", this);
    return true;
  }

  private getHint(autocompletionToken: AutocompletionToken, suggestedString: string): Yasqe.Hint {
    if (this.config.postProcessSuggestion) {
      suggestedString = this.config.postProcessSuggestion(this.yasqe, autocompletionToken, suggestedString);
    }
    var from:Yasqe.Position
    if (autocompletionToken.from) {
      const cur = this.yasqe.getDoc().getCursor();
      from = {...cur, ...autocompletionToken.from}
    }
    return {
      text: suggestedString,
      displayText: suggestedString,
      from: from
    };
  }

  private getHints(token: AutocompletionToken): Promise<Yasqe.Hint[]> {

    if (this.config.preProcessToken) {
      token = this.config.preProcessToken(this.yasqe, token);
    }

    if (token) return this.getCompletions(token).then(suggestions => suggestions.map(s => this.getHint(token, s)));
    return Promise.resolve([]);
  }
  public autocomplete(fromAutoShow: boolean) {
    //this part goes before the autoshow check, as we _would_ like notification showing to indicate a user can press ctrl-space
    if (!this.isValidPosition()) return false;
    if (
      fromAutoShow && // from autoShow, i.e. this gets called each time the editor content changes
      (!this.config.autoShow || // autoshow for  this particular type of autocompletion is -not- enabled
      (!this.config.bulk && this.config.async)) // async is enabled (don't want to re-do ajax-like request for every editor change)
    ) {
    return false;
  }
    const cur = this.yasqe.getDoc().getCursor();
    const token: AutocompletionToken = this.yasqe.getCompleteToken();
    const getHints: Yasqe.HintFn = () => {
      // const list:any = null;
      return this.getHints(token).then(list => {
        return {
          list: list,
          from: <Yasqe.Position>{
            line: cur.line,
            ch: token.start
          },
          to: <Yasqe.Position>{
            line: cur.line,
            ch: token.end
          }
        };
      });
    };
    getHints.async = false; //in their code, async means using a callback
    //we always return a promise, which should be properly handled regardless of this val
    var hintConfig: Yasqe.HintConfig = {
      closeCharacters: /(?=a)b/,
      completeSingle: false,
      hint: getHints,
      container: this.yasqe.rootEl//this way, we can still scope to css to `.yasqe`
    };

    this.yasqe.showHint(hintConfig);
    return true;
  }
}

/**
 * Converts rdf:type to http://.../type and converts <http://...> to http://...
 * Stores additional info such as the used namespace and prefix in the token object
 */
export function preprocessIriForCompletion(yasqe: Yasqe.Instance, token: AutocompletionToken) {
  var queryPrefixes = yasqe.getPrefixesFromQuery();
  var stringToPreprocess = token.string;
  //we might be in a property path...
  if (token.state.lastProperty && token.state.lastProperty.length) {
    stringToPreprocess = token.state.lastProperty;
    token.from = {
      ch: token.start + token.string.length - token.state.lastProperty.length
    }
  }
  if (stringToPreprocess.indexOf("<") < 0) {
    token.tokenPrefix = stringToPreprocess.substring(0, stringToPreprocess.indexOf(":") + 1);

    if (queryPrefixes[token.tokenPrefix.slice(0, -1)] != null) {
      token.tokenPrefixUri = queryPrefixes[token.tokenPrefix.slice(0, -1)];
    }
  }

  token.autocompletionString = stringToPreprocess.trim();
  if (stringToPreprocess.indexOf("<") < 0 && stringToPreprocess.indexOf(":") > -1) {
    // hmm, the token is prefixed. We still need the complete uri for autocompletions. generate this!
    for (var prefix in queryPrefixes) {
      if (token.tokenPrefix === prefix + ":") {
        token.autocompletionString = queryPrefixes[prefix];
        token.autocompletionString += stringToPreprocess.substring(prefix.length + 1);
        break;
      }
    }
  }

  if (token.autocompletionString.indexOf("<") == 0)
    token.autocompletionString = token.autocompletionString.substring(1);
  if (token.autocompletionString.indexOf(">", token.autocompletionString.length - 1) > 0)
    token.autocompletionString = token.autocompletionString.substring(0, token.autocompletionString.length - 1);
  return token;
}

export function postprocessIriCompletion(
  yasqe: Yasqe.Instance,
  token: AutocompletionToken,
  suggestedString: string
) {
  if (token.tokenPrefix && token.autocompletionString && token.tokenPrefixUri) {
    // we need to get the suggested string back to prefixed form
    suggestedString = token.tokenPrefix + suggestedString.substring(token.tokenPrefixUri.length);
  } else {
    // it is a regular uri. add '<' and '>' to string
    suggestedString = "<" + suggestedString + ">";
  }
  return suggestedString;
}

//Use protocol relative request when served via http[s]*. Otherwise (e.g. file://, fetch via http)
export function fetchFromLov(yasqe: Yasqe.Instance, type: "class" | "property", token: AutocompletionToken): Promise<string[]> {
  var reqProtocol = window.location.protocol.indexOf("http") === 0 ? "//" : "http://";
  const notificationKey = "autocomplete_" + type;
  if (!token || !token.string || token.string.trim().length == 0) {
    yasqe.showNotification(notificationKey, "Nothing to autocomplete yet!");
    return Promise.resolve();
  }
  // //if notification bar is there, show a loader
  // yasqe.autocompleters.notifications
  //   .getEl(completer)
  //   .empty()
  //   .append($("<span>Fetchting autocompletions &nbsp;</span>"))
  //   .append($(yutils.svg.getElement(require("../imgs.js").loader)).addClass("notificationLoader"));
  // doRequests();
  return superagent
    .get(reqProtocol + "lov.okfn.org/dataset/lov/api/v2/autocomplete/terms")
    .query({
      q: token.autocompletionString,
      page_size: 50,
      type: type
    })
    .then(
      result => {
        if (result.body.results) {
          return result.body.results.map((r: any) => r.uri[0]);
        }
        return [];
      },
      e => {
        yasqe.showNotification(notificationKey, "Failed fetching suggestions");
      }
    );
}

import  variableCompleter  from "./variables";
import  prefixCompleter  from "./prefixes";
import  propertyCompleter  from "./properties";
import  classCompleter  from "./classes";
export var completers:CompleterConfig[] = [
  variableCompleter,
  prefixCompleter,
  propertyCompleter,
  classCompleter
]
// var needPossibleAdjustment = [];
// for (var notificationName in completionNotifications) {
//   if (completionNotifications[notificationName].is(":visible")) {
//     neesdPossibleAdjustment.push(completionNotifications[notificationName]);
//   }
// }
// if (needPossibleAdjustment.length > 0) {
//   //position completion notifications
//   var scrollBar = $(yasqe.getWrapperElement()).find(".CodeMirror-vscrollbar");
//   var offset = 0;
//   if (scrollBar.is(":visible")) {
//     offset = scrollBar.outerWidth();
//   }
//   needPossibleAdjustment.forEach(function(notification) {
//     notification.css("right", offset);
//   });
// }
