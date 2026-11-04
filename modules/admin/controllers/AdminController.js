angular.module('admin')
.controller("adminController", ['$scope', '$http', '$routeParams', '$window', '$timeout', function ($scope, $http, $routeParams, $window, $timeout) {
    var rurl = burl + "modules/admin/";

    function init() {
        $scope.deletedfiles = [];
    }

    init();

    $scope.SendEscalation = function () {
        var callapi = "escalations.aspx";
        $http.post(rurl + callapi, "{}", { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
         .then(function (response) {
             var data = response.data["data"];
             var status = response.data["status"];
             if (status["success"] == "Y") {
                 alert("Escalations Sent Successfully.");
             }
             else {
                 alert("Sending Escalations Failed - " + status["error"]);
             }
         },
        function (response) {
            alert("Sending Escalations Failed.");
        });
    }

    $scope.DeleteOldFiles = function () {
        var callapi = "deleteOldFiles.aspx";
        $http.post(rurl + callapi, "{}", { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
         .then(function (response) {
             var data = response.data["data"];
             var status = response.data["status"];
             if (status["success"] == "Y") {
                 $scope.deletedfiles = data;
                 alert("Deleted Successfully.");
             }
             else {
                 alert("Delete Files Failed - " + status["error"]);
             }
         },
        function (response) {
            alert("Delete Files Failed.");
        });
    }
}]);
