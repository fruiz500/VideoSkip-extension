const isFirefox = typeof InstallTrigger !== 'undefined',
	height = isFirefox ? 490 : 470,
	width = isFirefox ? 530 : 490;
const popupParams = "scrollbars=yes,resizable=yes,status=no,location=no,toolbar=no,menubar=no,width=" + width + ",height=" + height + ",top=100,left=2500";
var activeTab, serviceName;

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
	if(request.message == "start_info"){				//reply from the content script
		var hasVideo = request.hasVideo;
		if(hasVideo){
			//load 2nd content script programmatically (needs activeTab permission)
			if(!request.isLoaded) chrome.tabs.executeScript({
				file: '/content2.js',
				allFrames: true
			});
			serviceName = request.serviceName;
		}
		setTimeout(function(){
		  chrome.runtime.sendMessage({message: "page_data", serviceName: serviceName, activeTabId: activeTab.id});		//send info to open window

		  if(isFirefox){		//Firefox needs to get the serviceName from the window url the 1st time, because it closes the popup
			if(serviceName){
				window.open('/_locales/' + chrome.i18n.getMessage('directory') + '/videoskip.html#' + activeTab.id + '&' + serviceName,'VSwindow', popupParams).focus();
			}else{
				window.open('/_locales/' + chrome.i18n.getMessage('directory') + '/videoskip.html#' + activeTab.id,'VSwindow', popupParams).focus();
			}
		  }
		},500)			//timed so VSwindow has time to load and get the message
	}
  }
);

window.onload = function() {
	chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    	activeTab = tabs[0];

//open VSwindow. The delay somehow is needed so the focus takes hold. New window created only if closed previously
		setTimeout(function(){
			window.open('/_locales/' + chrome.i18n.getMessage('directory') + '/videoskip.html#' + activeTab.id,'VSwindow', popupParams).focus();
		},400);
		popText.textContent = chrome.i18n.getMessage('popupOpen');

//load 1st content script programmatically (needs activeTab permission) Firefox sometimes throws an error, hence the try block
	try{
		chrome.tabs.executeScript({
			file: '/content1.js',
			allFrames: true
		});
		if(isFirefox && typeof subsClasses == "undefined"){
			chrome.tabs.executeScript({		//Firefox has trouble loading the content script in a one-two sequence, so load it all at once
				file: '/content2.js',
				allFrames: true
			})
		}
	}catch(err){								//show error message after other messages
		setTimeout(function(){
			popText.textContent = chrome.i18n.getMessage('firefoxError')
		},500)
	}
	});
	setTimeout(window.close,10000)
}