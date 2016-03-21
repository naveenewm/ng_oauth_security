oauth2-security
============================
 oauth2-security is a security module for [AngularJs](http://angularjs.org/) to manage client side authentication and authorization for OAuth 2 servers (currently for only password flow). 
 
### Features
-------------
  - It will manage page direction according to user roles,
  - Keep Cookies for http authentication token and user.
  - Interceptor for Authenticate http request and obtains refresh_token automatically.
  - Url expression Resolver for baseUrl.
  
### Install
--------------
* Download latest from [here](https://github.com/naveenewm/oauth2-security/releases/latest)

```html
<script src="angular(.min).js"></script>
<script src="oauth2-security(.min).js"></script>
```
 
* Add a dependency in your app module : `angular.module('myApp', ['oauth2-security'])`

  
### Configuration
------------------
     angular.module('myApp')
     .config(["OAuthProvider", 
         function(OAuthProvider) {
            OAuthProvider.config({
                refreshTokeGrandType:true,
                context:{<!--context for app-->},
                http:{<!--config for http ajax request-->},
                view:{<!--view config for app, hash url pattern based-->},
                entryPoint:[<!--entry point for oauth2 flow to obtain tokens and user details-->],
            });
         }
      ]);
      
##### Context

OAuth has `OAuthConfig` service which contains all configs and context object, purpose of this context to hold constant like urls, client info etc.. context can access by `OAuthConfig.getContext()`.

     context:{
         url:{
             "baseUrl": <!--base url-->,
             "login": <!--login url-->,
             "logout": <!--revoke url-->,
             "user": <!--url to get user info-->
         },
         client: {
             "clientId": <!--client id-->,,
             "clientSecret":<!--client secret-->,,
             "scope":<!--scope of user auth-->,
         }
     }
     
##### Http

* This is to manage http ajax call config and maintain oauth flows (proceed refresh_token grant type).
* Resolvable url expression which use full for add bashUrl in every `$http` url with expression of `${key}`.
* `secureApiUrlPatterns` is RegExp to authenticate http request by adding `Authorization` header by default `Authorization = Bearer ${access_token}`
* Intercept for add common params and headers with resolvable expression by mapped url patterns.


        http:{
             secureApiUrlPatterns:[<!--url RegExp pattern like /.*\/api\/.*/ -->],
             intercept:[
                 {urlPatterns:[/.*\/api\/.*/], headers:{'Accept': '*'},params:{}}
             ],
             urlResolver:function(context){
                 return {map:context.url}
             },
        },
        
##### View

* This is to manage views based on authorities (roles) of the users by `RegExp` pattern which match with url.
* Url's to redirection of target and access denied pages (optionally injectable config also).
* `IS_ANONYMOUSLY` is authority for access to non authenticated pages.
* `IS_AUTHENTICATED_ANONYMOUSLY` is authority for common access to authenticated pages.


        view:{
            loginPage:" url to login page (ex: #/public/login)",
            intercept:[
                {urlPattern:/.*#\/public\/.*/, roles:["IS_ANONYMOUSLY"]},
                {urlPattern:/.*#\/products\/.*/, roles:["ROLE_PRODUCT"]},
                {urlPattern:/.*#\/reports\/.*/, roles:["ROLE_REPORT"]},
            ],
            targetUrl:"#/home",
            deniedPageUrl:"#/public/denied",
        },
        
##### Entry Point

* Optionally for detail configuration to obtain `access_token` , `refresh_token` , user details and extract authorities.
* `entryPoint` is injectable factory method which should return config object with `accessToken`, `refreshToken`, `revokeToken`, `me` and `extractRoles` functions.
* If this config not exist default implementation will be applied.

        entryPoint:["$http","OAuthConfig",function($http, OAuthConfig){
             var context = OAuthConfig.getContext();
             return {
                 "accessToken":function(username, password) {
                     return $http({
                         method:"POST",
                         url: "${baseUrl}{{login}}",
                         data: $.param({
                             "client_id": context.client.clientId,
                             "client_secret": context.client.clientSecret,
                             "grant_type": context.client.passwordGrantType,
                             "scope":  context.client.scop,
                             "username": username,
                             "password": password
                         }),
                         headers: {'Content-Type': 'application/x-www-form-urlencoded'}
                     }).then(function(credentials) {
                         return credentials.data;
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
                     }).then(function(credentials) {
                         return credentials.data;
                     });
                 },
                 "revokeToken" : function() {
                     return $http({
                         method:"GET",
                         url: "{{baseUrl}}{{logout}}"
                     });
                 },
                 "me" : function() {
                     return $http.get("{{baseUrl}}{{user}}")
                         .then(function(user) { return user.data; });
                 },
                 "extractRoles":function(user){
                     return user.roles;
                 }
             }
         }];
         
#### Directive 

* directive to access secure image by adding access_token param in the url. 

        <img oauth-src="{{user._links.image.href}}" default-src="images/default.png"/>
        
#### Services

* `OAuth` is main service for oauth2.
* `Principle` is service holed credentials and user info.
* `ExpResolver` is service which resolve http expressions ex: `${baseUrl}`.
* `OAuthConfig` is service to hold configs of oauth.

### Credits
------------

Credit goes to [Spring Security](http://projects.spring.io/spring-security)