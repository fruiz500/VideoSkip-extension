// this script is injected and executes as soon as the browser action button is clicked
let myVideo = null;
let adSeconds = 0;
const isFirefox = typeof InstallTrigger !== 'undefined';
const VSheight = isFirefox ? 0 : 0;
const VSwidth = isFirefox ? 540 : 540;

// Declare UI components globally so addInterface and content2.js can access them
let VSinterface = document.getElementById('VSbox');
let VSlogo = VSinterface ? VSinterface.querySelector('img') : null;
let VScontrol = VSinterface ? VSinterface.lastElementChild : null;
let VSshot = document.getElementById('VSshot');
let VSstatus = document.getElementById('VSstatus');
let VSblurBox = document.getElementById('VSblurBox');

//returns true if an element is visible.
function isVisible(ele) {
    return (ele.offsetWidth > 0 && ele.offsetHeight > 0) && (ele.style.visibility != 'hidden');
}

const host = window.location.hostname;
let serviceName;
if (host == 'localhost') {        //this is a local file, so we can't get the host
    serviceName = 'local';
} else {
    const splitName = host.split('.');								//get the main name of the source
    if (splitName.length > 3) {									//numeric IP address or subdomain
        serviceName = 'IPnumber';
    } else {
        serviceName = splitName[splitName.length - 2] == 'co' ? splitName[splitName.length - 3] : splitName[splitName.length - 2];
    }
}

//find the video on the page proper, or inside 1st-level iframes
const myVideos = [];
myVideos.push(document.querySelectorAll("video"));			//top level
const iframes = document.querySelectorAll("iframe");
for (let i = 0; i < iframes.length; i++) {				//look into each iframe, only one level down
    try {
        myVideos.push(iframes[i].contentWindow.document.querySelectorAll('video'));		//this will give an error is the iframe is crossorigin, hence the try statement
    } catch (err) { }
}

//filter only the videos that are visible
const visibleVideos = [];
for (let i = 0; i < myVideos.length; i++) {
    for (let j = 0; j < myVideos[i].length; j++) {
        if (isVisible(myVideos[i][j])) {
            visibleVideos.push(myVideos[i][j]);
        }
    }
}
let mySubtitles;
if (visibleVideos.length > 0) {
    myVideo = visibleVideos[visibleVideos.length - 1];		//select last video that is theoretically visible (Amazon Prime fix)
    if (serviceName == 'apple' || serviceName == 'disneyplus') mySubtitles = myVideo.nextSibling;    //apple does not use a special class for subtitles, neither did Disney+ originally
}

//things that won't load well from the 2nd content script

