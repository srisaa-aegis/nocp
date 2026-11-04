angular.module('citizen')
.controller("renewalController", ['$scope', '$http', '$routeParams', 'fileUpload', '$window', function ($scope, $http, $routeParams, fileUpload, $window) {

    //$scope.UploadFiles = function () {
    //    var nurl = burl + "modules/citizen/";

    //    var fd = new FormData();
    //    fd.append($('#lfileSitePlan').html(), $scope.fileSitePlan);
    //    fd.append($('#lfileSectionPlan').html(), $scope.fileSectionPlan);
    //    fd.append($('#lfileElevationPlan').html(), $scope.fileElevationPlan);

    //    var uploadUrl = nurl + "uploaddocs.aspx?bid=" + $routeParams.id;
    //    fileUpload.uploadFileToUrl(fd, uploadUrl);
    //};

    function init() {
        $scope.statuses = [];
        $scope.buildTypes = [];
        $scope.applications = [];
        $scope.districts = [];
        $scope.errorlist = [];

        $scope.checklist = {
            all_ok: false,
            agreed: false,
        };

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

        if ($routeParams.id) {
            $http.post(nurl + "Renewal.aspx", { "renewal_id": $routeParams.id }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
			 .then(function (response) {
			     var data = response.data["data"];
			     var status = response.data["status"];
			     if (status["success"] == "Y") {
			         //						var dsplit = data['challan_date'].split("-");
			         //						data['challan_date'] = new Date(dsplit[0], dsplit[1], dsplit[2]);
			         $scope.application = data;
			     }
			     else {
			         //alert("Error: " + status["error"]);
			     }
			 },
				function (response) {
				    alert("Failed to Fetch Renewal Information.");
				});
        }
        else {
            $http.get(url + "apis/newrenewal.txt").success(function (response) {
                $scope.application = response;
            });
            $http.get(nurl + "Renewals.aspx").then(
				function (response) {
				    $scope.applications = response.data;
				},
				function (response) {
				    alert("Failed to Fetch Active Renewals.");
				});
        }
    }

    init();

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
        return Math.round($scope.total_built_up() * 10);
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

    $scope.AddBlock = function () {
        var nblock = {
            "renewalblock_id": 0,
            "renewalblock_name": "",
            "site_type": "res",
            "site_stype": "A4",
            "height": 0,
            "flr_count": 0,
            "built_area": 0
        };
        $scope.application.blocks.push(nblock);
    }

    $scope.DeleteBlock = function (idx) {
        var nurl = burl + "modules/citizen/";
        var r = confirm("Do you really want to delete the Block '" + $scope.application.blocks[idx].renewalblock_name + "'? You will lose all the information about the block.");
        if (r == true) {
            $http.post(nurl + "deleterenewalblock.aspx", { "renewalblock_id": $scope.application.blocks[idx].renewalblock_id }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
			.then(
				function (response) {
				    $scope.application.blocks.splice(idx, 1);
				},
				function (response) {
				    alert("Failed to Delete the Block.");
				});
        }
    }

    $scope.UploadFiles = function () {
        var nurl = burl + "modules/citizen/";

        var fd = new FormData();
        fd.append($('#lfileChallan').attr("fname"), $scope.fileChallan);
        fd.append($('#lfilepnoc').attr("fname"), $scope.filepnoc);
        fd.append($('#lfileOccupancy').attr("fname"), $scope.fileOccupancy);
        //fd.append($('#lfileDeclaration').attr("fname"), $scope.fileDeclaration);
        //fd.append($('#lfileEstimate').attr("fname"), $scope.fileEstimate);
        //fd.append($('#lfileWidening').attr("fname"), $scope.fileWidening);

        var uploadUrl = nurl + "uploadrenewaldocs.aspx?rid=" + $routeParams.id;
        fileUpload.uploadFileToUrl(fd, uploadUrl);
    };

    $scope.FileExists = function (fname) {
        for (var i in $scope.application.files) {
            if ($scope.application.files[i].name == fname + ".pdf") {
                return true;
            }
        }
        return false;
    }

    $scope.DownloadFile = function (fname) {
        var purl = burl + "uploads/renewals/" + $scope.application.renewal_id + "/" + fname + ".pdf";
        $window.open(purl);
    }

    //$scope.DownloadFinal = function (fid) {
    //    var purl = burl + "uploads/renewals/" + fid + "/FinalDoc.pdf";
    //    $window.open(purl);
    //}

    $scope.SaveRenewal = function () {
        var nurl = burl + "modules/citizen/";
        $http.post(nurl + "NewRenewals.aspx", $scope.application, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
		 .then(function (response) {
		     var data = response.data["data"];
		     var status = response.data["status"];
		     if (status["success"] == "Y") {
		         $scope.application.renewal_id = data["renewal_id"];
		         $scope.UploadFiles();
		         alert("Successfully Saved");
		         location.href = "#editrenewal/" + data["renewal_id"];
		     }
		     else {
		         alert("Error: " + status["error"]);
		     }
		 },
			function (response) {
			    alert("Application submission 2 failed.");
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


    $scope.ViewApplication = function (renewal_id) {
        location.href = "#editrenewal/" + renewal_id;
    }

    $scope.GotoBasic = function () {
        location.href = "#editrenewal/" + $scope.application.renewal_id;
    }

    //$scope.GotoDetails = function (block_id) {
    //    location.href = "#editpnoc_1/" + block_id;
    //}

    //$scope.GotoEscapes = function (block_id) {
    //    location.href = "#editpnoc_2/" + block_id;
    //}

    //$scope.GotoFFE = function (block_id) {
    //    location.href = "#editpnoc_3/" + block_id;
    //}

    //$scope.GotoAttach = function (block_id) {
    //    location.href = "#editpnoc_4/" + block_id;
    //}

    //$scope.CoverLetter = function (appl_id) {
    //    location.href = "#cover/" + appl_id;
    //}

    //$scope.Acknowledge = function (appl_id) {
    //    location.href = "#ack/" + appl_id;
    //}

    //$scope.ConfirmDoc = function () {
    //    var nurl = burl + "modules/citizen/";
    //    $http.post(nurl + "validateapplication.aspx", { "appl_id": $scope.application.appl_id }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
	//	 .then(function (response) {
	//	     var data = response.data["data"];
	//	     var status = response.data["status"];
	//	     if (status["success"] == "Y") {
	//	         location.href = "#confirm/" + $scope.application.appl_id;
	//	     }
	//	     else {
	//	         alert("Error: Please correct the following errors.");
	//	         $scope.errorlist = data["errors"];
	//	         $('#openmodalbutton').click();
	//	     }
	//	 },
	//		function (response) {
	//		    alert("Application Validation failed.");
	//		});
    //}
}]);
