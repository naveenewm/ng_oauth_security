/**
 * oauth2.security
 * ⓒ 2016 Naveen Raj
 * License: MIT
 */
angular.module('oauth2.security',['ngCookies'])
    // Provider to maintain config
    .provider('OAuthConfig', [function() {
        var _config, _context, _grandType;
        //config service
        function Config($injector){
            var _http, _view;
            // wrapper for view config
            _view = new (function View (config){
                this.loginPage = config.loginPage;
                this.intercept = config.intercept;
                this.targetUrl = config.targetUrl;
                this.targetUrlProvider = config.targetUrlProvider;
                this.deniedPageUrl = config.deniedPageUrl;
                this.deniedUrlProvider = config.deniedUrlProvider;

                this.getLoginPageUrl = function(){
                    return this.loginPage||'#/login';
                };
                this.getAccessDeniedPageUrl = function(){
                    return this.deniedPageUrl||
                        this.deniedUrlProvider&&$injector.invoke(this.deniedUrlProvider)||
                        '#/access-denied';
                };
                this.getTargetUrl = function(){
                    return this.targetUrl||
                        this.targetUrlProvider&&$injector.invoke(this.targetUrlProvider)||
                        '#/home';
                };
            })(_config.view);

            _http = new (function Http(config){
                this.intercept = config.intercept?config.intercept:[];
                if(config.secureApiUrlPatterns){ this.intercept.push({urlPatterns:config.secureApiUrlPatterns, headers:{'Authorization':'Bearer {{access_token}}'}})};
                this.urlResolver =  typeof config.urlResolver=='function'?config.urlResolver(_context):config.urlResolver;
                this.addIntercept = function(intercept){
                    this.intercept = this.intercept||[];
                    this.intercept.push(intercept);
                };
                this.getUrlResolver = function(){
                    return this.urlResolver;
                }
            })(_config.http);

            return {
                'getContext' : function() {
                    return _context;
                },
                'getView' : function() {
                    return  _view;
                },
                'getRefreshTokeGrandType':function(){
                    return _config.refreshTokeGrandType;
                },
                'getEntryPoint' : function() {
                    if(!_config.entryPoint){throw new Error('entryPoint config not found');}
                    return _config.entryPoint;
                },
                'getHttp' : function() {
                    return _http;
                }
            }
        }
        return {
            'setConfig' : function(config) {
                _config = config;
                _grandType=config.grandType;
                _context = config.context||{};
                if(!config.http) throw new Error('http config not found');
                if(!config.view) throw new Error('view config not found');
                if(!config.entryPoint) throw new Error('oauth type config not found');
            },
            '$get':['$injector',Config]
        };
    }])
    // service to resolve urls of http
    .factory('ExpResolver', ['OAuthConfig', function(OAuthConfig) {
        var resolever = OAuthConfig.getHttp().getUrlResolver();
        var map = {};
        for(var name in resolever.map){
            map[name]= resolever.map[name];
        }
        function resolevePath(src){
            if(src){
                for(var mapKey in map){
                    var mapValue =  map[mapKey];
                    src = src.replace(new RegExp('{{'+mapKey+'}}|\\${'+mapKey+'}','g'),typeof mapValue == 'function'?mapValue():mapValue);
                }
            }
            return src;
        }
        return {
            appMap:function(key,value){
                if(key&&value)
                    map[key]=value;
            },
            removeMap:function(key){
                if(key) delete map[key];
            },
            resolve:function(str){
                return resolever&&resolevePath(str)||str;
            },
            resolveUrl:function(url){
                return resolever&&resolevePath(url)||url;
            }
        }
    }])
    // service to keep credentials, user and authorities with local
    .factory('Principle', ['$cookieStore','$rootScope', function($cookieStore, $rootScope) {
        var _principle;
        var _user;
        var _authorities;
        var PRINCIPLE_KEY='PRINCIPLE_OAUTH';
        var USER_KEY='USER_OAUTH';
        var AUTHORITIES_KEY='AUTHORITIES_OAUTH';
        var _synch = function(principle, user, authorities) {
            if(principle){
                _principle = principle;
                $cookieStore.put(PRINCIPLE_KEY, _principle);
            }else{
                _principle = _principle || $cookieStore.get(PRINCIPLE_KEY);
            }
            if(user){
                _user = user;
                $cookieStore.put(USER_KEY, _user);
            }else{
                _user = _user || $cookieStore.get(USER_KEY);
            }
            if(authorities){
                _authorities = authorities;
                $cookieStore.put(AUTHORITIES_KEY, _authorities);
            }else{
                _authorities = _authorities || $cookieStore.get(AUTHORITIES_KEY);
            }
        }
        var _clear = function() {
            $cookieStore.remove(PRINCIPLE_KEY);
            $cookieStore.remove(USER_KEY);
            $cookieStore.remove(AUTHORITIES_KEY);
            _principle = _user = _authorities = null;
        };
        return {
            'isAvailabel' : function() {
                _synch();
                return !!_principle;
            },
            'credentials' : function(credentials) {
                _synch(credentials);
                if(_principle) return _principle; else throw new Error('principle not found');
                if(credentials)$rootScope.$broadcast('oauth2:principle-credentials-updated', credentials);
            },
            'user':function(user, authorities){
                _synch(undefined,user,authorities);
                if(_user) return _user; else throw new Error('user not found');
                if(user)$rootScope.$broadcast('oauth2:principle-user-updated', user);
            },
            'authorities':function(authorities){
                _synch(undefined,undefined,authorities);
                if(_authorities)return _authorities; else throw new Error('authorities not found');
            },
            'getAccessToken': function() {
                return this.credentials().access_token;
            },
            'getRefreshToken': function() {
                return this.credentials().refresh_token;
            },
            'setAuthentications' : function(principle, user, authorities) {
                if(principle&&user&&authorities) _synch(principle, user, authorities); else throw new Error('principle not persisted',principle, user, authorities);
            },
            'clear' :_clear
        };
    }])
    // service to process auth requests
    .factory('OAuthProcessor',['$http', 'OAuthConfig', '$injector','$log','$httpParamSerializerJQLike', function($http, OAuthConfig, $injector, $log, $httpParamSerializerJQLike) {
        var context = OAuthConfig.getContext();
        var processor = null;
        try{
            processor = $injector.invoke(OAuthConfig.getEntryPoint());
        }catch (e){
            $log.debug(e);
        }
        var defaultProcessor = new (function(){
            this.accessToken = function(config,username,password) {
                var c = angular.extend({
                    method:"POST",
                    url: "${authServer}/${login}",
                },config);
                c.data = angular.extend({
                    "client_id": context.client.clientId,
                    "client_secret": context.client.clientSecret,
                    "username": username,
                    "password": password,
                    "grant_type": 'password',
                    "scope":  'read',
                },config.data);
                c.headers = angular.extend({'Content-Type': 'application/x-www-form-urlencoded'},config.headers);
                c.data = c.data&&c.headers['Content-Type']=='application/x-www-form-urlencoded'?
                    $httpParamSerializerJQLike(c.data):c.data;
                return $http(c).then(function(credentials) {
                    return credentials.data;
                });
            };
            this.refreshToken = function(config, refreshToken) {
                var c = angular.extend({
                    method:"POST",
                    url: "${authServer}/${login}",
                },config);
                c.data = angular.extend({
                    'client_id': context.client.clientId,
                    'client_secret': context.client.clientSecret,
                    'grant_type': 'refresh_token',
                    'refresh_token': refreshToken
                },config.data);
                c.headers = angular.extend({'Content-Type': 'application/x-www-form-urlencoded'},config.headers);
                c.data = c.data&&c.headers['Content-Type']=='application/x-www-form-urlencoded'?
                    $httpParamSerializerJQLike(c.data):c.data;
                return $http(c).then(function(credentials) {
                    return credentials.data;
                });
            };
            this.revokeToken = function(config) {
                var c = angular.extend({method:"POST",url: "${authServer}/${revoke}"},config);
                c.data = angular.extend({},config.data);
                c.headers = angular.extend({'Content-Type': 'application/x-www-form-urlencoded'},config.headers);
                c.data = c.data&&c.headers['Content-Type']=='application/x-www-form-urlencoded'?
                    $httpParamSerializerJQLike(c.data):c.data;
                return $http(c);
            };
            this.me = function(config) {
                var c = angular.extend({method:"GET",url: "${resourceServer}/${me}"},config);
                c.data = angular.extend({},config.data);
                c.headers = angular.extend({'Content-Type': 'application/x-www-form-urlencoded'},config.headers);
                c.data = c.data&&c.headers['Content-Type']=='application/x-www-form-urlencoded'?
                    $httpParamSerializerJQLike(c.data):c.data;

                return $http(c).then(function(me) {return me.data;});
            };
            this.extractRoles=function(users){
                return users.roles||['ROLE_USER'];
            }
        })();
        return {
            'accessToken':function(username, password) {
                return (processor&&typeof processor.accessToken == 'function')?processor.accessToken(username, password):defaultProcessor.accessToken(processor.accessToken,username, password);
            },
            'refreshToken': function(refreshToken) {
                return (processor&& typeof processor.refreshToken == 'function')?processor.refreshToken(refreshToken):defaultProcessor.refreshToken(processor.refreshToken,refreshToken);
            },
            'revokeToken' : function() {
                return (processor&& typeof processor.revokeToken == 'function')?processor.revokeToken():defaultProcessor.revokeToken(processor.revokeToken);
            },
            'me' : function() {
                return (processor&& typeof processor.me == 'function')?processor.me():defaultProcessor.me(processor.me);
            },
            'extractRoles' : function(user) {
                return ((processor&& typeof processor.extractRoles == 'function'&&processor.extractRoles)||defaultProcessor.extractRoles)(user);
            }
        }
    }])
    // interceptor for $httpProvider
    .factory('AuthInterceptor', ['OAuthConfig','$q', 'Principle', '$injector','$log', 'ExpResolver', function(OAuthConfig, $q, Principle, $injector, $log, ExpResolver) {

        var inFlightAuthRequest = null;
        var httpConfig = $injector.get('OAuthConfig').getHttp();
        ExpResolver.appMap('access_token',function(){try {return Principle.getAccessToken();}catch (e){}});
        return {
            'request': function (config) {
                config.url=ExpResolver.resolveUrl(config.url);
                if(httpConfig.intercept&&httpConfig.intercept.length) {
                    for (var i in httpConfig.intercept) {
                        var httpc = httpConfig.intercept[i];
                        for (var i in httpc.urlPatterns) {
                            if (httpc.urlPatterns[i].test(config.url)) {
                                for (var name in httpc.headers) {
                                    config.headers[name] = ExpResolver.resolve(httpc.headers[name]);
                                }
                                for (var name in httpc.params) {
                                    config.params[name] = ExpResolver.resolve(httpc.params[name]);
                                }
                            }

                        }
                    }
                }
                return config;
            },
            'responseError': function (response) {
                switch(response.status) {
                    case 401:
                        //if principle available than refresh the token
                        if(Principle.isAvailabel()&&OAuthConfig.getRefreshTokeGrandType()) {
                            var OAuthProcessor = $injector.get('OAuthProcessor');
                            var OAuth = $injector.get('OAuth');
                            var defer = $q.defer();
                            if(!inFlightAuthRequest) {
                                inFlightAuthRequest = OAuthProcessor.refreshToken(Principle.getRefreshToken());
                            }
                            inFlightAuthRequest.then(function(credentials) {
                                inFlightAuthRequest=null;
                                if(credentials.access_token) {
                                    Principle.credentials(credentials);
                                    $injector.get('$http')(response.config).then(function(resp){
                                        defer.resolve(resp);
                                    }, function(resp){
                                        defer.reject(resp);
                                    });
                                } else defer.reject(response);
                            }, function(error) {
                                inFlightAuthRequest = null;
                                defer.reject();
                                Principle.clear();
                                $injector.get('Redirection').confirmAccess();
                                return error;
                            });
                            return defer.promise;
                        }
                        break;
                }
                return $q.reject(response);
            }
        };
    }])
    //service to manage redirection process
    .factory('Redirection', ['$window','$location', 'OAuthConfig','Principle','$log','$rootScope', function($window,$location, OAuthConfig, Principle, $log, $rootScope) {

        var Redirection = new (function (){
            var view = OAuthConfig.getView();
            var redirectUrl = function(url){
                $log.debug('redirecting - ',url);
                var ele = document.createElement('a');
                ele.href = url;
                if(ele.host!=$window.location.host||ele.pathname!=$window.location.pathname){
                    $window.location.href = url;
                }
                $location.url(ele.hash.substr(1,ele.hash.length));
            };
            var getGrantedAuthoritiesOfUrl = function (url){
                url = url?url:$location.absUrl();
                var roles = [];
                for(var i in view.intercept){
                    var inter = view.intercept[i];
                    if(inter.urlPattern.test(url)){
                        roles=roles.concat(inter.roles);
                    }
                }
                return roles;
            };
            // method to check access in each time of page redirection
            this.confirmAccess= function(){
                var currentUrl = $location.absUrl();
                var currentUserRoles = null;
                try{
                    currentUserRoles = Principle.authorities();
                    currentUserRoles.push('IS_AUTHENTICATED_ANONYMOUSLY')
                }catch (e){$log.error(e.message); currentUserRoles = ['IS_ANONYMOUSLY'];}
                if(getGrantedAuthoritiesOfUrl(currentUrl).some(function(role){return currentUserRoles.indexOf(role)>=0;})){
                    $log.debug('page authenticated',currentUrl);
                    $rootScope.$broadcast('oauth2:page-authenticated', currentUrl);
                } else {
                    if(currentUserRoles.indexOf('IS_ANONYMOUSLY')<0){
                        redirectUrl(view.getAccessDeniedPageUrl());
                    }else {
                        redirectUrl(view.getLoginPageUrl());
                    }
                    $log.debug('page denied',currentUrl);
                    $rootScope.$broadcast('oauth2:page-denied', currentUrl);
                }
            };
            this.redirectToTarget = function(){
                redirectUrl(view.getTargetUrl());
            }
        })();
        return Redirection;
    }])
    .run(['$rootScope','Redirection', function($rootScope,Redirection){
        $rootScope.$on('$locationChangeStart',function(eve,old,newUrl){
            Redirection.confirmAccess();
        });
    }])
    //main provider for oauth flow
    .provider('OAuth', ['$httpProvider', 'OAuthConfigProvider', function($httpProvider, OAuthConfigProvider) {
        function config(config) {
            OAuthConfigProvider.setConfig(config);
        };
        //set interceptor
        $httpProvider.interceptors.push('AuthInterceptor');

        //oauth service
        function OAuth(OAuthConfig, Principle, Redirection, OAuthProcessor, $rootScope) {
            var context = OAuthConfig.getContext();
            this.getContext=function(){  return context;  };
            this.login = function(username, password, defaultTarget) {
                return OAuthProcessor.accessToken(username, password).then(function(cr){
                    Principle.credentials(cr);
                    return OAuthProcessor.me().then(function (user) {
                        Principle.user(user,OAuthProcessor.extractRoles(user));
                        defaultTarget&&Redirection.redirectToTarget();
                        return user;
                    },function(error){
                        $rootScope.$broadcast('oauth2:user-obtaining-failure', error);
                    });
                },function(error){
                    $rootScope.$broadcast('oauth2:credentials-obtaining-failure', error);
                });
            };

            this.logout = function() {
                return OAuthProcessor.revokeToken().then(function(resp) {
                    Principle.clear();
                    Redirection.confirmAccess();
                    $rootScope.$broadcast('oauth2:revoke-success',resp.data);
                },function(resp) {
                    Principle.clear();
                    Redirection.confirmAccess();
                    $rootScope.$broadcast('oauth2:revoke-failure', resp);
                });
            };
            this.getAbsUrl = function(path) {
                return context.url.resourceServer+path;
            };
            this.getAbsUrlWithAuth = function(path) {
                path = path.indexOf('?')>1?path+'&access_token='+Principle.getAccessToken():path+'?access_token='+Principle.getAccessToken();
                return context.url.resourceServer+path;
            };
            this.getUrlWithAuth = function(url) {
                url = url.indexOf('?')>1?url+'&access_token='+Principle.getAccessToken():url+'?access_token='+Principle.getAccessToken();
                return url;
            };
            return this;
        };
        return {
            config:config,
            $get:['OAuthConfig', 'Principle', 'Redirection', 'OAuthProcessor', '$rootScope', OAuth]
        };
    }])
    .directive('oauthSrc', ['ExpResolver', function (ExpResolver) {
        function setImage(url,element){
            var img = new Image();
            img.src = url;
            angular.element(img).bind('load', function () {
                element.attr('src', url);
            });
        }
        return {
            restrict: 'A',
            link: function ($scope, element, attrs) {
                var defaultUrl = attrs.defaultSrc?attrs.defaultSrc:'assets/img/no-image-icon.png';
                element.on('error', function(e) {
                    setImage(defaultUrl,element);
                });
                attrs.$observe('oauthSrc', function(newVal, oldVal) {
                    if (newVal != undefined) {
                        newVal += newVal.indexOf('?')>1?'&access_token=${access_token}':'?access_token=${access_token}';
                        setImage(ExpResolver.resolveUrl(newVal), element);
                    }
                });
            }
        };
    }]);