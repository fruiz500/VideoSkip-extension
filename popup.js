//recognize browser
var	isChrome = navigator.userAgent.toLowerCase().indexOf('chrome') > -1,
	isFirefox = typeof InstallTrigger !== 'undefined';

var popupParams = "scrollbars=yes,resizable=yes,status=no,location=no,toolbar=no,menubar=no,width=960,height=600,top=150,left=1000";
var popup, activeTab;
	
//opens permanent popup on icon click
function openPopup(){
	if(isFirefox){
		popup = chrome.windows.create({url:'videoskip.html#' + activeTab.id, width:980, height:670, type:'popup'})
	}else{
		popup = window.open('videoskip.html#' + activeTab.id,'controlPanel',popupParams)
	}
}

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {	  
	if(request.message == "start_info"){				//reply from the content script
		var hasVideo = request.hasVideo;
		if(hasVideo){
			openPopup();							//opens separate window if there's a video 
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
		chrome.tabs.sendMessage(activeTab.id, {message: "start"})		//tell content script to look for videos and report
	})
}