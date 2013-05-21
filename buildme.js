(function(){var t="undefined"!=typeof window?window:exports,r="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",n=function(){try{document.createElement("$")}catch(t){return t}}();t.btoa||(t.btoa=function(t){for(var o,e,a=0,c=r,f="";t.charAt(0|a)||(c="=",a%1);f+=c.charAt(63&o>>8-8*(a%1))){if(e=t.charCodeAt(a+=.75),e>255)throw n;o=o<<8|e}return f}),t.atob||(t.atob=function(t){if(t=t.replace(/=+$/,""),1==t.length%4)throw n;for(var o,e,a=0,c=0,f="";e=t.charAt(c++);~e&&(o=a%4?64*o+e:e,a++%4)?f+=String.fromCharCode(255&o>>(6&-2*a)):0)e=r.indexOf(e);return f})})();

(function(global,$){

	function buildit() {
		var src = $source.val();
		src = btoa(src);
		$showmeurl.val("http://getify.github.io/showme.html?data:text/html;charset=utf-8;base64," + src);
	}

	var $source, $showmeurl;

	$(document).ready(function(){
		$source = $("#source");
		$showmeurl = $("#showmeurl");

		$("#buildit").click("click",buildit);
	});

})(window,jQuery);
