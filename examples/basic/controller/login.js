/**
 * Created by Naveen on 3/20/2016.
 */
angular.module('app').controller('LoginCtrl',['$scope','OAuth',function($scope, OAuth){
    $scope.login = function(username, password){
      OAuth.login(username,password).then(function(cre){
          console.log('login success..',cre);
      });
    };
}]);