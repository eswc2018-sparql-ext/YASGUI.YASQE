import * as Yasqe from "../";
import Trie from "../trie";
import { EventEmitter } from "events";
export class CompleterConfig {
  isValidCompletionPosition: (yasqe: Yasqe) => boolean;
  get: (yasqe: Yasqe, token?: Yasqe.Token) => Promise<string[]> | string[];
  preProcessToken?: (yasqe: Yasqe, token: Yasqe.Token) => AutocompletionToken;
  postProcessSuggestion?: (yasqe: Yasqe, token: AutocompletionToken, suggestedString: string) => string;
  async: boolean;
  bulk: boolean;
  autoShow?: boolean;
  persistenceId?: Yasqe.Config["persistenceId"];
  name?: string;
}

interface AutocompletionToken extends Yasqe.Token {
  autocompletionString?: string;
}
export class Completer extends EventEmitter {
  protected yasqe: Yasqe;
  private trie: Trie;
  private config: CompleterConfig;
  constructor(yasqe: Yasqe, config: CompleterConfig, name: string) {
    super();
    this.yasqe = yasqe;
    this.config = config;
    this.config.name = name;
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
  private getCompletions(token?: AutocompletionToken): Promise<string[]> {
    if (!this.config.get) return;

    //No token, so probably getting as bulk
    if (!token) {
      if (this.config.get instanceof Array) return Promise.resolve(this.config.get);
      //wrapping call in a promise.resolve, so this when a `get` is both async or sync
      return Promise.resolve(this.config.get(this.yasqe));
    }

    //ok, there is a token
    const stringToAutocomplete = token.autocompletionString || token.string;
    if (this.trie) return Promise.resolve(this.trie.autoComplete(stringToAutocomplete));
    if (this.config.get instanceof Array)
      return Promise.resolve(
        this.config.get.filter(possibleMatch => possibleMatch.indexOf(stringToAutocomplete) === 0)
      );
    //assuming it's a function
    return Promise.resolve(this.config.get(this.yasqe, token)).then(r => r);
  }

  /**
   * Populates completions. Pre-fetches those if bulk is set to true
   */
  public populateCompletions(): Promise<void> {
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

  // getSuggestionsAsHintObject(suggestions:string[], token:AutocompletionToken):Yasqe.Hint {
  //   var hintList:Yasqe.Hint[] = suggestions.map(suggestedString => {
  //     if (this.config.postProcessSuggestion) {
  //       suggestedString = this.config.postProcessSuggestion(token, suggestedString);
  //     }
  //     return {
  //       text: suggestedString,
  //       displayText: suggestedString,
  //       hint: this.selectHint
  //     };
  //   });
  //
  //   var cur = this.yasqe.getDoc().getCursor();
  //   var returnObj = {
  //     completionToken: token.string,
  //     list: hintList,
  //     from: {
  //       line: cur.line,
  //       ch: token.start
  //     },
  //     to: {
  //       line: cur.line,
  //       ch: token.end
  //     }
  //   };
  //   // //if we have some autocompletion handlers specified, add these these to the object. Codemirror will take care of firing these
  //   // if (completer.callbacks) {
  //   //   for (var callbackName in completer.callbacks) {
  //   //     if (completer.callbacks[callbackName]) {
  //   //       YASQE.on(returnObj, callbackName, completer.callbacks[callbackName]);
  //   //     }
  //   //   }
  //   // }
  //   return returnObj;
  // };

  // private getCompletionHintsObject():Promise<Yasqe.Hint> {
  //   var getSuggestionsFromToken = (partialToken:AutocompletionToken) => {
  //     var stringToAutocomplete = partialToken.autocompletionString || partialToken.string;
  //     var suggestions = [];
  //     if (this.trie) {
  //       suggestions = this.trie.autoComplete(stringToAutocomplete);
  //     } else if (typeof this.config.get == "function" && this.config.async == false) {
  //       suggestions = <any>this.config.get(stringToAutocomplete);
  //     } else if (this.config.get instanceof Array) {
  //       suggestions = this.config.get.filter(possibleMatch => possibleMatch.indexOf(stringToAutocomplete) === 0)
  //     }
  //     return this.getSuggestionsAsHintObject(suggestions, partialToken);
  //   };
  //
  //   var token = this.yasqe.getCompleteToken();
  //   if (this.config.preProcessToken) {
  //     token = this.config.preProcessToken(token);
  //   }
  //
  //   if (token) {
  //     this.config.get(token)
  //     if (!this.config.bulk && this.config.async) {
  //       // var wrappedCallback = function(suggestions) {
  //       //   callback(getSuggestionsAsHintObject(suggestions, completer, token));
  //       // };
  //        this.config.get(token).then(getSuggestionsAsHintObject);
  //     } else {
  //       return getSuggestionsFromToken(token);
  //     }
  //   }
  // };
  private isValidPosition(): boolean {
    if (!this.config.isValidCompletionPosition) return false; //no way to check whether we are in a valid position
    if (!this.config.isValidCompletionPosition(this.yasqe)) {
      this.emit("invalidPosition", this);
      return false;
    }
    this.emit("validPosition", this);
    return true;
  }

  private getHint(autocompletionToken: AutocompletionToken, suggestedString: string): Yasqe.Hint {
    if (this.config.postProcessSuggestion) {
      suggestedString = this.config.postProcessSuggestion(this.yasqe, autocompletionToken, suggestedString);
    }
    return {
      text: suggestedString,
      displayText: suggestedString
    };
  }

  private getHints(token: AutocompletionToken): Promise<Yasqe.Hint[]> {
    // var getSuggestionsFromToken = (partialToken:AutocompletionToken) => {
    //   var stringToAutocomplete = partialToken.autocompletionString || partialToken.string;
    //   var suggestions = [];
    //   if (this.trie) {
    //     suggestions = this.trie.autoComplete(stringToAutocomplete);
    //   } else if (typeof this.config.get == "function" && this.config.async == false) {
    //     suggestions = <any>this.config.get(stringToAutocomplete);
    //   } else if (this.config.get instanceof Array) {
    //     suggestions = this.config.get.filter(possibleMatch => possibleMatch.indexOf(stringToAutocomplete) === 0)
    //   }
    //   return this.getSuggestionsAsHintObject(suggestions, partialToken);
    // };

    if (this.config.preProcessToken) {
      token = this.config.preProcessToken(this.yasqe, token);
    }

    if (token) return this.getCompletions(token).then(suggestions => suggestions.map(s => this.getHint(token, s)));
    return Promise.resolve([]);
  }
  public autocomplete(fromAutoShow: boolean) {
    if (
      fromAutoShow && // from autoShow, i.e. this gets called each time the editor content changes
      (!this.config.autoShow || // autoshow for  this particular type of autocompletion is -not- enabled
        (!this.config.bulk && this.config.async)) // async is enabled (don't want to re-do ajax-like request for every editor change)
    ) {
      return false;
    }
    if (!this.isValidPosition()) return false;
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

    // if (!this.config.bulk && this.config.async) {
    //   hintConfig.async = true;
    // }
    // var wrappedHintCallback = function(yasqe, callback) {
    //   return getCompletionHintsObject(completer, callback);
    // };
    this.yasqe.showHint(hintConfig);
    return true;
  }
}

export { default as variables } from "./variables";
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
