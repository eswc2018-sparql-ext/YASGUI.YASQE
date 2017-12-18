import * as Yasqe from '../'
import Trie from '../trie'
import {EventEmitter} from 'events'
import {EditorChange} from 'codemirror'
class CompleterConfig {
  isValidCompletionPosition:(yasqe:Yasqe) => boolean
  get:(token?: Yasqe.Token | string) => Promise<string[]> | string[]
  preProcessToken: (token:Yasqe.Token) => Yasqe.Token
  postProcessToken: (token:Yasqe.Token, suggestedString:string) => string
  async: boolean
  bulk: boolean
  autoShow: boolean
  persistenceId: Yasqe.Config['persistenceId']
  name?:string
}
interface Hint {
  closeCharacters?: RegExp,
  completeSingle?: boolean
  async?:boolean
}
interface AutocompletionToken extends Yasqe.Token {
  autocompletionString: string
}
class Completer extends EventEmitter {
  protected yasqe:Yasqe
  private trie:Trie
  private config:CompleterConfig
  constructor(yasqe:Yasqe, config:CompleterConfig) {
    super();
    this.yasqe = yasqe;
    this.config = config;
    // this.name = name
  }

  private selectHint(data:EditorChange, completion:any) {
    if (completion.text != this.yasqe.getTokenAt(this.yasqe.getDoc().getCursor()).string) {
      this.yasqe.getDoc().replaceRange(completion.text, data.from, data.to);
    }
  };
  private getStorageId() {
    return this.yasqe.getStorageId(this.config.persistenceId);
  }
  private storeBulkCompletions(completions:string[]) {
    if (!completions || !(completions instanceof Array)) return;
    // store array as trie
    this.trie = new Trie();
    completions.forEach((c) => this.trie.insert(c))

    // store in localstorage as well
    var storageId = this.getStorageId();
    if (storageId) this.yasqe.storage.set(storageId, completions, 60*60*24*30,this.yasqe.handleLocalStorageQuotaFull);
  };

  //Get array of strings from `get` array, function or promise
  private getCompletions(token?:Yasqe.Token | string):Promise<string[]> {
    if (!this.config.get) return;
    if (this.config.get instanceof Array) {
      return Promise.resolve(this.config.get)
    }
    //wrapping call in a promise.resolve, so this when a `get` is both async or sync
    Promise.resolve(this.config.get(token)).then(r => r,  (e) => {
      console.error('Failed getting completions for ' + this.config.name)
    });
  }
  private init():Promise<void> {
      if (this.config.bulk) {
        if (this.config.get instanceof Array) {
          // we don't care whether the completions are already stored in
          // localstorage. just use this one
          this.storeBulkCompletions(this.config.get);
          return Promise.resolve();
        } else {
          // if completions are defined in localstorage, use those! (calling the
          // function may come with overhead (e.g. async calls))
          var completionsFromStorage:string[];
          var storageId = this.getStorageId();
          if (storageId) completionsFromStorage = this.yasqe.storage.get<string[]>(storageId);
          if (completionsFromStorage && completionsFromStorage.length > 0) {
            this.storeBulkCompletions(completionsFromStorage);
            return Promise.resolve()
          } else {
            return this.getCompletions().then(this.storeBulkCompletions);
          }
        }
      }

  }

  getSuggestionsAsHintObject(suggestions:string[], token:AutocompletionToken):Yasqe.Hint {
    var hintList:Yasqe.Hint[] = suggestions.map(suggestedString => {
      if (this.config.postProcessToken) {
        suggestedString = this.config.postProcessToken(token, suggestedString);
      }
      return {
        text: suggestedString,
        displayText: suggestedString,
        hint: this.selectHint
      };
    });

    var cur = this.yasqe.getDoc().getCursor();
    var returnObj = {
      completionToken: token.string,
      list: hintList,
      from: {
        line: cur.line,
        ch: token.start
      },
      to: {
        line: cur.line,
        ch: token.end
      }
    };
    // //if we have some autocompletion handlers specified, add these these to the object. Codemirror will take care of firing these
    // if (completer.callbacks) {
    //   for (var callbackName in completer.callbacks) {
    //     if (completer.callbacks[callbackName]) {
    //       YASQE.on(returnObj, callbackName, completer.callbacks[callbackName]);
    //     }
    //   }
    // }
    return returnObj;
  };

