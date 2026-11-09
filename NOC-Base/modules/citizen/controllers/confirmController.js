angular.module('citizen')
    .controller("confirmController", ['$scope', '$http', '$routeParams', 'fileUpload', '$window', function ($scope, $http, $routeParams, fileUpload, $window) {

        function init() {
            $scope.checklist = {
                correct: false,
                nostart: false,
                finalnoc: false,
                ffequip: false,
                onlyfire: false,
                nohite: false
            };

            $scope.statuses = [];
            $scope.buildTypes = [];
            $scope.districts = [];
            $scope.blocks = [];
            $scope.floorwise = [];
            $scope.step_info = {};
            $scope.equipTypes = [];
            $scope.addcc = "";
            $scope.valid_from = "";
            $scope.valid_to = "";



            var nurl = burl + "modules/citizen/";

            $http.get(url + "apis/Equipments.txt").success(function (response) {
                $scope.equipTypes = response;
            });

            $http.get(url + "apis/Statuses.txt").success(function (response) {
                $scope.statuses = response;
            });

            $http.get(url + "apis/Districts.txt").success(function (response) {
                $scope.districts = response;
            });

            $http.get(url + "apis/BuildTypes.txt").success(function (response) {
                $scope.buildTypes = response;
            });

            $http.get(url + "apis/ApplTypes.txt").success(function (response) {
                $scope.appltypes = response;
            });

            $http.get(url + "apis/FFE_Notes.txt").success(function (response) {
                $scope.ffenotes = response;
            });

            if ($routeParams.id) {
                $http.post(nurl + "application.aspx", { "appl_id": $routeParams.id }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                    .then(function (response) {
                        var data = response.data["data"];
                        var status = response.data["status"];
                        if (status["success"] == "Y") {
                            $scope.application = data;
                            for (block in $scope.application.blocks) {
                                $http.post(nurl + "block.aspx", { "block_id": $scope.application.blocks[block].block_id }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                                    .then(function (response) {
                                        var data = response.data["data"];
                                        $scope.blockSiteType = data.site_type;
                                        $scope.blockSiteSubType = data.site_stype;
                                        var status = response.data["status"];
                                        if (status["success"] == "Y") {
                                            $scope.blocks.push(data);
                                        }
                                        else {
                                            alert("QError: " + status["error"]);
                                        }
                                    },
                                        function (response) {
                                        });

                                $http.post(nurl + "floorwise_ffe.aspx", { "block_id": $scope.application.blocks[block].block_id }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                                    .then(function (response) {
                                        var data = response.data["data"];
                                        var status = response.data["status"];
                                        if (status["success"] == "Y") {
                                            $scope.floorwise.push(data);
                                        }
                                        else {
                                            alert("QError: " + status["error"]);
                                        }
                                    },
                                        function (response) {
                                        });

                            }
                        }
                        else {
                            //alert("Error: " + status["error"]);
                        }

                        if (location.href.indexOf("rejection") > 0 || location.href.indexOf("final_noc") > 0) {
                            $http.post(burl + "modules/dept/" + "process_stepinfo.aspx", { "a_id": $routeParams.id, "s_id": 6 }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                                .then(function (response) {
                                    var data = response.data["data"];
                                    var status = response.data["status"];
                                    if (status["success"] == "Y") {
                                        $scope.step_info = data[0];
                                        $scope.temp = JSON.parse($scope.step_info.j);
                                        $scope.addcc = $scope.temp.form.addcc;
                                        $scope.valid_from = $scope.temp.form.valid_from;
                                        $scope.valid_to = $scope.temp.form.valid_to;
                                    }
                                    else {
                                        alert("QError: " + status["error"]);
                                    }
                                },
                                    function (response) {
                                    });
                        }
                    },
                        function (response) {
                            alert("Failed to Fetch Application Information.");
                        });
            }
            var date = new Date();
            $scope.CurrentDate = date;   //$filter('date')(new Date(), 'dd/MM/yyyy');
        }

        $scope.allok = function () {
            if ($scope.application.appl_type == 'O' || $scope.application.appl_type == 'R') {
                nostart = true; finalnoc = true; ffequip = true;
            }
            alert($scope.checklist.correct);
            if ($scope.checklist.correct && $scope.checklist.nostart && $scope.checklist.finalnoc
                && $scope.checklist.ffequip && $scope.checklist.onlyfire && $scope.checklist.nohite)
                return true;
            return false;
        }
        var rurl = burl + "modules/register/";
        $http.get(rurl + "session.aspx").then(
            function (response) {
                $scope.zession = response.data;
                if ($scope.zession.success == "Y")
                    CanAccess($http, "A", $routeParams.id, init);
                else
                    location.href = "index.html";
            },
            function (response) {
                location.href = "index.html";
            });

        $scope.equipment_suffix = function (equip) {
            for (var i in $scope.equipTypes) {
                if ($scope.equipTypes[i].id == equip) {
                    return $scope.equipTypes[i].suffix;
                }
            }
            return "";
        }

        $scope.equipment_desc = function (equip) {
            for (var i in $scope.equipTypes) {
                if ($scope.equipTypes[i].id == equip) {
                    return $scope.equipTypes[i].desc;
                }
            }
            return "";
        }

        $scope.status_description = function (sts) {
            for (var i in $scope.statuses) {
                if ($scope.statuses[i].code == sts) {
                    return $scope.statuses[i].desc;
                }
            }
            return "";
        }

        $scope.FloorDisplay = function (block) {
            var bc = 0; var sc = 0; var gc = 0; var fc = 0; var tc = 0;
            for (var i in block.floors) {
                if (block.floors[i].built_area > 0) {
                    if (block.floors[i].flr_type == 'F') fc = fc + 1;
                    else if (block.floors[i].flr_type == 'G') gc = gc + 1;
                    else if (block.floors[i].flr_type == 'B') bc = bc + 1;
                    else if (block.floors[i].flr_type == 'S') sc = sc + 1;
                    else if (block.floors[i].flr_type == 'T') tc = tc + 1;
                }
            }

            var retval = "";
            if (bc == 1) retval = retval + "Basement ";
            else if (bc > 1) retval = retval + bc + " Basements ";

            if (retval != "" && sc > 0) retval = retval + "+ ";
            if (sc == 1) retval = retval + "Stilt ";
            else if (sc > 1) retval = retval + sc + " Stilts ";

            if (retval != "" && gc > 0) retval = retval + "+ ";
            if (gc == 1) retval = retval + "Ground Floor ";
            else if (gc > 1) retval = retval + gc + " Ground Floors ";

            if (retval != "" && fc > 0) retval = retval + "+ ";
            if (fc == 1) retval = retval + "One Upper Floor ";
            else if (fc > 1) retval = retval + fc + " Upper Floors ";

            //	    if (retval != "" && tc > 0) retval = retval + "+ ";
            //	    if (tc == 1) retval = retval + "Terrace ";
            //	    else if (tc > 1) retval = retval + tc + " Terraces ";

            return retval;
        }

        $scope.direction_name = function (direc) {
            if (direc == 'E') return 'East';
            else if (direc == 'W') return 'West';
            else if (direc == 'N') return 'North';
            else if (direc == 'S') return 'South';
            else if (direc == 'NE') return 'North East';
            else if (direc == 'NW') return 'North West';
            else if (direc == 'SE') return 'South East';
            else if (direc == 'SW') return 'South West';
            else if (direc == 'C') return 'Center';
            else return direc;
        }

        $scope.t20OccCount = function (floor) {
            if ($scope.application.status_id == 1) {
                floor.occu_count_reqd = Common_t20OccCount(floor);
            }
            return floor.occu_count_reqd;
        }

        $scope.permissible_load = function (floor) {
            if (floor.flr_type == 'F' || floor.flr_type == 'G') {
                return Math.ceil(floor.built_area / 12.5);
            }
            return "";
        }

        $scope.LoadPerUnitExit = function (floor) {
            if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 3).toUpperCase() == "RES") {
                return 25;
            }
            else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 3).toUpperCase() == "EDU") {
                return 25;
            }
            else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 4).toUpperCase() == "INS1") {
                return 25;
            }
            else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 4).toUpperCase() == "INS2") {
                return 25;
            }
            else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 4).toUpperCase() == "ASM1") {
                return 40;
            }
            else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 4).toUpperCase() == "ASM2") {
                return 40;
            }
            else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 4).toUpperCase() == "MER1") {
                return 50;
            }
            else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 4).toUpperCase() == "MER2") {
                return 50;
            }
            else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 3).toUpperCase() == "BIZ") {
                return 50;
            }
            else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 3).toUpperCase() == "IND") {
                return 50;
            }
            else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 3).toUpperCase() == "STO") {
                return 50;
            }
            else if (floor.occ_type.length >= 3 && floor.occ_type.substring(0, 3).toUpperCase() == "HAZ") {
                return 25;
            }
            else {
                return 0;
            }
        }

        $scope.stairsbyload = function (floor) {
            if (floor.flr_type == 'F' || floor.flr_type == 'G') {
                return Math.floor(100 * floor.occ_c_app / (2 * $scope.LoadPerUnitExit(floor))) / 100;
            }
            return "";
        }

        $scope.builderOccCount = function (floor) {
            var occCnt = 0;
            occCnt = floor.occ_c_app[i];
            return occCnt;
        }

        $scope.aggregate_staircase = function (block) {

            var total = 0;
            for (var i in block.escapes) {
                if (block.escapes[i].etype == 'I' || block.escapes[i].etype == 'E') {
                    total = total + block.escapes[i].width;
                }
            }
            return total;
        }

        $scope.floor_occu_name = function (occu) {
            return Common_Floor_Occu_Name(occu);
        }

        $scope.reqd_open_space = function (block, ospace) {
            if ($scope.application.status_id == 1) {
                ospace.os_reqd = Common_reqd_open_space(block, ospace.direc, $scope.application.plot_area);
            }
            return ospace.os_reqd;
            //var reqd = 7;

            //if (block.height <= 30)
            //    reqd = Math.ceil(block.height / 3);
            //else if (block.height <= 50)
            //    reqd = Math.ceil(30 / 3) + Math.ceil((block.height - 30) / 5);
            //else if (block.height <= 55)
            //    reqd = 16;
            //else
            //    reqd = 16 + Math.ceil((block.height - 55) / 10);

            //if (block.road_wide) {
            //    if (direc != "") {
            //        if (block.front_dir == "" || direc == block.front_dir) {
            //            return reqd;
            //        }
            //        else {
            //            return 7;
            //        }
            //    }
            //    else {
            //        return reqd;
            //    }
            //}
            //else {
            //    return reqd;
            //}
        }

        $scope.escape_name = function (escpe) {
            if (escpe == 'I') return 'Internal Staircase';
            else if (escpe == 'E') return 'External Staircase';
            else if (escpe == 'R') return 'Ramp Above Ground';
            else if (escpe == 'C') return 'Basement Ramp';
            else return escpe;
        }

        //$scope.reqd_escape_width = function (block, stype) {
        //    if (stype == 'I') {
        //        if (block.site_type == 'ins' || block.site_type == 'asm')
        //            return "2.0";
        //        else
        //            return "1.5";
        //    } else if (stype == 'E') {
        //        return "1.25";
        //    } else if (stype == 'R') {
        //        return "2.0";
        //    } else if (stype == 'C') {
        //        return "1-Way: 3.6 / 2-Way:5.4";
        //    } else {
        //        return "NA";
        //    }
        //}
        $scope.reqd_escape_width = function (block, stype) {
            var exape = block.escapes;
            var site_type = block.site_type;
            var site_stype = block.site_stype;
            var maxOcCount = $scope.MaxOccuCount();
            var nbc_year;
            if ($scope.application.noc_format == "final_noc") {
                nbc_year = "2005";
            }
            else {
                nbc_year = "2016";
            }
            //if ($scope.application.status_id == 1) {
            //    exape.width_reqd = Common_reqd_escape_width(stype, site_type, site_stype, maxOcCount, nbc_year);
            //}
            //return exape.width_reqd == -1 ? "1-Way: 3.6 / 2-Way:5.4" : parseFloat(exape.width_reqd);
            return Common_reqd_escape_width(stype, site_type, site_stype, maxOcCount, nbc_year);
        }
        $scope.MaxOccuCount = function () {
            var max_ocount = 0;
            for (var i in $scope.blocks.floors) {
                if (($scope.blocks.floors[i].flr_type == 'F' || $scope.blocks.floors[i].flr_type == 'G') && parseFloat($scope.blocks.floors[i].occ_c_app) > max_ocount) {
                    max_ocount = parseFloat($scope.blocks.floors[i].occ_c_app);
                }
            }
            return max_ocount;
        }
        $scope.get_fire_lifts = function (block) {
            var count = 0;
            for (var i in block.lifts) {
                count++;
            }
            return count;
            //var max_area = 0;
            //for (var i in block.floors) {
            //    if ((block.floors[i].flr_type == 'F' || block.floors[i].flr_type == 'G') && parseFloat(block.floors[i].built_area) > max_area) {
            //        max_area = parseFloat(block.floors[i].built_area);
            //    }
            //}

            //var retval = Math.floor(max_area / 1200);
            //if (retval == 0) {
            //    retval = 1;
            //}
            //return retval;
        }

        $scope.max_stairs_by_load = function (block) {
            return Common_MaxStairsbyLoad(block);
        }

        $scope.stair_count_by_nbc = function (block) {
            return Common_TotalStairsRequiredByNBC(block);
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

        $scope.proposed_escape_count = function (block, stype) {
            var count = 0;
            for (var i in block.escapes) {
                if (block.escapes[i].etype == stype) {
                    count = count + 1;
                }
            }
            return count;
        }

        $scope.proposed_escape_reqdwidth = function (block, stype) {
            var width = 0;
            for (var i in block.escapes) {
                if (block.escapes[i].etype == stype) {
                    width = block.escapes[i].width_reqd;
                }
            }
            return width;
        }

        $scope.proposed_escape_width = function (block, stype) {
            var wdth = 0;
            var count = 0;
            for (var i in block.escapes) {
                if (block.escapes[i].etype == stype) {
                    wdth = wdth + block.escapes[i].width;
                    count = count + 1;
                }
            }
            if (count > 0)
                return wdth / count;
            else return 0;
        }

        $scope.total_built_up = function () {
            var block; var total = 0.0;
            for (block in $scope.application.blocks) {
                total = total + parseFloat($scope.application.blocks[block].built_area);
            }
            return Math.round(total * 100) / 100;
        }

        $scope.block_built_up = function (block) {
            var floor; var total = 0.0;
            for (floor in block.floors) {
                total = total + parseFloat(block.floors[floor].built_area);
            }
            return Math.round(total * 100) / 100;
        }

        $scope.total_built_up_r = function () {
            var block; var total = 0.0;
            if ($scope.application.appl_mode == "O") {
                for (block in $scope.application.blocks) {
                    total = total + parseFloat($scope.application.blocks[block].parent_built_area);
                }
            }
            else if ($scope.application.appl_mode == "M") {
                for (block in $scope.application.blocks) {
                    total = total + parseFloat($scope.application.blocks[block].total_built_area);
                }
            }
            return Math.round(total * 100) / 100;
        }

        $scope.district_desc = function (dist) {
            for (var i in $scope.districts) {
                if ($scope.districts[i].id == dist) {
                    return $scope.districts[i].desc;
                }
            }
            return "";
        }

        $scope.type_name = function (btype) {
            for (var i in $scope.buildTypes) {
                if ($scope.buildTypes[i].code == btype) {
                    return $scope.buildTypes[i].name;
                }
            }
            return btype;
        }

        $scope.SubmitAppl = function () {
            var ok;
            if ($scope.application.appl_type == 'P') {
                ok = $('#correct').is(":checked") && $('#nostart').is(":checked") && $('#finalnoc').is(":checked")
                    && $('#nohite').is(":checked") && $('#onlyfire').is(":checked") && $('#ffequip').is(":checked");
            }
            else if ($scope.application.appl_type == 'O' || $scope.application.appl_type == 'R') {
                ok = $('#correct').is(":checked") && $('#nohite').is(":checked") && $('#onlyfire').is(":checked");
            }
            else if ($scope.application.appl_type == 'D') {
                ok = $('#correct').is(":checked") && $('#nohite').is(":checked") && $('#onlyfire').is(":checked");
            }
            if (ok) {
                ShowLoader();
                var nurl = burl + "modules/citizen/";
                $http.post(nurl + "submitapplication.aspx", $scope.application, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                    .then(function (response) {
                        var data = response.data["data"];
                        var status = response.data["status"];
                        if (status["success"] == "Y") {
                            alert("Application Submitted Successfully. Please print the Acknowledge from the Dashboard.");
                            location.href = "#dashboard";
                            HideLoader();
                        }
                        else {
                            alert("Error: " + status["error"]);
                            HideLoader();
                        }
                    },
                        function (response) {
                            alert("Application submission failed.");
                            HideLoader();
                        });
            }
            else {
                alert("Please confirm that you agree to all the terms and conditions by clicking on the check boxes.");
            }
        }

        $scope.block_TotalOccLoad = function (block) {
            var floor; var total = 0.0;
            for (floor in block.floors) {
                total = total + parseFloat(block.floors[floor].occ_c_app);
            }
            return Math.round(total * 100) / 100;
        }
        $scope.block_TotalOccLoad_O = function (block) {
            return Common_Block_TotalOccLoad_O(block);
        }
        $scope.block_TotalNBCOccLoad = function (block) {
            return Common_Block_TotalNBCOccLoad(block);
        }
        $scope.block_TotalNBCOccLoad_O = function (block) {
            return Common_Block_TotalNBCOccLoad_O(block);
        }
        $scope.renewdate = '____________________';

        $scope.stype_name = function (btype, stype) {
            var rtvalue;
            for (var i in $scope.buildTypes) {
                if ($scope.buildTypes[i].code == btype) {
                    for (var j in $scope.buildTypes[i].code) {
                        if ($scope.buildTypes[i].code.sub[j] == stype) {
                            rtvalue = $scope.buildTypes[i].code.sub[j].name;
                        }
                    }
                }
            }
            return rtvalue;
        }
        $scope.equipment_short = function (equip) {
            for (var i in $scope.equipTypes) {
                if ($scope.equipTypes[i].id == equip) {
                    return $scope.equipTypes[i].short;
                }
            }
            return "";
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

        $scope.equipment_level = function (equip) {
            for (var i in $scope.equipTypes) {
                if ($scope.equipTypes[i].id == equip) {
                    return $scope.equipTypes[i].level;
                }
            }
            return "";
        }
        $scope.GetFFETotal = function (ename, tag, block_id) {
            var total = 0;
            for (var j in $scope.floorwise) {
                if ($scope.floorwise[j].block_id == block_id) {
                    for (var i in $scope.floorwise[j].data) {
                        try {
                            if ($scope.floorwise[j].data[i][ename][tag] != '' && $scope.floorwise[j].data[i][ename][tag] != '--') {
                                total = total + parseInt($scope.floorwise[j].data[i][ename][tag]);
                            }
                        } catch (e) {
                        }
                    }
                }
            }
            return total;
        }
        $scope.floor_type_description = function (floor) {
            return Common_Floor_Type_Name(floor.flr_type);
        }
        $scope.occu_typ_description = function (floor) {
            return Common_Floor_Occu_Name(floor.occ_type);
        }
        //$scope.AddTotal = function (floor) {
        //    var tRow = {
        //        "floor_id": 0,
        //        "flr_type": "",
        //        "flr_name": "Total",
        //        "built_area": 99999,
        //        "occu_count": 990,
        //        "OccCnt_NBC": 990
        //    };
        //    $scope.blocks.floors.push(tRow);
        //}
    }]);
