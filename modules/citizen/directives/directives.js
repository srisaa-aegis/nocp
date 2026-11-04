 angular.module('citizen')
 .directive('fileModel', ['$parse', function ($parse) {
	return {
	   restrict: 'A',
	   link: function(scope, element, attrs) {
		  var model = $parse(attrs.fileModel);
		  var modelSetter = model.assign;

		  element.bind('change', function(){
			 scope.$apply(function(){
				modelSetter(scope, element[0].files[0]);
			 });
		  });
	   }
	};
 }])

 .directive('ssFormat', ['$compile', function($compile){
    return{
    priority: 1000,
    terminal: true,
    compile: function (element, attr){

		var format = attr["ssFormat"];
        element.removeAttr('ss-format');
        if ( format == 'decimal')
        {
        	element.attr('ng-pattern', '/^[0-9]+(\.[0-9]{1,2})?$/');
		}
        else if ( format == 'nzdecimal')
        {
        	element.attr('ng-pattern', '/^[1-9][0-9]+(\.[0-9]{1,2})?$/');
		}
		else if (format == 'mobile')
		{
			element.attr('ng-pattern', '/^[0-9]{10,10}$/');
		}
		else if (format == 'phone')
		{
			element.attr('ng-pattern', '/^[-()0-9]+$/');
		}
		else if (format == 'integer')
		{
			element.attr('ng-pattern', '/^[0-9]+$/');
		}
		else if (format == 'nzinteger')
		{
			element.attr('ng-pattern', '/^[1-9][0-9]+$/');
		}
		else if (format == 'latlng')
		{
			element.attr('ng-pattern', '/^[0-9]+(\.[0-9]{1,8})?$/');
		}
		else if (format == 'date')
		{
			//element.attr('ng-pattern', '^((((0[13578])|([13578])|(1[02]))[\/](([1-9])|([0-2][0-9])|(3[01])))|(((0[469])|([469])|(11))[\/](([1-9])|([0-2][0-9])|(30)))|((2|02)[\/](([1-9])|([0-2][0-9]))))[\/]\d{4}$|^\d{4}$');
		}

        return {
            pre: function preLink(scope, iElement, iAttrs, controller) {  },
            post: function postLink(scope, iElement, iAttrs, controller) {
                $compile(iElement)(scope);
            }
        };
    }
};
 }])

 .directive('ssDisabled', ['$compile', function ($compile) {
     return {
         priority: 1000,
         terminal: true,
         compile: function (element, attr) {

             var format = attr["ssDisabled"];
             var field = attr["ngModel"];
             element.removeAttr('ss-disabled');
             if (false) {
                 element.attr('ng-disabled', 'application.host_name == "MAUD" || application.status_id != 1');
             }
             else {
                 element.attr('ng-disabled', 'application.status_id != 1');
             }
             return {
                 pre: function preLink(scope, iElement, iAttrs, controller) { },
                 post: function postLink(scope, iElement, iAttrs, controller) {
                     $compile(iElement)(scope);
                 }
             };
         }
     };
 }]);