  private getCompletionHintsObject():Promise<Yasqe.Hint> {
    var getSuggestionsFromToken = (partialToken:AutocompletionToken) => {
      var stringToAutocomplete = partialToken.autocompletionString || partialToken.string;
      var suggestions = [];
      if (this.trie) {
        suggestions = this.trie.autoComplete(stringToAutocomplete);
      } else if (typeof this.config.get == "function" && this.config.async == false) {
        suggestions = <any>this.config.get(stringToAutocomplete);
      } else if (this.config.get instanceof Array) {
        suggestions = this.config.get.filter(possibleMatch => possibleMatch.indexOf(stringToAutocomplete) === 0)
      }
      return this.getSuggestionsAsHintObject(suggestions, partialToken);
    };

    var token = this.yasqe.getCompleteToken();
    if (this.config.preProcessToken) {
      token = this.config.preProcessToken(token);
    }

    if (token) {
      this.config.get(token)
      if (!this.config.bulk && this.config.async) {
        // var wrappedCallback = function(suggestions) {
        //   callback(getSuggestionsAsHintObject(suggestions, completer, token));
        // };
        return this.config.get(token).then(getSuggestionsAsHintObject);
      } else {
        return getSuggestionsFromToken(token);
      }
    }
  };
  public autocomplete(fromAutoShow:boolean) {
    if (
      fromAutoShow && // from autoShow, i.e. this gets called each time the editor content changes
      (!this.config.autoShow || // autoshow for  this particular type of autocompletion is -not- enabled
      (!this.config.bulk && this.config.async)) // async is enabled (don't want to re-do ajax-like request for every editor change)
    ) {
    return false;
  }
    if (!this.config.isValidCompletionPosition) continue; //no way to check whether we are in a valid position
    if (!this.config.isValidCompletionPosition(this.yasqe)) {
      this.emit('invalidPosition', this);
      return this;
    }
    this.emit('validPosition', this);

    var hintConfig:Hint = {
      closeCharacters: /(?=a)b/,
      completeSingle: false
    };

    if (!this.config.bulk && this.config.async) {
      hintConfig.async = true;
    }
    var wrappedHintCallback = function(yasqe, callback) {
      return getCompletionHintsObject(completer, callback);
    };
    var result = this.yasqe.getDoc().showHint(yasqe, wrappedHintCallback, hintConfig);
    return true;
  }
  autoComplete(fromAutoShow:boolean) {
    if (this.yasqe.getDoc().somethingSelected()) return;
    var tryHintType = function(completer) {
      if (
        fromAutoShow && // from autoShow, i.e. this gets called each time the editor content changes
        (!completer.autoShow || // autoshow for  this particular type of autocompletion is -not- enabled
          (!completer.bulk && completer.async)) // async is enabled (don't want to re-do ajax-like request for every editor change)
      ) {
        return false;
      }

      var hintConfig = {
        closeCharacters: /(?=a)b/,
        completeSingle: false
      };
      if (!completer.bulk && completer.async) {
        hintConfig.async = true;
      }
      var wrappedHintCallback = function(yasqe, callback) {
        return getCompletionHintsObject(completer, callback);
      };
      var result = YASQE.showHint(yasqe, wrappedHintCallback, hintConfig);
      return true;
    };
    for (var completerName in this.completers) {
      if ($.inArray(completerName, yasqe.options.autocompleters) == -1) continue; //this completer is disabled
      var completer = completers[completerName];
      if (!completer.isValidCompletionPosition) continue; //no way to check whether we are in a valid position

      if (!completer.isValidCompletionPosition()) {
        //if needed, fire callbacks for when we are -not- in valid completion position
        if (completer.callbacks && completer.callbacks.invalidPosition) {
          completer.callbacks.invalidPosition(yasqe, completer);
        }
        //not in a valid position, so continue to next completion candidate type
        continue;
      }
      // run valid position handler, if there is one (if it returns false, stop the autocompletion!)
      if (completer.callbacks && completer.callbacks.validPosition) {
        if (completer.callbacks.validPosition(yasqe, completer) === false) continue;
      }
      var success = tryHintType(completer);
      if (success) break;
    }
  };
}
export default class BaseCompleter {
  private yasqe:Yasqe
  private completionNotifications = {};
  private completers:{[completerName:string]:Completer} = {}
  constructor(yasqe:Yasqe) {
    this.yasqe = yasqe
    yasqe.on("cursorActivity", function() {
      autoComplete(true);
    });
    yasqe.on("change", function() {
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
    });
  }







