import * as Yasqe from "../";
import { AutocompletionToken } from "./";
import * as superagent from "superagent";
/**
 * Converts rdf:type to http://.../type and converts <http://...> to http://...
 * Stores additional info such as the used namespace and prefix in the token object
 */
export function preprocessResourceTokenForCompletion(yasqe: Yasqe, token: AutocompletionToken) {
  var queryPrefixes = yasqe.getPrefixesFromQuery();
  if (token.string.indexOf("<") < 0) {
    token.tokenPrefix = token.string.substring(0, token.string.indexOf(":") + 1);

    if (queryPrefixes[token.tokenPrefix.slice(0, -1)] != null) {
      token.tokenPrefixUri = queryPrefixes[token.tokenPrefix.slice(0, -1)];
    }
  }

  token.autocompletionString = token.string.trim();
  if (token.string.indexOf("<") < 0 && token.string.indexOf(":") > -1) {
    // hmm, the token is prefixed. We still need the complete uri for autocompletions. generate this!
    for (var prefix in queryPrefixes) {
      if (token.tokenPrefix === prefix + ":") {
        token.autocompletionString = queryPrefixes[prefix];
        token.autocompletionString += token.string.substring(prefix.length + 1);
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

export function postprocessResourceTokenForCompletion(
  yasqe: Yasqe,
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
export function fetchFromLov(yasqe: Yasqe, type: "class" | "property", token: AutocompletionToken): Promise<string[]> {
  var reqProtocol = window.location.protocol.indexOf("http") === 0 ? "//" : "http://";
  const notificationKey = type;
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
          return result.body.results.map((r: any) => r.uri);
        }
        return [];
      },
      e => {
        yasqe.showNotification(notificationKey, "Failed fetching suggestions");
      }
    );
}
