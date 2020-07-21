// this script executes as soon as the browser action button is clicked
var myVideo = null;

//returns true if an element is visible.
function isVisible (ele) {
	return (ele.offsetWidth > 0 && ele.offsetHeight > 0) && (ele.style.visibility != 'hidden')
}

var myVideos = document.querySelectorAll("video");			//get all videos on page, stick with the first one that is visible
for(var i = 0; i < myVideos.length; i++){
	if(isVisible(myVideos[i])){
		myVideo = myVideos[i];
		break
	}
}

chrome.runtime.sendMessage({message: "start_info", hasVideo: !!myVideo, isLoaded: typeof(blankSubs) != "undefined"})		//just a Boolean confirming there's a video, so the popup loads, the second part is to avoid injecting the rest of the content script multiple times

if(!!myVideo){													//add overlay image for superimpose function
	myVideo.crossOrigin = 'anonymous';		//in case it helps
	var superimpose = false,									//flag for sending image when superimposing a screenshot
	VideoSkipShot = document.createElement('img');
	VideoSkipShot.style.position = 'absolute';
	VideoSkipShot.style.top = myVideo.style.top | 0;
	VideoSkipShot.style.left = myVideo.style.left | 0;
	VideoSkipShot.style.opacity = '50%';
	VideoSkipShot.style.zIndex = myVideo.style.zIndex + 1 | 1;
	VideoSkipShot.style.display = 'none';
	myVideo.parentNode.insertBefore(VideoSkipShot,myVideo);
	
	var VideoSkipControl = document.createElement('span');			//to display filter settings on fullscreen
	VideoSkipControl.style.position = 'absolute';
	VideoSkipControl.style.top = (myVideo.offsetTop + 200) + 'px';
	VideoSkipControl.style.left = (myVideo.offsetLeft + 200) + 'px';
	VideoSkipControl.style.zIndex = myVideo.style.zIndex + 1 | 1;
	VideoSkipControl.style.display = 'none';
	VideoSkipControl.textContent = "This is the control";
	VideoSkipControl.style.fontSize = "xx-large";
	VideoSkipControl.style.color = "white";
	VideoSkipControl.style.fontFamily = "sans-serif";
	VideoSkipControl.style.backgroundColor = "rgba(0, 0, 0, 0.33)";
	VideoSkipControl.style.zIndex = "999";
	myVideo.parentNode.insertBefore(VideoSkipControl,myVideo);
}