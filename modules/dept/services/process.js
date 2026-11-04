angular.module('dept')
.service('Process', ['$http', function ($http) {
	this.ProcessSteps = function(aid){
		$http.post(uploadUrl, fd, {
			transformRequest: angular.identity,
			headers: {'Content-Type': undefined}
		})
		.success(function(){
		})
		.error(function(){
		});
    }
 }]);
