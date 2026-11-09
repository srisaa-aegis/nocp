var registers = angular.module("registers", ['ngRoute']);

registers.config(['$routeProvider', '$httpProvider', function ($routeProvider, $httpProvider) {
    $httpProvider.defaults.withCredentials = true;
    $routeProvider.

        when('/login', {
            templateUrl: 'login.htm'
        }).

        when('/logout', {
            templateUrl: 'logout.htm'
        }).

        when('/register', {
            templateUrl: 'register.htm'
        }).

        when('/forgotpwd', {
            templateUrl: 'forgotpwd.htm'
        }).

        otherwise({
            redirectTo: '/login'
        });
}]);

var citizen = angular.module("citizen", ['ngRoute']);
citizen.config(['$routeProvider', '$httpProvider', function ($routeProvider, $httpProvider) {
    $httpProvider.defaults.withCredentials = true;
    $routeProvider.

        when('/dashboard', {
            templateUrl: 'dashboard.htm'
        }).
        when('/addpnoc', {
            templateUrl: 'editpnoc.htm',
            controller: 'applicationController'
        }).
        when('/editpnoc/:id', {
            templateUrl: 'editpnoc.htm',
            controller: 'applicationController'
        }).
        when('/editpnoc_1/:id', {
            templateUrl: 'editpnoc_1.htm',
            controller: 'blockController'
        }).
        when('/editpnoc_2/:id', {
            templateUrl: 'editpnoc_2.htm',
            controller: 'blockController'
        }).
        when('/editpnoc_3/:id', {
            templateUrl: 'editpnoc_3.htm',
            controller: 'blockController'
        }).
        when('/editpnoc_4/:id', {
            templateUrl: 'editpnoc_4.htm',
            controller: 'blockController'
        }).
        when('/cover/:id', {
            templateUrl: 'coverletter.htm',
            controller: 'applicationController'
        }).
        when('/ack/:id', {
            templateUrl: 'acknowledge.htm',
            controller: 'applicationController'
        }).
        when('/rcp/:id', {
            templateUrl: 'challan.htm',
            controller: 'applicationController'
        }).
        when('/declaration/:id', {
            templateUrl: 'declaration.htm'
        }).
        when('/final_noc/:id', {
            templateUrl: 'final_noc.htm'
        }).
        when('/final_noc_16/:id', {
            templateUrl: 'final_noc_16.htm'
        }).
        when('/final_noc_g/:id', {
            templateUrl: 'final_noc_g.htm'
        }).
        when('/occcert/:id', {
            templateUrl: 'occcert.htm'
        }).
        when('/rejection/:id', {
            templateUrl: 'rejection.htm'
        }).
        when('/final_noc_ic/:id', {
            templateUrl: 'final_noc_ic.htm'
        }).
        when('/confirm/:id', {
            templateUrl: 'confirmpnoc.htm',
            controller: 'confirmController'
        }).
        when('/confirm_oe/:id', {
            templateUrl: 'confirmoenoc.htm',
            controller: 'confirmController'
        }).
        when('/chpass', {
            templateUrl: 'changepass.htm'
        }).
        when('/invalid', {
            templateUrl: 'invalid.htm'
        }).
        otherwise({
            redirectTo: '/dashboard'
        }).
        when('/editonoc/:id', {
            templateUrl: 'editonoc.htm',
            controller: 'applicationController'
        }).
        when('/editdnoc/:id', {
            templateUrl: 'editdnoc.htm',
            controller: 'applicationController'
        }).
        when('/editonoc_1/:id', {
            templateUrl: 'editonoc_1.htm',
            controller: 'blockController'
        }).
        when('/editonoc_2/:id', {
            templateUrl: 'editonoc_2.htm',
            controller: 'blockController'
        }).
        when('/editonoc_3/:id', {
            templateUrl: 'editonoc_3.htm',
            controller: 'blockController'
        }).
        when('/editonoc_4/:id', {
            templateUrl: 'editonoc_4.htm',
            controller: 'blockController'
        }).
        when('/editrnoc/:id', {
            templateUrl: 'editrnoc.htm',
            controller: 'applicationController'
        }).
        when('/editrnoc_1/:id', {
            templateUrl: 'editrnoc_1.htm',
            controller: 'blockController'
        }).
        when('/editronoc/:id', {
            templateUrl: 'editronoc.htm',
            controller: 'applicationController'
        }).
        when('/editronoc_1/:id', {
            templateUrl: 'editronoc_1.htm',
            controller: 'blockController'
        }).
        when('/editronoc_2/:id', {
            templateUrl: 'editronoc_2.htm',
            controller: 'blockController'
        }).
        when('/editronoc_3/:id', {
            templateUrl: 'editronoc_3.htm',
            controller: 'blockController'
        }).
        when('/editronoc_4/:id', {
            templateUrl: 'editronoc_4.htm',
            controller: 'blockController'
        }).
        when('/pnocconditions/:id', {
            templateUrl: 'confirmpconditions.htm',
            controller: 'applicationController'
        }).
        when('/confirm_o/:id', {
            templateUrl: 'confirmonoc.htm',
            controller: 'confirmController'
        }).
        when('/final_noc_o/:id', {
            templateUrl: 'final_noc_o.htm'
        }).
        when('/final_noc_o_e/:id', {
            templateUrl: 'final_noc_o_e.htm'
        }).
        when('/confirm_r/:id', {
            templateUrl: 'confirmrnoc.htm',
            controller: 'confirmController'
        }).
        when('/confirm_d/:id', {
            templateUrl: 'confirmdnoc.htm',
            controller: 'confirmController'
        }).
        when('/final_noc_r/:id', {
            templateUrl: 'final_noc_r.htm'
        }).
        when('/allplans/:id', {
            templateUrl: 'allplans.htm',
            controller: 'blockController'
        }).
        when('/addoenoc', {
            templateUrl: 'editoenoc.htm',
            controller: 'applicationController'
        }).
        when('/editoenoc/:id', {
            templateUrl: 'editoenoc.htm',
            controller: 'applicationController'
        }).
        when('/editoenoc_1/:id', {
            templateUrl: 'editoenoc_1.htm',
            controller: 'blockController'
        }).
        when('/editoenoc_2/:id', {
            templateUrl: 'editoenoc_2.htm',
            controller: 'blockController'
        }).
        when('/editoenoc_3/:id', {
            templateUrl: 'editoenoc_3.htm',
            controller: 'blockController'
        }).
        when('/editoenoc_4/:id', {
            templateUrl: 'editoenoc_4.htm',
            controller: 'blockController'
        });
}]);

