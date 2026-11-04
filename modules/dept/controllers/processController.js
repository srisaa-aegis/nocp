angular.module('dept')
    .controller("processController", function ($scope, $http, $routeParams, fileUpload, $window) {

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
        $scope.sfo = [];
        $scope.regional = [];
        $scope.ffenotes = [];
        $scope.equipTypes = [];
        $scope.RenewApplID;
        $scope.disableCntrl = false;
        $scope.districts = [];
        $scope.deptreqfiles = [];

        $scope.AddRequestDocument = function () {
            var ddoc = {
                "fileid": 0,
                "file_name": "",
                "file_desc": "",
                "pid": 0
            };
            $scope.deptreqfiles.push(ddoc);
        }

        $scope.UploadComplete = function (status) {
            HideLoader();
            if (status) {
                alert('Submitted successfully.');
            }
            else {
                alert('Upload document failed. Please contact Administrator.');
            }
            location.reload();
        }

        $scope.UploadFiles = function () {
            var fd = new FormData();
            if ($("#fileFinalDoc")[0].files.length > 0)
                $scope.fileFinalDoc = $("#fileFinalDoc")[0].files[0];
            fd.append("FinalDoc", $scope.fileFinalDoc);

            var uploadUrl = curl + "uploaddocs.aspx?aid=" + $routeParams.id;
            fileUpload.uploadFileToUrl(fd, uploadUrl);//, $scope.UploadComplete);
        };

        $scope.UploadImages = function (pid) {
            var fd = new FormData();
            //var pid = $scope.form.pid;

            for (b in $scope.form_to.blocks) {
                var block = $scope.form_to.blocks[b];
                var block_id = block.block_id;
                for (var i in block.ospaces) {
                    if ($("#imgOpenspace_" + block_id + i)[0].files.length > 0) {
                        fd.append($("#limgOpenspace_" + block_id + i).html(), $("#imgOpenspace_" + block_id + i)[0].files[0]);
                    }
                }
                for (var i in block.escapes) {
                    if ($("#imgMescpSC_" + block_id + i)[0].files.length > 0) {
                        fd.append($("#limgMescpSC_" + block_id + i).html(), $("#imgMescpSC_" + block_id + i)[0].files[0]);
                    }
                }
                for (var i in block.equipment) {
                    if ($("#imgFFE_" + block_id + i)[0].files.length > 0) {
                        fd.append($("#limgFFE_" + block_id + i).html(), $("#imgFFE_" + block_id + i)[0].files[0]);
                    }
                }
            }

            var uploadUrl = nurl + "uploadimages_inspection.aspx?aid=" + $routeParams.id;
            fileUpload.uploadFileToUrl(fd, uploadUrl);
        };

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

            $http.get(url + "apis/Districts.txt").success(function (response) {
                $scope.districts = response;
            });

            //$http.get(nurl + "sendbackusers.aspx", { "appl_id": $routeParams.id }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
            //    .then(function (response) {
            //        $scope.sendbackusers = response.data.data;
            //    },
            //        function (response) {
            //            alert("Error");
            //        });

            if ($routeParams.id) {
                $http.post(nurl + "process_steps.aspx", { "appl_id": $routeParams.id }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                    .then(function (response) {
                        var data = response.data["data"];
                        var status = response.data["status"];
                        if (status["success"] == "Y") {
                            $scope.processsteps = data;
                            $scope.sendbackusers = $scope.processsteps.filter((arr, index, self) =>
                                index === self.findIndex((t) => (t.uid === arr.uid && t.uid === arr.uid)))

                            for (i = 0; i < $scope.processsteps.length; i++) {
                                $scope.processsteps[i].j = JSON.parse($scope.processsteps[i].j);
                            }
                        }
                        else {
                            alert("QError: " + status["error"]);
                        }
                    },
                        function (response) {
                            alert("Error");
                        });

                $http.post(curl + "application.aspx", { "appl_id": $routeParams.id }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                    .then(function (response) {
                        var data = response.data["data"];
                        var status = response.data["status"];
                        if (status["success"] == "Y") {
                            $scope.application = data;
                            $scope.appl_type = $scope.application.appl_type;
                            $scope.appl_mode = $scope.application.appl_mode;
                            $scope.approver = $scope.application.approver;
                            if ($scope.application.appl_type == "R" && $scope.application.appl_mode == "M") {
                                $scope.RenewApplID = $routeParams.id;
                                $scope.getParentData($scope.application.parent_id);
                            }
                            else if ($scope.application.appl_type == "R" && $scope.application.appl_mode == "O") {
                                $scope.getParentData($scope.application.parent_id);
                            }
                            else {
                                $scope.getBlockData();
                            }
                        }
                        else {
                            //alert("Error: " + status["error"]);
                        }
                    },
                        function (response) {
                            alert("Failed to Fetch Application Information.");
                        });
                $http.post(nurl + "users.aspx", { "role_id": 9 }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                    .then(function (response) {
                        $scope.sfo = response.data.data;
                    });

                $http.post(nurl + "users.aspx", { "role_id": 6 }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                    .then(function (response) {
                        $scope.officers = response.data.data;
                    });
                $http.post(nurl + "users.aspx", { "role_id": 7 }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                    .then(function (response) {
                        $scope.regional = response.data.data;
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

        $scope.district_name = function (dist) {
            for (var i in $scope.districts) {
                if ($scope.districts[i].id == dist) {
                    return $scope.districts[i].desc;
                }
            }
            return "";
        }

        $scope.PersistDFO = function () {
            return;
            for (var i in $scope.form_to.blocks) {
                for (var j in $scope.form_to.blocks[i].ospaces) {
                    $scope.form_to.blocks[i].ospaces[j].ok = $('#OS_' + $scope.form_to.blocks[i].ospaces[j].direc).val();
                    $scope.form_to.blocks[i].ospaces[j].remark = $('#OSR_' + $scope.form_to.blocks[i].ospaces[j].direc).val();
                }

                for (var j in $scope.form_to.blocks[i].floors) {
                    $scope.form_to.blocks[i].floors[j].ok = $('#FLR_' + $scope.form_to.blocks[i].floors[j].floor_id).val();
                    $scope.form_to.blocks[i].floors[j].remark = $('#FLR_R_' + $scope.form_to.blocks[i].floors[j].floor_id).val();
                }

                for (var j in $scope.form_to.blocks[i].equipment) {
                    $scope.form_to.blocks[i].equipment[j].ok = $('#FFE_' + $scope.form_to.blocks[i].equipment[j].qtype).val();
                    $scope.form_to.blocks[i].equipment[j].remark = $('#FFE_R_' + $scope.form_to.blocks[i].equipment[j].qtype).val();
                }
            }
        }

        $scope.SubmitNote = function (submit) {
            ShowLoader();
            $scope.disableCntrl = true;
            if ($scope.application.status_id == 4) {
                var final_reco = $('#final_reco').val();
                if (typeof final_reco !== 'undefined' && final_reco.length == 0) {
                    alert("Please select recommend / not recommend issue of NoC before submitting.");
                    HideLoader();
                    return;
                }
            }
            if ($scope.application.status_id == 5) {
                var rfo_recommend = $('#rfo_recommend').val();
                if (typeof rfo_recommend !== 'undefined' && rfo_recommend.length == 0) {
                    alert("Please select recommend / not recommend issue of NoC before submitting.");
                    HideLoader();
                    return;
                }
            }
            //if ($scope.application.status_id == 4 && $scope.application.appl_type == 'R') {
            if ($scope.application.status_id == 4 && $scope.appl_type == 'R') {
                var rfo_recommend = $('#rfo_recommend').val();
                if (typeof rfo_recommend !== 'undefined' && rfo_recommend.length == 0) {
                    alert("Please select recommend / not recommend issue of NoC before submitting.");
                    HideLoader();
                    return;
                }
            }

            if ($scope.appl_type == 'R' && $scope.modalstep.template == "dfo_report_r") {
                var doc_remarks = $scope.form_to.doc_remarks;
                var any_other = $scope.form_to.any_other;
                var remark = $scope.form_to.remark;
                var specific = $scope.form_to.specific;
                var submitter = $scope.form_to.submitter;
                var inspection_date = $scope.form_to.inspection_date;
                if (doc_remarks == undefined || any_other == undefined || remark == undefined || specific == undefined || submitter == undefined || inspection_date == undefined) {
                    if ($scope.SubmitNote == true) {
                        alert("Please enter all fields.");
                        HideLoader();
                        return;
                    }
                }

                for (var i = 0; i < $scope.form_to.blocks.length; i++) {
                    var openspace = $scope.form_to.blocks[i].ospaces;
                    for (var j = 0; j < openspace.length; j++) {
                        var observation = openspace[j].ok;
                        if (observation == 'N' || observation == undefined) {
                            $scope.openspace = 'N';
                            break;
                        }
                        else {
                            $scope.openspace = 'Y';
                        }
                    }
                    var escapes = $scope.form_to.blocks[i].escapes;
                    for (var k = 0; k < escapes.length; k++) {
                        var observation = escapes[k].T_Escape;
                        if (observation == 'N' || observation == undefined) {
                            $scope.escape = 'N';
                            break;
                        }
                        else {
                            $scope.escape = 'Y';
                        }
                    }
                    var floors = $scope.form_to.blocks[i].floors;
                    for (var l = 0; l < floors.length; l++) {
                        var observation = floors[l].ok;
                        if (observation == 'N' || observation == undefined) {
                            $scope.floor = 'N';
                            break;
                        }
                        else {
                            $scope.floor = 'Y';
                        }
                    }
                    var floorwisereco = $scope.form_to.blocks[i].floorwisereco;
                    if (floorwisereco == undefined) {
                        alert("Please enter all fields.");
                        $scope.form_to.final_reco = 'N';
                        HideLoader();
                        return;
                    }
                    if ($scope.openspace == 'N' || $scope.escape == 'N' || $scope.floor == 'N') {
                        $scope.form_to.final_reco = 'N';
                    }
                    else {
                        $scope.form_to.final_reco = 'Y';
                    }
                }
            }
            if ($scope.appl_type == 'O' && $scope.appl_mode != 'E' && $scope.modalstep.template == "dfo_report_o" && $scope.modalstep.sid != 3) {
                var remark = $scope.form_to.remark;
                var inspection_date = $scope.form_to.inspection_date;
                if (remark == undefined || inspection_date == undefined) {
                    if ($scope.SubmitNote == true) {
                        alert("Please enter all fields.");
                        HideLoader();
                        return;
                    }
                }

                for (var i = 0; i < $scope.form_to.blocks.length; i++) {
                    var openspace = $scope.form_to.blocks[i].ospaces;
                    for (var j = 0; j < openspace.length; j++) {
                        var observation = openspace[j].ok;
                        if (observation == 'N' || observation == undefined) {
                            $scope.openspace = 'N';
                            break;
                        }
                        else {
                            $scope.openspace = 'Y';
                        }
                    }
                    var escapes = $scope.form_to.blocks[i].escapes;
                    for (var k = 0; k < escapes.length; k++) {
                        var observation = escapes[k].T_Escape;
                        if (observation == 'N' || observation == undefined) {
                            $scope.escape = 'N';
                            break;
                        }
                        else {
                            $scope.escape = 'Y';
                        }
                    }
                    var floors = $scope.form_to.blocks[i].floors;
                    for (var l = 0; l < floors.length; l++) {
                        var observation = floors[l].ok;
                        if (observation == 'N' || observation == undefined) {
                            $scope.floor = 'N';
                            break;
                        }
                        else {
                            $scope.floor = 'Y';
                        }
                    }
                    var equip = $scope.form_to.blocks[i].equipment;
                    for (var m = 0; m < equip.length; m++) {
                        var observation = equip[m].ok;
                        if (observation == 'N' || observation == undefined) {
                            $scope.equip = 'N';
                            break;
                        }
                        else {
                            $scope.equip = 'Y';
                        }
                    }
                    var floorwisereco = $scope.form_to.blocks[i].floorwisereco;
                    var specific = $scope.form_to.blocks[i].specific;
                    var any_other = $scope.form_to.blocks[i].any_other;
                    var img_remarks = $scope.form_to.blocks[i].img_remarks;
                    if (floorwisereco == undefined || specific == undefined || any_other == undefined || img_remarks == undefined) {
                        if ($scope.SubmitNote == true) {
                            alert("Please enter all fields.");
                            $scope.form_to.final_reco = 'N';
                            HideLoader();
                            return;
                        }
                    }
                    if ($scope.openspace == 'N' || $scope.escape == 'N' || $scope.floor == 'N' || $scope.equip == 'N') {
                        $scope.form_to.final_reco = 'N';
                    }
                    else {
                        $scope.form_to.final_reco = 'Y';
                    }
                }
            }
            if ($scope.appl_type == 'P' && $scope.modalstep.template == "dfo_report") {
                var any_other = $scope.form_to.any_other;
                var remark = $scope.form_to.remark;
                var inspection_date = $scope.form_to.inspection_date;
                if (any_other == undefined || remark == undefined || inspection_date == undefined) {
                    if ($scope.SubmitNote == true) {
                        alert("Please enter all fields.");
                        HideLoader();
                        return;
                    }
                }

                for (var i = 0; i < $scope.form_to.blocks.length; i++) {
                    var openspace = $scope.form_to.blocks[i].ospaces;
                    for (var j = 0; j < openspace.length; j++) {
                        var observation = openspace[j].ok;
                        if (observation == 'N' || observation == undefined) {
                            $scope.openspace = 'N';
                            break;
                        }
                        else {
                            $scope.openspace = 'Y';
                        }
                    }
                    //var escapes = $scope.form_to.blocks[i].escapes;
                    //for (var k = 0; k < escapes.length; k++) {
                    //    var observation = escapes[k].T_Escape;
                    //    if (observation == 'N' || observation == undefined) {
                    //        $scope.form_to.final_reco = 'N';
                    //        break;
                    //    }
                    //}
                    var floors = $scope.form_to.blocks[i].floors;
                    for (var l = 0; l < floors.length; l++) {
                        var observation = floors[l].ok;
                        if (observation == 'N' || observation == undefined) {
                            $scope.floor = 'N';
                            break;
                        }
                        else {
                            $scope.floor = 'Y';
                        }
                    }
                    var equip = $scope.form_to.blocks[i].equipment;
                    for (var m = 0; m < equip.length; m++) {
                        var observation = equip[m].ok;
                        if (observation == 'N' || observation == undefined) {
                            $scope.equip = 'N';
                            break;
                        }
                        else {
                            $scope.equip = 'Y';
                        }
                    }
                    var floorwisereco = $scope.form_to.blocks[i].floorwisereco;
                    if (floorwisereco == undefined) {
                        if ($scope.SubmitNote == true) {
                            alert("Please enter all fields.");
                            $scope.form_to.final_reco = 'N';
                            HideLoader();
                            return;
                        }
                    }
                    if ($scope.openspace == 'N' || $scope.floor == 'N' || $scope.equip == 'N') {
                        $scope.form_to.final_reco = 'N';
                    }
                    else {
                        $scope.form_to.final_reco = 'Y';
                    }
                }
            }

            if ($scope.application.status_id == 2 && $scope.appl_type == 'O' && $scope.appl_mode == 'E' && $scope.modalstep.template == "dfo_report_o_e") {
                var rfo_recommend = $scope.form_to.final_reco;
                var remark = $scope.form_to.remark;
                var inspection_date = $scope.form_to.inspection_date;
                if (rfo_recommend == undefined || remark == undefined || inspection_date == undefined) {
                    if ($scope.SubmitNote == true) {
                        alert("Please enter all fields.");
                        HideLoader();
                        return;
                    }
                }
                for (var i = 0; i < $scope.form_to.blocks.length; i++) {
                    var specific = $scope.form_to.blocks[i].specific;
                    var any_other = $scope.form_to.blocks[i].any_other;
                    var img_remarks = $scope.form_to.blocks[i].img_remarks;
                    var floorwisereco = $scope.form_to.blocks[i].floorwisereco;
                    if (specific == undefined || any_other == undefined || img_remarks == undefined || floorwisereco == undefined) {
                        if ($scope.SubmitNote == true) {
                            alert("Please enter all fields.");
                            HideLoader();
                            return;
                        }
                    }
                }
            }

            //if (($scope.form_to.sid == 5 || $scope.form_to.sid == 6) && submit && $scope.application.appl_type != 'D') {
            if (($scope.form_to.sid == 5 || $scope.form_to.sid == 6) && submit && $scope.appl_type != 'D') {

                if ($("#fileFinalDoc").length > 0) {
                    if ($("#fileFinalDoc")[0].files.length == 0) {
                        alert("Please attach the Final Document (NoC/Letter) before submitting");
                        HideLoader();
                        return;
                    }
                }
            }
            if (submit) {
                var chk_status = $scope.ValidateFormData();
                if (!chk_status) {
                    $scope.disableCntrl = false;
                    HideLoader();
                }
                else if (!confirm("Do you really want to submit the note/report? If this is not the final copy that you want to submit, click 'Save' button and click 'Submit' after finalizing. ")) {
                    $scope.disableCntrl = false;
                    HideLoader();
                    return;
                }
            }
            var nurl = burl + "modules/dept/";
            if ($scope.modalstep.sid == 3 && $scope.modalstep.d.includes('Inspection')) {
                $scope.PersistDFO();
            }
            $scope.form_to.sid = $scope.modalstep.sid;
            $scope.form_to.pid = $scope.modalstep.pid;
            $scope.form_to.aid = $scope.modalstep.aid;
            $scope.form_to.district = $scope.modalstep.district;
            $scope.form_to.revision = $scope.application.revision;

            if ($scope.form_to.sid == 6 && submit && $scope.appl_type != 'D' && $scope.appl_mode != 'E') {

                $scope.fileFinalDoc = document.getElementById("fileFinalDoc").files[0];
                $scope.UploadFiles();
            }
            if ($scope.form_to.sid == 63 && submit && $scope.appl_type != 'D') {

                $scope.fileFinalDoc = document.getElementById("fileFinalDoc").files[0];
                $scope.UploadFiles();
            }

            //if (($scope.form_to.sid == 2 || $scope.form_to.sid == 3) && $scope.application.appl_type == "O" && $scope.application.status_id < 7) {
            if (($scope.form_to.sid == 2 || $scope.form_to.sid == 3) && $scope.appl_type == "O" && $scope.application.status_id < 7) {
                $scope.UploadImages($scope.form_to.pid);
                if (submit && $scope.application.deptimgages.length < 1) {
                    alert("Please upload the images before submit the report.")
                    $scope.disableCntrl = false;
                }
            }

            $http.post(nurl + "process_move.aspx?s=" + submit, { "form": $scope.form_to },
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                .then(function (response) {

                    var data = response.data["data"];
                    var status = response.data["status"];
                    if (status["success"] == "Y") {
                        //if ($scope.form_to.sid == 6 && submit) {
                        //    $scope.fileFinalDoc = document.getElementById("fileFinalDoc").files[0];
                        //    $scope.UploadFiles();
                        // }
                        //else {
                        if (submit == false) {
                            alert("The information has been saved. But it is NOT submitted. Click on the Submit button to Submit the Note/Report.")
                            $scope.disableCntrl = false; $scope.modalstep.j.form = $scope.form_to;
                            HideLoader();
                        }
                        else {
                            alert("Submitted Successfully.");
                            $('#modal').modal('hide');
                            $scope.disableCntrl = false;
                            location.reload();
                            HideLoader();
                        }
                        //}
                    }
                    else {
                        alert("Error: " + status["error"]);
                        HideLoader();
                    }
                },
                    function (response) {
                        alert("Update Status Failed.");
                        HideLoader();
                    });
        }

        $scope.ValidateFormData = function () {
            var cnt = 0, sucess = true, error_msg = "";
            for (var j in $scope.form_to) {
                cnt++;
                var value = $scope.form_to[j];
                if (value.length == 0 && j != "revision") {
                    error_msg = "All Fields are mandatory. If not applicable Please enter NA or --";
                    sucess = false;
                }
            }
            if (cnt == 1) {
                sucess = false;
                error_msg = "All Fields are mandatory. If not applicable Please enter NA or --";
            }
            if (error_msg.length > 0) { alert(error_msg); }
            return sucess;
        }

        $scope.SetFormData = function (proc) {
            $scope.form_to = {};
            var totbuilt = 0;
            for (var i in $scope.blocks) {
                for (var j in $scope.blocks[i].floors) {
                    totbuilt = totbuilt + $scope.blocks[i].floors[j].built_area;
                }
            }
            $scope.form_to.tot_built_area = totbuilt;

            //        if ($scope.modalstep.sid == 3 && $scope.modalstep.d.includes('Inspection')) {
            if ($scope.modalstep.template == "dfo_report" || $scope.modalstep.template == "dfo_report_o" || $scope.modalstep.template == "dfo_report_r" || $scope.modalstep.template == "dfo_report_o_e") {
                if ($scope.blocks.length > 0) {
                    $scope.form_to.blocks = $scope.blocks;
                    for (var i in $scope.form_to.blocks) {
                        for (var j in $scope.form_to.blocks[i].ospaces) {
                            $scope.form_to.blocks[i].ospaces[j].ok = "";
                            $scope.form_to.blocks[i].ospaces[j].remark = "";
                        }
                    }
                    $scope.form_to.floorwise = $scope.floorwise;
                }
            }
            else if ($scope.modalstep.template == "rfo_note" || $scope.modalstep.template == "rfo_note_o" || $scope.modalstep.template == "rfo_note_r") {
                $scope.form_to.blocks = [];
                for (var i in $scope.blocks) {

                    block = $scope.blocks[i]; // HACK - ONE BLOCK ONLY
                    $scope.form_to.blocks[i] = {};

                    $scope.form_to.blocks[i].block_id = block.block_id;
                    $scope.form_to.blocks[i].block_name = block.block_name;
                    $scope.form_to.blocks[i].rfo_occu_type = block.site_type;
                    $scope.form_to.blocks[i].rfo_height = block.height;
                    $scope.form_to.blocks[i].rfo_area = $scope.application.plot_area;
                    $scope.form_to.blocks[i].rfo_os_e_req = Common_reqd_open_space(block, "E", $scope.application.plot_area);
                    $scope.form_to.blocks[i].rfo_os_s_req = Common_reqd_open_space(block, "S", $scope.application.plot_area);
                    $scope.form_to.blocks[i].rfo_os_w_req = Common_reqd_open_space(block, "W", $scope.application.plot_area);
                    $scope.form_to.blocks[i].rfo_os_n_req = Common_reqd_open_space(block, "N", $scope.application.plot_area);

                    $scope.form_to.blocks[i].rfo_os_e_pro = Common_proposed_open_space(block, "E");
                    $scope.form_to.blocks[i].rfo_os_s_pro = Common_proposed_open_space(block, "S");
                    $scope.form_to.blocks[i].rfo_os_w_pro = Common_proposed_open_space(block, "W");
                    $scope.form_to.blocks[i].rfo_os_n_pro = Common_proposed_open_space(block, "N");

                    $scope.form_to.blocks[i].rfo_os_e_pro_O = Common_proposed_open_space_O(block, "E");
                    $scope.form_to.blocks[i].rfo_os_s_pro_O = Common_proposed_open_space_O(block, "S");
                    $scope.form_to.blocks[i].rfo_os_w_pro_O = Common_proposed_open_space_O(block, "W");
                    $scope.form_to.blocks[i].rfo_os_n_pro_O = Common_proposed_open_space_O(block, "N");

                    $scope.form_to.blocks[i].rfo_ffe_fe_req = Common_Required_Equip(block, 2);
                    $scope.form_to.blocks[i].rfo_ffe_hr_req = Common_Required_Equip(block, 3);
                    $scope.form_to.blocks[i].rfo_ffe_wr_req = Common_Required_Equip(block, 10);
                    $scope.form_to.blocks[i].rfo_ffe_dc_req = Common_Required_Equip(block, 9);
                    $scope.form_to.blocks[i].rfo_ffe_yh_req = Common_Required_Equip(block, 8);
                    $scope.form_to.blocks[i].rfo_ffe_as_req = Common_Required_Equip(block, 5);
                    $scope.form_to.blocks[i].rfo_ffe_mc_req = Common_Required_Equip(block, 4);
                    $scope.form_to.blocks[i].rfo_ffe_ad_req = Common_Required_Equip(block, 1);
                    $scope.form_to.blocks[i].rfo_ffe_ut_req = Common_Required_Equip(block, 12);
                    $scope.form_to.blocks[i].rfo_ffe_tt_req = Common_Required_Equip(block, 11);
                    $scope.form_to.blocks[i].rfo_ffe_fp_req = Common_Required_Equip(block, 7);
                    $scope.form_to.blocks[i].rfo_ffe_bp_req = Common_Required_Equip(block, 6);

                    $scope.form_to.blocks[i].rfo_area_O = $scope.application.parent_plot_area;
                    $scope.form_to.blocks[i].rfo_height_O = block.parent_height;

                    $scope.form_to.blocks[i].rfo_pr_escape_cnt_int = $scope.proposed_escape_count(block, 'I');
                    $scope.form_to.blocks[i].rfo_pr_escape_width_int = $scope.proposed_escape_width(block, 'I');
                    $scope.form_to.blocks[i].rfo_pr_escape_cnt_ext = $scope.proposed_escape_count(block, 'E');
                    $scope.form_to.blocks[i].rfo_pr_escape_width_ext = $scope.proposed_escape_width(block, 'E');
                }

            }
        }

        $scope.PullBack = function (proc) {
            var nurl = burl + "modules/dept/";
            proc.pbcomm = "";
            $http.post(nurl + "pullback.aspx?", { "form": proc },
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                .then(function (response) {
                    var data = response.data["data"];
                    var status = response.data["status"];
                    if (status["success"] == "Y") {
                        alert("Pulled Back Successfully.");
                        $('#modal').modal('hide');
                        location.reload();
                    }
                    else {
                        alert("Error: " + status["error"]);
                    }
                },
                    function (response) {
                        alert("Pull back Failed.");
                    });
        }

        $scope.SendBack = function (sendto, cmnt) {
            var nurl = burl + "modules/dept/";
            $http.post(nurl + "sendback.aspx?", { "applid": $routeParams.id, "sendto": sendto, "cmnt": cmnt }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                .then(function (response) {
                    var data = response.data["data"];
                    var status = response.data["status"];
                    if (status["success"] == "Y") {
                        alert("Send Back Successfully.");
                        //$('#modal').modal('hide');
                        location.reload();
                    }
                    else {
                        alert("Error: " + status["error"]);
                    }
                }, function (response) {
                    alert("Send Back Successfully.");
                    location.reload();
                });
        }

        $scope.OpenForm = function (proc) {
            ShowLoader();
            $scope.disabledform = false;
            $scope.modalstep = proc;
            try {
                if ('form' in proc.j) {
                    $scope.form_to = proc.j.form;
                    if ($scope.modalstep.d.includes('Inspection') && !('blocks' in $scope.form_to) && !($scope.modalstep.template == 'dfo_others_o')) {
                        $scope.SetFormData(proc)
                    }
                }
                else {
                    $scope.SetFormData(proc)
                }
                HideLoader();
            }
            catch (err) {
                $scope.SetFormData(proc)
                HideLoader();
            }

            $('#opensecnote').click();
        }

        $scope.OpenRequDoc = function (deptFiles, pid) {
            $scope.disabledform = false;
            $scope.deptreqfiles = deptFiles;
            $scope.processid = pid;
            for (var i = 0; i < $scope.deptreqfiles.length; i++) {
                $scope.deptreqfiles[i].pid = pid;
            }
            $('#requestdoc').click();
        }

        $scope.DeleteRow = function (item) {
            var index = $scope.deptreqfiles.indexOf(item)
            $scope.deptreqfiles.splice(index, 1);
        }

        $scope.RequestDoc = function (deptFilesRequ) {
            for (var i = 0; i < deptFilesRequ.length; i++) {
                if (deptFilesRequ[i].fileid == 0) {
                    if (deptFilesRequ[i].file_name == 'undefined' || deptFilesRequ[i].file_name.length == 0) {
                        alert("Please Enter File Name.");
                        return;
                    }
                    if (deptFilesRequ[i].file_desc == 'undefined' || deptFilesRequ[i].file_desc.length == 0) {
                        alert("Please Enter File Description.");
                        return;
                    }
                    deptFilesRequ[i].pid = $scope.processid;
                    var uploadUrl = nurl + "uploaddeptdocs.aspx?aid=" + $routeParams.id + "&pid=" + deptFilesRequ[i].pid + "&filename=" + deptFilesRequ[i].file_name + "&filedesc=" + deptFilesRequ[i].file_desc;
                    $http.post(uploadUrl, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                        .then(function (response) {
                            var data = response.data["data"];
                            var status = response.data["status"];
                            if (status["success"] == "Y") {
                            }
                            else {
                                alert("Error: " + status["error"]);
                            }
                        }, function (response) {
                            alert("Request Sent Failed.");
                            location.reload();
                        });
                }
            }

            alert("Request Send to Citizen.");
            location.reload();
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
            $('#opensecnote').click();
        }

        $scope.PrintStep = function (proc) {
            $window.open('processprint.html#/printprocess/' + proc.pid);
        }

        $scope.ChangeUser = function (proc) {
            $scope.modalstep = proc;
            $('#openchuser').click();
        }

        $scope.ReassignUser = function (proc) {
            var nurl = burl + "modules/dept/";
            $http.post(nurl + "reassign.aspx", $scope.modalstep,
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                .then(function (response) {
                    var data = response.data["data"];
                    var status = response.data["status"];
                    if (status["success"] == "Y") {
                        alert("Saved Successfully");
                        $('#modal').modal('hide');
                        location.reload();
                    }
                    else {
                        alert("Error: " + status["error"]);
                    }
                },
                    function (response) {
                        alert("Reassign to User failed.");
                    });

        }

        $scope.SkipUser = function (step) {
            if (confirm("Do you really want to bypass this user?")) {
                var nurl = burl + "modules/dept/";
                $scope.modalstep = step;

                $scope.form_to.sid = $scope.modalstep.sid;
                $scope.form_to.pid = $scope.modalstep.pid;
                $scope.form_to.aid = $scope.modalstep.aid;
                $scope.form_to.district = $scope.modalstep.district;
                $scope.form_to.remark = "Officer Bypassed";
                $scope.form_to.revision = $scope.application.revision;

                $http.post(nurl + "process_move.aspx", { "form": $scope.form_to },
                    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                    .then(function (response) {
                        var data = response.data["data"];
                        var status = response.data["status"];
                        if (status["success"] == "Y") {
                            alert("Action performed successfully");
                            window.reload();
                        }
                        else {
                            alert("Error: " + status["error"]);
                        }
                    },
                        function (response) {
                            alert("Action Failed.");
                        });
            }
        }

        $scope.direction_name = function (direc) {
            return Common_Direction_Name(direc);
        }

        $scope.reqd_open_space = function (block, ospace) {
            //return Common_reqd_open_space(block, direc, $scope.application.plot_area);
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
            var rtval = 0;
            for (var i in block.escapes) {
                if (block.escapes[i].etype == stype) {
                    wdth = wdth + block.escapes[i].width;
                    count = count + 1;
                }
            }
            if (count > 0)
                rtval = wdth / count;
            else
                rtval = 0;

            return rtval;
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

        $scope.block_TotalOccLoad = function (block) {
            return Common_Block_TotalOccLoad(block);
        }

        $scope.block_TotalNBCOccLoad = function (block) {
            return Common_Block_TotalNBCOccLoad(block);
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
        $scope.TotalStairsRequiredByNBC = function () {
            return Common_TotalStairsRequiredByNBC($scope.blocks[0]);
        }

        $scope.MaxStairsbyLoad = function () {
            return Common_MaxStairsbyLoad($scope.blocks[0]);
        }

        $scope.Required_Equip = function (id) {
            return Common_Required_Equip($scope.blocks[0], id);
        }

        $scope.block_built_up_o = function (block) {
            return Common_Block_Built_Up_O(block);
        }
        $scope.block_TotalNBCOccLoad_O = function (block) {
            return Common_Block_TotalNBCOccLoad_O(block);
        }
        $scope.block_TotalOccLoad_O = function (block) {
            return Common_Block_TotalOccLoad_O(block);
        }

        $scope.FileExists_Image = function (fname) {
            for (var i in $scope.blocks[0].images) {
                if ($scope.blocks[0].images[i].name == fname + ".jpg") {
                    return true;
                }
            }
            return false;
        }

        $scope.DownloadFile_Image = function (fname) {
            var purl = burl + "uploads/blocks/" + $scope.blocks[0].block_id + "/images/" + fname + ".jpg";
            $window.open(purl);
        }

        $scope.FileExists_deptImage = function (fname) {
            for (var i in $scope.application.deptimgages) {
                if ($scope.application.deptimgages[i].name == fname + ".jpg") {
                    return true;
                }
            }
            return false;
        }

        $scope.DownloadFile_deptImage = function (fname) {
            var purl = burl + "uploads/applications/" + $scope.application.appl_id + "/inspection/" + fname + ".jpg";
            $window.open(purl);
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
            if (ename == 6 || ename == 7 || ename == 8 || ename == 11 || ename == 12) {
                total = $scope.floorwise[0].data[0][ename + "_A"];
            }
            else {
                for (var i in $scope.floorwise[0].data) {
                    if ($scope.floorwise[0].data[i].FLR_NAME != 'Total' && $scope.floorwise[0].data[i][ename + "_A"] != '' && $scope.floorwise[0].data[i][ename + "_A"] != '--') {
                        total = total + parseInt($scope.floorwise[0].data[i][ename + "_A"]);
                    }
                }
            }
            return total;
        }

        $scope.GetTotalProposed = function (ename) {
            var total = 0;
            if (ename == 6 || ename == 7 || ename == 8 || ename == 11 || ename == 12) {
                total = $scope.floorwise[0].data[0][ename + "_P"];
            }
            else {
                for (var i in $scope.floorwise[0].data) {
                    if ($scope.floorwise[0].data[i].FLR_NAME != 'Total' && $scope.floorwise[0].data[i][ename + "_P"] != '' && $scope.floorwise[0].data[i][ename + "_P"] != '--') {
                        total = total + parseInt($scope.floorwise[0].data[i][ename + "_P"]);
                    }
                }
            }
            return total;
        }

        $scope.max_stairs_by_load = function (block) {
            return Common_MaxStairsbyLoad(block);
        }

        $scope.getParentData = function (ro_appl_id) {
            $http.post(curl + "application.aspx", { "appl_id": ro_appl_id }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                .then(function (response) {
                    var rodata = response.data["data"];
                    var status = response.data["status"];
                    if (status["success"] == "Y") {
                        $scope.application = rodata;
                        $scope.getBlockData();
                    }
                },
                    function (response) {
                        alert("Failed to Fetch Application Information.");
                    });
        }

        $scope.getBlockData = function () {
            for (block in $scope.application.blocks) {
                $http.post(curl + "block.aspx", { "block_id": $scope.application.blocks[block].block_id }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                    .then(function (response) {
                        var data = response.data["data"];
                        var status = response.data["status"];
                        if (status["success"] == "Y") {
                            $scope.blocks.push(data);
                        }
                        else {
                            alert("QError: " + status["error"]);
                        }
                    },
                        function (response) {
                            alert("Error Loading Block Info");
                        });

                $http.post(curl + "floorwise_ffe.aspx", { "block_id": $scope.application.blocks[block].block_id }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
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

        $scope.appl_type_node = function (appl_type) {
            for (var i in $scope.appltypes) {
                if ($scope.appltypes[i].code == appl_type) {
                    return $scope.appltypes[i];
                }
            }
            return "{}";
        }

        $scope.equipment_level = function (equip) {
            for (var i in $scope.equipTypes) {
                if ($scope.equipTypes[i].id == equip) {
                    return $scope.equipTypes[i].level;
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

        $scope.FillForm19 = function () {
            var callapi = ""; var ndata = {};
            callapi = "copyform16.aspx";
            ndata = { "appl_id": $scope.RenewApplID };
            var nurl = burl + "modules/citizen/";
            $http.post(nurl + callapi, ndata, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                .then(function (response) {
                    var data = response.data["data"];
                    var status = response.data["status"];
                    if (status["success"] == "Y") {
                        var newid = data["appl_id"];
                        $scope.NavigateToAddRNOC(newid);
                    }
                    else {
                        alert("Application Copying Failed.");
                    }
                },
                    function (response) {
                        alert("Application Copying Failed.");
                    });
        }

        $scope.NavigateToAddRNOC = function (applid) {
            window.open("home.html#editronoc/" + applid);
        }

        $scope.deficit_open_space = function (ospace) {
            var chk = true, chk_os = 0;
            chk_os = Math.min(ospace.os_preqd, ospace.parent_proposed);
            chk = chk_os - ospace.proposed > 0
            if (chk > 0) {
                return chk;
            }
            else { return '-'; }
        }
    });