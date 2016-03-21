/*! oauth2-security - v1.1.0 - 2016-03-21 */angular.module("oauth2.security",["ngCookies"]).provider("OAuthConfig",[function(){function a(a){var d,e;return e=new function(b){this.loginPage=b.loginPage,this.intercept=b.intercept,this.targetUrl=b.targetUrl,this.targetUrlProvider=b.targetUrlProvider,this.deniedPageUrl=b.deniedPageUrl,this.deniedUrlProvider=b.deniedUrlProvider,this.getLoginPageUrl=function(){return this.loginPage||"#/login"},this.getAccessDeniedPageUrl=function(){return this.deniedPageUrl||this.deniedUrlProvider&&a.invoke(this.deniedUrlProvider)||"#/access-denied"},this.getTargetUrl=function(){return this.targetUrl||this.targetUrlProvider&&a.invoke(this.targetUrlProvider)||"#/home"}}(b.view),d=new function(a){this.intercept=a.intercept?a.intercept:[],a.secureApiUrlPatterns&&this.intercept.push({urlPatterns:a.secureApiUrlPatterns,headers:{Authorization:"Bearer {{access_token}}"}}),this.urlResolver="function"==typeof a.urlResolver?a.urlResolver(c):a.urlResolver,this.addIntercept=function(a){this.intercept=this.intercept||[],this.intercept.push(a)},this.getUrlResolver=function(){return this.urlResolver}}(b.http),{getContext:function(){return c},getView:function(){return e},getRefreshTokeGrandType:function(){return b.refreshTokeGrandType},getEntryPoint:function(){if(!b.entryPoint)throw new Error("entryPoint config not found");return b.entryPoint},getHttp:function(){return d}}}var b,c,d;return{setConfig:function(a){if(b=a,d=a.grandType,c=a.context||{},!a.http)throw new Error("http config not found");if(!a.view)throw new Error("view config not found");if(!a.entryPoint)throw new Error("oauth type config not found")},$get:["$injector",a]}}]).factory("ExpResolver",["OAuthConfig",function(a){function b(a){if(a)for(var b in d){var c=d[b];a=a.replace(new RegExp("{{"+b+"}}|\\${"+b+"}","g"),"function"==typeof c?c():c)}return a}var c=a.getHttp().getUrlResolver(),d={};for(var e in c.map)d[e]=c.map[e];return{appMap:function(a,b){a&&b&&(d[a]=b)},removeMap:function(a){a&&delete d[a]},resolve:function(a){return c&&b(a)||a},resolveUrl:function(a){return c&&b(a)||a}}}]).factory("Principle",["$cookieStore",function(a){var b,c,d,e="PRINCIPLE_OAUTH",f="USER_OAUTH",g="AUTHORITIES_OAUTH",h=function(h,i,j){h?(b=h,a.put(e,b)):b=b||a.get(e),i?(c=i,a.put(f,c)):c=c||a.get(f),j?(d=j,a.put(g,d)):d=d||a.get(g)},i=function(){a.remove(e),a.remove(f),a.remove(g),b=c=d=null};return{isAvailabel:function(){return h(),!!b},getPrinciple:function(){if(h(),b)return b;throw new Error("principle not found")},getUser:function(){if(h(),c)return c;throw new Error("user not found")},getAuthorities:function(){if(h(),d)return d;throw new Error("authorities not found")},getAccessToken:function(){return this.getPrinciple().access_token},getRefreshToken:function(){return this.getPrinciple().refresh_token},setPrinciple:function(a){if(!a)throw new Error("principle not persisted",a);h(a)},setUser:function(a,b){if(!a||!b)throw new Error("user not persisted",a,b);h(void 0,a,b)},setAuthentications:function(a,b,c){if(!(a&&b&&c))throw new Error("principle not persisted",a,b,c);h(a,b,c)},clear:i}}]).factory("OAuthProcessor",["$http","OAuthConfig","$injector","$log",function(a,b,c,d){var e=b.getContext(),f=null;try{f=c.invoke(b.getEntryPoint())}catch(g){d.debug(g.message)}var h=new function(){this.accessToken=function(b,c){return a({method:"POST",url:e.url.baseUrl+e.url.login||"/token",data:$.param({client_id:e.client.clientId,client_secret:e.client.clientSecret,grant_type:e.client.passwordGrantType,scope:e.client.scope,username:b,password:c}),headers:{"Content-Type":"application/x-www-form-urlencoded"}}).then(function(a){return a.data})},this.refreshToken=function(b){return a({method:"POST",url:e.url.baseUrl+e.url.login||"/login",data:$.param({client_id:e.client.clientId,client_secret:e.client.clientSecret,grant_type:e.client.refreshTokeGrantType,refresh_token:b}),headers:{"Content-Type":"application/x-www-form-urlencoded"}}).then(function(a){return a.data})},this.revokeToken=function(){return a({method:"GET",url:e.url.baseUrl+e.url.logout||"/revoke"})},this.me=function(){return a.get(e.url.baseUrl+e.url.user||"/me").then(function(a){return a.data})},this.extractRoles=function(a){return a.roles||["ROLE_USER"]}};return{accessToken:function(a,b){return(f&&"function"==typeof f.accessToken&&f.accessToken||h.accessToken)(a,b)},refreshToken:function(a){return(f&&"function"==typeof f.refreshToken&&f.refreshToken||h.refreshToken)(a)},revokeToken:function(){return(f&&"function"==typeof f.revokeToken&&f.revokeToken||h.revokeToken)()},me:function(){return(f&&"function"==typeof f.me&&f.me||h.me)()},extractRoles:function(a){return(f&&"function"==typeof f.extractRoles&&f.extractRoles||h.extractRoles)(a)}}}]).factory("AuthInterceptor",["OAuthConfig","$q","Principle","$injector","$log","ExpResolver",function(a,b,c,d,e,f){var g=null,h=d.get("OAuthConfig").getHttp();return f.appMap("access_token",function(){try{return c.getAccessToken()}catch(a){}}),{request:function(a){if(a.url=f.resolveUrl(a.url),h.intercept&&h.intercept.length)for(var b in h.intercept){var c=h.intercept[b];for(var b in c.urlPatterns)if(c.urlPatterns[b].test(a.url)){for(var d in c.headers)a.headers[d]=f.resolve(c.headers[d]);for(var d in c.params)a.params[d]=f.resolve(c.params[d])}}return a},responseError:function(e){switch(e.status){case 401:if(c.isAvailabel()&&a.getRefreshTokeGrandType()){var f=d.get("OAuthProcessor"),h=(d.get("OAuth"),b.defer());return g||(g=f.refreshToken(c.getRefreshToken())),g.then(function(a){g=null,a.access_token?(c.setPrinciple(a),d.get("$http")(e.config).then(function(a){h.resolve(a)},function(a){h.reject(a)})):h.reject(e)},function(a){return g=null,h.reject(),c.clear(),d.get("Redirection").confirmAccess(),a}),h.promise}}return b.reject(e)}}}]).factory("Redirection",["$window","$location","OAuthConfig","Principle","$log",function(a,b,c,d,e){var f=new function(){var f=c.getView(),g=function(c){e.debug("redirecting - ",c);var d=document.createElement("a");d.href=c,d.host==a.location.host&&d.pathname==a.location.pathname||(a.location.href=c),b.url(d.hash.substr(1,d.hash.length))},h=function(a){a=a?a:b.absUrl();var c=[];for(var d in f.intercept){var e=f.intercept[d];e.urlPattern.test(a)&&(c=c.concat(e.roles))}return c};this.confirmAccess=function(){var a=b.absUrl(),c=null;try{c=d.getAuthorities(),c.push("IS_AUTHENTICATED_ANONYMOUSLY")}catch(i){e.error(i.message),c=["IS_ANONYMOUSLY"]}h(a).some(function(a){return c.indexOf(a)>=0})?e.debug("page authenticated",a):(g(c.indexOf("IS_ANONYMOUSLY")<0?f.getAccessDeniedPageUrl():f.getLoginPageUrl()),e.debug("page denied",a))},this.redirectToTarget=function(){g(f.getTargetUrl())}};return f}]).run(["$rootScope","Redirection",function(a,b){a.$on("$locationChangeStart",function(a,c,d){b.confirmAccess()})}]).provider("OAuth",["$httpProvider","OAuthConfigProvider",function(a,b){function c(a){b.setConfig(a)}function d(a,b,c,d,e){var f=a.getContext();return this.getContext=function(){return f},this.login=function(a,f,g){return d.accessToken(a,f).then(function(a){return b.setPrinciple(a),d.me().then(function(a){return b.setUser(a,d.extractRoles(a)),g&&c.redirectToTarget(),e.$broadcast("oauthAccessTokenObtainingSuccess",a),a})})},this.logout=function(){return d.revokeToken().then(function(a){b.clear(),c.confirmAccess(),e.$broadcast("oauthRevokeSuccess",a)},function(a){b.clear(),c.confirmAccess(),e.$broadcast("oauthRevokeSuccess",a)})},this.getAbsUrl=function(a){return f.url.baseUrl+f.url.api+f.url.version+a},this.getAbsUrlWithAuth=function(a){return a=a.indexOf("?")>1?a+"&access_token="+b.getAccessToken():a+"?access_token="+b.getAccessToken(),f.url.baseUrl+f.url.api+f.url.version+a},this.getUrlWithAuth=function(a){return a=a.indexOf("?")>1?a+"&access_token="+b.getAccessToken():a+"?access_token="+b.getAccessToken()},this}return a.interceptors.push("AuthInterceptor"),{config:c,$get:["OAuthConfig","Principle","Redirection","OAuthProcessor","$rootScope",d]}}]).directive("oauthSrc",["OAuth",function(a){function b(a,b){var c=new Image;c.src=a,angular.element(c).bind("load",function(){b.attr("src",a)})}return{restrict:"A",link:function(c,d,e){var f=e.defaultSrc?e.defaultSrc:"assets/img/no-image-icon.png";d.on("error",function(a){b(f,d)}),e.$observe("oauthSrc",function(c,e){void 0!=c&&b(a.getUrlWithAuth(c),d)})}}}]);