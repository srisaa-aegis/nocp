/**
 * FireAPP Module
 *
 * Description
 */
var ngAPP = angular.module('FireAPP', []);

ngAPP.controller('MainCtrl', ['$scope', function($scope) {
    $scope.isLogin = true, $scope.isRegister = false, $scope.isForgetPassword = false;

    // Form Display function
    $scope.displayForm = function(form) {
    	switch (form) {
    		case "register":
    			$scope.isLogin = false;
    			$scope.isRegister = true;
    			$scope.isForgetPassword = false;
    			break;
    		case "login":
    			$scope.isLogin = true;
    			$scope.isRegister = false;
    			$scope.isForgetPassword = false;
    			break;
    		case "forgetPassword":
    			$scope.isLogin = false;
    			$scope.isRegister = false;
    			$scope.isForgetPassword = true;
    			break;
    		default:
    			$scope.isLogin = true;
    			$scope.isRegister = false;
    			$scope.isForgetPassword = false;
    			break;
    	}
    };


    $scope.getArray = function(n) {
    	return new Array(n || 1);
    }
}])
