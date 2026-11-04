angular.module('dept')
    .controller("blockController", ['$scope', '$http', '$routeParams', 'fileUpload', '$window', function ($scope, $http, $routeParams, fileUpload, $window) {

        $scope.UploadFiles = function () {
            var nurl = burl + "modules/citizen/";

            var fd = new FormData();
            fd.append($('#lfileSitePlan').html(), $scope.fileSitePlan);
            fd.append($('#lfileSectionPlan').html(), $scope.fileSectionPlan);
            fd.append($('#lfileElevationPlan').html(), $scope.fileElevationPlan);

            for (i = 0; i < $scope.block.floors.length; i++) {
                fd.append($('#lfileFloorPlan_' + i).html(), document.getElementById("fileFloorPlan_" + i).files[0]);
            }

            var uploadUrl = nurl + "uploadplans.aspx?bid=" + $routeParams.id;
            fileUpload.uploadFileToUrl(fd, uploadUrl);
            alert("Plans uploaded successfully.");
            $scope.ViewApplication();
        };

        function init() {
            $scope.buildTypes = [];

            //		var url = "http://localhost:8080/fireapp/";
            var nurl = burl + "modules/citizen/";

            $http.get(url + "apis/BuildTypes.txt").success(function (response) {
                $scope.buildTypes = response;
            });
            $http.get(url + "apis/Equipments.txt").success(function (response) {
                $scope.equipTypes = response;
            });

            if ($routeParams.id) {
                $http.post(nurl + "block.aspx", { "block_id": $routeParams.id }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                    .then(function (response) {
                        var data = response.data["data"];
                        var status = response.data["status"];
                        if (status["success"] == "Y") {
                            $scope.block = data;
                            $http.post(nurl + "application.aspx", { "appl_id": $scope.block.appl_id, "partial": true }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                                .then(function (response) {
                                    var data = response.data["data"];
                                    var status = response.data["status"];
                                    if (status["success"] == "Y") {
                                        $scope.application = data;
                                    }
                                    else {
                                        alert("Error: " + status["error"]);
                                    }
                                },
                                    function (response) {
                                        alert("Failed to Fetch Application Information.");
                                    });
                        }
                        else {
                            alert("QError: " + status["error"]);
                        }
                    },
                        function (response) {
                            alert("Failed to Fetch Block Information.");
                        });
            }
        }

        $http.get(rurl + "session.aspx").then(
            function (response) {
                $scope.zession = response.data;
                if ($scope.zession.success == "Y") {
                    if ($scope.zession.rid != 4) {
                        init();
                    }
                    else {
                        location.href = '#invalid';
                    }
                }
                else {
                    location.href = "index.html";
                }
            },
            function (response) {
                location.href = "index.html";
            });

        //$scope.reqd_escape_width = function (stype){
        //	if ( stype == 'I' ) {
        //		if ( $scope.application.site_type == 'ins' || $scope.application.site_type == 'asm' )
        //			return "2.0";
        //		else
        //			return "1.5";
        //	} else if ( stype == 'E' ) {
        //		return "1.25";
        //	} else if ( stype == 'R' ) {
        //		return "2.0";
        //	} else if ( stype == 'C' ) {
        //		return "1-Way: 3.6 / 2-Way:5.4";
        //	} else {
        //		return "NA";
        //	}
        //}

        $scope.reqd_escape_width = function (block, stype) {
            var nbc_year;
            if ($scope.application.noc_format == "final_noc") {
                nbc_year = "2005";
            }
            else {
                nbc_year = "2016";
            }
            return Common_reqd_escape_width(stype, block.site_type, block.site_stype, $scope.MaxOccuCount, nbc_year);
        }

        $scope.MaxOccuCount = function () {
            var max_ocount = 0;
            for (var i in $scope.block.floors) {
                if (($scope.block.floors[i].flr_type == 'F' || $scope.block.floors[i].flr_type == 'G') && parseFloat($scope.block.floors[i].occ_c_app) > max_ocount) {
                    max_ocount = parseFloat($scope.block.floors[i].occ_c_app);
                }
            }
            return max_ocount;
        }

        $scope.reqd_open_space = function (block, ospace) {
            if ($scope.application.status_id == 1) {
                ospace.os_reqd = Common_reqd_open_space(block, ospace.direc, $scope.application.plot_area);
            }
            return ospace.os_reqd;
        }        

        $scope.t20OccCount = function (floor) {
            if ($scope.application.status_id == 1) {
                floor.occu_count_reqd = Common_t20OccCount(floor);
            }
            return floor.occu_count_reqd;
        }

        $scope.t20OccCount_O = function (floor) {
            if ($scope.application.status_id == 1) {
                floor.parent_occu_count_reqd = Common_t20OccCount_O(floor);
            }
            return floor.parent_occu_count_reqd;
        }
        $scope.direction_name = function (direc) {
            if (direc == 'E') return 'East';
            else if (direc == 'W') return 'West';
            else if (direc == 'N') return 'North';
            else if (direc == 'S') return 'South';
            else return direc;
        }

        $scope.equipment_desc = function (equip) {
            for (var i in $scope.equipTypes) {
                if ($scope.equipTypes[i].id == equip) {
                    return $scope.equipTypes[i].desc;
                }
            }
            return "";
        }

        $scope.equipment_suffix = function (equip) {
            for (var i in $scope.equipTypes) {
                if ($scope.equipTypes[i].id == equip) {
                    return $scope.equipTypes[i].suffix;
                }
            }
            return "";
        }

        $scope.AddFloor = function () {
            var nfloor = { "floor_id": 0, "flr_type": "", "flr_name": "", "built_area": 0, "occ_type": "", "occ_c_app": 0 };
            $scope.block.floors.push(nfloor);
        }

        $scope.DeleteFloor = function (idx) {
            var r = confirm("Do you really want to delete the Floor '" + $scope.block.floors[idx].flr_name + "'?");
            if (r == true) {
                $scope.block.floors.splice(idx, 1);
            }
        }

        $scope.DeleteEscape = function (idx) {
            var r = confirm("Do you really want to delete the Escape '" + $scope.block.escapes[idx].desc + "'?");
            if (r == true) {
                $scope.block.escapes.splice(idx, 1);
            }
        }

        $scope.AddEscape = function () {
            var nescape = { "escape_id": 0, "etype": "", "desc": "", "width": 0, "location": "" };
            $scope.block.escapes.push(nescape);
        }

        $scope.FileExists = function (fname) {
            for (var i in $scope.block.files) {
                if ($scope.block.files[i].name == fname + ".pdf") {
                    return true;
                }
            }
            return false;
        }

        $scope.DownloadFile = function (fname) {
            var purl = burl + "uploads/blocks/" + $scope.block.block_id + "/" + fname + ".pdf";
            $window.open(purl);
        }

        $scope.SaveDetails = function () {
            if ($scope.application.status_id == 1) {
                var nurl = burl + "modules/citizen/";
                $http.post(nurl + "saveblockdetails.aspx", $scope.block, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                    .then(function (response) {
                        var data = response.data["data"];
                        var status = response.data["status"];
                        if (status["success"] == "Y") {
                            $scope.block.block_id = data["block_id"];
                            alert("Successfully Saved");
                            $scope.GotoEscapes();
                        }
                        else {
                            alert("Error: " + status["error"]);
                        }
                    },
                        function (response) {
                            alert("Block Save Failed.");
                        });
            }
            else {
                $scope.GotoEscapes();
            }
        }

        $scope.SaveEscapes = function () {
            if ($scope.application.status_id == 1) {
                var nurl = burl + "modules/citizen/";
                $http.post(nurl + "saveescapes.aspx", $scope.block, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                    .then(function (response) {
                        var data = response.data["data"];
                        var status = response.data["status"];
                        if (status["success"] == "Y") {
                            alert("Successfully Saved");
                            $scope.GotoFFE();
                        }
                        else {
                            alert("Error: " + status["error"]);
                        }
                    },
                        function (response) {
                            alert("Escape Save Failed.");
                        });
            }
            else {
                $scope.GotoFFE();
            }
        }

        $scope.ConfirmFFE = function () {
            if ($scope.application.status_id == 1) {
                var nurl = burl + "modules/citizen/";
                $http.post(nurl + "confirmffe.aspx", $scope.block, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                    .then(function (response) {
                        var data = response.data["data"];
                        var status = response.data["status"];
                        if (status["success"] == "Y") {
                            alert("Successfully Saved");
                            $scope.GotoAttach();
                        }
                        else {
                            alert("Error: " + status["error"]);
                        }
                    },
                        function (response) {
                            alert("Escape Save Failed.");
                        });
            }
            else {
                $scope.GotoAttach();
            }
        }

        $scope.ViewApplication = function () {
            location.href = "#editpnoc/" + $scope.block.appl_id;
        }

        $scope.GotoDetails = function () {
            location.href = "#editpnoc_1/" + $scope.block.block_id;
        }

        $scope.GotoEscapes = function () {
            location.href = "#editpnoc_2/" + $scope.block.block_id;
        }

        $scope.GotoFFE = function () {
            location.href = "#editpnoc_3/" + $scope.block.block_id;
        }

        $scope.GotoAttach = function () {
            location.href = "#editpnoc_4/" + $scope.block.block_id;
        }

    }]);