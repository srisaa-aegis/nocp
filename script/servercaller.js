function ServerCall(url, data, successFunction, failureFunction)
{
	$http.get(nurl).then(
		function(response) {
			var data = response.data;
			if(data["success"] == "Y")
			{
				HideLoader();
			    //alert("Registration Successful. You will receive an email and a SMS with the password. Please use yur email-id as user name");
			    alert("Registration Successful. You will receive a SMS with the password. Please use your email-id as user name");
				location.href = '#login';
			}
			else
			{
				HideLoader();
				alert("Registration Failed: " + data["error"]);
			}
		},
		function(response){
			HideLoader();
			alert("Registration has Failed.");
	});
}

function CanAccess(scall, otype, oid, callback) {
    if (oid) {
        var nurl = burl + "modules/common/canaccess.aspx?id=" + oid + "&t=" + otype;
        scall.get(nurl).then(
            function (response) {
                var data = response.data;
                if (data.status["success"] != "Y") {
                    location.href = '#invalid';
                }
                else {
                    callback();
                }
            },
            function (response) {
            });
    }
    else {
        callback();
    }
}