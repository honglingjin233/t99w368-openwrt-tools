'use strict';
'require view';

return view.extend({
	render: function() {
		window.location.replace('/luci-static/modem5g/index.html');
		return '';
	}
});
