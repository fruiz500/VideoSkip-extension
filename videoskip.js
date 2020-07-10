        /*
		@source: https://github.com/fruiz500/VideoSkip-extension

        @licstart  The following is the entire license notice for the
        JavaScript code in this page.

        Copyright (C) 2020  Francisco Ruiz

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

var name = '';								//global variable with name of skip file, minus extension
var cuts = [];				//global variable containing the cuts, each array element is an object with this format {startTime,endTime,text,action}
var activeTabId = parseInt(window.location.hash.slice(1));		//sent with this page's name as the window opens

var ua = navigator.userAgent.toLowerCase(); 		//to choose fastest filter method, per https://jsben.ch/5qRcU
if (ua.indexOf('safari') != -1) { 
  if (ua.indexOf('chrome') == -1){ var isSafari = true
  }else{ var isChrome = true
  }
}else if(typeof InstallTrigger !== 'undefined'){var isFirefox = true
}else if (document.documentMode || /Edge/.test(navigator.userAgent)){var isEdge = true
}

//loads the skips file
function loadFileAsURL(){
	var fileToLoad = skipFile.files[0],
		fileReader = new FileReader();
	fileReader.onload = function(fileLoadedEvent){
		var URLFromFileLoaded = fileLoadedEvent.target.result;
		var extension = fileToLoad.name.slice(-4);
		if(extension == ".skp"){
			var data = URLFromFileLoaded.split('data:image/jpeg;base64,');			//separate skips from screenshot
			name = fileToLoad.name.slice(0,-4);
			skipBox.value = data[0].trim();
			if(data[1]) screenShot.src = 'data:image/jpeg;base64,' + data[1];
		}else{
			boxMsg.textContent = chrome.i18n.getMessage('wrongFile')
		}
	};
	fileReader.readAsText(fileToLoad);
	boxMsg.textContent = chrome.i18n.getMessage('contentOfFile') + fileToLoad.name;
	setTimeout(function(){justLoaded = true;sendData();},1000)							//give it a whole second to load before data is extracted to memory and sent; also set switches
}

//loads the screen shot from file, if the direct take didn't work
function loadShot(){
	var fileToLoad = shotFile.files[0],
		fileReader = new FileReader();
	fileReader.onload = function(fileLoadedEvent){
		var URLFromFileLoaded = fileLoadedEvent.target.result;
		resizedShot(URLFromFileLoaded, 240)		//resize to standard height 240 px into screenshot, asynchronous function
	};
	if(fileToLoad){
		fileReader.readAsDataURL(fileToLoad);
		boxMsg.textContent = chrome.i18n.getMessage('shotLoaded')
	}else{
		boxMsg.textContent = chrome.i18n.getMessage('shotCanceled')
	}
}

// Takes a data URI and returns the Data URI corresponding to the resized image at the wanted size. by Pierrick Martellière at StackOverflow
function resizedShot(dataURIin, wantedHeight)		//width will be calculated to maintain aspect ratio
    {
        // We create an image to receive the Data URI
        var img = document.createElement('img');

        // When the event "onload" is triggered we can resize the image.
        img.onload = function()
            {        
                // We create a canvas and get its context.
                var canvas = document.createElement('canvas');
                var ctx = canvas.getContext('2d');

                // We set the dimensions at the wanted size.
				 var wantedWidth = wantedHeight * this.width / this.height;
                canvas.width = wantedWidth;
                canvas.height = wantedHeight;

                // We resize the image with the canvas method drawImage();
                ctx.drawImage(this, 0, 0, wantedWidth, wantedHeight);

                var dataURIout = canvas.toDataURL('image/jpeg');

                // Use and treat your Data URI here !! //
				screenShot.src = dataURIout
            };

        // We put the Data URI in the image's src attribute
        img.src = dataURIin;
    }

//to download data to a file, from StackOverflow
function download(data, filename, type) {
	var a = document.createElement("a");
	var file = new Blob([data], {"type": type}),
		url = URL.createObjectURL(file);
	a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function() {
       document.body.removeChild(a);
       window.URL.revokeObjectURL(url);  
    }, 0)
}

//to parse the content of the skip box in something close to .srt format, from StackOverflow
var PF_SRT = function() {
  //SRT format
  var pattern = /([\d:,.]+)\s*-+\>\s*([\d:,.]+)\s*\n([\s\S]*?(?=\n{2}|$))?/gm;		//no item number, can use decimal dot instead of comma, malformed arrows
  var _regExp;

  var init = function() {
    _regExp = new RegExp(pattern);
  };
  var parse = function(f) {
    if (typeof(f) != "string")
      throw "Sorry, the parser accepts only strings";

    var result = [];
    if (f == null)
      return _subtitles;

    f = f.replace(/\r\n|\r|\n/g, '\n')

    while ((matches = pattern.exec(f)) != null) {
      result.push(toLineObj(matches));
    }
    return result;
  }
  var toLineObj = function(group) {
    return {
      startTime: fromHMS(group[1]),			//load timings in seconds
      endTime: fromHMS(group[2]),
      text: group[3],
	  action: ''				//no action by default, to be filled later
    };
  }
  init();
  return {
    parse: parse
  }
}();

//to put seconds into hour:minute:second format
function toHMS(seconds) {
	var hours = Math.floor(seconds / 3600);
	seconds -= hours * 3600;
    var minutes = Math.floor(seconds / 60);
    minutes = (minutes >= 10) ? minutes : "0" + minutes;
    seconds = Math.floor((seconds % 60) * 100) / 100;			//precision is 0.01 s
    seconds = (seconds >= 10) ? seconds : "0" + seconds;
    return hours + ":" + minutes + ":" + seconds;
}
  
//the opposite: hour:minute:second string to decimal seconds
function fromHMS(timeString){
	timeString = timeString.replace(/,/,".");			//in .srt format decimal seconds use a comma
	var time = timeString.split(":");
	if(time.length == 3){							//has hours
		return parseInt(time[0])*3600 + parseInt(time[1])*60 + parseFloat(time[2])
	}else if(time.length == 2){					//minutes and seconds
		return parseInt(time[0])*60 + parseFloat(time[1])
	}else{											//only seconds
		return parseFloat(time[0])
	}
}

isSync = false;

//shift all times so the screenshot has correct timing in the video
function syncTimes(){
	isSync = true;
	chrome.tabs.sendMessage(activeTabId, {message: "need_time"});		//to be continued when the current time is received
	setTimeout(function(){makeTimeLabels()},100)
}

//puts data from the cuts array into skipBox
function times2box(){
	var text = '';
	for(var i = 0; i < cuts.length; i++){
		text += toHMS(cuts[i].startTime) + ' --> ' + toHMS(cuts[i].endTime) + '\n' + cuts[i].text + '\n\n'
	}
	skipBox.value = text.trim()
}

var isScrub = false;

//insert string in box, at cursor or replacing selection
function writeIn(string){
	var start = skipBox.selectionStart,
		end = skipBox.selectionEnd,
		newEnd = start + string.length;
	skipBox.value = skipBox.value.slice(0,start) + string + skipBox.value.slice(end,skipBox.length);
	if(isScrub){
		skipBox.setSelectionRange(start,newEnd)
	}else{
		skipBox.setSelectionRange(newEnd,newEnd);
	}
	setTimeout(function(){cuts = PF_SRT.parse(skipBox.value); setActions(); makeTimeLabels()},100);
	skipBox.focus()
}

//insert things in box
function writeTime(){
	isSync = false;
	chrome.tabs.sendMessage(activeTabId, {message: "need_time"})	
}

var isSilence = false;

//insert quick silence
function writeSilence(){
	isSilence = true;
	chrome.tabs.sendMessage(activeTabId, {message: "need_time"})
}

//called by forward button
function fwdSkip(){
	if(skipBox.selectionStart != skipBox.selectionEnd){							//there is a selection
		var index = getTimeIndex(),
			tol = 0.02;
		if(index != null){
			skipBox.setSelectionRange(timeLabels[1][index],timeLabels[2][index]);
			var selectedTime = fromHMS(timeLabels[0][index]);
			var timeShift = fineMode.checked ? 0.0417 : 0.417;
			chrome.tabs.sendMessage(activeTabId, {message: "shift_time", timeShift: timeShift, isSuper: isSuper});
			isScrub = true;
			chrome.tabs.sendMessage(activeTabId, {message: "need_time"});		
			skipBox.focus()
		}
	}else{											//scrub by a small amount
		var timeShift = fineMode.checked ? 0.0417 : 0.417;
		chrome.tabs.sendMessage(activeTabId, {message: "shift_time", timeShift: timeShift, isSuper: isSuper})
	}
}

//called by back button
function backSkip(){
	if(skipBox.selectionStart != skipBox.selectionEnd){							//there is a selection
		var index = getTimeIndex(),
			tol = 0.02;
		if(index != null){
			skipBox.setSelectionRange(timeLabels[1][index],timeLabels[2][index]);
			var selectedTime = fromHMS(timeLabels[0][index]);
			var timeShift = fineMode.checked ? 0.0417 : 0.417;
			chrome.tabs.sendMessage(activeTabId, {message: "shift_time", timeShift: - timeShift, isSuper: isSuper});
			isScrub = true;
			chrome.tabs.sendMessage(activeTabId, {message: "need_time"});
			skipBox.focus()
		}
	}else{											//scrub by a small amount
		var timeShift = fineMode.checked ? 0.0417 : 0.417;
		chrome.tabs.sendMessage(activeTabId, {message: "shift_time", timeShift: - timeShift, isSuper: isSuper})
	}
}

//scrub to first time in the box, unless a time is selected
function scrub2shot(){
	var index = getTimeIndex();
	if(index != null){
		skipBox.setSelectionRange(timeLabels[1][index],timeLabels[2][index]);
		chrome.tabs.sendMessage(activeTabId, {message: "change_time", time: fromHMS(timeLabels[0][index]), isSuper: isSuper})
		skipBox.focus()
	}else{											//scrub to 1st time
		chrome.tabs.sendMessage(activeTabId, {message: "change_time", time: fromHMS(timeLabels[0][0]), isSuper: isSuper})	
	}
}

var isSuper = false;

//put the screenshot on top of the video so a perfect match can be found, and back
function toggleTopShot(){
	if(isSuper){
		isSuper = false;
		chrome.tabs.sendMessage(activeTabId, {message: "superimpose", status: false})
	}else{
		isSuper = true;
		chrome.tabs.sendMessage(activeTabId, {message: "superimpose", status: true, dataURI: screenShot.src})		
	}
}

var timeLabels = [];

//remakes array timeLabels containing HMS times, plus their positions in the box [HMS time, start, end]
function makeTimeLabels(){
	timeLabels = [[],[],[]];						//string, startPosition, endPosition
	var	text = skipBox.value,
		string, start, end = 0;
	var matches = text.match(/\d+[\d:.]+/g);
	if(matches){
		for(var i = 0; i < matches.length; i++){
			string = matches[i];
			timeLabels[0][i] = string;
			start = text.indexOf(string,end)
			timeLabels[1][i] = start;
			end = start + string.length;
			timeLabels[2][i] = end
		}
	}
	if(isSuper) toggleTopShot()
}

var switches = [false,false,false,false,false,false];

//record position of content switches
function recordSwitches(){
	var boxes = checkBoxes.querySelectorAll('input');
	for(var i = 0; i < boxes.length; i++){
		switches[i] = boxes[i].checked
	}
}

//gets index of a particular HMS time in the box, by location; returns null if the cursor is not on a time label
function getTimeIndex(){
	var start = skipBox.selectionStart,
		end = skipBox.selectionEnd;
	for(var i = 0; i < timeLabels[0].length; i++){
		if(timeLabels[1][i] <= start && timeLabels[2][i] >= end) return i
	}
}

//request screenshot
function takeShot(){
	chrome.tabs.sendMessage(activeTabId, {message: "need_shot", needTime: true})
}

var justLoaded = false;		//for setting switches on file load

//send settings to the content script
function sendData(){
	cuts = PF_SRT.parse(skipBox.value);
	if(justLoaded) setSwitches();
	justLoaded = false;
	setActions();
	recordSwitches();
	chrome.tabs.sendMessage(activeTabId, {message: "skip_data", cuts: cuts, switches: switches});
	makeTimeLabels()
}

//to move and resize superimposed shot
document.onkeydown = checkKey;

function checkKey(e) {
  if(isSuper){								//this only works when a screenshot is superimposed on the video
    e = e || window.event;					
        if (e.keyCode == '38') {			//shifted combinations resize, unshifted moves, hold Alt for fine movement
        // up arrow
			chrome.tabs.sendMessage(activeTabId, {message: "move_shot", isSize: e.altKey, dir: 'up', isFine: e.shiftKey})
        }
        else if (e.keyCode == '40') {
        // down arrow
			chrome.tabs.sendMessage(activeTabId, {message: "move_shot", isSize: e.altKey, dir: 'down', isFine: e.shiftKey})			
        }
        else if (e.keyCode == '37') {
       // left arrow
			chrome.tabs.sendMessage(activeTabId, {message: "move_shot", isSize: e.altKey, dir: 'left', isFine: e.shiftKey})
        }
        else if (e.keyCode == '39') {
       // right arrow
			chrome.tabs.sendMessage(activeTabId, {message: "move_shot", isSize: e.altKey, dir: 'right', isFine: e.shiftKey})
        }
  }
}

skipFile.addEventListener('change', loadFileAsURL);

exchangeBtn.addEventListener('click', function(){window.open('https://videoskip.org/exchange')});

shotFile.addEventListener('change', loadShot);

timeBtn.addEventListener('click', writeTime);

arrowBtn.addEventListener('click', function(){writeIn(' --> ')});

beepBtn.addEventListener('click', writeSilence);

help.addEventListener('click', function(){window.open('help.html')});

saveFile.addEventListener('click', function(){
	if(!name) name = prompt('Enter the file name. Extension .skp wil be added');
	download(skipBox.value + '\n' + screenShot.src, name + '.skp', "text/plain");	
	boxMsg.textContent = chrome.i18n.getMessage('fileSaved') + name + '.skp'
})

skipBox.addEventListener('change', sendData);

checkBoxes.addEventListener('change', sendData);

shotBtn.addEventListener('click',takeShot);

shotFileBtn.style.display = 'none';

fwdBtn.addEventListener('click',fwdSkip);

fFwdBtn.addEventListener('click',function(){
	skipBox.selectionStart = skipBox.selectionEnd;		//clear selection, if any
	skipBox.focus();
	chrome.tabs.sendMessage(activeTabId, {message: "fast_toggle"})
});

backBtn.addEventListener('click',backSkip);

shotTimeBtn.addEventListener('click',scrub2shot);

moveBtn.addEventListener('click',toggleTopShot);

syncBtn.addEventListener('click',syncTimes);

//faster way to check for content depending on browser; returns a Boolean; regex and stringArray content should match
function isContained(containerStr, regex){
	var result = false;
	if(isFirefox){
		result = containerStr.search(regex) != -1
	}else if(isSafari || isEdge || isChrome){								//below this won't be used in the extension, but left to see
		result = regex.test(containerStr)
	}else{
		result = !!containerStr.match(regex)
	}
	return result
}

//to decide whether a particular content is to be skipped, according to check boxes. Allows alternative and incomplete keywords
function isSkipped(label){
	if(isContained(label,/sex|nud/) && sexMode.checked){
		return true
	}else if(isContained(label,/vio|gor/) && violenceMode.checked){
		return true
	}else if(isContained(label,/pro|cur|hat/) && curseMode.checked){
		return true
	}else if(isContained(label,/alc|dru|smo/) && boozeMode.checked){
		return true
	}else if(isContained(label,/fri|sca|int/) && scareMode.checked){
		return true
	}else if(isContained(label,/oth|bor/) && otherMode.checked){
		return true
	}else{
		return false
	}
}

//set switches for edits present in skip file; used only when a file is loaded
function setSwitches(){
	var boxes = checkBoxes.querySelectorAll('input');
	for(var i = 0; i < 6; i++) boxes[i].checked = false;
	for(var i = 0; i < cuts.length; i++){
		var label = cuts[i].text.toLowerCase().replace(/\(.*\)/g,'');						//ignore text in parentheses
		sexMode.checked = sexMode.checked || isContained(label,/sex|nud/);
		violenceMode.checked = violenceMode.checked || isContained(label,/vio|gor/);
		curseMode.checked = curseMode.checked || isContained(label,/pro|cur|hat/);
		boozeMode.checked = boozeMode.checked || isContained(label,/alc|dru|smo/);
		scareMode.checked = scareMode.checked || isContained(label,/fri|sca|int/);
		otherMode.checked = otherMode.checked || isContained(label,/oth|bor/)
	}
}

//fills the action field in object cuts, according to the position of the check boxes and the text at each time
function setActions(){
	for(var i = 0; i < cuts.length; i++){
		var label = cuts[i].text.toLowerCase().replace(/\(.*\)/g,''),						//ignore text in parentheses
			isAudio = isContained(label,/aud|sou|spe|wor/),
			isVideo = isContained(label,/vid|ima|img/);
		if(!isAudio && !isVideo){
			cuts[i].action = isSkipped(label) ? 'skip' : ''	
		}else if(isAudio){
			cuts[i].action = isSkipped(label) ? 'mute' : ''
		}else{
			cuts[i].action = isSkipped(label) ? 'blank' : ''
		}
	}
}

//to get the time from the content script
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
	 
    if(request.message == "video_time") {
		if(isSync){																						//re-sync all times
			var	initialData = skipBox.value.trim().split('\n').slice(0,2),					//first two lines
				shotTime = fromHMS(initialData[0]),
				seconds = shotTime ? request.time - shotTime : 0;
			for(var i = 0; i < cuts.length; i++){
				cuts[i].startTime += seconds;
				cuts[i].endTime += seconds
			}
			times2box();										//put shifted times in the box
	
			if(shotTime != null){										//reconstruct initial data, if present
				initialData[0] = toHMS(shotTime + seconds);
				skipBox.value = initialData.join('\n') + '\n\n' + skipBox.value
			}
			if(seconds >= 0){
				boxMsg.textContent = chrome.i18n.getMessage('delayed') + Math.floor(seconds*100)/100 + chrome.i18n.getMessage('seconds')
			}else{
				boxMsg.textContent = chrome.i18n.getMessage('advanced') + Math.floor(- seconds*100)/100 + chrome.i18n.getMessage('seconds')
			}
			setTimeout(function(){makeTimeLabels()},100)
			
		}else if(isSilence){																	//insert single-word silence
			writeIn(toHMS(request.time - 0.7) + ' --> ' + toHMS(request.time) + '\nprofane word\n\n');
			isSilence = false

		}else{																		//just put it in box
			writeIn(toHMS(request.time))
		}
		
	}else if(request.message == "video_shot"){
		if(request.dataURI){
			screenShot.src = request.dataURI
		}else{
			boxMsg.textContent = chrome.i18n.getMessage('badService');
			shotFileBtn.style.display = ''
		}
		writeIn(toHMS(request.time));						//insert time regardless
		setTimeout(function(){makeTimeLabels()},100)
	}
  }
)