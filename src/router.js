const {createContext, runInContext} = require("vm");
const Settings = require("./settings");

class Router {
  constructor(settings, environment) {
    this.settings = settings;
    this.environment = Object.assign({}, settings.environment(), environment);
    this.context = createContext(this.environment);
  }
  
  convertParam(t, value) {
    return t === "number" ? Number(value) : value;
  }

  processParam(param, input) {
    let value = input[param.in][param.name] || param.default;
    if (!value && param.required) throw `Missing parameter '${param.name}'`;
    return this.convertParam(param.type, value);
  }

  processParams(params, input) {
    if (!params) return {};
    let output = {};
    
    for (let p of params)
      output[p.name] = this.processParam(p, input);
      
    return output;
  }
  
  handle(request) {
    let {action, parameters} = request.route.settings;
    if (!action) return;
    
    let params = this.processParams(parameters, request.params);
    for (let paramFunc of this.settings.params())
      paramFunc(request, params);
      
    if (typeof action === "function")
      return action(params, request);
    
    if (typeof action === "string")
      return runInContext(action, this.context)(params, request);
    
    let handler = this.settings.findHandler(action.type);
    if (handler) return handler(request.route, this.context, params);
    
    throw "Could not find a handler for route";
  }
  
  respond(output, request) {
    let {response} = request.route.settings;
    if (response) return response(output, request);
    
    if (typeof output === "string")
      return request.send(output, {"Content-Type": "text/html"});
      
    if (["Object", "Array"].includes(output.constructor.name))
      return request.send(JSON.stringify(output), {"Content-Type": "application/json"});
    
    let responder = this.settings.findResponder(output);
    
    if (!responder)
      throw `Couldn't find responder for type: ${output.constructor.name}`;
      
    return responder.responder(output, request);
  }
}

module.exports = Router;