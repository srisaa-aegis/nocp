angular.module('register')
.service('serverCall', ['$http', function ($http) {
	this.getData = function(serverURL, data, successCallback, loader = true){
		if ( loader ) ShowLoader();
		$http.post(serverURL, data, {headers: {'Content-Type': 'application/x-www-form-urlencoded'} })
		.then(function (response) {
				var data = response.data["data"];
				var status = response.data["status"];
				if(status["success"] == "I")
				{
					alert('Invalid Session. Please login again.');
					location.href = 'index.html';
				}
				else
				{
					successCallback(response);
					if ( loader ) HideLoader();
				}
		},
		function (response) {
			alert("System Error - " + response);
			if ( loader ) HideLoader();
		});
    }
 }]);

