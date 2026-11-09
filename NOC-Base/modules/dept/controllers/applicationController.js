angular.module('dept')
    .controller("applicationController", function ($scope, $http, $routeParams, fileUpload, $window) {

        var nurl = burl + "modules/dept/";
        var curl = burl + "modules/citizen/";
        var rurl = burl + "modules/register/";

        $scope.search =
            {
                "dlevel": "",
                "appl_type": "",
                "district": 0,
                "status": 0,
                "pattern": "",
                "region": ""
            };

        $scope.passchange =
            {
                "old_pwd": "",
                "new_pwd": "",
                "confirm_pwd": "",
                "errors": []
            };

        $scope.rolestatuses = {};
        $scope.fileFinalDoc = "";
        $scope.zession = [];
        $scope.NewMessage = "";

        $scope.AddDocument = function () {
            var ddoc = {
                "file_id": 0,
                "appl_id": "",
                "user_id": "",
                "file_name": "",
                "file_desc": "",
                "create_date": ""
            };
            $scope.application.deptfiles.push(ddoc);
        }

        $scope.UploadFiles = function () {
            var fd = new FormData();
            fd.append("FinalDoc", $scope.fileFinalDoc);

            var uploadUrl = curl + "uploaddocs.aspx?aid=" + $routeParams.id;
            fileUpload.uploadFileToUrl(fd, uploadUrl);
        };

        $scope.FileExists_Dept = function (file) {
            for (var i in $scope.application.deptfiles) {
                if (file.file_name.length > 0)
                    if ($scope.application.deptfiles[i].file_name == file.file_name) {
                        return true;
                    }
            }
            return false;
        }

        $scope.DownloadDeptFile = function (fname) {
            var purl = burl + "uploads/applications/" + $scope.application.appl_id + "/documents/" + fname;
            $window.open(purl);
        }

        $scope.UploadDeptComplete = function (status) {
            HideLoader();
            if (status) {
                alert('File uploaded Successfully.');
            }
            else {
                alert('Upload file Failed. Please Contact Administrator.');
            }
            location.reload();
        }

        $scope.UploadDeptUploads = function (file, fileCntrl) {
            var fd = new FormData();
            if ($("#" + fileCntrl)[0].files.length > 0) {
                $scope.DeptUploads = $("#" + fileCntrl)[0].files[0];
                fd.append($scope.DeptUploads.name, $scope.DeptUploads);
                var uploadUrl = nurl + "uploaddeptdocs.aspx?aid=" + $routeParams.id + "&filedesc=" + file.file_desc;
                fileUpload.uploadFileToUrl(fd, uploadUrl, $scope.UploadDeptComplete);
                $scope.AddDocument();
            }
        }

        $scope.PerformSearch = function () {
            ShowLoader();
            $http.post(nurl + "search.aspx", $scope.search, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                .then(function (response) {
                    $scope.applications = response.data;
                    HideLoader();
                },
                    function (response) {
                        alert("Failed to Fetch Applications.");
                        HideLoader();
                    });
        }

        $scope.GetAvgRating = function (months) {
            var avg = 0.0;
            ShowLoader();
            $http.post(nurl + "Feedback_AvgRating.aspx", { "months": months }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                .then(function (response) {
                    $scope.Rating = response.data;
                    HideLoader();
                    var data = response.data["data"];
                    var status = response.data["status"];
                    if (status["success"] == "Y") {
                        $scope.Rating = data;
                        avg = parseFloat($scope.Rating.avg_rating);
                        $("#rateYo").rateYo({
                            rating: avg,
                            precision: 2,
                            halfrating: true,
                            readOnly: true
                        });
                    }
                    else {
                        if (status["success"] == "N")
                            alert("No records found");
                    }
                    HideLoader();
                },
                    function (response) {
                        alert("Failed to Fetch Details.");
                        HideLoader();
                    });
        }

        //$(function () {
        //    var rating = 0;
        //    $("#rateYo").rateYo({
        //        onSet: function () {
        //            rating = $scope.Rating.avg_rating;
        //        }
        //    });
        //    $(".rateyo-readonly-widg").rateYo({
        //        rating: rating,
        //        numStars: 5,
        //        precision: 2,
        //        minValue: 1,
        //        maxValue: 5
        //    }).on("rateyo.change", function (e, data) {

        //        console.log(data.rating);
        //    });
        //});

        $scope.SendDeptSMS = function (message) {
            ShowLoader();
            $scope.NewSMSRow.message = message;
            $http.post(nurl + "sendsms.aspx", $scope.NewSMSRow, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                .then(function (response) {
                    var data = response.data["data"];
                    var status = response.data["status"];
                    if (status["success"] == "Y") {
                        $scope.applications.sms = data;
                        alert("SMS Sent Successfully.");
                    }
                    else {
                        if (status["success"] == "N")
                            alert("Send SMS Failed: " + data["error"]);
                    }
                    HideLoader();
                },
                    function (response) {
                        alert("Send SMS Failed.");
                        HideLoader();
                    });
        }

        $scope.get_fire_stations = function () {
            for (var etype in $scope.stations) {
                if ($scope.stations[etype].id == $scope.application.district) {
                    return $scope.stations[etype].stations;
                }
            }
            return [];
        }

        $scope.LoadList = function () {
            ShowLoader();
            $http.get(nurl + "applications.aspx").then(
                function (response) {
                    $scope.applications = response.data;
                    HideLoader();
                },
                function (response) {
                    alert("Failed to Fetch Active Applications.");
                    HideLoader();
                });
        }

        $scope.ShowBlock = function (id) {
            $scope.showblocks.block = id;
        }

        function init() {
            $scope.showblocks = { "block": 0 };

            $scope.statuses = [];
            $scope.buildTypes = [];
            $scope.applications = [];
            $scope.floorwise = [];
            $scope.districts = [];

            $scope.checklist = {
                all_ok: true
            };

            $scope.showdivs = {
                basic: true,
                tech: false,
                attach: false
            }

            $scope.inspection = {
                reco: "",
                memo: "",
                remark: ""
            }

            $scope.prelims = {
                reco: "",
                approve_date: "",
                remark: "",
                memo: "",
            }

            $http.get(url + "apis/Statuses.txt").success(function (response) {
                $scope.statuses = response;
            });

            $http.get(url + "apis/BuildTypes.txt").success(function (response) {
                $scope.buildTypes = response;
            });

            $http.get(url + "apis/RoleStatuses.txt").success(function (response) {
                $scope.rolestatuses = response[$scope.zession["role"]];
            });

            $http.get(url + "apis/Districts.txt").success(function (response) {
                $scope.districts = response;
            });

            $http.get(url + "apis/FireStations.txt").success(function (response) {
                $scope.stations = response;
            });

            $http.post(nurl + "users.aspx", { "role_id": 2 }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                .then(function (response) {
                    var data = response.data["data"];
                    var status = response.data["status"];
                    if (status["success"] == "Y") {
                        $scope.users = data;
                    }
                });

            if ($routeParams.id) {
                $http.post(curl + "application.aspx", { "appl_id": $routeParams.id }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                    .then(function (response) {
                        var data = response.data["data"];
                        var status = response.data["status"];
                        if (status["success"] == "Y") {
                            $scope.application = data;
                            $scope.AddDocument();
                            $scope.get_fire_stations();

                            $scope.NewSMSRow = {
                                sms_id: 0,
                                appl_id: $scope.application.appl_id,
                                user_id: "",
                                citizen_id: $scope.application.citizen_id,
                                message: $scope.NewMessage
                            }

                            for (block in $scope.application.blocks) {
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
                                            alert("Error");
                                        });
                            }
                        }
                        else {
                            //alert("Error: " + status["error"]);
                        }
                    },
                        function (response) {
                            alert("Failed to Fetch Application Information.");
                        });
            }
            else {
                //if (window.location.href.indexOf("search") > -1) {
                //    $scope.PerformSearch();
                //}
                //else {
                //    $scope.LoadList();
                //}
                if (!window.location.href.indexOf("search") > -1) {
                    $scope.LoadList();
                }

            }

            $rateYo.rateYo("rating", 0.0);
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

        $scope.DownloadFinal = function () {
            var purl = "";
            purl = burl + "uploads/applications/" + $scope.application.appl_id + "/FinalDoc.pdf";
            $window.open(purl);
        }

        $scope.user_name = function (user_id) {
            for (var i in $scope.users) {
                if ($scope.users[i].user_id == user_id) {
                    return $scope.users[i].user_name;
                }
            }
            return user_id;
        }

        $scope.ShowDivs = function (typ) {
            if (typ == 'B') {
                $scope.showdivs.basic = true;
                $scope.showdivs.tech = false;
                $scope.showdivs.attach = false;
            }
            if (typ == 'T') {
                $scope.showdivs.basic = false;
                $scope.showdivs.tech = true;
                $scope.showdivs.attach = false;
            }
            if (typ == 'A') {
                $scope.showdivs.basic = false;
                $scope.showdivs.tech = false;
                $scope.showdivs.attach = true;
            }
        }

        $scope.reqd_open_space = function () {
            //////if ($scope.application.status_id == 1) {
            //////    ospace.os_reqd = Common_reqd_open_space($scope.block, ospace.direc, $scope.application.plot_area);
            //////}
            //////return ospace.os_reqd;
            return Math.floor($scope.application.height / 3);
        }

        $scope.reqd_stair_cases = function () {
            return Math.floor($scope.application.built_area / (900 * $scope.application.flr_count));
        }

        $scope.reqd_int_stair_width = function () {
            if ($scope.application.site_type == 'ins' || $scope.application.site_type == 'asm')
                return 2;
            else
                return 1.5;
        }

        $scope.reqd_ext_stair_width = function () {
            return 1.25;
        }

        $scope.reqd_ramp_width = function () {
            return 2;
        }

        $scope.reqd_ramps = function () {
            if ($scope.application.site_type == 'ins')
                return Math.floor($scope.application.built_area / (900 * $scope.application.flr_count));
            else
                return 0;
        }

        $scope.reqd_challan = function () {
            // return $scope.application.built_area * 10;
            return $scope.application.challan_amt_reqd;
        };

        $scope.type_name = function (btype) {
            for (var i in $scope.buildTypes) {
                if ($scope.buildTypes[i].code == btype) {
                    return $scope.buildTypes[i].name;
                }
            }
            return btype;
        }

        $scope.type_description = function (btype) {
            for (var i in $scope.buildTypes) {
                if ($scope.buildTypes[i].code == btype) {
                    return $scope.buildTypes[i].desc;
                }
            }
            return "*";
        }

        $scope.status_description = function (sts) {
            for (var i in $scope.statuses) {
                if ($scope.statuses[i].code == sts) {
                    return $scope.statuses[i].desc;
                }
            }
            return "";
        }

        $scope.direction_name = function (direc) {
            if (direc == 'E') return 'East';
            else if (direc == 'W') return 'West';
            else if (direc == 'N') return 'North';
            else if (direc == 'S') return 'South';
            else if (direc == 'NE') return 'North East';
            else if (direc == 'SE') return 'South East';
            else if (direc == 'NW') return 'North West';
            else if (direc == 'SW') return 'South West';
            else if (direc == 'C') return 'Center';
            else return direc;
        }

        $scope.district_name = function (dist) {
            for (var i in $scope.districts) {
                if ($scope.districts[i].id == dist) {
                    return $scope.districts[i].desc;
                }
            }
            return "";
        }

        $scope.NeedForward = function () {
            return false;
            //        if ($scope.application.status_id == 2 && $scope.zession.role == "H") {
            //            return true;
            //        }
            //        return false;
        }

        $scope.NeedInspection = function () {
            if ($scope.application.status_id == 2 && $scope.zession.role == "D") {
                return true;
            }
            return false;
        }

        $scope.CanShowInspection = function () {
            if ($scope.application.status_id > 2) {
                return true;
            }
            return false;
        }

        $scope.CanShowForward = function () {
            //        if ($scope.application.status_id > 2) {
            //            return true;
            //        }
            return false;
        }

        $scope.NeedPrelim = function () {
            if ($scope.application.status_id == 3 && $scope.zession.role == "O") {
                return true;
            }
            return false;
        }
        $scope.CanShowPrelim = function () {
            if ($scope.application.status_id > 3) {
                return true;
            }
            return false;
        }
        $scope.NeedCommittee = function () {
            //return false;
            //		if ( $scope.application.status == 'PAP' )
            //		{
            //			return true;
            //		}
            return false;
        }
        $scope.CanShowCommittee = function () {
            //return false;
            //		if ( $scope.application.status != 'RCV' && $scope.application.status != 'SUB' && $scope.application.status != 'DRF'
            //			&& $scope.application.status != 'PAP' && $scope.application.status != 'PRJ')
            //		{
            //			return true;
            //		}
            return false;
        }

        $scope.NeedFinal = function () {
            if ($scope.application.status_id == 4 && $scope.zession.role == "H") {
                return true;
            }
            return false;
        }
        $scope.CanShowFinal = function () {
            if ($scope.application.status_id > 4) {
                return true;
            }
            return false;
        }
        $scope.NeedUpdate = function () {
            if ($scope.NeedInspection() || $scope.NeedPrelim() || $scope.NeedCommittee() || $scope.NeedForward() || $scope.NeedFinal()) {
                return true;
            }
            return false;
        }

        $scope.ProcessAppl = function (appl_id) {
            if ($scope.zession["rid"] == 8 || location.href.indexOf("search") > 0) {
                window.open("#fulledit/" + appl_id);
            }
            else {
                location.href = "#fulledit/" + appl_id;
            }
        }

        $scope.ViewAppl = function (appl_id, appl_type, appl_mode) {
            if (appl_type == 'P') {
                window.open("home.html#editpnoc/" + appl_id);
            }
            else if (appl_type == 'O' && appl_mode != 'E') {
                window.open("home.html#editonoc/" + appl_id);
            }
            else if (appl_type == 'O' && appl_mode == 'E') {
                window.open("home.html#editoenoc/" + appl_id);
            }
            else if (appl_type == 'R') {
                window.open("home.html#editrnoc/" + appl_id);
            }
            else if (appl_type == 'D') {
                window.open("home.html#editdnoc/" + appl_id);
            }
        }

        $scope.InspectReport = function (appl_id) {
            location.href = "#insrpt/" + appl_id;
        }

        $scope.ReceiveApplication = function (appl_id) {
            location.href = "#receive/" + appl_id;
        }
        //Old Files Integration
        $scope.ReferenceFile = function () {
            var nurl = "modules/dept/";
            var url = nurl + "displaynotefile.aspx?appl_id=" + $scope.application.appl_id + "&district=" + $scope.application.district + "&ref_no=" + $scope.application.ref_no;
            $window.open(url, "_blank");
        }

        $scope.SaveReport = function () {
            //		alert('ok');
            //		alert($scope.inspection.remark);
            //		alert($scope.inspection.memo);
        }
        $scope.SaveReceipt = function () {
            var nurl = burl + "modules/dept/";
            var purl = nurl + "statusupdate.aspx?ID=" + $scope.application.appl_id + "&STS=RCV&RMK=";

            $http.get(purl).then(
                function (response) {
                    var data = response.data;
                    if (data["success"] == "Y") {
                        alert("Application has been marked as Receieved");
                        location.href = '#dashboard';
                    }
                    else {
                        alert("Update Failed.");
                    }
                },
                function (response) {
                    alert("Update Failed.");
                });
        }

        $scope.CalculateFFE = function () {

            if (confirm("Do you really want to recalculate the equipment?")) {
                var nurl = burl + "modules/dept/";
                var purl = nurl + "calculateffe.aspx?aid=" + $scope.application.appl_id;

                $http.get(purl).then(
                    function (response) {
                        var data = response.data;
                        if (data["status"]["success"] == "Y") {
                            alert("Fire Fighting Equipment Recalculated");
                        }
                        else {
                            alert("Update Failed.");
                        }
                    },
                    function (response) {
                        alert("Update Failed.");
                    });
            }
        }

        $scope.UpdateStatus = function () {
            var sts = "";
            var rmk = "";

            if ($scope.application.status_id == 2) {
                sts = $('#reviewer').val();
                rmk = $('#forward_remark').val();
            }
            else if ($scope.application.status_id == 3) {
                sts = $('#prelim_reco').val();
                rmk = $('#prelim_remark').val();
            }
            else if ($scope.application.status_id == 4) {
                sts = $('#final_reco').val();
                rmk = $('#final_remark').val();
            }
            var nurl = burl + "modules/dept/";

            $http.post(nurl + "statusupdate.aspx", { "appl_id": $scope.application.appl_id, "status_id": $scope.application.status_id, "response": sts, "remark": rmk },
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                .then(function (response) {
                    var data = response.data["data"];
                    var status = response.data["status"];
                    if (status["success"] == "Y") {
                        if ($scope.application.status_id == 4) {
                            $scope.fileFinalDoc = document.getElementById("fileFinalDoc").files[0];
                            $scope.UploadFiles();
                        }
                        location.href = '#dashboard';
                    }
                    else {
                        alert("Error: " + status["error"]);
                    }
                },
                    function (response) {
                        alert("Update Status Failed.");
                    });
        }

        $scope.ChangePassword = function () {
            $scope.passchange.errors = [];
            $ok = true;
            if ($scope.passchange.old_pwd == "") {
                $scope.passchange.errors.push("Old Password is Mandatory");
                $ok = false;
            }
            if ($scope.passchange.new_pwd == "") {
                $scope.passchange.errors.push("New Password is Mandatory");
                $ok = false;
            }
            if ($scope.passchange.confirm_pwd == "") {
                $scope.passchange.errors.push("Confirm New Password is Mandatory");
                $ok = false;
            }
            if ($scope.passchange.new_pwd != $scope.passchange.confirm_pwd) {
                $scope.passchange.errors.push("New Password and Confirm New Password do not match");
                $ok = false;
            }

            if ($ok) {
                var nurl = burl + "modules/dept/";

                $http.post(nurl + "changepass.aspx", $scope.passchange, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                    .then(function (response) {
                        HideLoader();
                        var data = response.data["data"];
                        var status = response.data["status"];
                        if (status["success"] == "Y") {
                            alert("Password Changed Successfully");
                            location.href = "#dashboard";
                        }
                        else {
                            $scope.passchange.errors.push(status["error"]);
                        }
                    },
                        function (response) {
                            alert("Failed to Change Password.");
                            HideLoader();
                        });
            }
        }

        $scope.GetTotalProvided = function (ename) {
            var total = 0;
            for (var i in $scope.ffe.data) {
                if ($scope.ffe.data[i].FLR_NAME != 'Total' && $scope.ffe.data[i][ename + "_A"] != '' && $scope.ffe.data[i][ename + "_A"] != '--') {
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

        $scope.updateApplication = function () {
            var nurl = burl + "modules/dept/";
            $http.post(nurl + "update_application.aspx", $scope.application, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                .then(function (response) {
                    var data = response.data["data"];
                    if (typeof data != "undefined") {
                        var status = response.data["status"];
                        if (status["success"] == "Y") {
                            $scope.application = data;
                            //$scope.get_fire_stations();
                            alert("Updated Successfully");
                            $('#modal').modal('hide');
                            location.reload();
                        }
                        else {
                            alert("Error: " + status["error"]);
                            HideLoader();
                        }
                    }
                    else {
                        alert("Update Failed.");
                    }
                },
                    function (response) {
                        alert("Update Failed.");
                    });
        }

        $scope.DisplayTrack = function (application) {
            var display = false;
            if (application.status_id > 1) { display = true; }
            else if (application.status_id == 1 && application.revision > 0 && application.appl_number.length > 0) { display = true; }

            return display;
        }

    });