    autoComplete(fromAutoShow:boolean) {
    if (this.yasqe.getDoc().somethingSelected()) return;
    var tryHintType = function(completer) {

    };
    for (var completerName in this.completers) {
      if (!this.completers[completerName].canAutocomplete()) continue;
      var success = tryHintType(completer);
      if (success) break;
    }
  };

  var getCompletionHintsObject = function(completer, callback) {
    var getSuggestionsFromToken = function(partialToken) {
      var stringToAutocomplete = partialToken.autocompletionString || partialToken.string;
      var suggestions = [];
      if (tries[completer.name]) {
        suggestions = tries[completer.name].autoComplete(stringToAutocomplete);
      } else if (typeof completer.get == "function" && completer.async == false) {
        suggestions = completer.get(stringToAutocomplete);
      } else if (typeof completer.get == "object") {
        var partialTokenLength = stringToAutocomplete.length;
        for (var i = 0; i < completer.get.length; i++) {
          var completion = completer.get[i];
          if (completion.slice(0, partialTokenLength) == stringToAutocomplete) {
            suggestions.push(completion);
          }
        }
      }
      return getSuggestionsAsHintObject(suggestions, completer, partialToken);
    };

    var token = yasqe.getCompleteToken();
    if (completer.preProcessToken) {
      token = completer.preProcessToken(token);
    }

    if (token) {
      // use custom completionhint function, to avoid reaching a loop when the
      // completionhint is the same as the current token
      // regular behaviour would keep changing the codemirror dom, hence
      // constantly calling this callback
      if (!completer.bulk && completer.async) {
        var wrappedCallback = function(suggestions) {
          callback(getSuggestionsAsHintObject(suggestions, completer, token));
        };
        completer.get(token, wrappedCallback);
      } else {
        return getSuggestionsFromToken(token);
      }
    }
  };

  /**
	 *  get our array of suggestions (strings) in the codemirror hint format
	 */
  var getSuggestionsAsHintObject = function(suggestions, completer, token) {
    var hintList = [];
    for (var i = 0; i < suggestions.length; i++) {
      var suggestedString = suggestions[i];
      if (completer.postProcessToken) {
        suggestedString = completer.postProcessToken(token, suggestedString);
      }
      hintList.push({
        text: suggestedString,
        displayText: suggestedString,
        hint: selectHint
      });
    }

    var cur = yasqe.getCursor();
    var returnObj = {
      completionToken: token.string,
      list: hintList,
      from: {
        line: cur.line,
        ch: token.start
      },
      to: {
        line: cur.line,
        ch: token.end
      }
    };
    //if we have some autocompletion handlers specified, add these these to the object. Codemirror will take care of firing these
    if (completer.callbacks) {
      for (var callbackName in completer.callbacks) {
        if (completer.callbacks[callbackName]) {
          YASQE.on(returnObj, callbackName, completer.callbacks[callbackName]);
        }
      }
    }
    return returnObj;
  };

  return {
    init: initCompleter,
    completers: completers,
    notifications: {
      getEl: function(completer) {
        return $(completionNotifications[completer.name]);
      },
      show: function(yasqe, completer) {
        //only draw when the user needs to use a keypress to summon autocompletions
        if (!completer.autoshow) {
          if (!completionNotifications[completer.name])
            completionNotifications[completer.name] = $("<div class='completionNotification'></div>");
          completionNotifications[completer.name]
            .show()
            .text("Press CTRL - <spacebar> to autocomplete")
            .appendTo($(yasqe.getWrapperElement()));
        }
      },
      hide: function(yasqe, completer) {
        if (completionNotifications[completer.name]) {
          completionNotifications[completer.name].hide();
        }
      }
    },
    autoComplete: autoComplete,
    getTrie: function(completer) {
      return typeof completer == "string" ? tries[completer] : tries[completer.name];
    }
  };
};

/**
 * function which fires after the user selects a completion. this function checks whether we actually need to store this one (if completion is same as current token, don't do anything)
 */
