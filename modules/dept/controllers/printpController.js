angular.module('dept')
    .controller("printpController", function ($scope, $http, $routeParams, $window) {

        var nurl = burl + "modules/dept/";
        var curl = burl + "modules/citizen/";
        var rurl = burl + "modules/register/";

        $scope.zession = [];
        $scope.modalstep = {};
        $scope.form_to = {};
        $scope.application = {};
        $scope.blocks = [];
        $scope.floorwise = [];
        $scope.officers = [];
        $scope.regional = [];
        $scope.ffenotes = [];

        function init() {
            $http.get(url + "apis/BuildTypes.txt").success(function (response) {
                $scope.buildTypes = response;
            });

            $http.get(url + "apis/Equipments.txt").success(function (response) {
                $scope.equipTypes = response;
            });

            $http.get(url + "apis/FFE_Notes.txt").success(function (response) {
                $scope.ffenotes = response;
            });

            $http.get(url + "apis/ApplTypes.txt").success(function (response) {
                $scope.appltypes = response;
            });

            if ($routeParams.id) {
                $http.post(nurl + "process_step.aspx", { "ps_id": $routeParams.id }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                    .then(function (response) {
                        var data = response.data["data"];
                        var status = response.data["status"];
                        if (status["success"] == "Y") {
                            $scope.processsteps = data;
                            $scope.appl_type = $scope.processsteps[0].appl_type;
                            $scope.appl_mode = $scope.processsteps[0].appl_mode;
                            for (i = 0; i < $scope.processsteps.length; i++) {
                                $scope.processsteps[i].j = JSON.parse($scope.processsteps[i].j);
                            }

                            $scope.ViewForm($scope.processsteps[0]);
                        }
                        else {
                            alert("QError: " + status["error"]);
                        }
                    },
                        function (response) {
                            alert("Error");
                        });
            }
        }

        $http.get(rurl + "session.aspx").then(
            function (response) {
                $scope.zession = response.data;
                if ($scope.zession.success == "Y")
                    if ($scope.zession.rid != 4) {
                        init();
                    }
                    else {
                        location.href = '#invalid';
                    }
                else
                    location.href = "index.html";
            },
            function (response) {
                location.href = "index.html";
            });

        $scope.reqd_open_space = function (block, ospace) {
            //return Common_reqd_open_space(block, direc, $scope.application.plot_area);
            if ($scope.application.status_id == 1) {
                ospace.os_reqd = Common_reqd_open_space(block, ospace.direc, $scope.application.plot_area);
            }
            return ospace.os_reqd;
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
            for (var j in $scope.form_to.floorwise) {
                if ($scope.form_to.floorwise[j].block_id == block_id) {
                    for (var i in $scope.form_to.floorwise[j].data) {
                        try {
                            if ($scope.form_to.floorwise[j].data[i][ename][tag] != '' && $scope.form_to.floorwise[j].data[i][ename][tag] != '--') {
                                total = total + parseInt($scope.form_to.floorwise[j].data[i][ename][tag]);
                            }
                        } catch (e) {
                        }
                    }
                }
            }
            return total;
        }

        $scope.ViewForm = function (proc) {
            $scope.disabledform = true;
            $scope.modalstep = proc;
            $scope.form_to = proc.j.form;
            if ($scope.modalstep.sid == 3 && $scope.modalstep.d.includes('Inspection')) {
                for (var i in $scope.form_to.blocks) {
                    for (var j in $scope.form_to.blocks[i].ospaces) {
                        $('#OS_' + $scope.form_to.blocks[i].ospaces[j].direc).val($scope.form_to.blocks[i].ospaces[j].ok);
                        $('#OSR_' + $scope.form_to.blocks[i].ospaces[j].direc).val($scope.form_to.blocks[i].ospaces[j].remark);
                    }
                }
            }
            else {
                if ($scope.modalstep.sid == 2 && $scope.modalstep.d.includes('Inspection') && $scope.modalstep.template == "dfo_report_o_e") {
                    for (var i in $scope.form_to.blocks) {
                        for (var j in $scope.form_to.blocks[i].ospaces) {
                            $('#OS_' + $scope.form_to.blocks[i].ospaces[j].direc).val($scope.form_to.blocks[i].ospaces[j].ok);
                            $('#OSR_' + $scope.form_to.blocks[i].ospaces[j].direc).val($scope.form_to.blocks[i].ospaces[j].remark);
                        }
                        $scope.form_to.floorwise = $scope.form_to.floorwise;
                    }
                }
            }
        }

        $scope.direction_name = function (direc) {
            return Common_Direction_Name(direc);
        }

        $scope.reqd_open_space = function (block, ospace) {
            // return Common_reqd_open_space(block, direc, $scope.application.plot_area);
            if ($scope.application.status_id == 1) {
                ospace.os_reqd = Common_reqd_open_space(block, ospace.direc, $scope.application.plot_area);
            }
            return ospace.os_reqd;
        }

        $scope.FloorDisplay = function (block) {
            return Common_FloorDisplay(block);
        }

        $scope.type_name = function (btype) {
            for (var i in $scope.buildTypes) {
                if ($scope.buildTypes[i].code == btype) {
                    return $scope.buildTypes[i].name;
                }
            }
            return btype;
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
            for (var i in $scope.blocks.floors) {
                if (($scope.blocks.floors[i].flr_type == 'F' || $scope.blocks.floors[i].flr_type == 'G') && parseFloat($scope.blocks.floors[i].occ_c_app) > max_ocount) {
                    max_ocount = parseFloat($scope.blocks.floors[i].occ_c_app);
                }
            }
            return max_ocount;
        }
        $scope.reqd_escape_width = function (exape) {
            var stype = exape.etype;
            var site_type = $scope.blocks.site_type;
            var site_stype = $scope.blocks.site_stype;
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

        $scope.floor_occu_name = function (occu) {
            return Common_Floor_Occu_Name(occu);
        }

        $scope.stairsbyload = function (floor) {
            return Common_StairsbyLoad(floor);
        }

        $scope.builderOccCount = function (floor) {
            var occCnt = 0;
            occCnt = floor.occ_c_app[i];
            return occCnt;
        }

        $scope.block_built_up = function (block) {
            return Common_Block_Built_Up(block);
        }

        $scope.block_built_up_o = function (block) {
            return Common_Block_Built_Up_O(block);
        }

        $scope.block_TotalOccLoad = function (block) {
            return Common_Block_TotalOccLoad(block);
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
        $scope.ApplModeDesc = function (appl_mode) {
            if (appl_mode == 'O')
                return "Online Application";
            else if (appl_mode == 'M')
                return "Manual Application";
            else if (appl_mode == 'N')
                return "Not Applied For";
            else
                return appl_mode;
        }
        $scope.StairTypeDesc = function (typ) {
            return Common_Stair_Type_Name(typ);
        }
        $scope.FloorNameDesc = function (block, floor_id) {
            return Common_FloorDesc(block, floor_id);
        }
        $scope.GetTotalProvided = function (ename) {
            var total = 0;
            for (var i in $scope.floorwise.data) {
                if ($scope.floorwise.data[i].FLR_NAME != 'Total' && $scope.floorwise.data[i][ename + "_A"] != '' && $scope.floorwise.data[i][ename + "_A"] != '--') {
                    if (ename == 6 || ename == 7 || ename == 8 || ename == 11 || ename == 12) {
                        if (total == 0)
                            total = "";
                        total = total + $scope.floorwise.data[i][ename + "_A"];
                    }
                    else {
                        total = total + parseInt($scope.floorwise.data[i][ename + "_A"]);
                    }
                }
            }
            return total;
        }

        $scope.GetTotalProposed = function (ename) {
            var total = 0;
            for (var i in $scope.floorwise.data) {
                if ($scope.floorwise.data[i].FLR_NAME != 'Total' && $scope.floorwise.data[i][ename + "_P"] != '' && $scope.floorwise.data[i][ename + "_P"] != '--') {
                    if (ename == 6 || ename == 7 || ename == 8 || ename == 11 || ename == 12) {
                        if (total == 0)
                            total = "";
                        total = total + $scope.floorwise.data[i][ename + "_P"];
                    }
                    else {
                        total = total + parseInt($scope.floorwise.data[i][ename + "_P"]);
                    }
                }
            }
            return total;
        }

        $scope.max_stairs_by_load = function (block) {
            return Common_MaxStairsbyLoad(block);
        }


        $scope.equipment_short = function (equip) {
            for (var i in $scope.equipTypes) {
                if ($scope.equipTypes[i].id == equip) {
                    return $scope.equipTypes[i].short;
                }
            }
            return "";
        }

    });