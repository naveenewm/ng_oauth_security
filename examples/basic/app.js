/**
 * Created by Naveen on 3/15/2016.
 */
angular.module('app',['ngRoute','oauth2.security'])

    .config(['$routeProvider',function($routeProvider){
        $routeProvider.otherwise('/public/login')
            .when('/public/login', {
            templateUrl: 'view/login.html',
            controller: 'LoginCtrl'
        })
    }])
    .config(['OAuthProvider',function(OAuthProvider){
        OAuthConfig.config({
            grantType:'authorizationCode',
            refreshTokeGrandType:false,
            global:{
                url:{
                    "authServer": "https://github.com",
                    "baseUrl": "https://api.github.com",
                },
                client:{
                    'clientID':'ef09717c1a1ef92d3059',
                    'clientSecret':'a42e8640b5954f5ad33e070d45d5ed52ea9c68b3',
                }
            },
            http:{
                secureApiUrlPatterns:[/.*\/api\/.*/],
                intercept:[
                    {urlPatterns:[/.*\/api\/.*/], headers:{'Authorization':'Bearer {{access_token}}'}, params:{}}
                ],
                urlResolver:function(context){
                    return {map:context.url}
                },
            },
            view:{
                loginPage:"ous_index.html#/app/login",
                intercept:[
                    {urlPattern:/.*#\/login.*/, roles:["IS_ANONYMOUSLY"]},
                    {urlPattern:/.*#\/home.*/, roles:["ROLE_USER"]},
                ],
                targetUrl:"#/home",//optional
                deniedPageUrl:"#/denied",//optional
            },
            entryPoint:["$http","OAuthConfig",function($http, OAuthConfig){
                var context = OAuthConfig.getContext();
                return {
                    "authorizationCode":{
                        url:'{{authServer}}/login/oauth/authorize',
                        param:{
                            'client_id': context.client.clientId,
                            'scope': 'repo, user',
                            'state': 'githubdemoapp',
                        }
                    },
                    "accessToken":function(authorizationCode) {
                        return $http({
                            method:"POST",
                            url: "{{authServer}}//login/oauth/authorize",
                            data: $.param({
                                "client_id": context.client.clientId,
                                "grant_type": context.client.passwordGrantType,
                                "scope":  'repo, user',
                                "state": authorizationCode.state,
                            }),
                            headers: {'Content-Type': 'application/x-www-form-urlencoded'}
                        }).then(function(credencials) {
                            return credencials.data;
                        });
                    },
                    "refreshToken": function(refreshToken) {
                        return $http({
                            method:"POST",
                            url:  "{{baseUrl}}{{login}}",
                            data: $.param({
                                "client_id": context.client.clientId,
                                "client_secret": context.client.clientSecret,
                                "grant_type": context.client.refreshTokeGrantType,
                                "refresh_token": refreshToken
                            }),
                            headers: {'Content-Type': 'application/x-www-form-urlencoded'}
                        }).then(function(resp) {
                            return resp.data;
                        });
                    },
                    "revokeToken" : function() {
                        return $http({
                            method:"GET",
                            url: "{{apiUrl}}{{logout}}"
                        });
                    },
                    "me" : function() {
                        return $http.get("{{apiUrl}}{{user}}")
                            .then(function(resp) { return resp.data; });
                    },
                    "extractRoles":function(user){
                        return user.roles;
                    }
                }
            }]
        });
    }]);