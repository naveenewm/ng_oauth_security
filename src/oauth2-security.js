/**
 * Created by Naveen on 8/3/2015.
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
    .factory('Principle', ['$cookieStore', function($cookieStore) {
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
            'getPrinciple' : function() {
                _synch();
                if(_principle) return _principle; else throw new Error('principle not found');
            },
            'getUser' : function() {
                _synch();
                if(_user) return _user; else throw new Error('user not found');
            },
            'getAuthorities' : function() {
                _synch();
                if(_authorities)return _authorities; else throw new Error('authorities not found');
            },
            'getAccessToken': function() {
                return this.getPrinciple().access_token;
            },
            'getRefreshToken': function() {
                return this.getPrinciple().refresh_token;
            },
            'setPrinciple' : function(principle) {
                if(principle) _synch(principle); else throw new Error('principle not persisted',principle);
            },
            'setUser' :function(user, authorities) {
                if(user && authorities) _synch(undefined,user,authorities); else throw new Error('user not persisted',user, authorities);
            },
            'setAuthentications' : function(principle, user, authorities) {
                if(principle&&user&&authorities) _synch(principle, user, authorities); else throw new Error('principle not persisted',principle, user, authorities);
            },
            'clear' :_clear
        };
    }])
    // service to process auth requests
    .factory('OAuthProcessor',['$http', 'OAuthConfig', '$injector','$log', function($http, OAuthConfig, $injector, $log) {
        var context = OAuthConfig.getContext();
        var processor = null;
        try{
            processor = $injector.invoke(OAuthConfig.getEntryPoint());
        }catch (e){
            $log.debug(e.message);
        }
        var defaultProcessor = new (function(){
            this.accessToken = function(username, password) {
                return $http({
                    method:'POST',
                    url: (context.url.baseUrl + context.url.login||'/token'),
                    data: $.param({
                        'client_id': context.client.clientId,
                        'client_secret': context.client.clientSecret,
                        'grant_type': context.client.passwordGrantType,
                        'scope':  context.client.scope,
                        'username': username,
                        'password': password
                    }),
                    headers: {'Content-Type': 'application/x-www-form-urlencoded'}
                }).then(function(credencials) {
                    return credencials.data;
                });
            };
            this.refreshToken = function(refreshToken) {
                return $http({
                    method:'POST',
                    url: (context.url.baseUrl + context.url.login||'/login'),
                    data: $.param({
                        'client_id': context.client.clientId,
                        'client_secret': context.client.clientSecret,
                        'grant_type': context.client.refreshTokeGrantType,
                        'refresh_token': refreshToken
                    }),
                    headers: {'Content-Type': 'application/x-www-form-urlencoded'}
                }).then(function(credencials) {
                    return credencials.data;
                });
            };
            this.revokeToken = function() {
                return $http({
                    method:'GET',
                    url:(context.url.baseUrl + context.url.logout||'/revoke')
                });
            };
            this.me = function() {
                return $http.get(context.url.baseUrl+context.url.user||'/me')
                    .then(function(me) {return me.data;});
            };
            this.extractRoles=function(users){
                return users.roles||['ROLE_USER'];
            }
        })();
        return {
            'accessToken':function(username, password) {
                return ((processor&&typeof processor.accessToken == 'function'&&processor.accessToken)||defaultProcessor.accessToken)(username, password);
            },
            'refreshToken': function(refreshToken) {
                return ((processor&& typeof processor.refreshToken == 'function'&&processor.refreshToken)||defaultProcessor.refreshToken)(refreshToken);
            },
            'revokeToken' : function() {
                return ((processor&& typeof processor.revokeToken == 'function'&&processor.revokeToken)||defaultProcessor.revokeToken)();
            },
            'me' : function() {
                return ((processor&& typeof processor.me == 'function'&&processor.me)||defaultProcessor.me)();
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
                            inFlightAuthRequest.then(function(credencials) {
                                inFlightAuthRequest=null;
                                if(credencials.access_token) {
                                    Principle.setPrinciple(credencials);
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
    .factory('Redirection', ['$window','$location', 'OAuthConfig','Principle','$log', function($window,$location, OAuthConfig, Principle, $log) {

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
                    currentUserRoles = Principle.getAuthorities();
                    currentUserRoles.push('IS_AUTHENTICATED_ANONYMOUSLY')
                }catch (e){$log.error(e.message); currentUserRoles = ['IS_ANONYMOUSLY'];}
                if(getGrantedAuthoritiesOfUrl(currentUrl).some(function(role){return currentUserRoles.indexOf(role)>=0;})){
                    $log.debug('page authenticated',currentUrl);
                } else {
                    if(currentUserRoles.indexOf('IS_ANONYMOUSLY')<0){
                        redirectUrl(view.getAccessDeniedPageUrl());
                    }else {
                        redirectUrl(view.getLoginPageUrl());
                    }
                    $log.debug('page denied',currentUrl);
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
                    Principle.setPrinciple(cr);
                    return OAuthProcessor.me().then(function (user) {
                        Principle.setUser(user,OAuthProcessor.extractRoles(user));
                        defaultTarget&&Redirection.redirectToTarget();
                        $rootScope.$broadcast('oauthAccessTokenObtainingSuccess', user);
                        return user;
                    });
                });
            };

            this.logout = function() {
                return OAuthProcessor.revokeToken().then(function(resp) {
                    Principle.clear();
                    Redirection.confirmAccess();
                    $rootScope.$broadcast('oauthRevokeSuccess',resp);
                },function(resp) {
                    Principle.clear();
                    Redirection.confirmAccess();
                    $rootScope.$broadcast('oauthRevokeSuccess', resp);
                });
            };
            this.getAbsUrl = function(path) {
                return context.url.baseUrl+context.url.api+context.url.version+path;
            };
            this.getAbsUrlWithAuth = function(path) {
                path = path.indexOf('?')>1?path+'&access_token='+Principle.getAccessToken():path+'?access_token='+Principle.getAccessToken();
                return context.url.baseUrl+context.url.api+context.url.version+path;
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
    .directive('oauthSrc', ['OAuth', function (OAuth) {
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
                    if (newVal != undefined) setImage(OAuth.getUrlWithAuth(newVal), element);
                });
            }
        };
    }]);