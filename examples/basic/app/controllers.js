'use strict';

/* Controllers */
angular.module('app')
    .controller('LoginCtrl',['$scope','OAuth',function($scope, OAuth){
      $scope.username = 'user@demo.com';
      $scope.password = 'user123';
      $scope.login = function(username, password){
        OAuth.login(username,password,true);
      };
    }])
    .controller('PhoneListCtrl', ['$scope','$http','OAuth',
      function($scope, $http, OAuth) {
        $http.get('${resourceServer}/phones/phones.php').then(function(phones){
        $scope.phones = phones.data;
        });
        $scope.orderProp = 'age';
        $scope.logout = function(){
          OAuth.logout();
        };
      }])
    .controller('PhoneDetailCtrl', ['$scope', '$routeParams',"$http",
      function($scope, $routeParams, $http) {
        $http.get('${resourceServer}/phones/'+$routeParams.phoneId+'.php').then(function(phone){
          $scope.phone =phone.data;
          $scope.mainImageUrl = phone.data.images[0];
        });
        $scope.setImage = function(imageUrl) {
          $scope.mainImageUrl = imageUrl;
        };
      }]);
