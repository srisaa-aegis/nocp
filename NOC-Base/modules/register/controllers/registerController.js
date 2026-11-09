angular.module('registers')
    .controller("registerController", function ($scope, $http) {
        var url = burl + "modules/register/";

        $scope.LoginUser = function () {
            if ($scope.login.captcha != $scope.login.verifyCaptcha) {
                alert('Please enter correct captcha');
                //$scope.generateCaptcha(5, '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ');
                $scope.generateCaptcha(5, '0123456789');
                $scope.login.verifyCaptcha = "";
            }
            else {
                $scope.isdisabled = true;
                ShowLoader();
                var nurl = url + "login.aspx?USR=" + $scope.login.username + "&PWD=" + encodeURIComponent($scope.login.password);
                $http.get(nurl).then(
                    function (response) {
                        var data = response.data;
                        HideLoader();
                        if (data["success"] == "Y") {
                            location.href = data["landing"];
                        }
                        else {
                            alert("The NOC Portal is down due to Technical Reason. We are actively solving the problem. We will be back soon");
                            //alert("Invalid User Name or Password");
                            //$scope.generateCaptcha(5, '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ');
                            $scope.generateCaptcha(5, '0123456789');
                            $scope.login.verifyCaptcha = "";
                        }
                        $scope.isdisabled = false;
                    },
                    function (response) {
                        HideLoader();
                        alert("Login Failed. Please try again.");
                        $scope.isdisabled = false;
                    });
            }
        }

        $scope.LogOut = function () {
            var nurl = url + "logout.aspx";
            $http.get(nurl).then(
                function (response) {
                    location.href = "index.html";
                },
                function (response) {
                    location.href = "index.html";
                });
        }

        $scope.Register = function () {
            ShowLoader();
            var nurl = url + "register.aspx?N=" + $scope.user.name + "&M=" + $scope.user.mobile_no + "&E=" + $scope.user.email + "&G=" + $scope.user.gender
                + "&B=" + $scope.user.dob + "&A=" + $scope.user.aadhar + "&AD=" + $scope.user.address;

            $http.get(nurl).then(
                function (response) {
                    var data = response.data;
                    if (data["success"] == "Y") {
                        HideLoader();
                        alert("Registration Successful. You will receive a SMS with the password. Please use your email-id as user name. Please contact ho.apfire@gmail.com for support.");
                        location.href = '#login';
                    }
                    else {
                        HideLoader();
                        alert("Registration Failed: " + data["error"]);
                    }
                },
                function (response) {
                    HideLoader();
                    alert("Registration has Failed.");
                });
        }

        $scope.ForgotPassword = function () {
            //location.href = '#login';
            ShowLoader();
            var nurl = url + "forgotpwd.aspx?USR=" + $scope.login.email;
            $http.get(nurl).then(
                function (response) {
                    var data = response.data;
                    if (data["success"] == "Y") {
                        HideLoader();
                        alert("Password will be sent to your registered mobile number. Please contact ho.apfire@gmail.com for support.");
                        location.href = '#login';
                    }
                    else {
                        HideLoader();
                        alert("Not Registered with this EmailID. Click Register Now to Register into NOC PORTAL");
                    }
                },
                function (response) {
                    HideLoader();
                    alert("Invalid user name.");
                });
        }

        $scope.GotoHome = function () {
            $http.get(rurl + "session.aspx").then(
                function (response) {
                    $scope.zession = response.data;
                    if ($scope.zession.success == "Y")
                        location.href = response["landing"];
                    else
                        location.href = "index.html";
                },
                function (response) {
                    location.href = "index.html";
                });
        }

        function init() {
            $scope.login = {
                username: "",
                password: "",
                email: "",
                captcha: "",
                verifyCaptcha: ""
            };

            $scope.user = {
                name: "",
                mobile_no: "",
                email: "",
                gender: "",
                dob: "",
                aadhar: "",
                address: "",
            };

            if (location.href.indexOf('logout') > 0) {
                $scope.LogOut();
            }
            else if (location.href.indexOf('gohome') > 0) {
                $scope.GotoHome();
            }

            //$scope.generateCaptcha(5, '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'); //sravani
            $scope.generateCaptcha(5, '0123456789');

        }

        $scope.generateCaptcha = function (length, chars) {
            var result = '';
            for (var i = length; i > 0; --i) result += chars[Math.round(Math.random() * (chars.length - 1))];
            $scope.login.captcha = result;
        }

        init();

    });