if (!!myVideo) {													//add overlay image for superimpose function
    myVideo.crossOrigin = 'anonymous';						//in case it helps

    //function to adjust for ad times
    function trueTime() {
        return (badAds.indexOf(serviceName) != -1) ? myVideo.currentTime - adSeconds : myVideo.currentTime;
    }

    //apply skips to video when it gets to them. THIS IS THE HEART OF THE EXTENSION

    // High-performance cut evaluation loop supporting nested/non-sequential cuts
    function checkVideoCuts() {
        if (typeof (cuts) == "undefined" || !cuts || cuts.length === 0) return;

        let action = '', tempAction = '';
        const currentTime = trueTime();

        // Evaluate all cuts to properly handle nesting and overlaps
        for (let i = 0; i < cuts.length; i++) {
            const startTime = cuts[i].startTime;
            const endTime = cuts[i].endTime;

            if (currentTime > startTime && currentTime < endTime) {
                tempAction = cuts[i].action;
            } else {
                tempAction = '';
            }

            if (tempAction == 'skip') {
                action = 'skip';
                break; // 'skip' takes absolute priority over everything else, so we can stop here
            } else if (tempAction == 'fast') {
                action = (action == 'skip') ? 'skip' : 'fast';
            } else if (tempAction.includes('blank')) {
                action = ((action == 'skip') || (action == 'fast')) ? action : tempAction;
            } else if (tempAction.includes('blur')) {
                action = ((action == 'skip') || (action == 'fast') || (action == 'blank')) ? action : tempAction;
            } else if (tempAction == 'mute') {
                action += 'mute';
            }
        }

        // Subtitle handling
        if (action.includes('mute')) {
            blankSubs(true);
        } else {
            blankSubs(false);
        }

        // Apply visual and playback state changes ONLY when the action state changes
        if (action != prevAction) {
            if (action == 'skip' || action == 'skipmute') {
                goToTime(endTime);
            } else if (action == 'blank' || action == 'blankmute') {
                myVideo.style.opacity = 0;
            } else if (action.includes('blank')) {
                const position = action.match(/\[.*\]/);
                if (position) moveBlurBox(JSON.parse(position[0]));
                VSblurBox.style.backgroundColor = 'black';
            } else if (action == 'blur' || action == 'blurmute') {
                myVideo.style.filter = 'blur(20px)';
            } else if (action.includes('blur')) {
                const position = action.match(/\[.*\]/);
                if (position) moveBlurBox(JSON.parse(position[0]));
                if (serviceName == 'amazon') VSblurBox.style.backgroundColor = 'black';
                isBlur = true;
            } else if (action == 'fast' || action == 'fastmute') {
                myVideo.playbackRate = 16;
            } else {
                myVideo.style.opacity = '';
                myVideo.style.filter = '';
                myVideo.playbackRate = 1;
                VSblurBox.style.display = 'none';
                isBlur = false;
            }
            prevAction = action;
        }

        // Volume management
        const targetVolume = action.includes('mute') ? 0 : 1;
        if (myVideo.volume != targetVolume) {
            myVideo.volume = targetVolume;
        }
    }

    function startPrecisionLoop() {
        checkVideoCuts();
        if (!myVideo.paused) {
            requestAnimationFrame(startPrecisionLoop);
        }
    }

    myVideo.addEventListener('play', startPrecisionLoop);
    myVideo.addEventListener('seeked', checkVideoCuts);

    //puts interface at end of body DOM, except for Apple
    function addInterface() {
        document.body.appendChild(VSinterface);					//not necessarily next to the video
    }

    //things that won't load well from the 2nd content script

    if (!VSinterface) {										//this is the interface, containing a clickable logo, and the interface proper
        VSinterface = document.createElement('div');
        VSinterface.id = 'VSbox';
        VSinterface.style.position = 'fixed';
        VSinterface.style.top = '130px';
        VSinterface.style.left = (serviceName == "netflix" ? 0 : myVideo.offsetLeft) + myVideo.offsetWidth - VSwidth + 'px';
        VSinterface.style.zIndex = '2147483647';
        VSinterface.style.width = VSwidth + 'px';
        VSinterface.style.height = VSheight + 'px';
        VSinterface.style.fontSize = '12px';

        VSlogo = document.createElement('img');					//clickable logo
        VSlogo.src = chrome.runtime.getURL('/img/icon64.png');
        VSlogo.title = chrome.i18n.getMessage('VSlogo');
        VSlogo.style.display = 'none';
        VSlogo.style.position = 'absolute';
        VSlogo.style.top = '73px';
        VSlogo.style.left = VSwidth - 94 + 'px';
        VSlogo.style.zIndex = '2';
        VSlogo.style.height = 'auto';
        VSinterface.appendChild(VSlogo);

        VScontrol = document.createElement('div');				//this is the interface proper
        VScontrol.style.position = 'absolute';
        VScontrol.style.top = 0;
        VScontrol.style.left = 0;
        VScontrol.frameBorder = 0;
        VScontrol.style.width = '100%';
        VScontrol.style.height = '100%';

        // Modernized asynchronous fetch loading wrapper
        (async function () {
            try {
                const response = await fetch(chrome.runtime.getURL('/_locales/' + chrome.i18n.getMessage('directory') + '/interface.html'));
                if (response.ok) {
                    VScontrol.innerHTML = await response.text();
                    VSinterface.appendChild(VScontrol);

                    if (serviceName == 'amazon') {		//this one closer to the video, because amazon won't show it otherwise
                        myVideo.closest(".atvwebplayersdk-video-surface").appendChild(VSshot);
                        myVideo.closest(".atvwebplayersdk-video-surface").appendChild(VSblurBox);
                    }

                    addInterface();                     //not necessarily close to the video; being at the end tends to be on top

                    //now tell the popup to inject the CSS and the rest of the script
                    chrome.runtime.sendMessage({ message: "video_found", isLoaded: typeof (blankSubs) != "undefined" }, function (response) { void chrome.runtime.lastError; });
                }
            } catch (error) {
                console.error("VideoSkip: Failed to load interface via fetch", error);
            }
        })();
    } else {
        chrome.runtime.sendMessage({ message: "video_found", isLoaded: typeof (blankSubs) != "undefined" }, function (response) { void chrome.runtime.lastError; });
    }

    if (!VSshot) {
        VSshot = document.createElement('img');				//superimposed screenshot
        VSshot.id = 'VSshot';
        VSshot.style.position = 'absolute';
        VSshot.style.top = myVideo.style.top | 0;
        VSshot.style.left = myVideo.style.left | 0;
        VSshot.style.opacity = '50%';
        VSshot.style.zIndex = myVideo.style.zIndex + 1 | 1;
        VSshot.style.display = 'none';
        if (serviceName != 'amazon') myVideo.parentNode.insertBefore(VSshot, myVideo);
    }

    if (!VSstatus) {
        VSstatus = document.createElement('span');			//to display filter settings on fullscreen
        VSstatus.id = 'VSstatus';
        VSstatus.style.position = 'absolute';
        VSstatus.style.zIndex = myVideo.style.zIndex + 2 | 2;
        VSstatus.style.display = 'none';
        VSstatus.textContent = "This is the status";
        VSstatus.style.fontSize = "xx-large";
        VSstatus.style.color = "white";
        VSstatus.style.fontFamily = "sans-serif";
        VSstatus.style.backgroundColor = "rgba(0, 0, 0, 0.33)";
        myVideo.parentNode.insertBefore(VSstatus, myVideo);
    }

    if (!VSblurBox) {
        VSblurBox = document.createElement('div');			//for local blur and blank
        VSblurBox.id = 'VSblurBox';
        VSblurBox.style.position = 'absolute';
        VSblurBox.style.zIndex = myVideo.style.zIndex + 2 | 2;
        VSblurBox.style.border = "none";
        VSblurBox.style.borderRadius = "500px";
        VSblurBox.style.overflow = "overlay";
        if (serviceName == 'amazon') {
            VSblurBox.style.backgroundColor = 'black';
        } else {
            VSblurBox.style.backdropFilter = "blur(20px)";
        }
        if (serviceName != 'amazon') myVideo.parentNode.insertBefore(VSblurBox, myVideo);
    }

    if (typeof (openPanel) != "undefined") openPanel();

}

"end of injected content1"		//add this so it becomes the "result" of the injected code and Firefox is happy