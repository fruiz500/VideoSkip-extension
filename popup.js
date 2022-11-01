        /*
		@source: https://github.com/fruiz500/VideoSkip-extension

        @licstart  The following is the entire license notice for the
        JavaScript code in this page.

        Copyright (C) 2022  Francisco Ruiz

        The JavaScript code in this page is free software: you can
        redistribute it and/or modify it under the terms of the GNU
        General Public License (GNU GPL) as published by the Free Software
        Foundation, either version 3 of the License, or (at your option)
        any later version.  The code is distributed WITHOUT ANY WARRANTY;
        without even the implied warranty of MERCHANTABILITY or FITNESS
        FOR A PARTICULAR PURPOSE.  See the GNU GPL for more details.

        As additional permission under GNU GPL version 3 section 7, you
        may distribute non-source (e.g., minimized or compacted) forms of
        that code without the copy of the GNU GPL normally required by
        section 4, provided you include this license notice and a URL
        through which recipients can access the Corresponding Source.


        @licend  The above is the entire license notice
        for the JavaScript code in this page.
        */

var isFirefox = typeof InstallTrigger !== 'undefined',
	height = isFirefox ? 525 : 480,
	width = isFirefox ? 530 : 490;

var tabId = '';

setTimeout(function(){
	startTab.innerHTML = chrome.i18n.getMessage('noVideo');
	helpBtn.addEventListener('click',function(){window.open('/_locales/' + chrome.i18n.getMessage('directory') + '/help.html')});
	exchangeBtn.addEventListener('click',function(){window.open('https://videoskip.org/exchange')})
},300);		//take a moment to load default info, in order to allow the injected script to respond

chrome.runtime.onMessage.addListener(
	function(request, sender, sendResponse) {
		if(request.message == "video_found"){				//reply from content1 script
			//load CSS and 2nd content script programmatically (needs activeTab permission)
			if(!request.isLoaded){
				chrome.scripting.insertCSS({
						target: {tabId: tabId},
						files: ['/content.css']
				});
				chrome.scripting.executeScript({
					target: {tabId: tabId},
					files: ['/content2.js']
				})
			}
			popText.textContent = chrome.i18n.getMessage('popupOpen');
			popText.style.display = 'block';
			startTab.style.display = 'none'
		}
	}
);

window.onload = function() {
	chrome.tabs.query({active: true, currentWindow: true, windowType: "normal"}, function(tabs) {
		tabId = tabs[0].id;

//load 1st content script programmatically (needs activeTab permission)
		chrome.scripting.executeScript({
			target: {tabId: tabId},
			files: ['/content1.js']
		})
	});
}
