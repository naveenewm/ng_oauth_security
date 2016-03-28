/**
 * Created by Naveen on 3/15/2016.
 */
angular.module('app',['ngRoute','oauth2.security','ngAnimate'])
    .config(['$routeProvider',function($routeProvider){
        $routeProvider.otherwise('/public/login')
            .when('/phones', {
                templateUrl: 'view/phone-list.html',
                controller: 'PhoneListCtrl'
            }).
            when('/phones/:phoneId', {
                templateUrl: 'view/phone-detail.html',
                controller: 'PhoneDetailCtrl'
            })
            .when('/public/login', {
                templateUrl: 'view/login.html',
                controller: 'LoginCtrl'
            })
            .otherwise('/public/login');
    }]);