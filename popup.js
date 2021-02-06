var isFirefox = typeof InstallTrigger !== 'undefined',
	height = isFirefox ? 480 : 470,
	width = isFirefox ? 530 : 490,
	top = isFirefox ? 150 : 150,
	left = isFirefox ? 2500 : 2500;
var popupParams = "scrollbars=yes,resizable=yes,status=no,location=no,toolbar=no,menubar=no,width=" + width + ",height=" + height + ",top=" + top + ",left=" + left;
var popup, activeTab, serviceName, popupTimer;

//opens permanent popup on icon click
function openPopup(){
	var popup = window.open('/_locales/' + chrome.i18n.getMessage('directory') + '/videoskip.html#' + activeTab.id + '&' + serviceName,'popup', popupParams);
	popup.focus()
}

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
	clearTimeout(timer1); 
	if(request.message == "start_info"){				//reply from the content script
		var hasVideo = request.hasVideo;
		if(hasVideo){
			//load 2nd content script programmatically (needs activeTab permission)
			if(!request.isLoaded) chrome.tabs.executeScript({
				file: '/content2.js',
				allFrames: true
			});
			serviceName = request.serviceName;
			chrome.runtime.sendMessage({message: "are_you_there", serviceName: serviceName});	//ask if the window is already open
			popupTimer = setTimeout(function(){		//give some time for an existing popup to reply before opening a new one
				openPopup();							//opens separate window if there's a video
				noVideo.textContent = chrome.i18n.getMessage('popupOpen');
				setTimeout(window.close,5000)
			},100)	
		}else{
			noVideo.textContent = chrome.i18n.getMessage('noVideoMsg');
			exchangeText.textContent = chrome.i18n.getMessage('exchangeText');
			helpBtn.textContent = chrome.i18n.getMessage('helpLabel');
			exchange.style.display = 'block'
		}
		
	}else if(request.message == "im_here"){		//reply from existing popup
		clearTimeout(popupTimer);
		noVideo.textContent = chrome.i18n.getMessage(isFirefox ? 'popupOpenLeft' : 'popupOpen');		//repositioned window appears at left in Firefox
		setTimeout(window.close,5000)
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
		});
		if(isFirefox){
			chrome.tabs.executeScript({		//Firefox has trouble loading the content script in a one-two sequence, so load it all at once
				file: '/content2.js',
				allFrames: true
			})
		}
	})
	helpBtn.addEventListener('click', function(){
		window.open('/_locales/' + chrome.i18n.getMessage('directory') + '/help.html')
	})
	exchangeBtn.addEventListener('click', function(){
		window.open('https://videoskip.org/exchange')
	})
}

//display a message if there's no reply from the content script
var timer1 = setTimeout(function(){
	noVideo.textContent = chrome.i18n.getMessage('noVideoMsg');
	setTimeout(window.close,5000)
},100)