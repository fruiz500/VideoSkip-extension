var isFirefox = typeof InstallTrigger !== 'undefined',
	height = isFirefox ? 480 : 470;
	width = isFirefox ? 510 : 470;
var popupParams = "scrollbars=yes,resizable=yes,status=no,location=no,toolbar=no,menubar=no,width=" + width + ",height=" + height + ",top=0,left=0";
var popup, activeTab, serviceName, popupTimer;

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
			chrome.runtime.sendMessage({message: "are_you_there", serviceName: serviceName});	//ask if the window is already open
			popupTimer = setTimeout(function(){		//give some time to an existing popup to reply before opening a new one
				openPopup();							//opens separate window if there's a video
//load 2nd content script programmatically (needs activeTab permission)
				if(!request.isLoaded) chrome.tabs.executeScript({
					file: '/content2.js',
					allFrames: true
				})
				window.close()
			},100)
		}else{
			noVideo.textContent = chrome.i18n.getMessage('noVideoMsg');
			setTimeout(window.close,3000)
		}
		
	}else if(request.message == "popup_open"){		//reply from existing popup
		clearTimeout(popupTimer);
		noVideo.textContent = chrome.i18n.getMessage('popupOpen');
		setTimeout(window.close,3000)
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