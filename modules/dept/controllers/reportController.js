angular.module('dept')
    .controller("reportController", ['$scope', '$http', '$routeParams', '$window', function ($scope, $http, $routeParams, $window) {
        var nurl = burl + "modules/dept/";
        var rurl = burl + "modules/register/";
        $scope.zession = [];
        $scope.statuses = [];
        $scope.applTypes = [];
        //$scope.Rpt_type = "";
        //$scope.rpt_scope = "MSB";
        //$scope.appl_type = "";
        //$scope.from_date = "";
        //$scope.to_date = "";

        $scope.rpt_parms =
            {
                "Rpt_type": "",
                "rpt_scope": "",
                "appl_type": "",
                "from_date": "01/01/1900",
                "to_date": "01/01/1900",
                "region": 0
            };

        $http.get(url + "apis/ApplTypes.txt").success(function (response) {
            $scope.applTypes = response;
        });

        $http.get(url + "apis/Statuses.txt").success(function (response) {
            $scope.statuses = response;
        });

        $scope.FetchData = function () {
            if ($scope.rpt_parms.Rpt_type == "3" && $scope.rpt_parms.appl_type.length < 1) {
                alert("Please select type of application.");
            }
            else {
                $http.post(nurl + "reports.aspx", $scope.rpt_parms, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                    .then(function (response) {
                        var data = response.data["data"];
                        var status = response.data["status"];
                        if (status["success"] == "Y") {
                            $scope.applicationdata = data;
                        }
                        else {
                            alert("No data found.");
                        }
                    },
                        function (response) {
                            alert("Failed to Fetch Information.");
                        });
            }
        }

        function init() {
            $scope.id = $routeParams.id;
            if (location.href.indexOf("pendency") > 0) {
                $scope.rpt_parms.Rpt_type = "1";
            }
            else if (location.href.indexOf("statistics") > 0) {
                $scope.rpt_parms.Rpt_type = "2";
            }
            else if (location.href.indexOf("conslidated") > 0) {
                $scope.rpt_parms.Rpt_type = "3";
            }
            else if (location.href.indexOf("sms") > 0) {
                $scope.rpt_parms.Rpt_type = "4";
            }
            else if (location.href.indexOf("feedback") > 0) {
                $scope.rpt_parms.Rpt_type = "5";
            }
            else if (location.href.indexOf("applications") > 0) {
                $scope.rpt_parms.Rpt_type = "6";
            }
            else if (location.href.indexOf("overdue") > 0) {
                $scope.rpt_parms.Rpt_type = "7";
            }
            var date = new Date();
            $scope.CurrentDate = date;
        }
        // init();
        $scope.status_description = function (sts) {
            for (var i in $scope.statuses) {
                if ($scope.statuses[i].code == sts) {
                    return $scope.statuses[i].desc;
                }
            }
            return "";
        }
        $http.get(rurl + "session.aspx").then(
            function (response) {
                $scope.zession = response.data;
                if ($scope.zession.success == "Y")
                    init();
                else
                    location.href = "index.html";
            },
            function (response) {
                location.href = "index.html";
            });
    }]);