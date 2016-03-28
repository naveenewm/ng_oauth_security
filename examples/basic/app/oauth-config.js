/**
 * Created by Naveen on 3/24/2016.
 */
angular.module('app')
    .config(['OAuthProvider',function(OAuthProvider){
        OAuthProvider.config({
            grantType:'password',
            refreshTokeGrandType:true,
            context:{
                url:{
                    //"authServer": "http://localhost",
                    //"resourceServer": "http://localhost/api",
                    "authServer": "http://oauth2psw.naveenewm.net16.net",
                    "resourceServer": "http://oauth2psw.naveenewm.net16.net/api",
                    'login':'token.php',
                    'revoke':'revoke.php',
                    'me':'me.php'
                },
                client:{
                    'clientId':'oauth2_security_demo',
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
                loginPage:"#/public/login",
                intercept:[
                    {urlPattern:/.*#\/public\/.*/, roles:["IS_ANONYMOUSLY"]},
                    {urlPattern:/.*#\/phones.*/, roles:["ROLE_USER"]},
                    {urlPattern:/.*#\/phones\/.*/, roles:["ROLE_USER"]},
                ],
                targetUrl:"#/phones",//optional
                deniedPageUrl:"#/phones",//optional
            },
            entryPoint:["$http","OAuthConfig",function($http, OAuthConfig){
                var context = OAuthConfig.getContext();
                return {
                    "accessToken": {
                        method:"POST",
                        url: "${authServer}/${login}",
                        data: {
                            "client_id": context.client.clientId,
                            "client_secret": context.client.clientSecret,
                            "grant_type": 'password',
                            "scope":  'read',
                        }
                    },
                    "refreshToken": {
                        method:"POST",
                        url:  "${resourceServer}/${login}",
                        data: {
                            "client_id": context.client.clientId,
                            "client_secret": context.client.clientSecret,
                            "grant_type": 'refresh_token',
                        },
                    },
                    "revokeToken" : {
                        method:"GET",
                        url: "${apiUrl}/{logout}"
                    },
                    "me" : {url:"${resourceServer}/${me}"},
                    "extractRoles":function(user){
                        return user.roles;
                    }
                }
            }]
        });
    }]);