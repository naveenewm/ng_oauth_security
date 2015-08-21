# ng_oauth_security
 AngularJs Security Module for OAuth 2 <br/>
 
    angular.module('app')
        .config(["OAuthProvider",function(OAuthProvider) {
                OAuthProvider.config({
                                   appId: {
                                       "clientId": "mysupplycompany",
                                       "clientSecret":"mycompanykey",
                                       "passwordGrantType":"password",
                                       "refreshTokeGrantType":"refresh_token",
                                       "scop":"read"
                                   },
                                   url:{
                                       "baseUrl": "--base url--", // For example: http://localhost:8080/chains,
                                       "api":"/api/",
                                       "version":"v1",
                                       "login":"/token",
                                       "logout":"/revoke",
                                       "user":"/me"
                                   }
                               },[
                                   {role:"OPEN",index:"index.html", securePattern:"/api/v1/*"},
                                   {role:"ROLE_RETAIL", index:"rt_index.html", securePattern:"/api/v1/*"},
                                   {role:"ROLE_WSALER",index:"ws_index.html", securePattern:"/api/v1/*"},
                                   {role:"ROLE_SUPPLIER",index:"sp_index.html", securePattern:"/api/v1/*"}
                               ]);
            }
        ]);
