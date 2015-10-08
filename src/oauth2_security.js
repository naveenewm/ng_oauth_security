/**
 * Created by Naveen on 8/3/2015.
 */
angular.module("oauth2.security",[])
    .factory("Principle", ["$cookieStore", function($cookieStore) {
        var _principle;
        var _user;
        var PRINCIPLE_KEY="PRINCIPLE_KEY";
        var USER_KEY="USER_KEY";
        var synch = function() {
            _user = _user ? _user : $cookieStore.get(USER_KEY);
            _principle = _principle ? _principle : $cookieStore.get(PRINCIPLE_KEY);
        }
        return {
            "isAvailabel" : function() {
                synch();
                return Boolean(_principle);
            },
            "getPrinciple" : function() {
                synch();
                return _principle
            },
            "getAccessToken": function() {
                synch();
                return _principle ? _principle.access_token : null;
            },
            "getRefreshToken": function() {
                synch();
                return _principle ? _principle.refresh_token : null;
            },
            "getUser" : function() {
                synch();
                return _user
            },
            "setUser" :function(user) {
                _user = user;
                $cookieStore.put(USER_KEY, user);
            },
            "setPrinciple" : function(principle) {
                _principle = principle;
                $cookieStore.put(PRINCIPLE_KEY, principle);
            },
            "clear" :function() {
                $cookieStore.remove(PRINCIPLE_KEY);
                $cookieStore.remove(USER_KEY);
                _user = null;
                _principle = null;
            }
        };
    }])
    .factory("OAuthProcessor",["$http",function($http) {

        return {
            "accessToken":function(credencials) {
                return $http({
                    method:"POST",
                    url: (credencials.url.baseUrl + credencials.url.login),
                    data: $.param({
                        "client_id": credencials.client.clientId,
                        "client_secret": credencials.client.clientSecret,
                        "grant_type": credencials.client.passwordGrantType,
                        "scop":  credencials.client.scop,
                        "username": credencials.username,
                        "password": credencials.password
                    }),
                    headers: {'Content-Type': 'application/x-www-form-urlencoded'}
                }).then(function(credencials) {
                    return credencials.data;
                });
            },
            "refreshToken": function(credencials) {
                return $http({
                    method:"POST",
                    url: (credencials.url.baseUrl + credencials.url.login),
                    data: $.param({
                        "client_id": credencials.client.clientId,
                        "client_secret": credencials.client.clientSecret,
                        "grant_type": credencials.client.refreshTokeGrantType,
                        "refresh_token": credencials.refresh_token
                    }),
                    headers: {'Content-Type': 'application/x-www-form-urlencoded'}
                }).then(function(credencials) {
                    console.log('accessToken Refreshed===', credencials.data);
                    return credencials.data;
                });
            },
            "revokeToken" : function(credencials) {
                return $http({
                    method:"GET",
                    url:(credencials.url.baseUrl + credencials.url.api+ credencials.url.version+credencials.url.logout)
                });
            },
            "me" : function(credencials) {
                return $http.get(credencials.url.baseUrl+credencials.url.api+ credencials.url.version+credencials.url.user)
                    .then(function(me) {return me.data;});
            }
        }
    }])
    .factory("AuthInterceptor", ["$q", "Principle", "$injector", function($q, Principle, $injector) {

        var inFlightAuthRequest = null;

        return {
            'request': function (config) {
                var OAuth = $injector.get("OAuth");
                if(config.url.match(OAuth.getConfigByUser(Principle.getUser()).apiPattern)) {
                    config.headers = config.headers || {};
                    if (Principle.isAvailabel()) {
                        config.headers["Authorization"] = 'Bearer ' + Principle.getAccessToken();
                        config.headers["Accept"] = '*';
                    }
                }
                return config;
            },
            'responseError': function (response) {
                var OAuthProcessor = $injector.get('OAuthProcessor');
                //if principle available than refresh the token
                if(Principle.getPrinciple())
                    switch(response.status) {
                        case 401:
                            var OAuth = $injector.get("OAuth");
                            var defer = $q.defer();
                            if(!inFlightAuthRequest) {
                                var credential = angular.extend(Principle.getPrinciple(),OAuth.getApiConfig());
                                inFlightAuthRequest = OAuthProcessor.refreshToken(credential);
                            }
                            inFlightAuthRequest.then(function(credencials) {
                                inFlightAuthRequest=null;
                                if(credencials.access_token) {
                                    Principle.setPrinciple(credencials);
                                    $injector.get("$http")(response.config).then(function(resp){
                                        defer.resolve(resp);
                                    }, function(resp){
                                        defer.reject(resp);
                                    });
                                } else defer.reject(response);
                            }, function(error) {
                                inFlightAuthRequest = null;
                                defer.reject();
                                Principle.clear();
                                OAuth.redirectCurrentUserPage();
                                return error;
                            });
                            return defer.promise;
                            break;
                    }
                return $q.reject(response);
            }
        };
    }])
    .provider("OAuth", ["$httpProvider", function($httpProvider) {

        var _apiConfig;
        var _httpConfig;

        function config(config) {
            _apiConfig = config;
            _httpConfig = config.http;
        };

        $httpProvider.interceptors.push("AuthInterceptor");

        function OAuth(Principle, $window, $q, OAuthProcessor) {
            var me = this;
            this.getConfigByUser = function(user){
                var config = null;
                _httpConfig.forEach(function(conf) {
                    if (user && user.roles) {
                        if (conf.role == user.roles[0]) {
                            config = conf;
                            return true;
                        } else
                            return false;
                    }else {
                        if (conf.role == 'ROOT') {
                            config = conf;
                            return true;
                        } else
                            return false;
                    }
                });
                return config;
            };
            this.redirectCurrentUserPage = function() {
                var defer = $q.defer();
                if($window.location.pathname.match("/"+ me.getConfigByUser(Principle.getUser()).appPath)){
                    defer.resolve();
                } else
                    $window.location.href = me.getConfigByUser(Principle.getUser()).appPath;
                return defer.promise;
            };

            this.login = function(credencials) {
                angular.extend(credencials, _apiConfig);

                return OAuthProcessor.accessToken(credencials).then(function(cr){
                    Principle.setPrinciple(cr);
                    return OAuthProcessor.me(credencials).then(function (resp) {
                        Principle.setUser(resp);
                        me.redirectCurrentUserPage();
                        return resp;
                    });
                });
            };

            this.logout = function() {
                return OAuthProcessor.revokeToken(_apiConfig).then(function() {
                    Principle.clear();
                    me.redirectCurrentUserPage();
                },function() {
                    Principle.clear();
                    me.redirectCurrentUserPage();
                });
            };

            this.getApiConfig = function() {
                return _apiConfig;
            };
            this.getAbsUrl = function(path) {
                return _apiConfig.url.baseUrl+_apiConfig.url.api+_apiConfig.url.version+path;
            };
            this.getAbsUrlWithAuth = function(path) {
                path = path.indexOf('?')>1?path+"&access_token="+Principle.getAccessToken():path+"?access_token="+Principle.getAccessToken();
                return _apiConfig.url.baseUrl+_apiConfig.url.api+_apiConfig.url.version+path;
            };
            this.getUrlWithAuth = function(url) {
                url = url.indexOf('?')>1?url+"&access_token="+Principle.getAccessToken():url+"?access_token="+Principle.getAccessToken();
                return url;
            };
            return this;
        };
        return {
            config:config,
            $get:["Principle", "$window", "$q", "OAuthProcessor", OAuth]
        };
    }])
    .directive("logoutLink", ["OAuth", function(OAuth) {
        return {
            restrict:"AE",
            replace:true,
            template:'<a href="">Sign out</a>',
            link:function($scope, element, attr) {
                element.on("click",function(event) {
                    OAuth.logout();
                });
            }
        }
    }])
    .directive("currentUserName", ["Principle", function(Principle) {
        return {
            restrict:"AE",
            template:'{{currentUserName}}',
            link:function($scope, element, attr) {
                $scope.currentUserName = Principle.getUser().name;
            }
        }
    }])
    .directive("currentUserImage", ["Principle", function(Principle) {
        return {
            restrict:"E",
            replace:true,
            template:'<img oauth-ng-img="imageUrl" dimg="user">',
            controller:["$scope", function($scope) {
                $scope.imageUrl = Principle.getUser()["_links"].image?Principle.getUser()["_links"].image.href:'';
                $scope.$on("PROFILE_PICTURE_UPDATED_EVENT", function($event, url) {
                    $scope.imageUrl = url+"?"+Math.random();
                    var user = Principle.getUser();
                    user["_links"].image = {"href":url};
                    Principle.setUser(user);
                });
            }]
        }
    }])
    .directive("currentUserEmail", ["Principle", function(Principle) {
        return {
            restrict:"AE",
            template:'{{currentUserEmail}}',
            link:function($scope, element, attr) {
                $scope.currentUserEmail = Principle.getUser().email;
            }
        }
    }])
    .directive('oauthNgImg', ["OAuth", function (OAuth) {
        return {
            restrict: 'A',
            link: function (scope, el, attrs) {
                var url = attrs.oauthNgImg;
                var defaultUrl = "assets/img/no-image-icon.png";
                if(attrs.dimg=='user') {
                    defaultUrl = 'assets/img/avatars/user_profile.jpg';
                }
                el.on("error", function(e) {
                    el.attr("src",defaultUrl);
                });
                el.attr("src",OAuth.getUrlWithAuth(url));
                scope.$watch(attrs.oauthNgImg, function(url){
                    url&&el.attr("src",OAuth.getUrlWithAuth(url));
                });
            }
        };
    }]);