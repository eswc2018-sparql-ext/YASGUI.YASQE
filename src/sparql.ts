import * as Yasqe from './';
import * as superagent from 'superagent';
import {merge} from 'lodash'
export type YasqeAjaxConfig = Yasqe.Config['sparql']
export interface PopulatedAjaxConfig {
  url: string,
  reqMethod: 'POST' | 'GET'
  headers: {[key:string]:string},
  accept: string,
  args: RequestArgs

}
// type callback = AjaxConfig.callbacks['complete'];
export function getAjaxConfig(yasqe:Yasqe, config:YasqeAjaxConfig = {}):PopulatedAjaxConfig {
  if (yasqe.config.sparql) config = merge({}, yasqe.config.sparql, config);
  if (!config.endpoint || config.endpoint.length == 0) return; // nothing to query!

  var queryMode = yasqe.getQueryMode();
  /**
	 * initialize ajax config
	 */
  const endpoint = typeof config.endpoint == "function" ? config.endpoint(yasqe) : config.endpoint;
  var reqMethod:'GET' | 'POST' = queryMode == "update"
    ? "POST"
    : typeof config.requestMethod == "function" ? config.requestMethod(yasqe) : config.requestMethod;

  //TODO: set xhr fields

  // if (config.xhrFields) ajaxConfig.xhrFields = config.xhrFields;

  return {
    reqMethod,
    url: endpoint,
    args: getUrlArguments(yasqe,config),
    headers: config.headers,
    accept: getAcceptHeader(yasqe, config)
  }
  /**
	 * merge additional request headers
	 */


};

export function executeQuery(yasqe:Yasqe,config?: YasqeAjaxConfig ):Promise<any> {
  const populatedConfig = getAjaxConfig(yasqe,config);
  var queryStart = Date.now();
  // function updateYasqeOnFinish() {
  //   yasqe.lastQueryDuration = Date.now() - queryStart;
  //   yasqe.updateQueryButton();
  // };
  // //Make sure the query button is updated again on complete
  // var completeCallbacks = [
  //   function() {
  //     require("./main.js").signal(yasqe, "queryFinish", arguments);
  //   },
  //   updateYasqeOnFinish
  // ];
  // ajaxConfig.complete = completeCallbacks;
  // return ajaxConfig;

  yasqe.emit("query", populatedConfig);
  var req:superagent.SuperAgentRequest;
  if (populatedConfig.reqMethod==='POST') {
    req = superagent.post(populatedConfig.url);
    req.send(populatedConfig.args)
  } else {
    req = superagent.get(populatedConfig.url);
    req.query(populatedConfig.args)
  }
  req.accept(populatedConfig.accept);
  req.set(populatedConfig.headers)
  return req.then((result) => {
    yasqe.emit('queryFinish', {response:result, duration: Date.now() - queryStart})
    yasqe.emit('response', result.body)
    return result.body
  }, (e) => {
    yasqe.emit('queryFinish')
    yasqe.emit('error', e);
    throw e;
  });
  // yasqe.xhr = $.ajax(YASQE.getAjaxConfig(yasqe, callbackOrConfig));
};


export type RequestArgs = {[argName:string]: string | string[]}
export function getUrlArguments(yasqe:Yasqe, config:YasqeAjaxConfig):RequestArgs  {
  var queryMode = yasqe.getQueryMode();

  var data:RequestArgs = {}

  data[yasqe.config.sparql.queryName(yasqe)] = config.getQueryForAjax ? config.getQueryForAjax(yasqe) : yasqe.getValue()

  /**
	 * add named graphs to ajax config
	 */
  if (config.namedGraphs && config.namedGraphs.length > 0) {
    let argName = queryMode === "query" ? "named-graph-uri" : "using-named-graph-uri ";
    data[argName] = config.namedGraphs;
  }
  /**
	 * add default graphs to ajax config
	 */
  if (config.defaultGraphs && config.defaultGraphs.length > 0) {
    let argName = queryMode == "query" ? "default-graph-uri" : "using-graph-uri ";
    data[argName] = config.namedGraphs;
  }

  /**
	 * add additional request args
	 */
  if (config.args && config.args.length > 0) merge(data, config.args);

  return data;
};
export function getAcceptHeader(yasqe:Yasqe, config:YasqeAjaxConfig) {
  var acceptHeader = null;
    if (yasqe.getQueryMode() == "update") {
      acceptHeader = typeof config.acceptHeaderUpdate === "function"
        ? config.acceptHeaderUpdate(yasqe)
        : config.acceptHeaderUpdate;
    } else {
      var qType = yasqe.getQueryType();
      if (qType == "DESCRIBE" || qType == "CONSTRUCT") {
        acceptHeader = typeof config.acceptHeaderGraph == "function"
          ? config.acceptHeaderGraph(yasqe)
          : config.acceptHeaderGraph;
      } else {
        acceptHeader = typeof config.acceptHeaderSelect == "function"
          ? config.acceptHeaderSelect(yasqe)
          : config.acceptHeaderSelect;
      }
  }
  return acceptHeader;
};
