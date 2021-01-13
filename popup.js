var isFirefox = typeof InstallTrigger !== 'undefined',
	height = isFirefox ? 400 : 380;
var popupParams = "scrollbars=yes,resizable=yes,status=no,location=no,toolbar=no,menubar=no,width=" + chrome.i18n.getMessage('width') +",height=" + height + ",top=150,left=2500";
var popup, activeTab, serviceName;

//opens permanent popup on icon click
function openPopup(){
	var popup = window.open('/_locales/' + chrome.i18n.getMessage('directory') + '/videoskip.html#' + activeTab.id + '&' + serviceName,'popup', popupParams);
	popup.focus()
}

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {	  
	if(request.message == "start_info"){				//reply from the content script
		var hasVideo = request.hasVideo;
		if(hasVideo){
			serviceName = request.serviceName;
			openPopup();							//opens separate window if there's a video
//load 2nd content script programmatically (needs activeTab permission)
			if(!request.isLoaded) chrome.tabs.executeScript({
				file: '/content2.js',
				allFrames: true
			})
			window.close()
		}else{
			noVideo.style.display = ''
		}
	}
  }
);

window.onload = function() {
	chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    	activeTab = tabs[0];
//load 1st content script programmatically (needs activeTab permission)
		chrome.tabs.executeScript({
			file: '/content1.js',
			allFrames: true
		})
		if(isFirefox){
			chrome.tabs.executeScript({		//Firefox has trouble loading the content script in a one-two sequence, so load it all at once
				file: '/content2.js',
				allFrames: true
			})
		}
	})
}