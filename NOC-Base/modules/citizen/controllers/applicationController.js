angular.module('citizen')
    .controller("applicationController", ['$scope', '$http', '$routeParams', 'fileUpload', '$window', '$timeout', '$filter', function ($scope, $http, $routeParams, fileUpload, $window, $timeout, $filter) {
        var rurl = burl + "modules/register/";

        $scope.addElement = function (root, name, value) {
            var element1 = document.createElement("input");
            element1.value = value;
            element1.name = name;
            element1.type = "hidden";
            root.appendChild(element1);
        }

        $scope.initPFCharges = function () {
            $http.post(url + "PFInit.aspx?APPL_ID=" + $scope.application.appl_id, {}, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                .then(function (response) {
                    var form = document.createElement("form");
                    var element1 = document.createElement("input");
                    var element2 = document.createElement("input");

                    form.method = "POST";
                    form.target = "_top";
                    form.action = pgurl;

                    for (var key in response.data.data) {
                        if (response.data.data.hasOwnProperty(key)) {
                            var val = response.data.data[key];
                            $scope.addElement(form, key, val);
                        }
                    }
                    document.body.appendChild(form);

                    alert("Payment process is being inited, do not press 'Escape', 'Back' or 'Refresh' on the browser, till payment is complete and the application is shown again");
                    form.submit();
                },
                    function (response) {
                        alert("Failed to Initialize Payment.");
                    });
        }


        $scope.UploadComplete = function (status) {
            HideLoader();
            if (status) {
                alert('Application saved successfully.');
            }
            else {
                alert('Application saved, but document upload failed. Try again.');
            }
            // location.reload();
        }

        $scope.setFile = function (element) {
            $scope.$apply(function ($scope) {
                $scope.theFile = element.files[0];
                $scope.FileMessage = '';
                var filename = $scope.theFile.name;
                console.log(filename.length)
                var index = filename.lastIndexOf(".");
                var strsubstring = filename.substring(index, filename.length);
                if (strsubstring == '.pdf') {
                    console.log('File Uploaded sucessfully');
                }
                else {
                    $scope.theFile = '';
                    $scope.FileMessage = 'please upload correct File Name, File extension should be .pdf, .doc or .xls';
                }

            });
        };

        $scope.UploadRequestDocs = function (deptFilesRequ) {
            var nurl = burl + "modules/dept/";
            var fd = new FormData();
            for (var i = 0; i < deptFilesRequ.length; i++) {
                if (deptFilesRequ[i].status == 'R') {
                    if ($("#RequestDocs" + i)[0].files.length > 0) {
                        $scope.RequestDocs = $("#RequestDocs" + i)[0].files[0];
                        fd.append($scope.RequestDocs.name, $scope.RequestDocs);
                        var uploadUrl = nurl + "uploaddeptdocs.aspx?aid=" + deptFilesRequ[i].appid + "&pid=" + deptFilesRequ[i].processid + "&fileid=" + deptFilesRequ[i].fileid + "&filename=" + deptFilesRequ[i].file_name + "&filedesc=" + deptFilesRequ[i].file_desc + "&citizencmnt=" + deptFilesRequ[i].citizen_comment;
                        fileUpload.uploadFileToUrl(fd, uploadUrl, $scope.UploadDeptComplete);
                    }
                    else {
                        alert("Please select the file to Upload for file - " + deptFilesRequ[i].file_name);
                    }
                }
            }
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

        $scope.DownloadDeptFile = function (fname, applid) {
            var filename = fname.replace(/^\s+|\s+$/g, "");
            var purl = burl + "uploads/applications/" + applid + "/documents/" + filename + ".pdf";
            $window.open(purl);
        }

        $scope.FileExists = function (file) {
            for (var i in $scope.application.deptfiles) {
                if (file.file_name.length > 0)
                    if ($scope.application.deptfiles[i].file_name == file.file_name) {
                        return true;
                    }
            }
            return false;
        }

        $scope.UploadRequestComplete = function (status) {
            HideLoader();
            if (status) {
                alert('File uploaded Successfully.');
            }
            else {
                alert('Upload file Failed. Please Contact Administrator.');
            }
            location.reload();
        }

        $scope.UploadFiles = function () {
            var nurl = burl + "modules/citizen/";
            var fd = new FormData();
            if ($scope.application.appl_type != "D") {
                if ($("#fileChallan")[0].files.length > 0)
                    $scope.fileChallan = $("#fileChallan")[0].files[0];
                fd.append($('#lfileChallan').attr("fname"), $scope.fileChallan);
                if ($scope.application.appl_type == "P") {
                    if ($scope.application.dlevel != 'DFO') {
                        if ($("#fileUndertaking")[0].files.length > 0)
                            $scope.fileUndertaking = $("#fileUndertaking")[0].files[0];
                        fd.append($('#lfileUndertaking').attr("fname"), $scope.fileUndertaking);
                        if ($("#fileGuarantee")[0].files.length > 0)
                            $scope.fileGuarantee = $("#fileGuarantee")[0].files[0];
                        fd.append($('#lfileGuarantee').attr("fname"), $scope.fileGuarantee);
                        if ($("#fileEstimate")[0].files.length > 0)
                            $scope.fileEstimate = $("#fileEstimate")[0].files[0];
                        fd.append($('#lfileEstimate').attr("fname"), $scope.fileEstimate);
                    }
                    if ($("#fileDeclaration")[0].files.length > 0)
                        $scope.fileDeclaration = $("#fileDeclaration")[0].files[0];
                    fd.append($('#lfileDeclaration').attr("fname"), $scope.fileDeclaration);
                    if ($("#fileWidening").length > 0) {
                        if ($("#fileWidening")[0].files.length > 0) {
                            fd.append($('#lfileWidening').attr("fname"), $("#fileWidening")[0].files[0]); //$scope.fileWidening
                        }
                    }
                    if ($("#addlDoc")[0].files.length > 0)
                        $scope.addlDoc = $("#addlDoc")[0].files[0];
                    fd.append($('#laddlDoc').attr("fname"), $scope.addlDoc);

                    if ($scope.application.host == "SDP") {
                        if ($("#osEmergency")[0].files.length > 0)
                            $scope.osEmergency = $("#osEmergency")[0].files[0];
                        fd.append($('#losEmergency').attr("fname"), $scope.osEmergency);
                        if ($("#offsEmergency")[0].files.length > 0)
                            $scope.offsEmergency = $("#offsEmergency")[0].files[0];
                        fd.append($('#loffsEmergency').attr("fname"), $scope.offsEmergency);
                        if ($("#RAReport")[0].files.length > 0)
                            $scope.RAReport = $("#RAReport")[0].files[0];
                        fd.append($('#lRAReport').attr("fname"), $scope.RAReport);
                    }
                }
                else if ($scope.application.appl_type == "O") {
                    if ($scope.application.appl_mode == "M") {
                        if ($("#filePNoc")[0].files.length > 0)
                            $scope.filePNoc = $("#filePNoc")[0].files[0];
                        fd.append($('#lfilePNoc').attr("fname"), $scope.filePNoc);
                    }
                    if ($scope.application.appl_mode == "O") {
                        if ($("#filePNoc")[0].files.length > 0)
                            $scope.filePNoc = $("#filePNoc")[0].files[0];
                        fd.append($('#lfilePNoc').attr("fname"), $scope.filePNoc);
                    }

                    if ($scope.application.appl_mode == "N") {
                        if ($("#muncDoc").length > 0) {
                            if ($("#muncDoc")[0].files.length > 0) {
                                fd.append($('#lmuncDoc').attr("fname"), $("#muncDoc")[0].files[0]);
                            }
                        }
                    }

                    if ($scope.application.appl_mode == "E") {
                        if ($("#fileUndertaking")[0].files.length > 0)
                            $scope.fileUndertaking = $("#fileUndertaking")[0].files[0];
                        fd.append($('#lfileUndertaking').attr("fname"), $scope.fileUndertaking);

                        if ($("#fileDeclaration")[0].files.length > 0)
                            $scope.fileDeclaration = $("#fileDeclaration")[0].files[0];
                        fd.append($('#lfileDeclaration').attr("fname"), $scope.fileDeclaration);

                        if ($("#muncDoc").length > 0) {
                            if ($("#muncDoc")[0].files.length > 0) {
                                fd.append($('#lmuncDoc').attr("fname"), $("#muncDoc")[0].files[0]);
                            }
                        }

                    }


                    if ($("#fileWidening").length > 0) {
                        if ($("#fileWidening")[0].files.length > 0) {
                            fd.append($('#lfileWidening').attr("fname"), $("#fileWidening")[0].files[0]); //$scope.fileWidening
                        }
                    }

                    if ($("#addlDoc")[0].files.length > 0)
                        $scope.addlDoc = $("#addlDoc")[0].files[0];
                    fd.append($('#laddlDoc').attr("fname"), $scope.addlDoc);
                }
                else if ($scope.application.appl_type == "R") {
                    if ($scope.application.appl_mode == "M") {
                        if ($("#fileONoc")[0].files.length > 0) {
                            fd.append($('#lfileONoc').attr("fname"), $("#fileONoc")[0].files[0]); //$scope.fileWidening
                        }
                    }
                    if ($("#addlDoc")[0].files.length > 0)
                        $scope.addlDoc = $("#addlDoc")[0].files[0];
                    fd.append($('#laddlDoc').attr("fname"), $scope.addlDoc);

                    if ($("#lastrenewDoc")[0].files.length > 0)
                        $scope.lastrenewDoc = $("#lastrenewDoc")[0].files[0];
                    fd.append($('#llastrenewDoc').attr("fname"), $scope.lastrenewDoc);
                }
            }
            else {
                $scope.Declaration = $("#Declaration")[0].files[0];
                fd.append($('#lDeclaration').attr("fname"), $scope.Declaration);
            }
            var uploadUrl = nurl + "uploaddocs.aspx?aid=" + $routeParams.id;
            fileUpload.uploadFileToUrl(fd, uploadUrl, $scope.UploadComplete);
        }

        function init() {
            $scope.todaydate = new Date();
            $scope.statuses = [];
            $scope.buildTypes = [];
            $scope.applications = [];
            $scope.hazards = [];
            $scope.districts = [];
            $scope.errorlist = [];
            $scope.conditions = [];
            $scope.selected_conditions = [];
            $scope.fileWidening = '';
            $scope.submitting = false;
            $scope.integration = [];
            $scope.declrenewals = [];
            $scope.newblock = {};
            $scope.checklist = {
                all_ok: false,
                agreed: false,
            };
            $scope.temp_appl_id = 0;
            var nurl = burl + "modules/citizen/";

            $http.get(url + "apis/Statuses.txt").success(function (response) {
                $scope.statuses = response;
            });

            $http.get(url + "apis/Districts.txt").success(function (response) {
                $scope.districts = response;
            });

            $http.get(url + "apis/BuildTypes.txt").success(function (response) {
                $scope.buildTypes = response;
            });

            $http.get(url + "apis/Hazards.txt").success(function (response) {
                $scope.hazards = response;
            });

            $http.get(url + "apis/FireStations.txt").success(function (response) {
                $scope.stations = response;
            });

            $http.get(url + "uploads/rules/integration/integration.config").success(function (response) {
                $scope.integration = response;
            });

            if ($routeParams.id) {
                $http.post(nurl + "application.aspx", { "appl_id": $routeParams.id }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                    .then(function (response) {
                        var data = response.data["data"];
                        var status = response.data["status"];
                        if (status["success"] == "Y") {
                            //	var dsplit = data['challan_date'].split("-");
                            //	data['challan_date'] = new Date(dsplit[0], dsplit[1], dsplit[2]);
                            $scope.application = data;
                            $scope.RenewApplID = $routeParams.id;
                            if (location.href.indexOf("onoc") > 0) {
                                $scope.application.form16type = "O";
                            }
                            else if (location.href.indexOf("rnoc") > 0) {
                                $scope.application.form16type = "R";
                            }
                            else {
                                $scope.application.form16type = "P";
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
                $http.get(url + "apis/newappl.txt").success(function (response) {
                    $scope.application = response;
                });
                $http.get(nurl + "applications.aspx").then(
                    function (response) {
                        $scope.applications = response.data;
                        //$('#openinfo').click();
                    },
                    function (response) {
                        alert("Failed to Fetch Active Applications.");
                    });
                $http.get(nurl + "declarationpending.aspx").then(
                    function (response) {
                        $scope.declrenewals = response.data.renewals;
                    },
                    function (response) {
                        alert("Failed to Fetch Active Renewals for Declaration.");
                    });

            }

        }

        $scope.DeleteApplication = function (applid) {
            var newLine = "\r\n"
            var message = "Are you sure you want to delete?"
            message += newLine;
            message += "Please verify and click OK. Once Application is deleted, complete data for this application is also removed";
            var x = confirm(message);
            if (x) {
                var nurl = burl + "modules/citizen/";
                $http.post(nurl + "delete_application.aspx", { "appl_id": applid }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                    .then(function (response) {
                        $scope.deleteapplication = response.data;
                        if ($scope.zession.success == "Y") {
                            alert("Application Deleted Successfully.");
                            location.reload();
                            HideLoader();
                        }
                        else {
                            alert("Application Deleted Failed.");
                            HideLoader();
                        }
                    },
                        function (response) {
                            alert("Application Deleted Failed.");
                            HideLoader();
                        });
            }
            else
                return false;
        }


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
        //init();

        //$scope.CheckFillForm19 = function (appl_id) {
        //    //if ($scope.application.ref_no == '' || $scope.application.parent_id == null)
        //    if ($scope.RenewApplID == null || $scope.application.parent_id == null)
        //        alert("Please Fill FillForm19");
        //}

        $scope.FillForm19 = function () {
            var n = 0;
            for (block in $scope.application.blocks) {
                n++;
            }
            if (n > 0) {
                if (!confirm("Have you provided all the information including all required blocks in this application. Not possible to add blocks once you click on 'OK'")) {
                    return;
                }
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
                            alert("You will be redirected to fill Form19 page.");
                            $scope.NavigateToAddRNOC(newid);
                        }
                        else {
                            alert("Application Copying Failed.");
                        }
                    },
                        function (response) {
                            alert("Application Copying Failed.");
                        });
                $scope.NavigateToAddRNOC = function (ro_appl_id) {
                    window.open("home.html#editronoc/" + ro_appl_id);
                }
            }
            else {
                alert("Please provide Block information, to fill Form19.");
            }
        }

        $scope.getChildApplications = function (appl_id) {
            ShowLoader();
            var nurl = burl + "modules/citizen/";
            $http.post(nurl + "childapplications.aspx", { "appl_id": appl_id }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                .then(function (response) {
                    $scope.childapplications = response.data;
                    $http.post(nurl + "renewalyears.aspx", { "appl_id": appl_id }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }).then(
                        function (response) {
                            $scope.decl_years = response.data[0];
                            HideLoader();
                        },
                        function (response) {
                            alert("Failed to Fetch DeclarationYears.");
                            HideLoader();
                        });

                },
                    function (response) {
                        alert("Application Child Failed.");
                        HideLoader();
                    });
        }

        $scope.total_built_up = function () {
            var block; var total = 0.0;
            for (block in $scope.application.blocks) {
                total = total + parseFloat($scope.application.blocks[block].built_area);
            }
            return Math.round(total * 100) / 100;
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

        $scope.NavigateToAdd = function () {
            $('#instructions').modal('hide');
            $('.modal-backdrop').hide();
            location.href = 'home.html#addpnoc';
        }

        //$scope.ExistingBuildingNOC = function () {
        //    $('#occupancy_existing').modal('hide');
        //    $('.modal-backdrop').hide();
        //    location.href = 'home.html#addoenoc';
        //}

        $scope.ExistingBuildingNOC = function (id) {
            var callapi = ""; var ndata = {};
            callapi = "newoeapplication.aspx";
            $scope.newoenoc.occumode = "E";
            ndata = $scope.newoenoc;

            var nurl = burl + "modules/citizen/";
            $http.post(nurl + callapi, ndata, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                .then(function (response) {
                    var data = response.data["data"];
                    var status = response.data["status"];
                    if (status["success"] == "Y") {
                        var newid = data["appl_id"];
                        $scope.NavigateToAddOENOC(newid);
                    }
                    else {
                        alert("Application Copying Failed.");
                    }
                },
                    function (response) {
                        alert("Application Copying Failed.");
                    });
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
            // return Math.round($scope.total_built_up() * 10);
            return Math.round($scope.application.challan_amt_reqd);
        };

        $scope.reqd_challan_o = function () {
            return $scope.application.challan_amt_reqd;
            //if ($scope.application.appl_type == "O" && $scope.application.appl_mode == "N") {
            //    var ch_o = parseFloat($scope.total_built_up());
            //    var mcapprove_date = $scope.application.mcapprove_date;
            //    var vals = mcapprove_date.split("-");
            //    if (vals.length > 2) {
            //        var mcdate = new Date(vals[0], vals[1], vals[2]);
            //    }
            //    var now = new Date();
            //    var years = now.getFullYear() - mcdate.getFullYear();
            //    var penalamt = Math.round((ch_o * 24 / 100) * years);
            //    return Math.round((ch_o * 10) + (ch_o * 10 / 100) + penalamt);
            //}
            //else {
            //    var ch_o = parseFloat($scope.total_built_up());
            //    var ch = parseFloat($scope.total_built_up_o());
            //    if (ch_o > ch) {
            //        return Math.round($scope.total_built_up() + 10 * ($scope.total_built_up() - $scope.total_built_up_o()));
            //    }
            //    else {
            //        return Math.round($scope.total_built_up());
            //    }
            //}
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

        $scope.district_desc = function (dist) {
            for (var i in $scope.districts) {
                if ($scope.districts[i].id == dist) {
                    return $scope.districts[i].desc;
                }
            }
            return "";
        }

        $scope.direction_name = function (direc) {
            if (direc == 'E') return 'East';
            else if (direc == 'W') return 'West';
            else if (direc == 'N') return 'North';
            else if (direc == 'S') return 'South';
            else return direc;
        }

        $scope.get_sub_types = function (btype) {
            for (var etype in $scope.buildTypes) {
                if ($scope.buildTypes[etype].code == btype) {
                    return $scope.buildTypes[etype].sub;
                }
            }
            return [];
        }

        $scope.get_hazards = function (type) {
            $scope.hazard = $filter("filter")($scope.hazards, { 'hazard_code': type });
            return $scope.hazard;
        }

        $scope.get_fire_stations = function () {
            for (var etype in $scope.stations) {
                if ($scope.stations[etype].id == $scope.application.district) {
                    return $scope.stations[etype].stations;
                }
            }
            return [];
        }

        $scope.get_ddo_code = function (dist) {
            for (var i in $scope.districts) {
                if ($scope.districts[i].id == dist) {
                    return $scope.districts[i].ddocode;
                }
            }
            return "";
        }

        $scope.get_distcode = function (dist) {
            for (var i in $scope.districts) {
                if ($scope.districts[i].id == dist) {
                    return $scope.districts[i].distcode;
                }
            }
            return "";
        }

        $scope.AddTempBlock = function () {
            var ndata = {};
            ndata = $scope.newblock;
            if (ndata.block_type == "N") {
                $scope.AddBlock(ndata.BlockName, ndata.block_type);
            }
            else {
                $scope.AddBlock("Podium Block : " + ndata.TBlockName, ndata.block_type);
                $scope.AddBlock("Tower Block : " + ndata.PBlockName, ndata.block_type);
            }
        }
        $scope.AddBlock = function (block_name, block_type) {
            var nblock = {
                "block_id": 0,
                "block_name": block_name,
                "site_type": "",
                "site_stype": "",
                "height": 0,
                "flr_count": 0,
                "built_area": 0,
                "is_mixed": false,
                "is_multiplex": false,
                "is_miniplex": false,
                "block_type": block_type
            };
            $scope.application.blocks.push(nblock);
        }

        $scope.DeleteBlock = function (idx) {
            var nurl = burl + "modules/citizen/";
            var r = confirm("Do you really want to delete the Block '" + $scope.application.blocks[idx].block_name + "'? You will lose all the information about the block.");
            if (r == true) {
                $http.post(nurl + "deleteblock.aspx", { "block_id": $scope.application.blocks[idx].block_id }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                    .then(
                        function (response) {
                            $scope.application.blocks.splice(idx, 1);
                        },
                        function (response) {
                            alert("Failed to Delete the Block.");
                        });
            }
        }

        $scope.FileExists = function (fname) {
            for (var i in $scope.application.files) {
                if ($scope.application.files[i].name == fname + ".pdf") {
                    return true;
                }
            }
            return false;
        }

        $scope.DownloadFile = function (fname) {
            var purl = burl + "uploads/applications/" + $scope.application.appl_id + "/" + fname + ".pdf";
            $window.open(purl);
        }

        $scope.DownloadFinal = function (application) {
            var purl = "";
            purl = burl + "uploads/applications/" + application.appl_id + "/FinalDoc.pdf";
            $window.open(purl);
        }

        $scope.DownloadFinalDeclaration = function (appl_id) {
            var purl = "";
            purl = burl + "uploads/applications/" + appl_id + "/Declaration.pdf";
            $window.open(purl);
        }

        $scope.DownloadDeclaration = function (appl_id) {
            var purl = "";
            purl = burl + "#declaration/" + appl_id;
            $window.open(purl);
        }

        $scope.SaveApplication = function () {
            ShowLoader();
            var nurl = burl + "modules/citizen/";
            if ($scope.application.raw_material == undefined) {
                $scope.application.raw_material = "";
            }
            if ($scope.application.end_product == undefined) {
                $scope.application.end_product = "";
            }
            $http.post(nurl + "newapplication.aspx", $scope.application, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                .then(function (response) {
                    var data = response.data["data"];
                    if (typeof data != "undefined") {
                        var status = response.data["status"];
                        if (status["success"] == "Y") {
                            $scope.application.appl_id = data["appl_id"];
                            $scope.UploadFiles();
                            $scope.ViewApplication(data["appl_id"], data["appl_type"], data["appl_mode"]);
                            HideLoader();
                        }
                        else {
                            alert("Error: " + status["error"]);
                            HideLoader();
                        }
                    }
                    else {
                        alert("Please provide valid data for Site Name and Site Address. Please check fields with Red Background and correct the values appropriately.");
                        HideLoader();
                    }
                },
                    function (response) {
                        alert("Application submission 2 failed.");
                        HideLoader();
                    });
        }

        $scope.Validate = function () {
            var succ = true;
            if ($scope.application.height < 18) {
                alert("Only Applications with Height more than 18 meters are accepted in this system. For other applications, please directly approach the DFO in your district.");
                succ = false;
            }

            if ($scope.reqd_challan() > $scope.application.challan_amt) {
                alert("Insufficient Challam Amount Paid.");
                succ = false;
            }

            if ($scope.application.height <= 0) {
                alert("Height of Building Mandatory.");
                succ = false;
            }
            if ($scope.application.flr_count <= 0) {
                alert("Floor Count Mandatory.");
                succ = false;
            }
            if ($scope.application.built_area <= 0) {
                alert("Total Built Up Area Mandatory.");
                succ = false;
            }
            if ($scope.application.plot_area <= 0) {
                alert("Plot Area Mandatory.");
                succ = false;
            }

            return succ;
        }

        $scope.ViewApplication = function (appl_id, appl_type, appl_mode) {
            if (typeof appl_id == 'undefined') {
                appl_id = $scope.application.appl_id;
            }
            if (typeof appl_type == 'undefined') {
                appl_type = $scope.application.appl_type;
            }
            if (appl_type == 'P')
                location.href = "#editpnoc/" + appl_id;
            else if (appl_type == 'O' && appl_mode != 'E')
                location.href = "#editonoc/" + appl_id;
            else if (appl_type == 'R')
                location.href = "#editrnoc/" + appl_id;
            else if (appl_type == 'D')
                location.href = "#editdnoc/" + appl_id;
            else if (appl_type == 'O' && appl_mode == 'E')
                location.href = "#editoenoc/" + appl_id;
        }

        $scope.GotoBasic = function () {
            location.href = "#editpnoc/" + $scope.application.appl_id;
        }

        $scope.GotoDetails = function (block_id) {
            if ($scope.application.appl_type == 'P') {
                location.href = "#editpnoc_1/" + block_id;
            }
            else if ($scope.application.appl_type == 'O' && $scope.application.appl_mode != 'E') {
                location.href = "#editonoc_1/" + block_id;
            }
            else if ($scope.application.appl_type == 'R') {
                location.href = "#editrnoc_1/" + block_id;
            }
            else if ($scope.application.appl_type == 'RO') {
                location.href = "#editronoc_1/" + block_id;
            }
            else if ($scope.application.appl_type == 'O' && $scope.application.appl_mode == 'E') {
                location.href = "#editoenoc_1/" + block_id;
            }
        }

        $scope.GotoEscapes = function (block_id) {
            if ($scope.application.appl_type == 'P') {
                location.href = "#editpnoc_2/" + block_id;
            }
            else if ($scope.application.appl_type == 'O' && $scope.application.appl_mode != 'E') {
                location.href = "#editonoc_2/" + block_id;
            }
            else if ($scope.application.appl_type == 'RO') {
                location.href = "#editronoc_2/" + block_id;
            }
            else if ($scope.application.appl_type == 'O' && $scope.application.appl_mode == 'E') {
                location.href = "#editoenoc_2/" + block_id;
            }
        }

        $scope.GotoFFE = function (block_id) {
            if ($scope.application.appl_type == 'P') {
                location.href = "#editpnoc_3/" + block_id;
            }
            else if ($scope.application.appl_type == 'O' && $scope.application.appl_mode != 'E') {
                location.href = "#editonoc_3/" + block_id;
            }
            else if ($scope.application.appl_type == 'RO') {
                location.href = "#editronoc_3/" + block_id;
            }
            else if ($scope.application.appl_type == 'O' && $scope.application.appl_mode == 'E') {
                location.href = "#editoenoc_3/" + block_id;
            }
        }

        $scope.GotoAttach = function (block_id) {
            if ($scope.application.host == 'MAUD') {
                location.href = "#allplans/" + block_id;
            }
            else {
                if ($scope.application.appl_type == 'P') {
                    location.href = "#editpnoc_4/" + block_id;
                }
                else if ($scope.application.appl_type == 'O' && $scope.application.appl_mode != 'E') {
                    location.href = "#editonoc_4/" + block_id;
                }
                else if ($scope.application.appl_type == 'RO') {
                    location.href = "#editronoc_4/" + block_id;
                }
                else if ($scope.application.appl_type == 'O' && $scope.application.appl_mode == 'E') {
                    location.href = "#editoenoc_4/" + block_id;
                }
            }
        }

        $scope.CoverLetter = function (appl_id) {
            location.href = "#cover/" + appl_id;
        }

        $scope.Acknowledge = function (appl_id) {
            location.href = "#ack/" + appl_id;
        }

        $scope.SaveChecklist = function () {
            ShowLoader();
            for (var i = 0; i < $scope.application.conditions.length; i++) {
                if ($scope.application.conditions[i].selected == true || $scope.application.conditions[i].applcheck_id > 0) {
                    var checklist = {
                        "checklist_id": $scope.application.conditions[i].checklist_id,
                        "applcheck_id": $scope.application.conditions[i].applcheck_id,
                        "selected": $scope.application.conditions[i].selected
                    };

                    if ($scope.selected_conditions.indexOf(checklist.checklist_id) < 0 && $scope.selected_conditions[checklist.checklist_id] != "undefined") {
                        $scope.selected_conditions.push(checklist);
                    }
                }
            }
            //$window.alert($scope.selected_conditions);
            var nurl = burl + "modules/citizen/";
            $http.post(nurl + "saveconditions.aspx", { "appl_id": $scope.application.appl_id, "list": $scope.selected_conditions }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                .then(function (response) {
                    var data = response.data["data"];
                    var status = response.data["status"];
                    if (status["success"] == "Y") {
                        alert("Conditions saved successfully.");
                        location.reload(); HideLoader();
                        //  location.href = 'home.html#/editonoc?id=' + $scope.application.appl_id;
                    }
                    else {
                        alert("Conditions Save failed.");
                        location.reload(); HideLoader();
                    }
                },
                    function (response) {
                        alert("Conditions Save failed.");
                        location.reload(); HideLoader();
                    });
        }

        $scope.ConfirmDoc = function () {
            ShowLoader();
            //  $scope.CheckFillForm19();
            $scope.submitting = true;
            var nurl = burl + "modules/citizen/";
            $http.post(nurl + "validateapplication.aspx", $scope.application, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                .then(function (response) {
                    var data = response.data["data"];
                    var status = response.data["status"];
                    if (status["success"] == "Y") {
                        if ($scope.application.appl_type == 'P')
                            location.href = "#confirm/" + $scope.application.appl_id;
                        else if ($scope.application.appl_type == 'O' && $scope.application.appl_mode != 'E')
                            location.href = "#confirm_o/" + $scope.application.appl_id;
                        else if ($scope.application.appl_type == 'R')
                            location.href = "#confirm_r/" + $scope.application.appl_id;
                        else if ($scope.application.appl_type == 'RO')
                            location.href = "#confirm_r/" + $scope.application.appl_id;
                        else if ($scope.application.appl_type == 'D')
                            ConfirmDeclaration();
                        else if ($scope.application.appl_type == 'O' && $scope.application.appl_mode == 'E')
                            location.href = "#confirm_oe/" + $scope.application.appl_id;
                        HideLoader();
                    }
                    else {
                        alert("Error: Please correct the following errors.");
                        $scope.errorlist = data["errors"];
                        $('#openmodalbutton').click();
                        HideLoader();
                    }
                    $scope.submitting = false;
                },
                    function (response) {
                        if ($scope.application.appl_type == "R") {
                            alert("Please fill form 19 before submission");
                        }
                        else {
                            alert("Application Validation failed.");
                        }
                        $scope.submitting = false;
                        HideLoader();
                    });
        }

        function ConfirmDeclaration() {
            if (confirm("Ensure the given Submitted details are correct. Edit details is not possible once click on OK button")) {
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
        }

        $scope.Revise = function (appl_id) {
            var nurl = burl + "modules/citizen/";
            $http.post(nurl + "revise.aspx", { "appl_id": appl_id }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                .then(function (response) {
                    var data = response.data["data"];
                    var status = response.data["status"];
                    if (status["success"] == "Y") {
                        location.href = "home.html#editpnoc/" + appl_id;
                    }
                    else {
                        alert("Application Revision Failed.");
                    }
                },
                    function (response) {
                        alert("Application Revision Failed.");
                    });
        }

        $scope.CopyPNOCApplication = function (id) {
            if (id < 1)
                if ($scope.newonoc.onocmode == 'O') {
                    id = $scope.newonoc.pnocapid;
                }

            var callapi = ""; var ndata = {};
            if (id > 0) {
                callapi = "copyform16.aspx";
                ndata = { "appl_id": id };
            }
            else {
                callapi = "newonocappl.aspx";
                ndata = $scope.newonoc;
            }

            var nurl = burl + "modules/citizen/";
            $http.post(nurl + callapi, ndata, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                .then(function (response) {
                    var data = response.data["data"];
                    var status = response.data["status"];
                    if (status["success"] == "Y") {
                        var newid = data["appl_id"];
                        $scope.NavigateToAddONOC(newid);
                    }
                    else {
                        alert("Application Copying Failed.");
                    }
                },
                    function (response) {
                        alert("Application Copying Failed.");
                    });
        }

        $scope.CloseApplication = function () {
            if ($scope.zession.role == "C") {
                location.href = "#dashboard";
            }
            else {
                location.href = window.close();
            }
            ////window.history.back();
        }

        $scope.NavigateToAddONOC = function (applid) {
            $('#occupancy').modal('hide');
            $('.modal-backdrop').hide();
            location.href = 'home.html#/editonoc?id=' + applid;
        }

        $scope.NavigateToAddOENOC = function (applid) {
            $('#occupancy_existing').modal('hide');
            $('.modal-backdrop').hide();
            location.href = 'home.html#/editoenoc?id=' + applid;
        }

        $scope.CannotEdit = function (ftype) {
            if ($scope.application.appl_type == 'P') {
                if ($scope.application.status_id == 1)
                    return false;
                else
                    return true;
            }
            else if ($scope.application.appl_type == 'O') {
                if ($scope.application.status_id == 1)
                    if (ftype == 'B') {
                        if ($scope.application.appl_mode == 'O') {
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
            else if ($scope.application.appl_type == 'R' || $scope.application.appl_type == 'RO') {
                if ($scope.application.status_id == 1)
                    if (ftype == 'B') {
                        if ($scope.application.appl_mode == 'O') {
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

        $scope.total_built_up_o = function () {
            var block; var total = 0.0;
            for (block in $scope.application.blocks) {
                total = total + parseFloat($scope.application.blocks[block].parent_built_area);
            }
            return Math.round(total * 100) / 100;
        }

        $scope.total_built_up_r = function () {
            var block; var total = 0.0;
            if ($scope.application.appl_mode == "O" && $scope.application.host != 'SDP') {
                for (block in $scope.application.blocks) {
                    total = total + parseFloat($scope.application.blocks[block].parent_built_area);
                }
            }
            if ($scope.application.appl_mode == "O" && $scope.application.host == 'SDP') {
                for (block in $scope.application.blocks) {
                    total = total + parseFloat($scope.application.blocks[block].total_built_area);
                }
            }
            else if ($scope.application.appl_mode == "M") {
                for (block in $scope.application.blocks) {
                    total = total + parseFloat($scope.application.blocks[block].total_built_area);
                }
            }
            return Math.round(total * 100) / 100;
        }

        $scope.CopyONOCApplication = function (id) {
            if (id < 1) {
                if ($scope.newonoc.onocmode == 'O') {
                    id = $scope.newonoc.pnocapid;
                }
                if ($scope.newonoc.onocmode == 'RO') {
                    id = $scope.newonoc.ronocid;
                }
            }

            var callapi = ""; var ndata = {};
            if (id > 0) {
                callapi = "copyform16.aspx";
                ndata = { "appl_id": id };
            }
            else {
                callapi = "NewRenewals.aspx";
                ndata = $scope.newonoc;
            }

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

        $scope.CopyRNOCApplication = function (id) {
            if (id > 0) {
                callapi = "newdeclaration.aspx";
                ndata = { "appl_id": id };
            }
            else {
                alert("Select the Renewal for Submit Declaration");
            }

            var nurl = burl + "modules/citizen/";
            $http.post(nurl + callapi, ndata, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                .then(function (response) {
                    var data = response.data["data"];
                    var status = response.data["status"];
                    if (status["success"] == "Y") {
                        var newid = data["appl_id"];
                        $scope.NavigateToAddDNOC(newid);
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
            $('#renewal').modal('hide');
            $('.modal-backdrop').hide();
            location.href = 'home.html#editrnoc?id=' + applid;
        }

        $scope.NavigateToAddDNOC = function (applid) {
            $('#declaration').modal('hide');
            $('.modal-backdrop').hide();
            location.href = 'home.html#editdnoc/id=' + applid;
        }

        $scope.getHOA = function (appl_type) {
            if (appl_type == "P" || appl_type == "O") {
                return "0070601090002001000VN";
            }
            if (appl_type == "R") {
                return "0070601090081000000VN";
            }
        }

        $scope.getServicecode = function (appl_type) {
            if (appl_type == "P" || appl_type == "O") {
                return 1089;
            }
            if (appl_type == "R") {
                return 1088;
            }
        }

        $scope.PayOnline = function (applid) {
            ShowLoader();
            var nurl = burl + "modules/integration/";
            $http.post(nurl + "newtransaction.aspx", $scope.application, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                .then(function (response) {
                    var data = response.data["data"];
                    var status = response.data["status"];
                    if (status["success"] == "Y") {
                        document.getElementById("TransactionID").value = data["tx_id"];
                        document.getElementById("RegID").value = $scope.application.host_id;
                        document.getElementById("DDOCode").value = $scope.get_ddo_code($scope.application.district);
                        document.getElementById("RemittersName").value = $scope.application.site_name;
                        document.getElementById("Amount").value = $scope.application.challan_amt_reqd;
                        document.getElementById("Clr_ID").value = $scope.application.host_key;
                        document.frmInput.submit();
                        HideLoader();
                    }
                    else {
                        alert("Transaction failed.");
                        HideLoader();
                    }
                },
                    function (response) {
                        alert("Transaction failed.");
                        HideLoader();
                    });
            //on return
            //SET values
        };

        $scope.CFMSPayOnline = function (applid) {
            ShowLoader();
            var nurl = burl + "modules/integration/";
            $http.post(nurl + "CfmsNewtransaction.aspx", $scope.application, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                .then(function (response) {
                    var data = response.data["data"];
                    var status = response.data["status"];
                    if (status["success"] == "Y") {
                        document.getElementById("DTId").value = data["tx_id"];;
                        document.getElementById("RN").value = $scope.application.site_name;
                        document.getElementById("RID").value = $scope.application.citizen_id;
                        document.getElementById("TA").value = $scope.application.challan_amt_reqd;
                        document.getElementById("Mobile").value = $scope.application.build_mobile;
                        document.getElementById("email").value = $scope.application.build_email;
                        document.getElementById("Ch").value = $scope.getHOA($scope.application.appl_type) + "," + $scope.get_ddo_code($scope.application.district) + "," + $scope.getServicecode($scope.application.appl_type) + "," + $scope.application.challan_amt_reqd;
                        document.getElementById("Oth").value = "";
                        document.frmCFMS.submit();
                        HideLoader();
                    }
                    else {
                        alert("CFMS Transaction failed.");
                        HideLoader();
                    }
                },
                    function (response) {
                        alert("CFMS Transaction failed.");
                        HideLoader();
                    });
        };

        $scope.redirectToCfms = function () {
            $window.open('https://prdcfms.apcfss.in:44300/sap/bc/ui5_ui5/sap/zfi_rcp_challan/index.html?sap-client=350&sap-ui-theme=cfms@https://prdcfms.apcfss.in:44300/sap/public/bc/themes/~client-350', '_blank');
        };

        $scope.NavigateToFeedback = function (applid) {
            $scope.temp_appl_id = applid;
        }

        $scope.UploadRequest = function (applid) {
            var nurl = burl + "modules/citizen/";
            $http.post(nurl + "upload_request.aspx", applid, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                .then(function (response) {
                    $scope.uploadRequest = response.data;
                    $scope.requestUser = $scope.uploadRequest[0].user_name
                    $('#requestdoc').click();
                    HideLoader();
                },
                    function (response) {
                        alert("Attachment Request Failed.");
                        HideLoader();
                    });
        }

        $(function () {
            $("#rateYo").rateYo({
                onSet: function (rating, rateYoInstance) {
                    rating = Math.ceil(rating);
                    $('#rating_input').val(rating);//setting up rating value to hidden field
                    alert("Rating is set to: " + rating);
                }
            });
        });

        $scope.Feedbackform = function () {
            var desc = document.getElementById("fd_desc").value;
            var rating = document.getElementById("rating_input").value;;//$scope.application.rating;
            if (desc.length == 0) {
                alert("Please enter description before submitting.");
                return;
            }
            if (rating.length == 0) {
                alert("Please  provide rating before submitting.");
                return;
            }
            else {
                var fdbdata = {};
                fdbdata =
                    {
                        "appl_id": $scope.temp_appl_id,
                        "rating": rating,
                        "description": desc
                    };
                ShowLoader();
                var nurl = burl + "modules/citizen/";
                $http.post(nurl + "savefeedback.aspx", fdbdata, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                    .then(function (response) {
                        var data = response.data["data"];
                        var status = response.data["status"];
                        if (status["success"] == "Y") {
                            $scope.application.feedback = data;
                            alert("Thankyou for your feedback.");
                        }
                        else {
                            alert("Save Failed");
                        }
                        location.reload();
                        HideLoader();
                    },
                        function (response) {
                            alert("Save Failed.");
                            HideLoader();
                        });
            }
        }

        $scope.pfCharges = function () {
            var transtype = document.getElementById("transtype").value;
            var utrnumber = document.getElementById("utrnumber").value;
            var transcomments = document.getElementById("transcomments").value;
            var transdate = document.getElementById("transdate").value;
            if (utrnumber.length == 0) {
                alert("Please enter UTR Number before submitting.");
                return;
            }
            if (transtype.length == 0) {
                alert("Please Select Trasaction type before submitting.");
                return;
            }
            if (transcomments.length == 0) {
                alert("Please enter Comments before submitting.");
                return;
            }
            if (transdate.length == 0) {
                alert("Please enter Trasaction Date before submitting.");
                return;
            }
            else {
                var transdata = {};
                transdata =
                    {
                        "appl_id": $routeParams.id,
                        "utrnumber": utrnumber,
                        "transtype": transtype,
                        "transcomments": transcomments,
                        "transdate": transdate
                    };
                ShowLoader();
                var nurl = burl + "modules/citizen/";
                $http.post(nurl + "savepfcharges.aspx", transdata, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
                    .then(function (response) {
                        var data = response.data["data"];
                        var status = response.data["status"];
                        if (status["success"] == "Y") {
                            $scope.application.pfcharges = data;
                            alert("Save Successfully.");
                        }
                        else if (status["success"] == "E") {
                            $scope.pfcharges = data;
                            alert("UTR Number already Exists. Please Send a mail to apfire@srisaa.com");
                        }
                        else {
                            alert("Save Failed. Please Send a mail to apfire@srisaa.com");
                        }
                        location.reload();
                        HideLoader();
                    },
                        function (response) {
                            alert("Save Failed. Please Send a mail to apfire@srisaa.com");
                            HideLoader();
                        });
            }
        }

        $timeout(function () {
            $('#district').val($scope.application.district + ''); // $scope.application.district
            $('#firestation').val($scope.application.firestation + ''); // $scope.application.district
            for (var i in $scope.application.blocks) {
                $('#site_stype_' + $scope.application.blocks[i].block_id).val($scope.application.blocks[i].site_stype + '');
            }
        }, 1000);

    }]);