var dept = angular.module("dept", ['ngRoute']);
dept.config(['$routeProvider', '$httpProvider', function ($routeProvider, $httpProvider) {
    $httpProvider.defaults.withCredentials = true;
    $routeProvider.

        when('/dashboard', {
            templateUrl: 'dashboard.htm'
        }).
        when('/search', {
            templateUrl: 'search.htm'
        }).
        when('/chpwd', {
            templateUrl: 'chpwd.htm'
        }).
        when('/sms', {
            templateUrl: 'sms.htm'
        }).
        when('/feedback', {
            templateUrl: 'feedback.htm'
        }).
        when('/applications', {
            templateUrl: 'applications.htm'
        }).
        when('/overdue', {
            templateUrl: 'overdue.htm'
        }).
        when('/receive/:id', {
            templateUrl: 'receive.htm'
        }).
        when('/fulledit/:id', {
            templateUrl: 'fulledit.htm'
        }).
        when('/insrpt/:id', {
            templateUrl: 'insrpt.htm'
        }).
        when('/pendency', {
            templateUrl: 'dgDashboardReport.htm'
        }).
        when('/printprocess/:id', {
            templateUrl: 'printprocess.htm',
            controller: 'printpController'
        }).
        when('/invalid', {
            templateUrl: 'invalid.htm'
        }).
        when('/statistics', {
            templateUrl: 'statistics_report.htm'
        }).
        when('/conslidated', {
            templateUrl: 'consolidated_report.htm'
        }).
        otherwise({
            redirectTo: '/dashboard'
        });
}]);

var admin = angular.module("admin", ['ngRoute']);
admin.config(['$routeProvider', '$httpProvider', function ($routeProvider, $httpProvider) {
    $httpProvider.defaults.withCredentials = true;
    $routeProvider.

        when('/dashboard', {
            templateUrl: 'dashboard.htm'
        }).
        when('/draftfiles', {
            templateUrl: 'draftfiles.htm'
        }).
        otherwise({
            redirectTo: '/dashboard'
        });
}]);
