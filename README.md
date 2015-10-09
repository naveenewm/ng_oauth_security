# oauth2_security
 AngularJs Security Module for OAuth 2 <br/>
 
    angular.module('app')
        .config(["OAuthProvider",function(OAuthProvider) {
                OAuthProvider.config({
                                   client: {
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
                                   },
								    http:[
									   {role:"OPEN",appPath:"index.html", apiPattern:"/api/v1/*"},
									   {role:"ROLE_USER1", appPath:"user1/index.html", apiPattern:"/api/v1/*"},
									   {role:"ROLE_USER2",appPath:"user2/index.html", apiPattern:"/api/v1/*"},
									   {role:"ROLE_ADMIN",appPath:"admin/index.html", apiPattern:"/api/v1/*"}
									]
                               });
            }
        ]);
