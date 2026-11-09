angular.module('citizen')
    .controller("blockController", ['$scope', '$http', '$routeParams', 'fileUpload', '$window', function ($scope, $http, $routeParams, fileUpload, $window) {

        $scope.showtable = 0;
        $scope.showtable2 = 0;
        $scope.showtable3 = 0;
        $scope.showtable4 = 0;
        $scope.editfloor = {};

        $scope.ShowHide = function (sh) {
            $scope.showtable = sh;
        }
        $scope.ShowHide2 = function (sh) {
            $scope.showtable2 = sh;
        }
        $scope.ShowHide3 = function (sh) {
            $scope.showtable3 = sh;
        }
        $scope.ShowHide4 = function (sh) {
            $scope.showtable4 = sh;
        }

        $scope.UploadComplete = function (status) {
            HideLoader();
            if (status) {
                alert('Plans uploaded successfully.');
                location.reload();
            }
            else {
                alert('Plan upload failed.');
            }
        }

        $scope.UploadFiles = function () {
            var nurl = burl + "modules/citizen/";

            var fd = new FormData();
            if ($("#fileSitePlan")[0].files.length > 0) {
                fd.append($('#lfileSitePlan').html(), $("#fileSitePlan")[0].files[0]); //$scope.fileSitePlan);
            }
            if ($("#fileSectionPlan")[0].files.length > 0) {
                fd.append($('#lfileSectionPlan').html(), $("#fileSectionPlan")[0].files[0]); //$scope.fileSectionPlan);
            }
            if ($("#fileElevationPlan")[0].files.length > 0) {
                fd.append($('#lfileElevationPlan').html(), $("#fileElevationPlan")[0].files[0]); //$scope.fileElevationPlan);
            }

            for (i = 0; i < $scope.block.floors.length; i++) {
                if ($("#fileFloorPlan_" + i)[0].files.length > 0) {
                    fd.append($('#lfileFloorPlan_' + i).html(), $("#fileFloorPlan_" + i)[0].files[0]); //document.getElementById("fileFloorPlan_" + i).files[0]);
                }
            }

            var uploadUrl = nurl + "uploadplans.aspx?bid=" + $routeParams.id;
            ShowLoader();
            fileUpload.uploadFileToUrl(fd, uploadUrl, $scope.UploadComplete);
        };

        function init() {
            $scope.buildTypes = [];
            $scope.equipTypes = [];

            //		var url = "http://localhost:8080/fireapp/";
            var nurl = burl + "modules/citizen/";

            $http.get(url + "apis/BuildTypes.txt").success(function (response) {
                $scope.buildTypes = response;
            });
            $http.get(url + "apis/Equipments.txt").success(function (response) {
                $scope.equipTypes = response;
            });

            $http.get(url + "apis/Directions.txt").success(function (response) {
                $scope.directions = response;
            });

            $http.get(url + "apis/FFE_Notes.txt").success(function (response) {
                $scope.ffenotes = response;
            });

            $http.get(url + "apis/ApplTypes.txt").success(function (response) {
                $scope.appltypes = response;
            });

            if ($routeParams.id) {
                $http.post(nurl + "block.aspx", { "block_id": $routeParams.id }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                    .then(function (response) {
                        var data = response.data["data"];
                        var status = response.data["status"];
                        if (status["success"] == "Y") {
                            $scope.block = data;
                            if ($scope.block.floors.length == 0) {
                                $scope.AddFloor(); //$scope.AddSubFloor();
                                $scope.block.floors[0].flr_type = - 'B';
                            }
                            $http.post(nurl + "application.aspx", { "appl_id": $scope.block.appl_id, "partial": true }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                                .then(function (response) {
                                    var data = response.data["data"];
                                    var status = response.data["status"];
                                    if (status["success"] == "Y") {
                                        $scope.application = data;
                                        $scope.block["appl_type"] = $scope.application.appl_type;
                                        if (location.href.indexOf("onoc") > 0) {
                                            $scope.application.form16type = "O";
                                        }
                                        else {
                                            $scope.application.form16type = "P";
                                        }
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

                $http.post(nurl + "floorwise_ffe.aspx", { "block_id": $routeParams.id }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                    .then(function (response) {
                        var data = response.data["data"];
                        var status = response.data["status"];
                        if (status["success"] == "Y") {
                            $scope.ffe = data;
                        }
                        else {
                            alert("QError: " + status["error"]);
                        }
                    },
                        function (response) {
                        });

            }
        }

        $scope.IsEquipmentSelected = function () {
            for (var j in $scope.equipTypes) {
                $scope.equipTypes[j].selected = false;
                for (var i in $scope.ffe.cols) {
                    if ($scope.ffe.cols[i].name == $scope.equipTypes[j].id) {
                        $scope.equipTypes[j].selected = true;
                    }
                }
            }
            $("#add_ffe").click();
        }

        var rurl = burl + "modules/register/";
        $http.get(rurl + "session.aspx").then(
            function (response) {
                $scope.zession = response.data;
                if ($scope.zession.success == "Y")
                    CanAccess($http, "B", $routeParams.id, init);
                else
                    location.href = "index.html";
            },
            function (response) {
                location.href = "index.html";
            });

        $scope.Stair_Count = function (stype) {
            return Common_Stair_Count($scope.block, stype);
        }

        $scope.reqd_escape_width = function (exape) {
            var stype = exape.etype;
            var site_type = $scope.block.site_type;
            var site_stype = $scope.block.site_stype;
            maxOcCount = $scope.MaxOccuCount();
            var nbc_year;
            if ($scope.application.noc_format == "final_noc") {
                nbc_year = "2005";
            }
            else {
                nbc_year = "2016";
            }
            if ($scope.application.status_id == 1) {
                exape.width_reqd = Common_reqd_escape_width(stype, site_type, site_stype, maxOcCount, nbc_year);
            }
            return exape.width_reqd == -1 ? "1-Way: 3.6 / 2-Way:5.4" : parseFloat(exape.width_reqd);
        }

        //$scope.reqd_open_space = function (direc) { 
        //      return Common_reqd_open_space($scope.block, direc, $scope.application.plot_area);
        //}

        $scope.reqd_open_space = function (ospace) {
            if ($scope.application.status_id == 1) {
                ospace.os_reqd = Common_reqd_open_space($scope.block, ospace.direc, $scope.application.plot_area);
            }
            return ospace.os_reqd;
        }

        //$scope.reqd_road_widening = function (rw) {
        //    if ($scope.application.status_id == 1) {
        //        rw.rw_reqd = Common_reqd_open_space(rw, ospace.direc, $scope.application.plot_area);
        //    }
        //    return rw.rw_reqd;
        //}

        $scope.aggregate_staircase = function (block) {
            var total = 0;
            for (var i in block.escapes) {
                if (block.escapes[i].etype == 'I' || block.escapes[i].etype == 'E') {
                    total = total + block.escapes[i].width;
                }
            }
            return total;
        }

        $scope.aggregate_exit = function (block) {
            var total = 0;
            for (var i in block.exits) {
                total = total + block.exits[i].width;
            }
            return total;
        }

        $scope.t20OccCount = function (floor) {
            var req = 0, builder = 0, area = 0;
            if ($scope.application.status_id == 1 && floor.occ_type != 'ASM6') {
                floor.occu_count_reqd = Common_t20OccCount(floor);
            }
            else if (floor.occ_type == 'ASM6') {
                for (var i in floor.subfloors) {
                    req = req + floor.subfloors[i].occu_count_reqd;
                    builder = builder + floor.subfloors[i].occ_c_app;
                    area = area + floor.subfloors[i].built_area;
                }
                floor.occu_count_reqd = req;
                floor.occ_c_app = builder;
                floor.built_area = area;
            }
            return floor.occu_count_reqd;
        }

        $scope.t20OccCount_O = function (floor) {
            if ($scope.application.status_id == 1 && floor.occ_type != 'ASM6') {
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

        $scope.appl_type_node = function (appl_type) {
            for (var i in $scope.appltypes) {
                if ($scope.appltypes[i].code == appl_type) {
                    return $scope.appltypes[i];
                }
            }
            return "{}";
        }

        $scope.appl_type_ffe = function (appl_type, appl_mode) {
            for (var i in $scope.appltypes) {
                if ($scope.appltypes[i].code == appl_type) {
                    for (var j in $scope.appltypes[i].mode) {
                        if ($scope.appltypes[i].mode[j].code == appl_mode) {
                            return $scope.appltypes[i].mode[j].ffe;
                        }
                    }
                }
            }
            return "[]";
        }

        $scope.equipment_desc = function (equip) {
            for (var i in $scope.equipTypes) {
                if ($scope.equipTypes[i].id == equip) {
                    return $scope.equipTypes[i].desc;
                }
            }
            return "";
        }

        $scope.equipment_short = function (equip) {
            for (var i in $scope.equipTypes) {
                if ($scope.equipTypes[i].id == equip) {
                    return $scope.equipTypes[i].short;
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

        $scope.equipment_level = function (equip) {
            for (var i in $scope.equipTypes) {
                if ($scope.equipTypes[i].id == equip) {
                    return $scope.equipTypes[i].level;
                }
            }
            return "";
        }

        $scope.min_doorway = function () {
            return Common_DoorWidthRequired($scope.block);
        }

        $scope.reqd_escape_count = function (block, stype) {
            var max_area = 0;
            for (var i in block.floors) {
                if ((block.floors[i].flr_type == 'F' || block.floors[i].flr_type == 'G') && parseFloat(block.floors[i].built_area) > max_area) {
                    max_area = parseFloat(block.floors[i].built_area);
                }
            }

            var max_cnt = Math.floor(max_area / 1000);
            if (stype == 'I') {
                if (max_cnt <= 1)
                    return 1;
                else
                    return 1 + Math.ceil((max_cnt - 1) / 2);
            }
            if (stype == 'E') {
                if (max_cnt <= 1)
                    return 1;
                else
                    return 1 + Math.floor((max_cnt - 1) / 2);
            }
        }

        //$scope.reqd_escape_width_stair = function (block, stype) {
        //    var ocount = 0;
        //    for (var i in block.floors) {
        //        ocount = ocount + block.floors[i].occ_c_app;
        //    }
        //    return Common_reqd_escape_width(stype, block.site_type, block.site_stype, ocount);
        //}

        $scope.proposed_escape_count = function (block, stype) {
            var count = 0;
            for (var i in block.escapes) {
                if (block.escapes[i].etype == stype) {
                    count = count + 1;
                }
            }
            if (count >= 1)
                return count
            else
                return 0;
        }

        $scope.max_stairs_by_load = function () {
            return Common_MaxStairsbyLoad($scope.block);
        }

        $scope.stair_count_by_nbc = function () {
            return Common_TotalStairsRequiredByNBC($scope.block);
        }

        $scope.proposed_escape_width = function (block, stype) {
            var wdth = 0;
            var count = 0;
            for (var i in block.escapes) {
                if (block.escapes[i].etype == stype) {
                    wdth = wdth + Number(block.escapes[i].width);
                    count = count + 1;
                }
            }
            if (count > 0)
                return wdth / count;
            else
                return 0;
        }

        //$scope.max_travel_distance = function () {
        //    return Common_Maximum_Travel_Distance($scope.block);
        //}

        //$scope.max_travel_distance_deadend = function () {
        //    return Common_Maximum_Travel_Distance_DeadEnd($scope.block);
        //}

        $scope.fire_lifts_reqd = function () {
            //return Common_Fire_Lifts_Reqd($scope.block);
            return 1;
        }

        $scope.AddFloor = function () {
            var nfloor = { "floor_id": 0, "flr_type": "", "flr_name": "", "built_area": 0, "occ_type": "", "occ_c_app": 0, "subfloors": [] };
            $scope.block.floors.push(nfloor);
        }

        $scope.AddSubFloor = function () {
            var nfloor = { "subfloor_id": 0, "floor_id": 0, "flr_name": "", "built_area": 0, "occ_type": "", "occ_c_app": 0 };
            $scope.editfloor.subfloors.push(nfloor);
            $scope.block.floors.subfloors.push(nfloor);
        }

        $scope.DeleteFloor = function (idx) {
            var nurl = burl + "modules/citizen/";
            var r = confirm("Do you really want to delete the Floor '" + $scope.block.floors[idx].flr_name + "'?");
            if (r == true) {
                $http.post(nurl + "deletefloor.aspx", { "floor_id": $scope.block.floors[idx].floor_id }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                    .then(
                        function (response) {
                            $scope.block.floors.splice(idx, 1);
                        },
                        function (response) {
                            alert("Failed to Delete the Floor.");
                        });
            }
        }

        $scope.DeleteSFloor = function (idx) {
            var nurl = burl + "modules/citizen/";
            var r = confirm("Do you really want to delete the Sub Floor '" + $scope.editfloor.subfloors[idx].flr_name + "'?");
            if (r == true) {
                $http.post(nurl + "delete_subfloor.aspx", { "sfloor_id": $scope.editfloor.subfloors[idx].subfloor_id }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                    .then(
                        function (response) {
                            $scope.editfloor.subfloors.splice(idx, 1);
                        },
                        function (response) {
                            alert("Failed to Delete the Sub Floor.");
                        });
            }
        }

        $scope.AddExit = function () {
            var nexit = { "exit_id": 0, "ename": "", "width": 0, "awidth": 0, "direc": "" };
            $scope.block.exits.push(nexit);
        }

        $scope.DeleteExit = function (idx) {
            var nurl = burl + "modules/citizen/";
            var r = confirm("Do you really want to delete the Entrance/Exit '" + $scope.block.exits[idx].ename + "'?");
            if (r == true) {
                $http.post(nurl + "deleteexit.aspx", { "exit_id": $scope.block.exits[idx].exit_id }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                    .then(
                        function (response) {
                            $scope.block.exits.splice(idx, 1);
                        },
                        function (response) {
                            alert("Failed to Delete the Entrance/Exit.");
                        });
            }
        }

        $scope.DeleteEscape = function (idx) {
            var nurl = burl + "modules/citizen/";
            var r = confirm("Do you really want to delete the Escape '" + $scope.block.escapes[idx].desc + "'?");
            if (r == true) {
                $http.post(nurl + "deleteescape.aspx", { "escape_id": $scope.block.escapes[idx].escape_id }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                    .then(
                        function (response) {
                            $scope.block.escapes.splice(idx, 1);
                        },
                        function (response) {
                            alert("Failed to Delete the Escape.");
                        });
            }
        }

        $scope.AddEscape = function () {
            var nescape = { "escape_id": 0, "etype": "", "desc": "", "width": 0, "location": "" };
            $scope.block.escapes.push(nescape);
        }

        $scope.AddDoor = function () {
            var ndoor = { "door_id": 0, "desc": "", "width": 0, "location": "" };
            $scope.block.doors.push(ndoor);
        }

        $scope.DeleteDoor = function (idx) {
            var nurl = burl + "modules/citizen/";
            var r = confirm("Do you really want to delete the Door '" + $scope.block.doors[idx].desc + "'?");
            if (r == true) {
                $http.post(nurl + "deletedoor.aspx", { "door_id": $scope.block.doors[idx].door_id }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                    .then(
                        function (response) {
                            $scope.block.doors.splice(idx, 1);
                        },
                        function (response) {
                            alert("Failed to Delete the Door.");
                        });
            }
        }

        $scope.AddLift = function () {
            var nlift = { "lift_id": 0, "ltype": "F", "lname": "", "capacity": 0 };
            $scope.block.lifts.push(nlift);
        }

        $scope.DeleteLift = function (idx) {
            var nurl = burl + "modules/citizen/";
            var r = confirm("Do you really want to delete the Lift '" + $scope.block.lifts[idx].lname + "'?");
            if (r == true) {
                $http.post(nurl + "deletefirelift.aspx", { "lift_id": $scope.block.lifts[idx].lift_id }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                    .then(
                        function (response) {
                            $scope.block.lifts.splice(idx, 1);
                        },
                        function (response) {
                            alert("Failed to Delete the Lift.");
                        });
            }
        }

        $scope.AddCPark = function () {
            var ncp = { "cpark_id": 0, "floor": "", "capacity": 0 };
            $scope.block.cparks.push(ncp);
        }

        $scope.DeleteCPark = function (idx) {
            var nurl = burl + "modules/citizen/";
            var r = confirm("Do you really want to delete the Car Park on '" + $scope.block.cparks[idx].floor + "'?");
            if (r == true) {
                //	        $http.post(nurl + "deleteescape.aspx", { "escape_id": $scope.block.escapes[idx].escape_id }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                //			.then(
                //				function (response) {
                $scope.block.cparks.splice(idx, 1);
                //				},
                //				function (response) {
                //				    alert("Failed to Delete the Block.");
                //				});
            }
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
                ShowLoader();
                var nurl = burl + "modules/citizen/";
                $scope.block.block_id = $routeParams.id;
                $http.post(nurl + "saveblockdetails.aspx", $scope.block, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                    .then(function (response) {
                        var data = response.data["data"];
                        var status = response.data["status"];
                        if (status["success"] == "Y") {
                            $scope.block.block_id = data["block_id"];
                            if ($scope.application.appl_type == "O" || $scope.application.appl_type == "RO") {
                                $scope.UploadImages_OP();
                            }
                            else {
                                alert("Successfully Saved");
                                HideLoader();
                                $scope.GotoEscapes();
                            }
                        }
                        else {
                            alert("Error: " + status["error"]);
                            HideLoader();
                        }
                    },
                        function (response) {
                            alert("Block Save Failed.");
                            HideLoader();
                        });
            }
            else {
                $scope.GotoEscapes();
            }
        }

        $scope.SaveRoadWidening = function () {
            if ($scope.application.status_id == 1) {
                ShowLoader();
                var nurl = burl + "modules/citizen/";
                $http.post(nurl + "saverw.aspx", $scope.block.roadwidening, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                    .then(function (response) {
                        var data = response.data["data"];
                        var status = response.data["status"];
                        if (status["success"] == "Y") {
                            $scope.block.block_id = data["block_id"];
                            if ($scope.application.appl_type == "O" || $scope.application.appl_type == "RO") {
                                $scope.UploadImages_OP();
                            }
                            else {
                                alert("Road Widening Successfully Saved");
                                HideLoader();
                            }
                        }
                        else {
                            alert("Error: " + status["error"]);
                            HideLoader();
                        }
                    },
                        function (response) {
                            alert("Road Widening  Save Failed.");
                            HideLoader();
                        });
            }
        }

        $scope.SaveEscapes = function () {
            if ($scope.application.status_id == 1) {
                ShowLoader();
                var nurl = burl + "modules/citizen/";
                $http.post(nurl + "saveescapes.aspx", $scope.block, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                    .then(function (response) {
                        var data = response.data["data"];
                        var status = response.data["status"];
                        if (status["success"] == "Y") {
                            if ($scope.application.appl_type == "O" || $scope.application.appl_type == "RO") {
                                $scope.UploadImages_Msescp();
                            }
                            else {
                                alert("Successfully Saved");
                                HideLoader();
                                $scope.GotoFFE();
                            }
                        }
                        else {
                            alert("Error: " + status["error"]);
                            HideLoader();
                        }
                    },
                        function (response) {
                            alert("Escape Save Failed.");
                            HideLoader();
                        });
            }
            else {
                $scope.GotoFFE();
            }
        }

        $scope.ConfirmFFE = function () {
            if ($scope.application.status_id == 1 && $scope.application.appl_type == "P") {
                ShowLoader();
                var nurl = burl + "modules/citizen/";
                $http.post(nurl + "confirmffe.aspx", $scope.block, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                    .then(function (response) {
                        var data = response.data["data"];
                        var status = response.data["status"];
                        if (status["success"] == "Y") {
                            alert("Successfully Saved");
                            HideLoader();
                            $scope.GotoAttach();
                        }
                        else {
                            alert("Error: " + status["error"]);
                            HideLoader();
                        }
                    },
                        function (response) {
                            alert("Escape Save Failed.");
                            HideLoader();
                        });
            }
            else {
                $scope.GotoAttach();
            }
        }

        $scope.SaveFFE = function () {
            if ($scope.application.status_id == 1 && ($scope.application.appl_type == "O" || $scope.application.appl_type == "RO")) {
                ShowLoader();
                var nurl = burl + "modules/citizen/";
                $http.post(nurl + "saveffe.aspx", $scope.ffe, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                    .then(function (response) {
                        var data = response.data["data"];
                        var status = response.data["status"];
                        if (status["success"] == "Y") {
                            if ($scope.application.appl_type == "O" || $scope.application.appl_type == "RO") {
                                $scope.UploadImages_FFE();
                            }
                            else {
                                alert("Successfully Saved");
                                HideLoader();
                                $scope.GotoAttach();
                            }
                        }
                        else {
                            alert("Error: " + status["error"]);
                            HideLoader();
                        }
                    },
                        function (response) {
                            alert("Escape Save Failed.");
                            HideLoader();
                        });
            }
            else {
                $scope.GotoAttach();
            }
        }

        $scope.AddFFE = function () {
            if ($scope.application.status_id == 1 && ($scope.application.appl_type == "O" || $scope.application.appl_type == "RO")) {
                ShowLoader();
                var nurl = burl + "modules/citizen/";
                $http.post(nurl + "addffe.aspx", { "block_id": $scope.block.block_id, "equipments": $scope.equipTypes }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                    .then(function (response) {
                        var status = response.data["status"];
                        if (status["success"] == "Y") {
                            HideLoader();
                            // $window.reload();
                            location.reload();
                        }
                        else {
                            alert("Error: " + status["error"]);
                            HideLoader();
                        }
                    },
                        function (response) {
                            alert("Escape Save Failed.");
                            HideLoader();
                        });
            }
            else {
                $scope.GotoAttach();
            }
        }

        $scope.ViewApplication = function () {
            if ($scope.application.appl_type == "P") {
                location.href = "#editpnoc/" + $scope.block.appl_id;
            }
          else if ($scope.application.appl_type == 'O' && $scope.application.appl_mode != 'E') {
                location.href = "#editonoc/" + $scope.block.appl_id;
            }
            else if ($scope.application.appl_type == "R") {
                location.href = "#editrnoc/" + $scope.block.appl_id;
            }
            else if ($scope.application.appl_type == "RO") {
                location.href = "#editronoc/" + $scope.block.appl_id;
            }
            else if ($scope.application.appl_type == "D") {
                location.href = "#editdnoc/" + $scope.block.appl_id;
            }
            else if ($scope.application.appl_type == 'O' && $scope.application.appl_mode == 'E') {
                location.href = "#editoenoc/" + $scope.block.appl_id;
            }
        }

        $scope.GotoDetails = function () {
            if ($scope.application.appl_type == "P") {
                location.href = "#editpnoc_1/" + $scope.block.block_id;
            }
          else if ($scope.application.appl_type == 'O' && $scope.application.appl_mode != 'E') {
                location.href = "#editonoc_1/" + $scope.block.block_id;
            }
            else if ($scope.application.appl_type == "RO") {
                location.href = "#editronoc_1/" + $scope.block.block_id;
            }
            else if ($scope.application.appl_type == 'O' && $scope.application.appl_mode == 'E') {
                location.href = "#editoenoc_1/" + $scope.block.block_id;
            }
        }

        $scope.GotoEscapes = function () {
            if ($scope.application.appl_type == "P") {
                location.href = "#editpnoc_2/" + $scope.block.block_id;
            }
          else if ($scope.application.appl_type == 'O' && $scope.application.appl_mode != 'E') {
                location.href = "#editonoc_2/" + $scope.block.block_id;
            }
            else if ($scope.application.appl_type == 'RO') {
                location.href = "#editronoc_2/" + $scope.block.block_id;
            }
            else if ($scope.application.appl_type == 'O' && $scope.application.appl_mode == 'E') {
                location.href = "#editoenoc_2/" + $scope.block.block_id;
            }
        }

        $scope.GotoFFE = function () {
            if ($scope.application.appl_type == "P") {
                location.href = "#editpnoc_3/" + $scope.block.block_id;
            }
			else if ($scope.application.appl_type == 'O' && $scope.application.appl_mode != 'E') {
                location.href = "#editonoc_3/" + $scope.block.block_id;
            }
            else if ($scope.application.appl_type == "RO") {
                location.href = "#editronoc_3/" + $scope.block.block_id;
            }
            else if ($scope.application.appl_type == 'O' && $scope.application.appl_mode == 'E') {
                location.href = "#editoenoc_3/" + $scope.block.block_id;
            }
        }

        $scope.GotoAttach = function () {
            if ($scope.application.host == 'MAUD') {
                location.href = "#allplans/" + block_id;
            }
            else {
                if ($scope.application.appl_type == "P") {
                    location.href = "#editpnoc_4/" + $scope.block.block_id;
                }
                else if ($scope.application.appl_type == 'O' && $scope.application.appl_mode != 'E') {
                    location.href = "#editonoc_4/" + $scope.block.block_id;
                }
                else if ($scope.application.appl_type == "RO") {
                    location.href = "#editronoc_4/" + $scope.block.block_id;
                }
                else if ($scope.application.appl_type == 'O' && $scope.application.appl_mode == 'E') {
                    location.href = "#editoenoc_4/" + $scope.block.block_id;
                }
            }
        }

        $scope.FloorTypeDesc = function (typ) {
            return Common_Floor_Type_Name(typ);
        }
        $scope.occu_typ_description = function (floor) {
            return Common_Floor_Occu_Name(floor.occ_type);
        }

        $scope.floor_type_description = function (floor) {
            return Common_Floor_Type_Name(floor.flr_type);
        }

        $scope.CannotEdit = function (ftype) {
            if ($scope.application.appl_type == "P") {
                if ($scope.application.status_id == 1)
                    return false;
                else
                    return true;
            }
            else if ($scope.application.appl_type == "O") {
                if ($scope.application.status_id == 1)
                    if (ftype == 'B') {
                        if ($scope.application.appl_mode == "O") {
                            return true;
                        }
                        else {
                            return false;
                        }
                    }
                    else {
                        return false;
                    }
                else
                    return true;
            }
            else if ($scope.application.appl_type == "R" || $scope.application.appl_type == "RO") {
                if ($scope.application.status_id == 1)
                    if (ftype == "B") {
                        if ($scope.application.appl_mode == "O") {
                            return true;
                        }
                        else {
                            return false;
                        }
                    }
                    else {
                        return false;
                    }
                else
                    return true;
            }
        }

        $scope.HideControl = function () {
            if ($scope.application.appl_type == "O") {
                if ($scope.application.status_id == 1) {
                    if ($scope.application.appl_mode == "N") {
                        return true;
                    }
                    else {
                        return false;
                    }
                }
                else
                    return true;
            }
        }

        $scope.UploadFiles_O = function () {
            var nurl = burl + "modules/citizen/";

            var fd = new FormData();
            if ($("#o_fileSitePlan")[0].files.length > 0) {
                fd.append("o_" + $("#o_lfileSitePlan").html(), $("#o_fileSitePlan")[0].files[0]); //$scope.fileSitePlan);
            }
            if ($("#o_fileSectionPlan")[0].files.length > 0) {
                fd.append("o_" + $("#o_lfileSectionPlan").html(), $("#o_fileSectionPlan")[0].files[0]); //$scope.fileSectionPlan);
            }
            if ($("#o_fileElevationPlan")[0].files.length > 0) {
                fd.append("o_" + $("#o_lfileElevationPlan").html(), $("#o_fileElevationPlan")[0].files[0]); //$scope.fileElevationPlan);
            }

            for (i = 0; i < $scope.block.floors.length; i++) {
                if ($("#o_fileFloorPlan_" + i)[0].files.length > 0) {
                    fd.append("o_" + $("#o_lfileFloorPlan_" + i).html(), $("#o_fileFloorPlan_" + i)[0].files[0]); //document.getElementById("fileFloorPlan_" + i).files[0]);
                }
            }

            var uploadUrl = nurl + "uploadplans.aspx?bid=" + $routeParams.id;
            ShowLoader();
            fileUpload.uploadFileToUrl(fd, uploadUrl, $scope.UploadComplete);
        }

        $scope.UploadImageComplete = function (status) {
            HideLoader();
            if (status) {
                alert("Details saved successfully.");
                if (location.href.indexOf("noc_1") > -1) {
                    $scope.GotoEscapes();
                }
                else if (location.href.indexOf("noc_2") > -1) {
                    $scope.GotoFFE();
                }
                else if (location.href.indexOf("noc_3") > -1) {
                    $scope.GotoAttach();
                }
                else {
                    location.reload();
                }
            }
            else {
                alert("Details saved, but image upload failed. Try again.");
            }
        }

        $scope.UploadImages_OP = function () {
            var nurl = burl + "modules/citizen/";

            var fd = new FormData();

            if ($scope.block.ospaces.length > 0) {
                for (i = 0; i < $scope.block.ospaces.length; i++) {
                    if ($("#imgOpenspace_" + i)[0].files.length > 0) {
                        fd.append($("#limgOpenspace_" + i).html(), $("#imgOpenspace_" + i)[0].files[0]);
                    }
                }
            }

            var uploadUrl = nurl + "uploadimages.aspx?bid=" + $routeParams.id;
            fileUpload.uploadFileToUrl(fd, uploadUrl, $scope.UploadImageComplete);
        }

        $scope.UploadImages_Msescp = function () {
            var nurl = burl + "modules/citizen/";
            var fd = new FormData();
            var error = [];
            if ($scope.block.escapes.length > 0) {
                for (i = 0; i < $scope.block.escapes.length; i++) {
                    if ($("#imgMescpSC_" + i)[0].files.length > 0) {
                        fd.append($("#limgMescpSC_" + i).html(), $("#imgMescpSC_" + i)[0].files[0]);
                    }
                    else {
                        error[i] = error[i] + $scope.block.escapes[i].desc + ",";
                    }
                }
            }

            if ($scope.application.dlevel != 'DFO') {
                if ($scope.block.exits.length > 0) {
                    for (i = 0; i < $scope.block.exits.length; i++) {
                        if ($("#imgMescpExit_" + i)[0].files.length > 0) {
                            fd.append($("#limgMescpExit_" + i).html(), $("#imgMescpExit_" + i)[0].files[0]);
                        }
                        else {
                            error[i] = error[i] + $scope.block.exits[i].desc + ",";
                        }
                    }
                }
            }

            if ($scope.application.host_name != 'SDP') {
                if ($scope.block.lifts.length > 0) {
                    for (i = 0; i < $scope.block.lifts.length; i++) {
                        if ($("#imgMescpFL_" + i)[0].files.length > 0) {
                            fd.append($("#limgMescpFL_" + i).html(), $("#imgMescpFL_" + i)[0].files[0]);
                        }
                        else {
                            error[i] = error[i] + $scope.block.lifts[i].lname + ",";
                        }
                    }
                }
            }

            if (error.length > 0) {
                alert("Please upload image(s) for " + error);
                HideLoader();
            }
            var uploadUrl = nurl + "uploadimages.aspx?bid=" + $routeParams.id;
            fileUpload.uploadFileToUrl(fd, uploadUrl, $scope.UploadImageComplete);
        }

        $scope.UploadImages_FFE = function () {
            var nurl = burl + "modules/citizen/";

            var fd = new FormData();
            if ($scope.block.equipment.length > 0) {
                for (i = 0; i < $scope.block.equipment.length; i++) {
                    if ($("#imgFFE_" + i)[0].files.length > 0) {
                        fd.append($("#limgFFE_" + i).html(), $("#imgFFE_" + i)[0].files[0]);
                    }
                }
            }

            var uploadUrl = nurl + "uploadimages.aspx?bid=" + $routeParams.id;
            fileUpload.uploadFileToUrl(fd, uploadUrl, $scope.UploadImageComplete);
        }

        $scope.FileExists_Image = function (fname) {
            for (var i in $scope.block.images) {
                if ($scope.block.images[i].name == fname + ".jpg") {
                    return true;
                }
            }
            return false;
        }

        $scope.DownloadFile_Image = function (fname) {
            var purl = burl + "uploads/blocks/" + $scope.block.block_id + "/images/" + fname + ".jpg";
            $window.open(purl);
        }

        $scope.GetTotalProvided = function (ename) {
            var total = 0;
            for (var i in $scope.ffe.data) {
                if ($scope.ffe.data[i].fname != 'Total' && $scope.ffe.data[i][ename + "_A"] != '' && $scope.ffe.data[i][ename + "_A"] != '--') {
                    if (ename == 6 || ename == 7 || ename == 8 || ename == 11 || ename == 12) {
                        if (total == 0)
                            total = "";
                        total = total + $scope.ffe.data[i][ename + "_A"];
                    }
                    else {
                        total = total + parseInt($scope.ffe.data[i][ename + "_A"]);
                    }
                }
            }
            return total;
        }

        $scope.GetTotalProposed = function (ename) {
            var total = 0;
            for (var i in $scope.ffe.data) {
                if ($scope.ffe.data[i].FLR_NAME != 'Total' && $scope.ffe.data[i][ename + "_P"] != '' && $scope.ffe.data[i][ename + "_P"] != '--') {
                    if (ename == 6 || ename == 7 || ename == 8 || ename == 11 || ename == 12) {
                        if (total == 0)
                            total = "";
                        total = total + $scope.ffe.data[i][ename + "_P"];
                    }
                    else {
                        total = total + parseInt($scope.ffe.data[i][ename + "_P"]);
                    }
                }
            }
            return total;
        }

        $scope.GetFFETotal = function (ename, tag) {
            var total = 0;
            for (var i in $scope.ffe.data) {
                try {
                    if ($scope.ffe.data[i][ename][tag] != '' && $scope.ffe.data[i][ename][tag] != '--') {
                        total = total + parseInt($scope.ffe.data[i][ename][tag]);
                    }
                } catch (e) {
                }
            }
            return total;
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

        $scope.get_floor_name = function (floor_id) {
            for (var i in $scope.block.floors) {
                if ($scope.block.floors[i].floor_id == floor_id) {
                    return $scope.block.floors[i].flr_name;
                }
            }
            return floor_id;
        }

        $scope.onStairDirectionChange = function (block, exape) {
            if (exape.etype == "C" && (exape.location == block.front_dir)) {
                $window.alert("Basement Ramps should not terminate in the front side of the building.");
            }
        };

        $scope.OpenSubFloors = function (floor) {
            $scope.editfloor = floor;
            $('#opensubfloor').click();
        }

        $scope.check_open_space = function (ospace) {
            var chk = true, chk_os = 0;
            chk_os = Math.min(ospace.os_preqd, ospace.parent_proposed);
            if (ospace.proposed < chk_os) {
                chk = false;
            }
            return chk;
        }
    }]);