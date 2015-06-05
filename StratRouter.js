var fs = require('fs');
var cwd = process.cwd();
var util = require("util"),
    events = require("events");
var compose = require('koa-compose');
var n_path = require('path');
var xml2js = require('xml2js');

function StratRouter(app,options){
    var _this = this;
    var use = [];
    events.EventEmitter.call(this);
    if(!options || (!options.ejsPath && !options.routerConfig))throw "path option can not be null";
    var path = cwd+options.ejsPath;
    var uriStart = options.uriPrefix || "";

    _this.add = function(path,ctrl,noPattern){
        if(typeof path == "string")path = uriStart+path;
        var reg = noPattern ? path : patternURI(path);
        console.log("add router:"+reg);
        _this.__addRoute(reg,CtrlPort(ctrl));
    };

    _this.__addRoute = function(reg,ctr,method){
        if(!method)method = 'all';
        app[method](reg,ctr);
    };

    _this.use = function (generator) {
        if(typeof generator!="function")throw "use argument must is a function";
        use.push(generator);
    };

    addRoutsWithFiles(path);
    if(options.routerConfig)addRoutesWidthConfig(parseConfig(options.routerConfig));
    function addRoutsWithFiles(root){
        var files = fs.readdirSync(root);
        files.forEach(function(file){
            var pathname = root+'/'+file
                , stat = fs.lstatSync(pathname);
            if (!stat.isDirectory()){
                var dir = pathname.replace(path,'');
                if(!/^[_@]/.test(file)){
                    var url = uriStart+dir.replace(/\.ejs$/,"");
                    _this.__addRoute(patternURI(url),CtrlPort(loadController(url)));
                }
            } else {
                if(!/^[_@]/.test(file))addRoutsWithFiles(pathname);
            }
        });
    }
    function addRoutesWidthConfig(config){
        var routes = config["routeConfig"]["route"];
        routes.forEach(function(item){
            var route = item['$'];
            _this.add(route.name,loadController(uriStart+'/'+route['controller']),true);
        });
    }

    function CtrlPort(ctrl){
        var render = function *(){
            var method = (this.req.method).toLowerCase();
            var pathname = this.req._parsedUrl.pathname;
            if(pathname && /(!([A-Za-z0-9])+)$/.test(pathname)){
                var action = pathname.replace(/(.*?)!/g,'');
                if(action)method = action;
            }
            var func = ctrl[method] || ctrl;
            if(typeof func != 'function')this.throw(404);
            var _render = this.render;
            this.render = function*(view,options){
                options = options || {};
                _this.emit("beforeRender",options,this);
                var c = yield _render.call(this,view,options);
                _this.emit("afterRender",options,this);
                return c;
            };
            if(typeof ctrl.validator == "object"){
                var validator = ctrl.validator;
                var validate = validator[method];
                if(validate){
                    _this.emit("beforeValidate",this);
                    yield validate.call(this);
                    _this.emit("afterValidate",this);
                }
            }
            return yield func.call(this);
        };

        return function *(){
            var gen = compose(use.concat(render));
            yield gen.call(this);
        }
    }

    function loadController(relativePath){
        var c;
        var jsFile = n_path.join(cwd,options.controllers,relativePath+".js");
        if(fs.existsSync(jsFile)){
            c = require(jsFile);
        }else{
            c = function *() {
                yield this.render(relativePath);
            };
        }
        return c;
    }
}

util.inherits(StratRouter, events.EventEmitter);

function patternURI(url){
    return new RegExp("(^("+url+"))"+"((!([A-Za-z0-9])+)?)$");
}

function parseConfig(config){
    if(typeof config == 'object')return config;
    var xml = fs.readFileSync(n_path.join(cwd,config),'utf-8');
    var json = {};
    xml2js.parseString(xml,function(err,rs){
        if(err)throw err;
        json = rs;
    });
    return json;
}

module.exports = StratRouter;